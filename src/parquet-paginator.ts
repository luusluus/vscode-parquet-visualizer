// Run this script as follows from command line
// https://stackoverflow.com/questions/33535879/how-to-run-typescript-files-from-command-line
// npx ts-node parquet.ts 
// import * as readline from 'readline/promises';

import { ParquetReader, ParquetSchema } from '@dvirtz/parquets';

export class ParquetPaginator {
  private reader: ParquetReader<unknown>;
  private pageSize: number;
  private rowCount: number;
  private pageCount: number;
  private schema: ParquetSchema;

  private constructor(reader: ParquetReader<unknown>, pageSize: number) {
    this.reader = reader;
    this.pageSize = pageSize;
    this.schema = this.reader.getSchema();
    this.rowCount = this.reader.getRowCount();
    this.pageCount = Math.ceil(this.rowCount / this.pageSize);
  }

  public static async createAsync (filePath: string, pageSize: number = 10) {
    const reader = await ParquetReader.openFile(filePath);
    return new ParquetPaginator(reader, pageSize);
  }

  // TODO: return a complex type called Page, with a method to get only values, not keys
  public async getPage(pageNumber: number) {
    if (pageNumber > this.pageCount) {
      throw new RangeError(`Page Number ${pageNumber} is out of range. Total number of pages are ${this.pageCount}`);
    }
    // read all records from the file and print them
    
    let startIndex = (pageNumber - 1) * this.pageSize;
    let endIndex = Math.min(startIndex + this.pageSize - 1, this.rowCount);

    let rows = [];
    const cursor = this.reader.getCursor();
    for (let i = 0; i < this.rowCount; i++) {
      // get subset of rows based on startindex and endindex
      const row = await cursor.next();
      if (i >= startIndex && i <= endIndex) {
        rows.push(row);
      }
      if (i > endIndex) {
        break;
      }
    }

    return rows;
  }

  public getSchema() {
    console.log(this.schema.fields);
    console.log(this.schema.fieldList);
    return this.schema.schema;
  }

  public getFieldList() {
    return this.schema.fieldList;
  }

  public getFields() {
    return this.schema.fields;
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
