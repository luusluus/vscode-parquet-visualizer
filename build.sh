#!/bin/bash

# Clear previous build
rm -rf ./out; 
mkdir ./out ./out/binding/; 

cp ./node_modules/duckdb-async/node_modules/duckdb/lib/binding/duckdb.node ./out/binding/; 
cp ./node_modules/parquet-wasm/node/parquet_wasm_bg.wasm ./out;

esbuild ./src/extension.ts --bundle --outfile=out/extension.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify --define:process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING='"'"$AZURE_APP_INSIGHTS_CONNECTION_STRING"'"'
esbuild ./src/worker.ts --bundle --outfile=out/worker.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify