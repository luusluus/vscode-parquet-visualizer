//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');


/**@type {import('webpack').Configuration}*/
const mainConfig = {
  target: 'webworker', // vscode extensions run in webworker context for VS Code web 📖 -> https://webpack.js.org/configuration/target/#target
  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  node: {
    __dirname: false
  },
  devtool: 'source-map',
  externals: [
    nodeExternals(),
    {
        vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/ 
        fs: 'commonjs fs',
        worker_threads: 'commonjs worker_threads'
    }
  ],
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
    extensions: ['.js', '.ts'],
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      assert: false,
      buffer: false,
      stream: false,
      path: false,
      fs: false,
      crypto: false,
      process: false,
      net: false,
      dns: false,
      tls: false,
      util: false,
      os: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      constants: false,
      child_process: false,
      bluebird: false,
      timers: false,
      querystring: false
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        type: 'javascript/auto',
        test: /\.json$/,
        use: 'json-loader'
      },
      {
        test: /\.html$/, 
        use: 'html-loader'
      },
    ]
  }
};


const workerConfig = {
    entry: './src/worker.ts', // Entry point for your worker code
    target: 'node', // Since it's a worker
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'worker.js',
        
    },
    externals: [
        nodeExternals(),
        {
            fs: 'commonjs fs',
            worker_threads: 'commonjs worker_threads',
            libraryTarget: 'commonjs2',
        }
      ],
      resolve: {
        // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
        mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
        extensions: ['.js', '.ts'],
        alias: {
          // provides alternate implementation for node module and source files
        },
        fallback: {
          // Webpack 5 no longer polyfills Node.js core modules automatically.
          // see https://webpack.js.org/configuration/resolve/#resolvefallback
          // for the list of Node.js core module polyfills.
        //   url: require.resolve("url"),
        }
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                  {
                    loader: 'ts-loader'
                  }
                ]
            },
        ],
    },
};

module.exports = [mainConfig, workerConfig];