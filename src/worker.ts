// worker.ts
const path = require('path');

import { randomUUID } from 'crypto';
import { Worker, parentPort, workerData } from 'node:worker_threads';

import { parse } from 'pgsql-parser';

import { Paginator } from './paginator';
import { DuckDBBackend } from './duckdb-backend';
import { DuckDBPaginator } from './duckdb-paginator';
import { createHeadersFromData, replacePeriodWithUnderscoreInKey } from './util';
import { Action, BackendName, MessageType, RequestSource, TableName, QueryStatement } from './constants';

class BackendWorker {
  dataPaginator: Paginator;
  queryResultPaginator: Paginator;
  backend: DuckDBBackend;
  isInitialized: boolean = false;

  private constructor(backend: DuckDBBackend) {
    this.backend = backend;
  }

  static async create(path: string) {
    const backend = await DuckDBBackend.createAsync(path);
    await backend.initialize();
    return new BackendWorker(backend);
  }

  async initializeDataPaginator(){
    console.log("initializeDataPaginator()");
    const queryResult = await this.backend.query(
      `SELECT COUNT(*) AS count FROM ${TableName.data}`
    );
    const dataCount = Number(queryResult[0]['count']);
    const readFromFile = false;
    this.dataPaginator = new DuckDBPaginator(
      this.backend,
      TableName.data,
      dataCount,
      readFromFile
    );
  }

  async getQueryResultPage(message: any) {
    return this.getPage(message, this.queryResultPaginator);
  }

  async getDataPage(message: any) {
    return this.getPage(message, this.dataPaginator);
  }

  async getPage(message: any, paginator: Paginator) {
    console.log(`getPage(${message})`);
    console.log(message);
    let result;
    if (message.action === Action.nextPage) {
      result = await paginator.nextPage(message.pageSize);
    } else if (message.action === Action.prevPage) {
      result = await paginator.previousPage(message.pageSize);
    } else if (message.action === Action.firstPage) {
      result = await paginator.firstPage(message.pageSize);
    } else if (message.action === Action.lastPage) {
      result = await paginator.lastPage(message.pageSize); 
    } else if (message.action === Action.goToPage) {
      result = await paginator.gotoPage(message.pageNumber, message.pageSize);
    } else if (message.action === Action.currentPage) {
      result = await paginator.getCurrentPage(message.pageSize);
    } else {
      throw Error(`Unknown message action: ${message.action}`);
    }

    const values = replacePeriodWithUnderscoreInKey(result);
    const headers = createHeadersFromData(values);

    return {
      headers: headers,
      result: values,
      rowCount: paginator.getTotalItems()
    };
  }

  formatQueryString(query: string): string {
    const pattern = /FROM data/i;
    
    if (!pattern.test(query)) {
        throw new Error("Query string must contain 'FROM data'");
    }
    
    return query.replace(pattern, `FROM read_parquet('${this.backend.filePath}')`);
  }

  async query(msg: any){
    // Parse query into AST
    const asts = parse(msg.query);
    if (asts.length > 1) {
      throw Error("Only one SQL statement is allowed.");
    }

    // TODO: check if correct table is being queried.
    const statement = asts[0]["RawStmt"]["stmt"];
    const statementType = Object.keys(statement)[0];

    const allowedStatements = [
      "InsertStmt",
      "UpdateStmt",
      "DeleteStmt",
      "SelectStmt"
    ];
    
    if (!(allowedStatements.indexOf(statementType) > - 1)) {
      throw Error("This statement is not allowed in this extension.");
    }

    let query = '';
    if (!this.isInitialized){
      // Read from file
      if (!("SelectStmt" in statement)) {
        throw Error("Data manipulation only possible when data is loaded into memory.");
      }
      else {
        query = this.formatQueryString(msg.query);
      }
    } else {
      query = msg.query;
    }
    
    if (!("SelectStmt" in statement)) {
      await this.backend.query(query);
      await this.initializeDataPaginator();
      return {
        headers: [],
        result: [],
        rowCount: 0
      };
    }

    await this.backend.query(`DROP TABLE IF EXISTS query_result`);
    // console.log("table dropped");

    await this.backend.query(
        `CREATE TABLE ${TableName.queryResult} AS 
            ${query}
        `
    );
    // console.log("ctas query done");

    const queryResult = await this.backend.query(
        `SELECT COUNT(*) AS count FROM ${TableName.queryResult}`
    );
    const queryResultCount = Number(queryResult[0]['count']);

    const readFromFile = false;
    this.queryResultPaginator = new DuckDBPaginator(
        this.backend, 
        TableName.queryResult, 
        queryResultCount,
        readFromFile
    );

    const result = await (this.queryResultPaginator.firstPage(msg.pageSize));
    const values = replacePeriodWithUnderscoreInKey(result);
    const headers = createHeadersFromData(values);

    return {
      headers: headers,
      result: values,
      rowCount: queryResultCount
    };
  }

