# parquet-visualizer
Explore parquet files visually with a table paginator.

![visualize](media/visualize.gif)

## Features
- Visualizes the binary parquet file in readable table format
- Paginate through parquet file
- Inspect the parquet file's schema
- Inspect the parquet file's metadata
- Open multiple files simultanuously
- Inspect complex objects by clicking on a table cell


## Parquet backend
The backend that loads the Parquet files uses the [parquet-wasm](https://kylebarron.dev/parquet-wasm) library.

## Frontend
The frontend is powered by [tabulator](https://tabulator.info/).

