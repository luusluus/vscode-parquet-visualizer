// Run this script as follows from command line
// https://stackoverflow.com/questions/33535879/how-to-run-typescript-files-from-command-line
// npx ts-node parquet.ts 

import { ParquetReader } from '@dvirtz/parquets';

class ParquetPaginator {
  private reader: any;
  private pageSize: number;

  constructor(filePath: string, pageSize: number = 10) {
    this.pageSize = pageSize;
    this.reader = this.init(filePath);
  }

  async init (filePath: string) : Promise<ParquetReader<unknown>> {
    return await ParquetReader.openFile(filePath);
  }


  async numPages() {
    const numRows = await this.reader.getRowCount();
    return Math.ceil(numRows / this.pageSize);
  }

}



(async () => {
    let reader = await ParquetReader.openFile("data/large.parquet");
    
    let cursor = reader.getCursor();
    const pageSize = 20;
    const currentPage = 66;

    const numRows = await reader.getRowCount();
    const numPages = Math.ceil(numRows / pageSize);
    console.log(`Number of rows:  ${numRows}`);
    console.log(`Number of pages: ${numPages}`);
    // read all records from the file and print them
    
    let startIndex = (currentPage - 1) * pageSize;
    let endIndex = Math.min(startIndex + pageSize - 1, numRows);
    console.log(`start index: ${startIndex}`);
    console.log(`end index ${endIndex}`);
    // console.log(reader.metadata.row_groups[0]);

    let rows = [];
    for (let i = 0; i < numRows; i++) {
      // get subset of rows based on startindex and endindex
      const row = await cursor.next();
      if (i >= startIndex && i <= endIndex) {
        rows.push(row);
      }
      if (i > endIndex) {
        break;
      }

    }

    console.log(rows.length);
    // console.log(cursor.envelopeReader.readRowGroup());
    // console.log(await cursor.next());
    // let record = null;
    // while (record = await cursor.next()) {
    //     // console.log(record);
    // }
    await reader.close();
})();
    