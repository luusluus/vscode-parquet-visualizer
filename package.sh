#!/bin/bash

# Clear previous builds
rm -rf ./dist
mkdir ./dist

# Targets to build against
targets=(
    "win32-x64" # DuckDB appears to not have ia32 nor arm64 builds for Windows
    "linux-x64"
    "linux-arm64"
    "darwin-x64"
    "darwin-arm64"
)

for p in ${targets[@]}; do
    platform=$(echo $p | cut -d "-" -f 1)
    arch=$(echo $p | cut -d "-" -f 2)

    # Download the right DuckDB binary for this target
    ./node_modules/@mapbox/node-pre-gyp/bin/node-pre-gyp install --directory ./node_modules/duckdb-async/node_modules/duckdb --target_platform=$platform --target_arch=$arch --update-binary || exit 1

    # Package extension
    vsce package --target $platform-$arch --out ./dist || exit 1

done