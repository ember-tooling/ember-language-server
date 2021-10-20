import {
  addToRegistry,
  removeFromRegistry,
  normalizeMatchNaming,
  NormalizedRegistryItem,
  IRegistry,
  getRegistryForRoots,
  existsInRegistry,
} from './utils/registry-api';
import { ProjectProviders, collectProjectProviders, AddonMeta, DependencyMeta, emptyProjectProviders } from './utils/addon-api';
import {
  findTestsForProject,
  findAddonItemsForProject,
  findAppItemsForProject,
  isRootStartingWithFilePath,
  getDepIfExists,
  cached,
  PackageInfo,
} from './utils/layout-helpers';
import { BaseProject } from './base-project';
import Server from './server';
import { Diagnostic, FileChangeType } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import { logError, logInfo } from './utils/logger';
import { URI } from 'vscode-uri';
import { initBuiltinProviders } from './utils/builtin-addons-initializer';

export type Executor = (server: Server, command: string, args: unknown[]) => Promise<unknown>;
export type Destructor = (project: Project) => void;
export type Linter = (document: TextDocument) => Promise<Diagnostic[] | null>;
export type Watcher = (uri: string, change: FileChangeType) => void;
export interface Executors {
  [key: string]: Executor;
}

export class Project extends BaseProject {
  providers!: ProjectProviders;
  builtinProviders!: ProjectProviders;
  addonsMeta: AddonMeta[] = [];
  dependenciesMeta: DependencyMeta[] = [];
  executors: Executors = {};
  watchers: Watcher[] = [];
  destructors: Destructor[] = [];
  linters: Linter[] = [];
  initIssues: string[] = [];
  files: Map<string, { version: number }> = new Map();
  addons!: string[];
  @cached
  get roots() {
    const mainRoot = this.root;
    const otherRoots = this.addonsMeta.filter((addon) => addon.version !== null).map((meta) => meta.root);
    // because all registry searches based on "startsWith", we could omit roots in same namespace,
    // like {root/a, root/b}, because we will get results of it from {root} itself
    const differentRoots = otherRoots.filter((root) => !isRootStartingWithFilePath(mainRoot, root));

    return [mainRoot, ...differentRoots];
  }
  private registryVersion = 0;
  private _registry!: IRegistry;
  private _registryVersion = -1;
  invalidateRegistry() {
    this._registryVersion = -1;
  }
  get registry(): IRegistry {
    if (this._registryVersion !== this.registryVersion) {
      logInfo(`${this.name} registry version mismatch [${this._registryVersion}, ${this.registryVersion}], regenerating...`);
      const start = Date.now();

      this._registry = getRegistryForRoots(this.roots);
      this._registryVersion = this.registryVersion;
      logInfo(`${this.name} registry generated in ${Date.now() - start}ms, new version: ${this._registryVersion}`);
    }

    return this._registry;
  }
  trackChange(uri: string, change: FileChangeType) {
    // prevent leaks
    if (this.files.size > 10000) {
      this.registryVersion++;
      logError(new Error('too many files for project ' + this.root) as Error & { stack: string });
      this.files.clear();
    }

    const rawPath = URI.parse(uri).fsPath;

    if (!rawPath) {
      return;
    }

    const filePath = path.resolve(rawPath);
    const item = this.matchPathToType(filePath);
    let normalizedItem: undefined | NormalizedRegistryItem = undefined;

    if (item) {
      normalizedItem = normalizeMatchNaming(item) as NormalizedRegistryItem;
    }

    if (change === 3) {
      this.registryVersion++;
      this.files.delete(filePath);

      if (normalizedItem) {
        removeFromRegistry(normalizedItem.name, normalizedItem.type, [filePath]);
      }
    } else {
      if (normalizedItem) {
        if (!existsInRegistry(normalizedItem.name, normalizedItem.type, filePath)) {
          this.registryVersion++;
        }

        // we still call it, because for template case, we have to update it's tokens
        addToRegistry(normalizedItem.name, normalizedItem.type, [filePath]);
      }

      if (!this.files.has(filePath)) {
        this.files.set(filePath, { version: 0 });
      }

      const file = this.files.get(filePath);

      if (file) {
        file.version++;
      }
    }

    this.watchers.forEach((cb) => cb(uri, change));
  }
  addCommandExecutor(key: string, cb: Executor) {
    this.executors[key] = cb;
  }
  addLinter(cb: Linter) {
    this.linters.push(cb);
  }
  addWatcher(cb: Watcher) {
    this.watchers.push(cb);
  }
  _packageJSON!: PackageInfo;
  @cached
  get packageJSON(): PackageInfo {
    return this._packageJSON;
  }
  get name() {
    return this.packageJSON.name ?? '[Unknown Project]';
  }
  async initialize(server: Server) {
    if (server.options.type === 'worker') {
      this.providers = emptyProjectProviders();
      this.flags.enableEagerRegistryInitialization = false;
    } else if (server.options.type === 'node') {
      this.providers = await collectProjectProviders(this.root, this.addons);
    } else {
      throw new Error(`Unknown server type: "${server.options.type}"`);
    }

    this.addonsMeta = this.providers.addonsMeta.filter((el) => el.root !== this.root);
    this.builtinProviders = initBuiltinProviders(this.addonsMeta);
  }
  constructor(public readonly root: string, addons: string[] = [], pkg: PackageInfo = {}) {
    super(root);
    this.addons = addons;
    this.addonsMeta = [];
    this._packageJSON = pkg;
    // for now, let's collect only interesting deps
    const interestingDeps = ['ember-cli', 'ember-source', 'ember-template-lint', 'typescript', '@embroider/core'];

    interestingDeps.forEach((dep) => {
      const version = getDepIfExists(pkg, dep);

      if (version !== null) {
        this.dependenciesMeta.push({
          name: dep,
          version,
        });
      }
    });
  }
  async unload() {
    this.initIssues = [];

    for (const fn of this.destructors) {
      try {
        await fn(this);
      } catch (e) {
        logError(e);
      }
    }

    this.files.clear();
    this.destructors = [];
    this.linters = [];
    this.watchers = [];
    this.executors = {};

    logInfo('--------------------');
    logInfo(`Ember CLI project: ${this.root} unloaded`);
    logInfo('--------------------');
  }
  flags = {
    enableEagerRegistryInitialization: true,
  };
  async init(server: Server) {
    for (const initFn of this.providers.initFunctions) {
      try {
        const initResult = await initFn(server, this);

        if (typeof initResult === 'function') {
          this.destructors.push(initResult);
        }
      } catch (e) {
        logError(e);
        this.initIssues.push(e.toString());
        this.initIssues.push(e.stack);
      }
    }

    for (const initFn of this.builtinProviders.initFunctions) {
      try {
        const initResult = await initFn(server, this);

        if (typeof initResult === 'function') {
          this.destructors.push(initResult);
        }
      } catch (e) {
        logError(e);
        this.initIssues.push(e.toString());
        this.initIssues.push(e.stack);
      }
    }

    if (this.flags.enableEagerRegistryInitialization) {
      // prefer explicit registry tree building
      await Promise.all([findTestsForProject(this), findAppItemsForProject(this), findAddonItemsForProject(this)]);
    }

    if (this.providers.info.length) {
      logInfo('--------------------');
      logInfo('loaded language server addons:');
      this.providers.info.forEach((addonName) => {
        logInfo('    ' + addonName);
      });
      logInfo('--------------------');
    }

    if (this.initIssues.length) {
      logInfo('---- Found init issues: -----');

      this.initIssues.forEach((issue) => {
        logInfo('--------------------');
        logInfo(issue);
        logInfo('--------------------');
      });
    }
  }
}
