// Run this script as follows from command line
// https://stackoverflow.com/questions/33535879/how-to-run-typescript-files-from-command-line
// npx ts-node parquet.ts 
// import * as readline from 'readline/promises';

import * as fs from 'fs';
const { File } = require('buffer'); 

import { ParquetFile } from 'parquet-wasm';

import { Backend } from './backend';
import { Table } from 'apache-arrow/table';
import { tableFromIPC } from 'apache-arrow';

export class ParquetWasmBackend extends Backend {
  public parquetFile: ParquetFile;
  

  private constructor(
    filePath: string,
    parquetFile: ParquetFile, 
    table: Table<any>
  ) {
    super(filePath);
    this.parquetFile = parquetFile;
    this.arrowSchema = table.schema;
    this.metadata = this.getMetaDataImpl();
  }

  public static override async createAsync (path: string) {
    const buffer = fs.readFileSync(path);
    const file = new File([buffer], "fileName", {
      type: "application/vnd.apache.parquet",
    });

    const parquetFile = await ParquetFile.fromFile(file);

    const stream = (await parquetFile.read({
      offset: 0,
      limit: 100
    })).intoIPCStream();
    const table = tableFromIPC(stream);

    return new ParquetWasmBackend(
      path, 
      parquetFile, 
      table
    );
  }

  dispose() {
    // console.log("ParquetWasmBackend.dispose()");
    this.parquetFile.free();
  }
  
  public async initialize(): Promise<void> {
    // console.log("initialize()");
  }

  getRowCount(): number {
    return this.parquetFile.metadata().fileMetadata().numRows();
  }
  
  getSchemaImpl(): any {
    return this.arrowSchema;
  }

  getMetaDataImpl(): any {
    const metadata = this.parquetFile.metadata();
    return [{
      file_name: this.filePath,
      created_by: metadata.fileMetadata().createdBy(),
      num_rows: metadata.fileMetadata().numRows(),
      num_row_groups: metadata.numRowGroups(),
      format_version: metadata.fileMetadata().version(),
      encryption_algorithm: "",
      footer_signing_key_metadata: ""
    }]
  }

  protected queryImpl(query: any): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

}
