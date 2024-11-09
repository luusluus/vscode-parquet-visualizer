@echo off

REM Clear previous build
rmdir /s /q out
mkdir out
mkdir out\binding

REM Copy required files
copy /y node_modules\duckdb-async\node_modules\duckdb\lib\binding\duckdb.node out\binding\
copy /y node_modules\parquet-wasm\node\parquet_wasm_bg.wasm out\

REM Run esbuild for extension.ts
esbuild src\extension.ts --bundle --outfile=out\extension.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify

REM Run esbuild for worker.ts
esbuild src\worker.ts --bundle --outfile=out\worker.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify