import { tableFromIPC} from "apache-arrow";

import { Paginator } from "./paginator";
import { ParquetWasmBackend } from './parquet-wasm-backend';
import { convertToTabulatorData } from './util';

export class ParquetWasmPaginator extends Paginator {

    private db: ParquetWasmBackend; // Assume this is your DuckDB connection instance
  
    constructor(db: any) {
      const totalItems = 10; // TODO: get totalitems of parquet file here.
      super(totalItems);
      this.db = db;
    }

    getPage(pageNumber: number, pageSize: number): Promise<any[]> {
        const pageCount = this.getTotalPages(pageSize);
        if (pageNumber > pageCount) {
          throw new RangeError(`Page Number ${pageNumber} is out of range. Total number of pages are ${pageCount}`);
        }
          
        const rowCount = this.db.parquetFile.metadata().fileMetadata().numRows();
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize - 1, rowCount);
        const limit = endIndex - startIndex;
        
        const processResult = async (): Promise<any[]> => {
          const stream = (await this.db.parquetFile.read(
            {
              offset: startIndex,
              limit: limit,
            }
          )).intoIPCStream();
          const table = tableFromIPC(stream);
          return convertToTabulatorData(table.toArray());
        };

        return processResult();
    }

    getTotalPages(pageSize: number): number {
        const numberOfRows = this.db.parquetFile.metadata().fileMetadata().numRows();
        return Math.ceil(numberOfRows / pageSize);
    }

}