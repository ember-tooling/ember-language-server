/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as fs from 'fs';

import { TextDocument } from 'vscode-languageserver-textdocument';

import {
  IPCMessageReader,
  IPCMessageWriter,
  createConnection,
  DidChangeWatchedFilesParams,
  IConnection,
  TextDocuments,
  InitializeResult,
  Diagnostic,
  InitializeParams,
  CodeActionParams,
  Command,
  CodeAction,
  DocumentSymbolParams,
  SymbolInformation,
  TextDocumentPositionParams,
  CompletionItem,
  StreamMessageReader,
  WorkspaceFoldersChangeEvent,
  TextDocumentSyncKind,
  StreamMessageWriter,
  ReferenceParams,
  Location
} from 'vscode-languageserver';

import ProjectRoots, { Project, Executors } from './project-roots';
import DefinitionProvider from './definition-providers/entry';
import TemplateLinter from './template-linter';
import DocumentSymbolProvider from './symbols/document-symbol-provider';
import JSDocumentSymbolProvider from './symbols/js-document-symbol-provider';
import HBSDocumentSymbolProvider from './symbols/hbs-document-symbol-provider';
import { ReferenceProvider } from './reference-provider/entry';
import { CodeActionProvider } from './code-action-provider/entry';
import { log, setConsole, logError, logInfo } from './utils/logger';
import TemplateCompletionProvider from './completion-provider/template-completion-provider';
import ScriptCompletionProvider from './completion-provider/script-completion-provider';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import { getRegistryForRoot, addToRegistry, REGISTRY_KIND, normalizeMatchNaming } from './utils/registry-api';
import { Usage, findRelatedFiles } from './utils/usages-api';

export default class Server {
  initializers: any[] = [];
  lazyInit: boolean = false;
  // Create a connection for the server. The connection defaults to Node's IPC as a transport, but
  // also supports stdio via command line flag
  connection: IConnection = process.argv.includes('--stdio')
    ? createConnection(new StreamMessageReader(process.stdin), new StreamMessageWriter(process.stdout))
    : createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

  // Create a simple text document manager. The text document manager
  // supports full document sync only
  documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  projectRoots: ProjectRoots = new ProjectRoots(this);
  addToRegistry(normalizedName: string, kind: REGISTRY_KIND, fullPath: string | string[]) {
    let rawPaths = Array.isArray(fullPath) ? fullPath : [fullPath];
    let purePaths = rawPaths.filter((p) => path.isAbsolute(p));
    if (purePaths.length) {
      addToRegistry(normalizedName, kind, purePaths);
      return true;
    } else {
      return false;
    }
  }
  getUsages(normalizedToken: string): Usage[] {
    return findRelatedFiles(normalizedToken);
  }
  getRegistry(rawRoot: string) {
    return getRegistryForRoot(path.resolve(rawRoot));
  }

  documentSymbolProviders: DocumentSymbolProvider[] = [new JSDocumentSymbolProvider(), new HBSDocumentSymbolProvider()];

  templateCompletionProvider: TemplateCompletionProvider = new TemplateCompletionProvider(this);
  scriptCompletionProvider: ScriptCompletionProvider = new ScriptCompletionProvider(this);

  definitionProvider: DefinitionProvider = new DefinitionProvider(this);

  templateLinter: TemplateLinter = new TemplateLinter(this);

  referenceProvider: ReferenceProvider = new ReferenceProvider(this);
  codeActionProvider: CodeActionProvider = new CodeActionProvider(this);
  executeInitializers() {
    this.initializers.forEach((cb: any) => cb());
    this.initializers = [];
  }
  private onInitilized() {
    this.connection.workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders.bind(this));

