export enum MessageType {
    paginator = "paginator",
    query = "query",
    exportQueryResults = "exportQueryResults",
    initialized = "initialized",
    update = "update",
    error = "err",
    ready = "ready",
    init = "init",
    exit = "exit"
}

export enum BackendName {
    duckdb = 'duckdb',
    parquetWasm = 'parquet-wasm'
}

export enum RequestSource {
    dataTab = "dataTab",
    queryTab = "queryTab"
}

export enum Action {
    currentPage = "currentPage",
    nextPage = "nextPage",
    prevPage = "prevPage",
    firstPage = "firstPage",
    lastPage = "lastPage",
    goToPage = "goToPage",
    changePageSize = "changePageSize",
    startQuery = "startQuery",
    exportQueryResults = "exportQueryResults",
    copyQueryResults = "copyQueryResults",
}

export enum TableName {
    data = "data",
    queryResult = "query_result"
}

export enum QueryStatement {
    insertStatement = "InsertStmt",
    updateStatement = "UpdateStmt",
    deleteStatement = "DeleteStmt",
    selectStatement = "SelectStmt",
}