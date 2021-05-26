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
  Connection,
  TextDocuments,
  InitializeResult,
  Diagnostic,
  InitializeParams,
  CodeActionParams,
  Command,
  ClientCapabilities,
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
  Location,
  ExecuteCommandParams,
  TextDocumentChangeEvent,
} from 'vscode-languageserver/node';

import ProjectRoots from './project-roots';
import { Project, Executors } from './project';
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
import { getRegistryForRoot, addToRegistry, REGISTRY_KIND, normalizeMatchNaming, IRegistry, getRegistryForRoots } from './utils/registry-api';
import { Usage, findRelatedFiles } from './utils/usages-api';
import { URI } from 'vscode-uri';
import { MatchResultType } from './utils/path-matcher';
import { FileChangeType } from 'vscode-languageserver/node';
import { debounce } from 'lodash';
import { Config, Initializer } from './types';

export default class Server {
  initializers: Initializer[] = [];
  lazyInit = false;
  // Create a connection for the server. The connection defaults to Node's IPC as a transport, but
  // also supports stdio via command line flag
  connection: Connection = process.argv.includes('--stdio')
    ? createConnection(new StreamMessageReader(process.stdin), new StreamMessageWriter(process.stdout))
    : createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

  // Create a simple text document manager. The text document manager
  // supports full document sync only
  documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  projectRoots: ProjectRoots = new ProjectRoots(this);
  addToRegistry(normalizedName: string, kind: REGISTRY_KIND, fullPath: string | string[]) {
    const rawPaths = Array.isArray(fullPath) ? fullPath : [fullPath];
    const purePaths = rawPaths.filter((p) => path.isAbsolute(p));

    if (purePaths.length) {
      addToRegistry(normalizedName, kind, purePaths);

      return true;
    } else {
      return false;
    }
  }
  getUsages(normalizedToken: string, resultType: MatchResultType): Usage[] {
    return findRelatedFiles(normalizedToken, resultType);
  }
  getRegistry(rawRoot: string | string[]): IRegistry {
    if (Array.isArray(rawRoot)) {
      return getRegistryForRoots(rawRoot);
    } else {
      return getRegistryForRoot(rawRoot);
    }
  }

  setConfiguration(config: Config) {
    if (config.addons) {
      this.projectRoots.setLocalAddons(config.addons);
    }

    if (config.ignoredProjects) {
      this.projectRoots.setIgnoredProjects(config.ignoredProjects);
    }

    if (config.useBuiltinLinting === false) {
      this.templateLinter.disable();
    } else if (config.useBuiltinLinting === true) {
      this.templateLinter.enable();
    }
  }

  documentSymbolProviders: DocumentSymbolProvider[] = [new JSDocumentSymbolProvider(), new HBSDocumentSymbolProvider()];

  templateCompletionProvider: TemplateCompletionProvider = new TemplateCompletionProvider(this);
  scriptCompletionProvider: ScriptCompletionProvider = new ScriptCompletionProvider(this);

  definitionProvider: DefinitionProvider = new DefinitionProvider(this);

  templateLinter: TemplateLinter = new TemplateLinter(this);

  referenceProvider: ReferenceProvider = new ReferenceProvider(this);
  codeActionProvider: CodeActionProvider = new CodeActionProvider(this);
  executeInitializers() {
    this.initializers.forEach((cb) => cb());
    this.initializers = [];
  }
  private onInitialized() {
    if (this.connection.workspace && this.clientCapabilities && this.clientCapabilities.workspace && this.clientCapabilities.workspace.workspaceFolders) {
      this.connection.workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders.bind(this));
    }

    this.executors['els.setConfig'] = async (_, __, [config]: [{ local: Config }]) => {
      this.setConfiguration(config.local);

      if (this.lazyInit) {
        this.executeInitializers();
      }
    };

    this.executors['els.registerProjectPath'] = async (_, __, [projectPath]: [string]) => {
      return this.projectRoots.onProjectAdd(projectPath);
    };

    this.executors['els.provideDiagnostics'] = async (_, __, [document]: [TextDocument]) => {
      return this.runAddonLinters(document);
    };

