import * as fs from 'fs';
import { performance }  from "perf_hooks";

import * as duckdb from "duckdb-async";
import { Backend } from "./backend";

import { tableFromIPC, Schema } from "apache-arrow";

export class DuckDBBackend extends Backend{
    private db: duckdb.Database;
    public arrowSchema: Schema<any>;
    public metadata: any;

    constructor(filePath: string, db: duckdb.Database){
      super(filePath);
      this.db = db;
    }

    public static override async createAsync (path: string){
      const db = await duckdb.Database.create(":memory:");
      // const splitted = path.split('/');
      // const filename = splitted[splitted.length - 1];
      // const filePath = `${__dirname}/${filename}.duckdb`;
      // const db = await duckdb.Database.create(filePath);
      return new DuckDBBackend(path, db);
    }

    dispose() {
      // console.log("Duckdbbackend.dispose()");
      // const splitted = this.filePath.split('/');
      // const filename = splitted[splitted.length-1];
      // const filePath = `${__dirname}/${filename}.duckdb`;
      // fs.unlinkSync(filePath);
    }

    public async initialize (){
        await this.db.all(`
            INSTALL arrow; LOAD arrow;
          `
        );
        
        const arrowIpc = await this.getSchemaImpl();
        this.arrowSchema = tableFromIPC(arrowIpc).schema;
        this.metadata = await this.getMetaDataImpl();
    }

    getSchemaImpl(): any {
      try{
        return this.db.arrowIPCAll(`
          SELECT * 
          FROM read_parquet('${this.filePath}')
          LIMIT 10
        `);

      } catch (e: any) {
        this.dispose();
        throw e;
      }
    }

    getMetaDataImpl(): Promise<any> {
      try{
        return this.db.all(`
          SELECT * 
          FROM parquet_file_metadata('${this.filePath}')
        `);
      } catch (e: any) {
        this.dispose();
        throw e;
      }
    }
    
    queryImpl(query: any): Promise<any> {
      return this.db.all(query);
    }

    public async checkIfTableExists(tableName: string) {
      console.log("checkIfTableExists()");
      const result = await this.db.all(`
        SELECT COUNT(*) as tableCount
        FROM information_schema.tables
        WHERE table_name = ${tableName}
      `);
      const tableCount = Number(result[0]['tableCount']);
      return tableCount > 0;
    }
    
    public async initializeTable(){
        const start = performance.now();
        const result = await this.db.all(`
          CREATE TABLE data AS 
          SELECT * 
          FROM read_parquet('${this.filePath}');
        `);

        const end = performance.now();
        console.log(`initializeTable() took ${(end - start) / 1e3} seconds`);

        return result;
    }

    public getRowCount(): number {
      return Number(this.metadata[0]["num_rows"]);
    }
}