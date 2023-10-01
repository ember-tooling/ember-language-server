/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';

import { TextDocument } from 'vscode-languageserver-textdocument';

import {
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
  WorkspaceFoldersChangeEvent,
  TextDocumentSyncKind,
  ReferenceParams,
  Location,
  ExecuteCommandParams,
  TextDocumentChangeEvent,
  ExecuteCommandRequest,
  HoverParams,
  Hover,
  FoldingRangeParams,
  FoldingRange,
} from 'vscode-languageserver';

import ProjectRoots from './project-roots';
import { Project, Executors } from './project';
import DefinitionProvider from './definition-providers/entry';
import TemplateLinter from './template-linter';
import DocumentSymbolProvider from './symbols/document-symbol-provider';
import JSDocumentSymbolProvider from './symbols/js-document-symbol-provider';
import HBSDocumentSymbolProvider from './symbols/hbs-document-symbol-provider';
import { ReferenceProvider } from './reference-provider/entry';
import { CodeActionProvider } from './code-action-provider/entry';
import { log, setConsole, logError, logInfo, logDebugInfo } from './utils/logger';
import TemplateCompletionProvider from './completion-provider/template-completion-provider';
import ScriptCompletionProvider from './completion-provider/script-completion-provider';
import {
  getRegistryForRoot,
  addToRegistry,
  REGISTRY_KIND,
  normalizeMatchNaming,
  IRegistry,
  getRegistryForRoots,
  disableTemplateTokensCollection,
  enableTemplateTokensCollection,
} from './utils/registry-api';
import { Usage, findRelatedFiles, waitForTokensToBeCollected, getAllTemplateTokens, ITemplateTokens } from './utils/usages-api';
import { URI } from 'vscode-uri';
import { MatchResultType } from './utils/path-matcher';
import { FileChangeType } from 'vscode-languageserver/node';
// @ts-expect-error esmodule
import * as debounce from 'lodash/debounce';
import { Config, Initializer } from './types';
import { asyncGetJSON, isFileBelongsToRoots, mGetProjectAddonsInfo, setRequireSupport, setSyncFSSupport } from './utils/layout-helpers';
import FSProvider, { AsyncFsProvider, setFSImplementation } from './fs-provider';
import { HoverProvider } from './hover-provider/entry';
import FoldingProvider from './folding-provider/entry';

export interface IServerConfig {
  local: Config;
}

export interface ServerOptions {
  type: 'node' | 'worker';
  fs: 'sync' | 'async';
}

const defaultServerOptions: ServerOptions = { type: 'node', fs: 'sync' };

export default class Server {
  flags = {
    hasExternalFileWatcher: false,
  };
  options!: ServerOptions;
  fs!: FSProvider;
  initializers: Initializer[] = [];
  lazyInit = false;
  // Create a connection for the server. The connection defaults to Node's IPC as a transport, but
  // also supports stdio via command line flag
  connection!: Connection;
  // Create a simple text document manager. The text document manager
  // supports full document sync only
  documents!: TextDocuments<TextDocument>;
  projectRoots!: ProjectRoots;
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

  async setConfiguration(config: Config) {
    // in worker mode we don't have fs access, so, we don't trying to include it
    if (this.options.type !== 'worker') {
      if (config.addons) {
        await this.projectRoots.setLocalAddons(config.addons);
      }
    }

    if (config.ignoredProjects) {
      this.projectRoots.setIgnoredProjects(config.ignoredProjects);
    }

    if (this.options.type === 'node') {
      if (config.useBuiltinLinting === false) {
        this.templateLinter.disable();
      } else if (config.useBuiltinLinting === true) {
        this.templateLinter.enable();
      }
    } else {
      this.templateLinter.disable();
    }

    if (config.collectTemplateTokens === false) {
      disableTemplateTokensCollection();
    } else if (config.collectTemplateTokens === true) {
      enableTemplateTokensCollection();
    }

    if (config.useBuiltinFoldingRangeProvider === false) {
      this.foldingProvider.disable();
    } else if (config.useBuiltinFoldingRangeProvider === true) {
      this.foldingProvider.enable();
    }
  }

  documentSymbolProviders!: DocumentSymbolProvider[];

  templateCompletionProvider!: TemplateCompletionProvider;
  scriptCompletionProvider!: ScriptCompletionProvider;

  definitionProvider!: DefinitionProvider;
  foldingProvider!: FoldingProvider;

  templateLinter!: TemplateLinter;

