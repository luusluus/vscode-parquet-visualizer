// worker.ts
const path = require('path');

import { randomUUID } from 'crypto';

const {
  parentPort, workerData
} = require('node:worker_threads');


import { Paginator } from './paginator';
import { DuckDBBackend } from './duckdb-backend';
import { DuckDBPaginator } from './duckdb-paginator';
import { createHeadersFromData, replacePeriodWithUnderscoreInKey } from './util';
import { DateTimeFormatSettings } from './types';

class BackendWorker {
  paginator: Paginator;
  backend: DuckDBBackend;
  queryResultCount: number;

  private constructor(backend: DuckDBBackend) {
    this.backend = backend;
  }

  static async create(path: string, dateTimeFormatSettings: DateTimeFormatSettings) {
    const backend = await DuckDBBackend.createAsync(path, dateTimeFormatSettings);
    await backend.initialize();
    return new BackendWorker(backend);
  }

  async getQueryResultPage(message: any) {
    let result;
    if (message.type === 'nextPage') {
      result = await this.paginator.nextPage(message.pageSize);
    } else if (message.type === 'prevPage') {
      result = await this.paginator.previousPage(message.pageSize);
    } else if (message.type === 'firstPage') {
      result = await this.paginator.firstPage(message.pageSize);
    } else if (message.type === 'lastPage') {
      result = await this.paginator.lastPage(message.pageSize); 
    } else if (message.type === 'currentPage') {
      result = await this.paginator.gotoPage(message.pageNumber, message.pageSize);
    } else {
      throw Error(`Unknown message type: ${message.type}`);
    }

    const values = replacePeriodWithUnderscoreInKey(result);
    const headers = createHeadersFromData(values);

    return {
      headers: headers,
      result: values,
      rowCount: this.queryResultCount
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
    const query = this.formatQueryString(msg.query);

    await this.backend.query(`DROP TABLE IF EXISTS query_result`);
    // console.log("table dropped");

    await this.backend.query(
        `CREATE TABLE query_result AS 
            ${query}
        `
    );
    // console.log("ctas query done");

    const queryResult = await this.backend.query(
        `SELECT COUNT(*) AS count FROM query_result`
    );
    this.queryResultCount = Number(queryResult[0]['count']);

    const table = 'query_result';
    const readFromFile = false;
    this.paginator = new DuckDBPaginator(
        this.backend, 
        table, 
        this.queryResultCount,
        readFromFile
    );

    const result = await (this.paginator.firstPage(msg.pageSize));
    const values = replacePeriodWithUnderscoreInKey(result);
    const headers = createHeadersFromData(values);

    return {
      headers: headers,
      result: values,
      rowCount: this.queryResultCount
    };
  }

  async exportQueryResult(exportType: string, savedPath: string) {
    let query = '';
    if (exportType === 'csv') {
      query = `COPY query_result TO '${savedPath}' WITH (HEADER, DELIMITER ',');`;
    }
    else if (exportType === 'json') {
      query = `COPY query_result TO '${savedPath}' (FORMAT JSON, ARRAY true);`;
    }
    else if (exportType === 'ndjson') {
      query = `COPY query_result TO '${savedPath}' (FORMAT JSON, ARRAY false);`;
    }
    else if (exportType === 'parquet') {
      query = `COPY query_result TO '${savedPath}' (FORMAT PARQUET);`;
    }
    else if (exportType === 'excel') {
      // NOTE: The spatial extension can't export STRUCT types.
      const dynamicQuery = `
        SELECT string_agg('"' || column_name || '"', ', ') as columns
        FROM (
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'query_result' AND data_type NOT LIKE 'STRUCT%'
        ) AS non_struct_columns;
      `;
      const dynamicColumnsQueryResult = await this.backend.query(dynamicQuery);
      const columns = dynamicColumnsQueryResult[0]["columns"];
      query = `
        COPY (SELECT ${columns} from query_result) TO '${savedPath}' (FORMAT GDAL, DRIVER 'xlsx');
      `;
    }
    try {
      await this.backend.query(query);
    } 
    catch (e: unknown) {
      console.error(e);
    }
    return savedPath;
  }
}

(async () => {
    const worker = await BackendWorker.create(
      workerData.pathParquetFile,
      workerData.dateTimeFormatSettings
    );

    parentPort.on('message', async (message: any) => {
        switch (message.source) {
          case 'query': {
            try{ 
                const {headers, result, rowCount} = await worker.query(message);
                const pageNumber = 1; 
                const pageSize = message.pageSize;
                const pageCount = Math.ceil(rowCount / pageSize);
                parentPort.postMessage({
                    result: result,
                    headers: headers,
                    type: 'query',
                    pageNumber: pageNumber,
                    pageCount: pageCount,
                    rowCount: rowCount,
                    pageSize: pageSize
                });
            } catch (err: unknown) {
                parentPort.postMessage({
                    type: 'query',
                    err: err
                });
            }
            
            break;
          }
          case 'paginator': {
            const {headers, result, rowCount} = await worker.getQueryResultPage(message);
            const pageCount = Math.ceil(rowCount / message.pageSize);
            const pageNumber = worker.paginator.getPageNumber();
            parentPort.postMessage({
              result: result,
              headers: headers,
              type: 'paginator',
              pageNumber: pageNumber,
              pageCount: pageCount,
              pageSize: message.pageSize,
            });
            break;
          }
          case 'exportQueryResults': {
            const exportType = message.exportType;
            const savedPath = message.savedPath;
            const exportPath = await worker.exportQueryResult(exportType, savedPath);
            parentPort.postMessage({
              type: 'exportQueryResults',
              path: exportPath
            });

            break;
          }
          default: {
            throw Error(`Unknown source ${message.source}`);
          }
        }
    });
})();
