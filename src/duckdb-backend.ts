import * as duckdb from "duckdb-async";

import { tableFromIPC, Schema } from "apache-arrow";

import { Backend } from "./backend";
import { DateTimeFormatSettings } from './types';

export class DuckDBBackend extends Backend{
    private db: duckdb.Database;
    public arrowSchema: Schema<any>;
    public metadata: any;

    constructor(filePath: string, dateTimeFormatSettings: DateTimeFormatSettings, db: duckdb.Database){
      super(filePath, dateTimeFormatSettings);
      this.db = db;
    }

    public static override async createAsync (path: string, dateTimeFormatSettings: DateTimeFormatSettings){
      const db = await duckdb.Database.create(":memory:");
      return new DuckDBBackend(path, dateTimeFormatSettings, db);
    }

    dispose() {}

    public async initialize (){
        await this.db.all(`
            INSTALL arrow; LOAD arrow;
            INSTALL spatial; LOAD spatial;
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

    public getRowCount(): number {
      return Number(this.metadata[0]["num_rows"]);
    }
}