    this.executors['els.reloadProject'] = async (_, __, [projectPath]: [string]) => {
      if (projectPath) {
        const project = this.projectRoots.projectForPath(projectPath);

        if (project) {
          this.projectRoots.reloadProject(project.root);

          return {
            msg: `Project reloaded`,
            path: project.root,
          };
        } else {
          return {
            msg: 'No project found',
            path: projectPath,
          };
        }
      } else {
        this.projectRoots.reloadProjects();

        return {
          msg: 'Projects reloaded',
        };
      }
    };

    this.executors['els.getRelatedFiles'] = async (_, __, [filePath, flags]: [string, { includeMeta: boolean }?]) => {
      const fullPath = path.resolve(filePath);
      const project = this.projectRoots.projectForPath(filePath);
      const includeMeta = typeof flags === 'object' && flags.includeMeta === true;

      if (project) {
        const item = project.matchPathToType(fullPath);

        if (item) {
          const normalizedItem = normalizeMatchNaming(item);
          const registryResults: string[] = [];

          project.roots.forEach((root) => {
            (this.getRegistry(root)[normalizedItem.type][normalizedItem.name] || []).forEach((item) => {
              if (!registryResults.includes(item)) {
                registryResults.push(item);
              }
            });
          });

          if (!includeMeta) {
            return registryResults.sort();
          }

          return registryResults.sort().map((filePath) => {
            return {
              path: filePath,
              meta: project.matchPathToType(filePath),
            };
          });
        }
      }

      return [];
    };