  referenceProvider!: ReferenceProvider;
  hoverProvider!: HoverProvider;
  codeActionProvider!: CodeActionProvider;
  async executeInitializers() {
    logInfo('UELS: executeInitializers');

    for (const initializer of this.initializers) {
      await initializer();
    }

    this.initializers = [];
  }
  private onInitialized() {
    if (this.connection.workspace && this.clientCapabilities && this.clientCapabilities.workspace && this.clientCapabilities.workspace.workspaceFolders) {
      this.connection.workspace.onDidChangeWorkspaceFolders(this.onDidChangeWorkspaceFolders.bind(this));
    }

    this.executors['els.setConfig'] = async (_, __, [config]: [IServerConfig]) => {
      try {
        await this.setConfiguration(config.local);
      } catch (e) {
        logError(e);
      }

      if (this.lazyInit) {
        try {
          await this.executeInitializers();
        } catch (e) {
          logError(e);
        }
      }
    };

    this.executors['els.registerProjectPath'] = async (_, __, [projectPath]: [string]) => {
      return await this.projectRoots.onProjectAdd(projectPath);
    };

    this.executors['els.provideDiagnostics'] = async (_, __, [document]: [TextDocument]) => {
      return await this.runAddonLinters(document);
    };

    this.executors['els.getProjectRegistry'] = async (_, __, [filePath]: [string]) => {
      const fullPath = path.resolve(filePath);
      const project = this.projectRoots.projectForPath(fullPath);

      if (!project) {
        return {
          msg: 'Unable to find project by given file path, try to register it first, using els.registerProjectPath command',
          path: filePath,
        };
      }

      await mGetProjectAddonsInfo(project.root);
      project.invalidateRegistry();

      return {
        projectName: project.name,
        root: project.root,
        roots: project.roots,
        registry: project.registry,
      };
    };

    this.executors['els.getLegacyTemplateTokens'] = async (_, __, [projectPath]: [string]) => {
      const project = this.projectRoots.projectForPath(projectPath);

      if (!project) {
        logDebugInfo('els.getLegacyTemplateTokens: no project');

        return {
          msg: 'Unable to find project for path',
          path: projectPath,
        };
      }

      logDebugInfo('els.getLegacyTemplateTokens [before collect]');

      await waitForTokensToBeCollected();

      const allTokens = getAllTemplateTokens();

      const projectTokens: ITemplateTokens = {
        component: {},
        routePath: {},
      };

      Object.keys(allTokens).forEach((key: keyof ITemplateTokens) => {
        Object.keys(allTokens[key]).forEach((pathName) => {
          const meta = allTokens[key][pathName];

          if (isFileBelongsToRoots(project.roots, meta.source)) {
            projectTokens[key][pathName] = {
              source: meta.source,
              tokens: meta.tokens,
            };
          }
        });
      });

      return {
        projectName: project.name,
        root: project.root,
        roots: project.roots,
        tokens: projectTokens,
      };
    };

    this.executors['els.reloadProject'] = async (_, __, [projectPath, force]: [string, boolean?]) => {
      if (projectPath) {
        const project = this.projectRoots.projectForPath(projectPath);

        if (project) {
          await this.projectRoots.reloadProject(project.root);

          return {
            msg: `Project reloaded`,
            path: project.root,
          };
        } else {
          if (force) {
            const results = await this.projectRoots.onProjectAdd(projectPath);
            const project = this.projectRoots.projectForPath(projectPath);

            return {
              msg: `Project added`,
              path: project ? project.root : 'unable to resolve project path',
              results,
            };
          } else {
            return {
              msg: 'No project found',
              path: projectPath,
            };
          }
        }
      } else {
        await this.projectRoots.reloadProjects();

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
          const registryResults: string[] = project.registry[normalizedItem.type][normalizedItem.name] || [];

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
  constructor(connection: Connection, options: ServerOptions = defaultServerOptions) {
    if (!connection) {
      throw new Error('uELS constructor accept connection instance as first argument');
    }

    if (globalThis.process) {
      globalThis.process.title = 'unstable_ember_language_server';
    }

    this.options = { ...defaultServerOptions, ...options };
    this.connection = connection;
    this.fs = this.options.fs === 'sync' ? new FSProvider() : new AsyncFsProvider(this);

    setSyncFSSupport(this.options.fs === 'sync');
    setRequireSupport(this.options.type === 'node');

    // Make the text document manager listen on the connection
    // for open, change and close text document events

    setConsole(this.connection.console);
    setFSImplementation(this.fs);

    this.templateLinter = new TemplateLinter(this);
    this.projectRoots = new ProjectRoots(this);
    this.documents = new TextDocuments(TextDocument);

    this.documentSymbolProviders = [new JSDocumentSymbolProvider(), new HBSDocumentSymbolProvider()];

    this.templateCompletionProvider = new TemplateCompletionProvider(this);
    this.scriptCompletionProvider = new ScriptCompletionProvider(this);
    this.definitionProvider = new DefinitionProvider(this);
    this.referenceProvider = new ReferenceProvider(this);
    this.hoverProvider = new HoverProvider(this);
    this.codeActionProvider = new CodeActionProvider(this);
    this.foldingProvider = new FoldingProvider(this);

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
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    this.connection.onExecuteCommand(this.onExecute.bind(this));
    this.connection.onReferences(this.onReference.bind(this));
    this.connection.onHover(this.onHover.bind(this));
    this.connection.onCodeAction(this.onCodeAction.bind(this));
    this.connection.onFoldingRanges(this.onFoldingRanges.bind(this));
    this.connection.telemetry.logEvent({ connected: true });
  }

  onFoldingRanges(params: FoldingRangeParams): FoldingRange[] | null {
    return this.foldingProvider.onFoldingRanges(params);
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

  // After the server has started the client sends an initilize request. The server receives
  // in the passed params the rootPath of the workspace plus the client capabilites.
  private async onInitialize({ rootUri, rootPath, workspaceFolders, initializationOptions, capabilities }: InitializeParams): Promise<InitializeResult> {
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
      await this.onInitialized();
      setConsole(null); //no console for testing as we use stdio for communication
    }

    log(`Initializing Ember Language Server at ${rootPath}`);

    this.initializers.push(async () => {
      await this.projectRoots.initialize(rootPath as string);

      if (workspaceFolders && Array.isArray(workspaceFolders)) {
        for (const folder of workspaceFolders) {
          const folderPath = URI.parse(folder.uri).fsPath;

          if (folderPath && rootPath !== folderPath) {
            await this.projectRoots.findProjectsInsideRoot(folderPath);
          }
        }
      }
    });

    if (!this.lazyInit) {
      await this.executeInitializers();
    }
    // this.setStatusText('Initialized');

    const info: { name: string; version: string } = (await asyncGetJSON(path.join(__dirname, './../package.json'))) as { name: string; version: string };

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
        foldingRangeProvider: true,
        codeActionProvider: true,
        referencesProvider: true,
        hoverProvider: true,
        workspace: {
          workspaceFolders: {
            supported: true,
            changeNotifications: true,
          },
        },
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.', '::', '$', '=', '/', '{{', '(', '<', '@', 'this.', '<:', '"', "'"],
        },
      },
    };
  }

  executors: Executors = {};

  sendCommand(command: string, ...options: unknown[]) {
    return this.connection.sendRequest(ExecuteCommandRequest.type.method, {
      command,
      arguments: options,
    });
  }

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

  private async onDidChangeConfiguration({ settings }: { settings: Config }) {
    await this.setConfiguration(settings);
  }

  private async onReference(params: ReferenceParams): Promise<Location[]> {
    return await this.referenceProvider.provideReferences(params);
  }

  private async onHover(params: HoverParams): Promise<Hover | null> {
    return await this.hoverProvider.provideHover(params);
  }

  private async onDefinition(params: TextDocumentPositionParams) {
    return this.definitionProvider.handle(params);
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
      logDebugInfo('onCompletionError', textDocumentPosition, e, e.stack, e.toString());
    }

    // this.setStatusText('Running');
    return completionItems;
  }

  // public setStatusText(text: string) {
  // this.connection.sendNotification('els.setStatusBarText', [text]);
  // }

  private async onDocumentSymbol(params: DocumentSymbolParams): Promise<SymbolInformation[]> {
    const uri = params.textDocument.uri;
    const filePath = URI.parse(uri).fsPath;

    if (!filePath) {
      return [];
    }

    const extension = path.extname(filePath);

    const providers = this.documentSymbolProviders.filter((provider) => provider.extensions.indexOf(extension) !== -1);

    if (providers.length === 0) return [];

    const content = await this.fs.readFile(filePath);

    if (content === null) {
      return [];
    }

    return providers.map((providers) => providers.process(content)).reduce((a, b) => a.concat(b), []);
  }
}
