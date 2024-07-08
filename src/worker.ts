// worker.ts
const {
  parentPort, workerData
} = require('node:worker_threads');


import { Paginator } from './paginator';
import { DuckDBBackend } from './duckdb-backend';
import { DuckDBPaginator } from './duckdb-paginator';
import { createHeadersFromData } from './util';


class BackendWorker {
  paginator: Paginator;
  backend: DuckDBBackend;
  queryResultCount: number;

  private constructor(backend: DuckDBBackend) {
    this.backend = backend;
  }

  static async create(path: string) {
    const backend = await DuckDBBackend.createAsync(path);
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

    const headers = createHeadersFromData(result);

    return {
      headers: headers,
      result: result,
      rowCount: this.queryResultCount
    }
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
    const headers = createHeadersFromData(result);

    return {
      headers: headers,
      result: result,
      rowCount: this.queryResultCount
    }
  }
}

(async () => {
    const worker = await BackendWorker.create(workerData.pathParquetFile);

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
            } catch (err: any) {
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
          default: {
            throw Error(`Unknown source ${message.source}`);
          }
        }
    });
})();
