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
  SymbolInformation,
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

import ProjectRoots from './project-roots';
import DefinitionProvider from './definition-provider';
import DocumentSymbolProvider from './symbols/document-symbol-provider';
import JSDocumentSymbolProvider from './symbols/js-document-symbol-provider';
import HBSDocumentSymbolProvider from './symbols/hbs-document-symbol-provider';

export default class Server {

  // Create a connection for the server. The connection uses Node's IPC as a transport
  connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

  // Create a simple text document manager. The text document manager
  // supports full document sync only
  documents: TextDocuments = new TextDocuments();

  projectRoots: ProjectRoots = new ProjectRoots(this);

  documentSymbolProviders: DocumentSymbolProvider[] = [
    new JSDocumentSymbolProvider(),
    new HBSDocumentSymbolProvider(),
  ];

  definitionProvider: DefinitionProvider = new DefinitionProvider(this);

  constructor() {
    // Make the text document manager listen on the connection
    // for open, change and close text document events
    this.documents.listen(this.connection);

    // Bind event handlers
    this.connection.onInitialize(this.onInitialize.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onDefinition(this.definitionProvider.handler);
  }

  listen() {
    this.connection.listen();
  }

  // After the server has started the client sends an initilize request. The server receives
  // in the passed params the rootPath of the workspace plus the client capabilites.
  private onInitialize(params: InitializeParams): InitializeResult {
    console.log('Initializing Ember Language Server');

    this.projectRoots.initialize(params);

    return {
      capabilities: {
        // Tell the client that the server works in FULL text document sync mode
        textDocumentSync: this.documents.syncKind,

        definitionProvider: true,
        documentSymbolProvider: true,
      }
    };
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

    let providers = this.documentSymbolProviders
      .filter(provider => provider.extensions.indexOf(extension) !== -1);

    if (providers.length === 0) return [];

    let content = readFileSync(filePath, 'utf-8');

    return providers
      .map(providers => providers.process(content))
      .reduce((a, b) => a.concat(b), []);
  }
}
