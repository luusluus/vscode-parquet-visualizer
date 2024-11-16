@echo on
setlocal enabledelayedexpansion

echo Running build.bat

mkdir out
mkdir out\binding

@REM REM Copy required files
echo Copy required files
copy /y node_modules\duckdb-async\node_modules\duckdb\lib\binding\duckdb.node out\binding\
copy /y node_modules\parquet-wasm\node\parquet_wasm_bg.wasm out\

@REM Run esbuild for extension.ts
echo Run esbuild for extension.ts
esbuild src\extension.ts --bundle --outfile=out\extension.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify --define:process.env.AZURE_APP_INSIGHTS_CONNECTION_STRING="\"%AZURE_APP_INSIGHTS_CONNECTION_STRING%\""

if errorlevel 1 set errorlevel=0

@REM Run esbuild for worker.ts
echo Run esbuild for worker.ts
esbuild src\worker.ts --bundle --outfile=out\worker.js --external:vscode --external:nock --external:aws-sdk --external:mock-aws-s3 --format=cjs --platform=node --minify