    this.executors['els.getKindUsages'] = async (_, __, [filePath]: [string]) => {
      const fullPath = path.resolve(filePath);
      const project = this.projectRoots.projectForPath(filePath);

      if (project) {
        const item = project.matchPathToType(fullPath);

        if (item) {
          return {
            name: item.name,
            path: filePath,
            type: item.type,
            usages: this.getUsages(item.name, item.type).map((usage) => {
              if (usage.type === 'routePath') {
                return {
                  ...usage,
                  type: 'template',
                };
              }

              return usage;
            }),
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
  clientCapabilities!: ClientCapabilities;
  constructor() {
    // Make the text document manager listen on the connection
    // for open, change and close text document events

    setConsole(this.connection.console);

    this.documents.listen(this.connection);

    this.onDidChangeContent = this.onDidChangeContent.bind(this);
    this._onDidChangeContent = debounce(this._onDidChangeContent.bind(this), 250);

    // Bind event handlers
    this.connection.onInitialize(this.onInitialize.bind(this));
    this.connection.onInitialized(this.onInitialized.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent);
    this.documents.onDidOpen(this.onDidChangeContent);
    this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
    this.connection.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
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

  async onExecute(params: ExecuteCommandParams) {
    if (!params) {
      return;
    }

    if (params.command in this.executors) {
      const result = await this.executors[params.command](this, params.command, params.arguments || []);

      return result;
    } else {
      const [uri, ...args] = params.arguments || [];

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

    return params;
  }

  listen() {
    this.connection.listen();
  }

  private onDidChangeWorkspaceFolders(event: WorkspaceFoldersChangeEvent) {
    if (event.added.length) {
      event.added.forEach((folder) => {
        this.projectRoots.findProjectsInsideRoot(URI.parse(folder.uri).fsPath);
      });
    }
  }
  flags = {
    hasExternalFileWatcher: false,
  };
  // After the server has started the client sends an initilize request. The server receives
  // in the passed params the rootPath of the workspace plus the client capabilites.
  private onInitialize({ rootUri, rootPath, workspaceFolders, initializationOptions, capabilities }: InitializeParams): InitializeResult {
    rootPath = rootUri ? URI.parse(rootUri).fsPath : rootPath;
    this.clientCapabilities = capabilities || {};

    if (!rootPath) {
      return { capabilities: {} };
    }

    if (initializationOptions && initializationOptions.editor && initializationOptions.editor === 'vscode') {
      logInfo('lazy init enabled, waiting for config from VSCode');
      this.lazyInit = true;
      this.flags.hasExternalFileWatcher = true;
    }

    if (initializationOptions && initializationOptions.isELSTesting) {
      this.onInitialized();
      setConsole(null); //no console for testing as we use stdio for communication
    }

    log(`Initializing Ember Language Server at ${rootPath}`);

    this.initializers.push(() => {
      this.projectRoots.initialize(rootPath as string);

      if (workspaceFolders && Array.isArray(workspaceFolders)) {
        workspaceFolders.forEach((folder) => {
          const folderPath = URI.parse(folder.uri).fsPath;

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

    const info = JSON.parse(fs.readFileSync(path.join(__dirname, './../package.json'), 'utf8'));

    return {
      serverInfo: {
        name: info.name,
        version: info.version,
      },
      capabilities: {
        // Tell the client that the server works in FULL text document sync mode
        textDocumentSync: TextDocumentSyncKind.Full,
        definitionProvider: true,
        executeCommandProvider: {
          commands: [
            'els.registerProjectPath',
            'els.provideDiagnostics',
            'els.extractSourceCodeToComponent',
            'els.executeInEmberCLI',
            'els.getRelatedFiles',
            'els.getKindUsages',
            'els.setConfig',
            'els.reloadProject',
          ],
        },
        documentSymbolProvider: true,
        codeActionProvider: true,
        referencesProvider: true,
        workspace: {
          workspaceFolders: {
            supported: true,
            changeNotifications: true,
          },
        },
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', '::', '$', '=', '/', '{{', '(', '<', '@', 'this.', '<:'],
        },
      },
    };
  }

  executors: Executors = {};

  private async runAddonLinters(document: TextDocument) {
    const results: Diagnostic[] = [];
    const project: Project | undefined = this.projectRoots.projectForUri(document.uri);

    if (project) {
      for (const linter of project.linters) {
        try {
          const tempResults = await linter(document as TextDocument);

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

    return results;
  }

  lastChangeEvent!: TextDocumentChangeEvent<TextDocument>;

  private async onDidChangeContent(change: TextDocumentChangeEvent<TextDocument>) {
    this.lastChangeEvent = change;
    this._onDidChangeContent();
  }

  private async _onDidChangeContent() {
    // this.setStatusText('did-change');
    const change = this.lastChangeEvent;

    const lintResults = await this.templateLinter.lint(change.document);

    if (change !== this.lastChangeEvent) {
      return;
    }

    if (Array.isArray(lintResults)) {
      this.connection.sendDiagnostics({ version: change.document.version, uri: change.document.uri, diagnostics: lintResults });
    }

    const addonResults = await this.runAddonLinters(change.document);

    if (change !== this.lastChangeEvent) {
      return;
    }

    const project = this.projectRoots.projectForUri(change.document.uri);

    if (project) {
      project.trackChange(change.document.uri, FileChangeType.Changed);
    }

    this.connection.sendDiagnostics({
      version: change.document.version,
      uri: change.document.uri,
      diagnostics: [...(lintResults || []), ...(addonResults || [])],
    });
  }

  private onDidChangeWatchedFiles(items: DidChangeWatchedFilesParams) {
    items.changes.forEach((change) => {
      const project = this.projectRoots.projectForUri(change.uri);

      if (project) {
        project.trackChange(change.uri, change.type);
      } else {
        if (change.type === 1 && change.uri.endsWith('ember-cli-build.js')) {
          const rawPath = URI.parse(change.uri).fsPath;

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

  private onDidChangeConfiguration({ settings }: { settings: Config }) {
    this.setConfiguration(settings);
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
        await this.scriptCompletionProvider.provideCompletions(textDocumentPosition),
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
    const uri = params.textDocument.uri;
    const filePath = URI.parse(uri).fsPath;

    if (!filePath) {
      return [];
    }

    const extension = path.extname(filePath);

    const providers = this.documentSymbolProviders.filter((provider) => provider.extensions.indexOf(extension) !== -1);

    if (providers.length === 0) return [];

    const content = fs.readFileSync(filePath, 'utf-8');

    return providers.map((providers) => providers.process(content)).reduce((a, b) => a.concat(b), []);
  }
}
