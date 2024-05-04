// Run this script as follows from command line
// https://stackoverflow.com/questions/33535879/how-to-run-typescript-files-from-command-line
// npx ts-node parquet.ts 
// import * as readline from 'readline/promises';

import * as fs from 'fs';

import {tableFromIPC, Table, Schema} from "apache-arrow";
import {
    readParquet,
} from "parquet-wasm/node/arrow1";


export class ParquetPaginator {
  private table: Table<any>;
  private pageSize: number;
  private rowCount: number;
  private pageCount: number;
  private schema: Schema;

  private constructor(table: Table<any>, pageSize: number) {
    this.table = table;
    this.schema = table.schema;
    this.rowCount = this.table.numRows;
    this.pageSize = pageSize; // This is the amount of rows in a page.
    this.setPageCount(pageSize); // This is the amount of pages
  }

  public static async createAsync (filePath: string, pageSize: number = 10) {
    const byteArray = fs.readFileSync(filePath);
    const arrowUint8Array = readParquet(byteArray);
    const arrowTable = tableFromIPC(arrowUint8Array.intoIPCStream());

    return new ParquetPaginator(arrowTable, pageSize);
  }

  // TODO: return a complex type called Page, with a method to get only values, not keys
  public async getPage(pageNumber: number) {
    if (pageNumber > this.pageCount) {
      throw new RangeError(`Page Number ${pageNumber} is out of range. Total number of pages are ${this.pageCount}`);
    }
    // read all records from the file and print them
    
    let startIndex = (pageNumber - 1) * this.pageSize;
    let endIndex = Math.min(startIndex + this.pageSize - 1, this.rowCount);

    const subTable = this.table.slice(startIndex, endIndex);
    
    const rows = subTable.toArray().map(obj => {
      const newObj = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = String(value); // Convert value to string
      }
      return newObj;
    });

    return rows;
  }

  public async getAllRows() {
    return this.table.toArray().map(obj => {
      const newObj = {};
      for (const [key, value] of Object.entries(obj)) {
        newObj[key] = String(value); // Convert value to string
      }
      return newObj;
    });
  }

  public getSchema() {
    // https://arrow.apache.org/docs/python/api/datatypes.html

    return this.schema.fields.map((f) => {
      const name = f.name;
      let type = f.type.toString();
      if (type.includes('Utf8')) {
        type = type.replace(/Utf8/g, 'String');
      } else if (type.includes('LargeUtf8')) {
        type = type.replace(/LargeUtf8/g, 'LargeString');
      }

      return {
        'name': name,
        'type': type
      };
    });
    
  }

  public getFields() {
    const fields = this.schema.fields;
    const headers = fields.map(f => {
      return {
        title: f.name,
        field: f.name
      };
    });
    return headers;
  }

  public getPageSize() {
    return this.pageSize;
  }

  public getPageCount() {
    return this.pageCount;
  }

  public getRowCount() {
    return this.rowCount;
  }

  public setPageSize(value: number) {
    this.pageSize = value;
  }

  public setPageCount(pageSize: number) {
    this.pageCount = Math.ceil(this.rowCount / pageSize); 
  }

}
