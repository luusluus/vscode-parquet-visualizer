@echo on

echo Running build.bat

echo clearing previous build
mkdir out
mkdir out\binding

@REM REM Copy required files
@REM copy /y node_modules\duckdb-async\node_modules\duckdb\lib\binding\duckdb.node out\binding\
@REM copy /y node_modules\parquet-wasm\node\parquet_wasm_bg.wasm out\

@REM Run esbuild for extension.ts
@REM echo Run esbuild for extension.ts
@REM esbuild src\extension.ts --bundle --outfile=out\extension.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify --define:process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING="\"%AZURE_APP_INSIGHTS_CONNECTION_STRING%\""

@REM Run esbuild for worker.ts
@REM echo Run esbuild for worker.ts
@REM esbuild src\worker.ts --bundle --outfile=out\worker.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify