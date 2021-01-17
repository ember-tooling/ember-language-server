'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: './lib/server.js', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'server.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  devtool: 'source-map',
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.js'],
  },
  externals: [
    "@babel/core",
    "@babel/plugin-proposal-decorators",
    "@babel/proposal-class-properties",
    "@babel/proposal-object-rest-spread",
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator",
    "@babel/plugin-proposal-numeric-separator",
    "@babel/plugin-proposal-logical-assignment-operators",
    "@babel/plugin-proposal-private-methods",
    "@babel/plugin-proposal-async-generator-functions",
    "@babel/plugin-proposal-function-sent",
    "@babel/plugin-proposal-do-expressions"]
};

module.exports = config;
