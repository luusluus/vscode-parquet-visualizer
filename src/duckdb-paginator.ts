import { Paginator, QueryObject } from './paginator';
import { DuckDBBackend } from './duckdb-backend';

export class DuckDBPaginator extends Paginator {
    private backend: DuckDBBackend; // Assume this is your DuckDB connection instance
    private table: string;
    private readFromFile: boolean;
    
    constructor(
        backend: DuckDBBackend, 
        table: string, 
        totalItems: number,
        readFromFile: boolean
    ) {
        super(totalItems);
        this.backend = backend;
        this.table = table;
        this.readFromFile = readFromFile;
    }

    getTotalPages(pageSize: number): number {
        return Math.ceil(this.totalItems / pageSize);
    }

    getPage(query: QueryObject): Promise<any[]> {        
        const offset = this.calculateOffset(query.pageNumber, query.pageSize);

        let source;
        if (this.readFromFile) {
            source = `read_parquet('${this.backend.filePath}')`;
        } else {
            source = this.table;
        }

        let queryStatement = `
            SELECT *
            FROM ${source}
        `;

        if (query.sort) {
            queryStatement += `
                ORDER BY "${query.sort.field}" ${query.sort.direction.toUpperCase()}
            `;
        }

        queryStatement += `
            LIMIT ${query.pageSize}
            OFFSET ${offset}
        `;
        
        return this.backend.query(queryStatement);
    }
}