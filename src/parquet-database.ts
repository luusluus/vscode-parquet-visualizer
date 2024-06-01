import * as duckdb from '@duckdb/duckdb-wasm';
import { ParquetFile } from 'parquet-wasm';
import Worker from 'web-worker';
import { Schema, Field, Type } from "apache-arrow";

import { convertToTabulatorData } from './util';

export class ParquetDatabase {
    private db: duckdb.AsyncDuckDB;

    private constructor(db: duckdb.AsyncDuckDB){
        this.db = db;
    }

    public static async createAsync (){
        const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
            mvp: {
                mainModule: `${__dirname}/duckdb-wasm/duckdb-mvp.wasm`,
                mainWorker: `${__dirname}/duckdb-wasm/duckdb-node-mvp.worker.cjs`,
            },
            eh: {
                mainModule: `${__dirname}/duckdb-wasm/duckdb-eh.wasm`,
                mainWorker: `${__dirname}/duckdb-wasm/duckdb-node-eh.worker.cjs`,
            },
        };
        // Select a bundle based on browser checks
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
    
        const worker = new Worker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule);

        return new ParquetDatabase(db);
    
    }

    private getSqlType(field: Field): string {
      if (field.typeId === Type.List) {
        let result = "";
        if (field.type.children.length > 0) {
          const type = this.getSqlType(field.type.children[0]);
          result = `${type}[]`;
        }
        return result;
      }
      if (field.typeId === Type.Struct) {
        let listOfFields = [];
        let children: any;
        if (field.type) {
          children = field.type.children;
        } else {
          children = (field as any).children;
        }
        for (const child of children) {
          const type = this.getSqlType(child);
          const name = child.name;
          const field = `${name} ${type}`;
          listOfFields.push(field);
        }
        const fields = listOfFields.join(",");
        const result = `STRUCT(${fields})`
        return result;
      }
  
      if (field.typeId === Type.Int) {
        return 'INTEGER';
      } 
      if (field.typeId === Type.Float) {
        return 'FLOAT';
      } 
      if (field.typeId === Type.Utf8) {
        return 'VARCHAR';
      } 
      if (field.typeId === Type.Bool) {
        return 'BOOLEAN';
      } 
      if (field.typeId === Type.Date) {
        return 'DATE';
      } 
      if (field.typeId === Type.TimestampMicrosecond) {
        return 'TIMESTAMP';
      } 
      if (field.typeId === Type.TimestampMillisecond) {
        return 'TIMESTAMP_MS';
      } 
      if (field.typeId === Type.TimestampSecond) {
        return 'TIMESTAMP_S';
      } 
  
      console.log(`Unknown field: ${field.name}`);
      return "";
      
    }
    
    public buildCreateTableStatement(tableName: string, schema: Schema<any>): string {
      const columns = schema.fields.map(field => {
        const columnName = field.name;
        const columnType = this.getSqlType(field.type);
        return `${columnName} ${columnType}`;
      }).join(', ');
    
      return `CREATE TABLE ${tableName} (\n  ${columns}\n);`;
    }

    
    public async query(query: string) {
      const start = Math.floor(Date.now() / 1000);
      const c = await this.db.connect();
      const result = await c.query(query);
      const end = Math.floor(Date.now() / 1000);
      console.log(`query took ${end-start} sec`);
      return convertToTabulatorData(result.toArray());
    }

    public async initialize(parquetFile: ParquetFile){
        async function* readableStreamAsyncIterator<T>(stream: ReadableStream<T>): AsyncIterableIterator<T> {
            const reader = stream.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  break;
                }
                yield value;
              }
            } finally {
              reader.releaseLock();
            }
          }
      
          const stream = await parquetFile.stream({
            concurrency: 10
          });
      
          const start = Math.floor(Date.now() / 1000);
          const c = await this.db.connect();
      
          const streamInserts = [];
          for await (const chunk of readableStreamAsyncIterator(stream)){
            const ipcStream = chunk.intoIPCStream();
            streamInserts.push(c.insertArrowFromIPCStream(
              ipcStream, 
              { name: 'streamed', create: false }
            ));
      
          }
      
          await Promise.all(streamInserts);
      
          const end = Math.floor(Date.now() / 1000);
          console.log(`initializing DB took ${end-start} sec`);
          
    }
}