    this.executors['els.setConfig'] = async (_, __, [config]) => {
      this.projectRoots.setLocalAddons(config.local.addons);
      if (this.lazyInit) {
        this.executeInitializers();
      }
    };
    this.executors['els.reloadProject'] = async (_, __, [projectPath]) => {
      if (projectPath) {
        const project = this.projectRoots.projectForPath(projectPath);
        if (project) {
          this.projectRoots.reloadProject(project.root);
        }
      } else {
        this.projectRoots.reloadProjects();
      }
    };
    this.executors['els.getRelatedFiles'] = async (_, __, [filePath]) => {
      const fullPath = path.resolve(filePath);
      const project = this.projectRoots.projectForPath(filePath);
      if (project) {
        const item = project.matchPathToType(fullPath);
        if (item) {
          let normalizedItem = normalizeMatchNaming(item);
          return this.getRegistry(project.root)[normalizedItem.type][normalizedItem.name] || [];
        }
      }

      return [];
    };
    this.executors['els.getKindUsages'] = async (_, __, [filePath]) => {
      const fullPath = path.resolve(filePath);
      const project = this.projectRoots.projectForPath(filePath);
      if (project) {
        const item = project.matchPathToType(fullPath);
        if (item) {
          return {
            name: item.name,
            path: filePath,
            type: item.type,
            usages: this.getUsages(item.name).map((usage) => {
              if (usage.type === 'routePath') {
                return {
                  ...usage,
                  type: 'template'
                };
              }
              return usage;
            })
          };
        }
      }

      return [];
    };
  }
  private async onCodeAction(params: CodeActionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    try {
      const results = await this.codeActionProvider.provideCodeActions(params);
      return results;
    } catch (e) {
      logError(e);
      return null;
    }
  }
  constructor() {
    // Make the text document manager listen on the connection
    // for open, change and close text document events

    setConsole(this.connection.console);

    this.documents.listen(this.connection);

    // Bind event handlers
    this.connection.onInitialize(this.onInitialize.bind(this));
    this.connection.onInitialized(this.onInitilized.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onDefinition(this.definitionProvider.handler);
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    this.connection.onExecuteCommand(this.onExecute.bind(this));
    this.connection.onReferences(this.onReference.bind(this));
    this.connection.onCodeAction(this.onCodeAction.bind(this));
    this.connection.telemetry.logEvent({ connected: true });
  }

  /**
   * Custom Notifications
   */

  displayInfoMessage(msg: string): void {
    this.connection.sendNotification('$/displayInfo', msg);
  }
  displayWarningMessage(msg: string): void {
    this.connection.sendNotification('$/displayWarning', msg);
  }
  displayErrorMessage(msg: string): void {
    this.connection.sendNotification('$/displayError', msg);
  }

  async onExecute(params: string[] | any) {
    if (Array.isArray(params)) {
      if (params[0] === 'els:registerProjectPath') {
        this.projectRoots.onProjectAdd(params[1]);
      }
    } else {
      if (params.command in this.executors) {
        return this.executors[params.command](this, params.command, params.arguments);
      } else {
        let [uri, ...args] = params.arguments;
        try {
          const project = this.projectRoots.projectForPath(uri);
          let result = null;
          if (project) {
            if (params.command in project.executors) {
              result = await project.executors[params.command](this, uri, args);
            }
          }
          return result;
        } catch (e) {
          logError(e);
        }
      }
    }
    return params;
  }

  listen() {
    this.connection.listen();
  }

  private onDidChangeWorkspaceFolders(event: WorkspaceFoldersChangeEvent) {
    if (event.added.length) {
      event.added.forEach((folder) => {
        this.projectRoots.findProjectsInsideRoot(folder.uri);
      });
    }
  }
  // After the server has started the client sends an initilize request. The server receives
  // in the passed params the rootPath of the workspace plus the client capabilites.
  private onInitialize({ rootUri, rootPath, workspaceFolders, initializationOptions }: InitializeParams): InitializeResult {
    rootPath = rootUri ? uriToFilePath(rootUri) : rootPath;
    if (!rootPath) {
      return { capabilities: {} };
    }
    if (initializationOptions && initializationOptions.editor && initializationOptions.editor === 'vscode') {
      logInfo('lazy init enabled, waiting for config from VSCode');
      this.lazyInit = true;
    }
    log(`Initializing Ember Language Server at ${rootPath}`);

    this.initializers.push(() => {
      this.projectRoots.initialize(rootPath as string);
      if (workspaceFolders && Array.isArray(workspaceFolders)) {
        workspaceFolders.forEach((folder) => {
          const folderPath = uriToFilePath(folder.uri);
          if (folderPath && rootPath !== folderPath) {
            this.projectRoots.findProjectsInsideRoot(folderPath);
          }
        });
      }
    });

    if (!this.lazyInit) {
      this.executeInitializers();
    }
    // this.setStatusText('Initialized');

    return {
      capabilities: {
        // Tell the client that the server works in FULL text document sync mode
        textDocumentSync: TextDocumentSyncKind.Full,
        definitionProvider: true,
        executeCommandProvider: {
          commands: [
            'els:registerProjectPath',
            'els.extractSourceCodeToComponent',
            'els.executeInEmberCLI',
            'els.getRelatedFiles',
            'els.getKindUsages',
            'els.setConfig',
            'els.reloadProject'
          ]
        },
        documentSymbolProvider: true,
        codeActionProvider: true,
        referencesProvider: true,
        workspace: {
          workspaceFolders: {
            supported: true,
            changeNotifications: true
          }
        },
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', '::', '=', '/', '{{', '(', '<', '@', 'this.']
        }
      }
    };
  }

  executors: Executors = {};

  private async onDidChangeContent(change: any) {
    // this.setStatusText('did-change');

    let lintResults = await this.templateLinter.lint(change.document);
    const results: Diagnostic[] = [];
    if (Array.isArray(lintResults)) {
      lintResults.forEach((result) => {
        results.push(result);
      });
    }
    const project: Project | undefined = this.projectRoots.projectForUri(change.document.uri);
    if (project) {
      for (let linter of project.linters) {
        try {
          let tempResults = await linter(change.document as TextDocument);
          // API must return array
          if (Array.isArray(tempResults)) {
            tempResults.forEach((el) => {
              results.push(el as Diagnostic);
            });
          }
        } catch (e) {
          logError(e);
        }
      }
    }

    this.connection.sendDiagnostics({ uri: change.document.uri, diagnostics: results });
  }

  private onDidChangeWatchedFiles(items: DidChangeWatchedFilesParams) {
    items.changes.forEach((change) => {
      let project = this.projectRoots.projectForUri(change.uri);
      if (project) {
        project.trackChange(change.uri, change.type);
      } else {
        if (change.type === 1 && change.uri.endsWith('ember-cli-build.js')) {
          const rawPath = uriToFilePath(change.uri);
          if (rawPath) {
            const filePath = path.dirname(path.resolve(rawPath));
            this.projectRoots.findProjectsInsideRoot(filePath);
          }
        }
      }
    });
    // /**
    //  * The file got created.
    //  */
    // const Created = 1;
    // /**
    //  * The file got changed.
    //  */
    // const Changed = 2;
    // /**
    //  * The file got deleted.
    //  */
    // const Deleted = 3;
  }

  private async onReference(params: ReferenceParams): Promise<Location[]> {
    return await this.referenceProvider.provideReferences(params);
  }

  private async onCompletionResolve(item: CompletionItem) {
    return item;
  }
  private async onCompletion(textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> {
    const completionItems = [];

    try {
      const [templateCompletions, scriptCompletions] = await Promise.all([
        await this.templateCompletionProvider.provideCompletions(textDocumentPosition),
        await this.scriptCompletionProvider.provideCompletions(textDocumentPosition)
      ]);
      completionItems.push(...templateCompletions, ...scriptCompletions);
    } catch (e) {
      logError(e);
      log('onCompletionError', textDocumentPosition, e, e.stack, e.toString());
    }

    // this.setStatusText('Running');
    return completionItems;
  }

  // public setStatusText(text: string) {
  // this.connection.sendNotification('els.setStatusBarText', [text]);
  // }

  private onDocumentSymbol(params: DocumentSymbolParams): SymbolInformation[] {
    let uri = params.textDocument.uri;
    let filePath = uriToFilePath(uri);
    if (!filePath) {
      return [];
    }

    let extension = path.extname(filePath);

    let providers = this.documentSymbolProviders.filter((provider) => provider.extensions.indexOf(extension) !== -1);

    if (providers.length === 0) return [];

    let content = fs.readFileSync(filePath, 'utf-8');

    return providers.map((providers) => providers.process(content)).reduce((a, b) => a.concat(b), []);
  }
}
