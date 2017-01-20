/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { basename, dirname, extname } from 'path';
import { readFileSync } from 'fs';

import {
	IPCMessageReader, IPCMessageWriter,
	createConnection, IConnection,
	TextDocuments, InitializeResult, InitializeParams, DocumentSymbolParams,
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

import { SymbolInformation, SymbolKind, Range, Position } from 'vscode-languageserver-types';

import { preprocess, traverse } from '@glimmer/syntax';

const klaw = require('klaw');

const ignoredFolders: string[] = [
	'.git',
	'bower_components',
	'node_modules',
	'tmp',
];

export default class Server {

	// Create a connection for the server. The connection uses Node's IPC as a transport
	connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

	// Create a simple text document manager. The text document manager
	// supports full document sync only
	documents: TextDocuments = new TextDocuments();

	workspaceRoot: string;

	constructor() {
		// Make the text document manager listen on the connection
		// for open, change and close text document events
		this.documents.listen(this.connection);

		// Bind event handlers
		this.connection.onInitialize(this.onInitialize.bind(this));
		this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
		this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
		this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
	}

	listen() {
		this.connection.listen();
	}

	// After the server has started the client sends an initilize request. The server receives
	// in the passed params the rootPath of the workspace plus the client capabilites.
	private onInitialize(params: InitializeParams): InitializeResult {
		this.workspaceRoot = params.rootPath;

		console.log(`Initializing Ember Language Server in ${this.workspaceRoot}`);

		findProjectRoots(this.workspaceRoot).then(projectRoots => {
			console.log(`Ember CLI projects found at:${projectRoots.map(it => `\n- ${it}`)}`);
		});

		return {
			capabilities: {
				// Tell the client that the server works in FULL text document sync mode
				textDocumentSync: this.documents.syncKind,

				documentSymbolProvider: true,
			}
		}
	}

	private onDidChangeContent(change) {
		// here be dragons
	}

	private onDidChangeWatchedFiles(change) {
		// here be dragons
	}

	private onDocumentSymbol(params: DocumentSymbolParams): SymbolInformation[] {
		let uri = params.textDocument.uri;
		let filePath = uriToFilePath(uri);
		let extension = extname(filePath);
		if (extension === '.hbs') {
			let ast = preprocess(readFileSync(filePath, 'utf-8'));

			let symbols: SymbolInformation[] = [];

			traverse(ast, {
				BlockStatement(node) {
					if (node.program.blockParams.length === 0) return;

					node.program.blockParams.forEach(blockParam => {
						let symbol = SymbolInformation.create(blockParam, SymbolKind.Variable, locToRange(node.loc));
						symbols.push(symbol);
					});
				}
			});

			return symbols;
		}
		return [];
	}
}

function locToRange(loc): Range {
	let start = Position.create(loc.start.line - 1, loc.start.column);
	let end = Position.create(loc.end.line - 1, loc.end.column);
	return Range.create(start, end);
}

export function findProjectRoots(workspaceRoot: string): Promise<string[]> {
	return new Promise(resolve => {
		let filter = it => ignoredFolders.indexOf(basename(it)) === -1;

		let projectRoots = [];
		klaw(workspaceRoot, { filter })
			.on('data', item => {
				if (basename(item.path) === 'ember-cli-build.js') {
					projectRoots.push(dirname(item.path));
				}
			})
			.on('end', () => resolve(projectRoots));
	});
}
