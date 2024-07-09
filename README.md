# Parquet Visualizer
Explore parquet files visually with SQL and a table paginator.

![visualize](media/visualize.gif)

## Features
- Visualizes the binary parquet file in readable table format
- Query parquet files with SQL
- Inspect complex objects by clicking on a table cell
- Inspect the parquet file's schema
- Inspect the parquet file's metadata
- Open multiple files simultanuously
- Select columns to visualize in table


## Parquet backends
This extension supports two different types of backends for visualizing and querying parquet files.

### DuckDB
[DuckDB](https://duckdb.org/docs/index) is the primary backend used for uncompressed and compressed parquet files (except for the BROTLI compression codec.)

### Parquet WASM
The backend that loads the Parquet files uses the [parquet-wasm](https://kylebarron.dev/parquet-wasm) library.

## Frontend
The tables of the frontend are powered by [tabulator](https://tabulator.info/).

The query editor of the frontend is powered by [ace] (https://github.com/ajaxorg/ace).

