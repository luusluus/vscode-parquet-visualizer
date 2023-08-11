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
    console.log(reader.getRowCount());

    let cursor = reader.getCursor();
    const pageSize = 20;
    const numRows = await reader.getRowCount();
    const numPages = Math.ceil(numRows / pageSize);
    console.log(numPages);
    // read all records from the file and print them
    let record = null;

    // console.log(reader.metadata.row_groups[0]);

    // console.log(cursor.envelopeReader.readRowGroup());
    
    while (record = await cursor.next()) {
        // console.log(record);
    }
    await reader.close();
})();
    