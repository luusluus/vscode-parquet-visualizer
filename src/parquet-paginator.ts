// Run this script as follows from command line
// https://stackoverflow.com/questions/33535879/how-to-run-typescript-files-from-command-line
// npx ts-node parquet.ts 
// import * as readline from 'readline/promises';

import { ParquetReader } from '@dvirtz/parquets';

export class ParquetPaginator {
  private reader: ParquetReader<unknown>;
  private pageSize: number;
  private rowCount: number;
  private pageCount: number;

  private constructor(reader: ParquetReader<unknown>, pageSize: number) {
    this.reader = reader;
    this.pageSize = pageSize;
    this.rowCount = this.reader.getRowCount();
    this.pageCount = Math.ceil(this.rowCount / this.pageSize);
  }

  public static async createAsync (filePath: string, pageSize: number = 20) {
    const reader = await ParquetReader.openFile(filePath);
    return new ParquetPaginator(reader, pageSize);
  }

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

  public numPages() {
    return this.pageCount;
  }
}


// (async () => {
//   const paginator = await ParquetPaginator.createAsync("data/large.parquet", 10);
//   const rl = readline.createInterface({
//       input: process.stdin,
//       output: process.stdout
//   });

//   for (;;) {
//     try {
//       const pageNumber = await rl.question('page number: ');
//       console.log(pageNumber);
//       if (pageNumber === 'q') {
//         console.log("exiting...");
//         rl.close();
//         return;
//       };
//       console.log(await paginator.getPage(+pageNumber));
//     }
//     catch (e) { 
//       if (e instanceof RangeError){
//         console.log(e);
//       } else {
//         throw (e);
//       }
//     }
//   }
// })();