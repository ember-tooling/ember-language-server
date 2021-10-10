'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const buildName = process.env.npm_lifecycle_event;
// build:bundle:node

// console.log(process.env.npm_lifecycle_event);

/**@type {import('webpack').Configuration}*/
const nodeBundleConfig = {
  target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: './src/server.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.join(__dirname, 'dist', 'bundled'),
    filename: 'node-server.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  // devtool: 'source-map',
  module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
  }
};

const workerBundleConfig = /** @type WebpackConfig */ {
	mode: 'none',
	target: 'webworker', // web extensions run in a webworker context
	entry: {
		'start-worker-server': './src/start-worker-server.ts',
	},
	output: {
		filename: 'start-worker-server.js',
		path: path.join(__dirname, 'dist', 'bundled'),
		libraryTarget: 'var',
		library: 'serverExportVar',
	},
	resolve: {
		mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {},
		fallback: {
			path: require.resolve("path-browserify"),
      util: false,
      os: false,
      fs: false,
      tty: false,
      assert: false,
      debug: false,
      net: false,
      stream: false,
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	// devtool: 'source-map',
};

const configs = [
  {
    name: 'build:bundle:node',
    config: nodeBundleConfig
  },
  {
    name: 'build:bundle:worker',
    config: workerBundleConfig
  }
];

module.exports = configs.filter(({name}) => name.startsWith(buildName)).map(e => e.config);
