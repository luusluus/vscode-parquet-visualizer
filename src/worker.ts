// worker.ts
const {
  parentPort, workerData
} = require('node:worker_threads');
import * as os from 'os';

import * as exceljs from 'exceljs';

import { DuckDbError } from 'duckdb-async';

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
    let pageSize: number;
    if (message.pageSize.toLowerCase() === 'all') {
        pageSize = this.paginator.totalItems;
    } else {
      pageSize = Number(message.pageSize);
    }

    let result;
    if (message.type === 'nextPage') {
      result = await this.paginator.nextPage(pageSize);
    } else if (message.type === 'prevPage') {
      result = await this.paginator.previousPage(pageSize);
    } else if (message.type === 'firstPage') {
      result = await this.paginator.firstPage(pageSize);
    } else if (message.type === 'lastPage') {
      result = await this.paginator.lastPage(pageSize); 
    } else if (message.type === 'currentPage') {
      result = await this.paginator.gotoPage(message.pageNumber, pageSize);
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

  async query(queryObject: any){
    let query = this.formatQueryString(queryObject.queryString);

    if (queryObject.sort) {
      const sort = queryObject.sort;

      query = query.replace(';', '');
      query = `
        WITH cte as (
          ${query}
        )
        SELECT * FROM cte
        ORDER BY "${sort.field}" ${sort.direction.toUpperCase()}
      `;
    }

    await this.backend.query(`DROP TABLE IF EXISTS query_result`);

    await this.backend.query(
        `CREATE TABLE query_result AS 
            ${query}
        `
    );

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

    let result;
    if (queryObject.pageSize.toLowerCase() === 'all') {
      result = await this.paginator.getPage(1, this.paginator.totalItems);
    } else {
      result = await (this.paginator.firstPage(Number(queryObject.pageSize)));
    }
    const values = replacePeriodWithUnderscoreInKey(result);
    const headers = createHeadersFromData(values);

    const querySchemaResult = await this.backend.query(
      `DESCRIBE ${query}`
    );

    return {
      headers: headers,
      result: values,
      schema: querySchemaResult,
      rowCount: this.queryResultCount
    };
  }

  async sortQueryResult (field: string, direction: string) {
    const query = `SELECT * FROM query_result ORDER BY "${field}" ${direction.toUpperCase()}`;
    console.log(query);
    const result = await this.backend.query(query);

    const values = replacePeriodWithUnderscoreInKey(result);
    return values;
  }

  async createEmptyExcelFile(filePath: string) {
    const workbook = new exceljs.Workbook();
    workbook.addWorksheet('Sheet1');

    await workbook.xlsx.writeFile(filePath);
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

      // Get the schema of the table
      const schemaQuery = `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'query_result'
      `;
      const schema = await this.backend.query(schemaQuery);

      // Build the SELECT query
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const columns = schema.map(({ column_name, data_type }) => {
          if (data_type.includes('STRUCT')) {
              return `TO_JSON("${column_name}") AS ${column_name}`;
          }
          return `"${column_name}"`;
      });

      const selectQuery = `SELECT ${columns.join(', ')} FROM query_result`;

      query = `
        COPY (${selectQuery}) TO '${savedPath}' (FORMAT GDAL, DRIVER 'xlsx');
      `;
    }

    if (os.platform() === 'win32') {
      await this.createEmptyExcelFile(savedPath);
      const tmpPath = savedPath.replace(/([^\\]+)\.xlsx$/, "tmp_$1.xlsx");
      await this.createEmptyExcelFile(tmpPath);
    }

    await this.backend.query(query);

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
                const query = message.query;
                const {headers, result, schema, rowCount} = await worker.query(query);
                const pageNumber = 1; 
                const pageSize = query.pageSize;

                let pageCount: number;
                if (pageSize.toLowerCase() === 'all'){
                  pageCount = 1;
                }
                else {
                  pageCount = Math.ceil(rowCount / Number(pageSize));
                }

                parentPort.postMessage({
                    schema: schema,
                    result: result,
                    headers: headers,
                    type: 'query',
                    pageNumber: pageNumber,
                    pageCount: pageCount,
                    rowCount: rowCount,
                    pageSize: pageSize,
                    sort: query.sort
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

            let pageCount: number;
            if (message.pageSize.toLowerCase() === 'all'){
              pageCount = 1;
            }
            else {
              pageCount = Math.ceil(rowCount / Number(message.pageSize));
            }
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

            try{
              const exportPath = await worker.exportQueryResult(exportType, savedPath);
              parentPort.postMessage({
                type: 'exportQueryResults',
                path: exportPath
              });

            }
            catch (e: unknown) {
              console.error(e);
              const error = e as DuckDbError;
              parentPort.postMessage({
                type: 'exportQueryResults',
                error: error.message,
              });
            }

            break;
          }
          default: {
            throw Error(`Unknown source ${message.source}`);
          }
        }
    });
})();