  async exportQueryResult(exportType: string) {
    const parsedPath = path.parse(this.backend.filePath);
    const id: string = randomUUID();

    let query = '';
    let newPath = '';
    if (exportType === 'csv') {
      parsedPath.base = `${parsedPath.name}-${id}.csv`;
      newPath = path.format(parsedPath);
      query = `COPY ${TableName.queryResult} TO '${newPath}' WITH (HEADER, DELIMITER ',');`;
    }
    else if (exportType === 'json') {
      parsedPath.base = `${parsedPath.name}-${id}.json`;
      newPath = path.format(parsedPath);
      query = `COPY ${TableName.queryResult} TO '${newPath}' (FORMAT JSON, ARRAY true);`;
    }
    else if (exportType === 'ndjson') {
      parsedPath.base = `${parsedPath.name}-${id}.json`;
      newPath = path.format(parsedPath);
      query = `COPY ${TableName.queryResult} TO '${newPath}' (FORMAT JSON, ARRAY false);`;
    }
    else if (exportType === 'parquet') {
      parsedPath.base = `${parsedPath.name}-${id}.parquet`;
      newPath = path.format(parsedPath);
      query = `COPY ${TableName.queryResult} TO '${newPath}' (FORMAT PARQUET);`;
    }
    else {
      throw Error(`unknown export type: ${exportType}`);
    }
    
    await this.backend.query(query);

    return newPath;
  }
}

(async () => {
    const worker = await BackendWorker.create(
      workerData.pathParquetFile
    );

    if (workerData.initialize){
      await worker.backend.initializeTable();
      await worker.initializeDataPaginator();
      
      worker.isInitialized = true;
      
      parentPort?.postMessage({
        type: MessageType.initialized
      });
    }

    parentPort?.on('message', async (message: any) => {
        switch (message.type) {
          case MessageType.query: {
            try{
                const {headers, result, rowCount} = await worker.query(message);
                const pageNumber = 1; 
                const pageSize = message.pageSize;
                const pageCount = Math.ceil(rowCount / pageSize);
                parentPort?.postMessage({
                    result: result,
                    headers: headers,
                    type: MessageType.query,
                    pageNumber: pageNumber,
                    pageCount: pageCount,
                    rowCount: rowCount,
                    pageSize: pageSize
                });
            } catch (err: any) {
                parentPort?.postMessage({
                    type: MessageType.query,
                    err: err
                });
            }
            
            break;
          }
          case MessageType.paginator: {
            let page;
            let pageNumber;
            console.log(message);
            if (message.source === RequestSource.dataTab) {
              page = await worker.getDataPage(message);
              pageNumber = worker.dataPaginator.getPageNumber();
            } else if (message.source === RequestSource.queryTab) {
              page = await worker.getQueryResultPage(message);
              pageNumber = worker.queryResultPaginator.getPageNumber();
            }
            console.log(`rowCount: ${page?.rowCount}`);
            const pageCount = Math.ceil(page?.rowCount ?? 0 / message.pageSize);
            console.log(`pageCount: ${pageCount}`);

            parentPort?.postMessage({
              type: MessageType.paginator,
              source: message.source,
              result: page?.result,
              headers: page?.headers,
              pageNumber: pageNumber,
              pageCount: pageCount,
              pageSize: message.pageSize,
            });
            break;
          }
          case MessageType.exportQueryResults: {
            const exportType = message.exportType;
            const exportPath = await worker.exportQueryResult(exportType);

            parentPort?.postMessage({
              type: MessageType.exportQueryResults,
              path: exportPath
            });

            break;
          }
          case MessageType.exit: {
            worker.backend.dispose();
          }
          default: {
            throw Error(`Unknown source ${message.source}`);
          }
        }
    });
})();
