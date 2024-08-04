# Parquet Visualizer
Parquet Visualizer is a tool that helps you easily explore and inspect parquet files fast.

![visualize](media/visualize.gif)

## What can I do with Parquet Visualizer?
You can use this tool to query the data with SQL, visually inspect parquet files and more.

### Run SQL Queries

### Inspect Data

### Inspect Complex Cell Values

### Inspect Schema

### Inspect Metadata

### Inspect Multiple Files

- Visualizes the binary parquet file in readable table format
- Query parquet files with SQL
- Inspect complex objects by clicking on a table cell
- Inspect the parquet file's schema
- Inspect the parquet file's metadata
- Open multiple files simultanuously
- Select columns to visualize in table

## Configuration
The following configuration options are available:

|name|default|description|
|----|-------|-----------|
|`parquet-visualizer.backend`|`duckdb`| Backend for reading the parquet file. Options: `duckdb`, `parquet-wasm`|
|`parquet-visualizer.defaultPageSizes`|[20, 50, 100, 500]|Set the default page size for data and query tab.|
|`parquet-visualizer.defaultQuery`|`SELECT *\r\nFROM data\r\nLIMIT 1000;`|Default SQL query for parquet file. The table `data` should remain the same.|


## Parquet backends
This extension supports two different types of backends for visualizing and querying parquet files.

### DuckDB
[DuckDB](https://duckdb.org/docs/index) is the primary backend used for uncompressed and compressed parquet files (except for the BROTLI compression codec.)

### Parquet-wasm
The backend that loads the Parquet files uses the [parquet-wasm](https://kylebarron.dev/parquet-wasm) library.

## Frontend
The tables of the frontend are powered by [tabulator](https://tabulator.info/).

The query editor of the frontend is powered by [ace] (https://github.com/ajaxorg/ace).

