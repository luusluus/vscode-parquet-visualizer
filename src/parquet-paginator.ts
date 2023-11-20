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
    this.pageSize = pageSize;
    this.pageCount = Math.ceil(this.rowCount / this.pageSize);
  }

  public static async createAsync (filePath: string, pageSize: number = 10) {
    const byteArray = fs.readFileSync(filePath);
    const arrowUint8Array = readParquet(byteArray);
    const arrowTable = tableFromIPC(arrowUint8Array.intoIPCStream());

    console.log(arrowTable);

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

    // let rows = [];
    // console.log(this.table.toArray());
    const subTable = this.table.slice(startIndex, endIndex);
    const rows = subTable.toArray().map(r => Object.values(r));
    console.log(subTable.toArray()[0]);
    console.log(Object.values(rows[0]));
    // console.log(rows[0]);
    
    // console.log(rows[0].values());
    // console.log(this.table.slice(startIndex, endIndex).data);
    // const cursor = this.reader.getCursor();
    // for (let i = 0; i < this.rowCount; i++) {
    //   // get subset of rows based on startindex and endindex
    //   const row = await cursor.next();
    //   if (i >= startIndex && i <= endIndex) {
    //     rows.push(row);
    //   }
    //   if (i > endIndex) {
    //     break;
    //   }
    // }

    return rows;
  }

  public getSchema() {
    // return this.schema.schema;
  }

  public getFieldList() {
    // return this.schema.fieldList;
  }

  public getFields() {
    // return this.schema.fields;
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

}
