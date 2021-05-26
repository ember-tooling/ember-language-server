import { addToRegistry, removeFromRegistry, normalizeMatchNaming, NormalizedRegistryItem, IRegistry, getRegistryForRoots } from './utils/registry-api';
import { ProjectProviders, collectProjectProviders, AddonMeta, DependencyMeta } from './utils/addon-api';
import {
  findTestsForProject,
  findAddonItemsForProject,
  findAppItemsForProject,
  isRootStartingWithFilePath,
  getDepIfExists,
  getPackageJSON,
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
      this._registry = getRegistryForRoots(this.roots);
      this._registryVersion = this.registryVersion;
      logInfo(`${this.name} registry generated, new version: ${this._registryVersion}`);
    }

    return this._registry;
  }
  trackChange(uri: string, change: FileChangeType) {
    // prevent leaks
    if (this.files.size > 10000) {
      this.registryVersion++;
      logError('too many files for project ' + this.root);
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
        addToRegistry(normalizedItem.name, normalizedItem.type, [filePath]);
      }

      if (!this.files.has(filePath)) {
        this.registryVersion++;
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
  @cached
  get packageJSON(): PackageInfo {
    return getPackageJSON(this.root);
  }
  get name() {
    return this.packageJSON.name;
  }
  constructor(public readonly root: string, addons: string[] = []) {
    super(root);
    this.providers = collectProjectProviders(root, addons);
    this.addonsMeta = this.providers.addonsMeta.filter((el) => el.root !== this.root);

    // for now, let's collect only interesting deps
    const interestingDeps = ['ember-cli', 'ember-source', 'ember-template-lint', 'typescript', '@embroider/core'];

    const pkg = this.packageJSON;

    interestingDeps.forEach((dep) => {
      const version = getDepIfExists(pkg, dep);

      if (version !== null) {
        this.dependenciesMeta.push({
          name: dep,
          version,
        });
      }
    });

    this.builtinProviders = initBuiltinProviders();
  }
  unload() {
    this.initIssues = [];
    this.destructors.forEach((fn) => {
      try {
        fn(this);
      } catch (e) {
        logError(e);
      }
    });
    logInfo('--------------------');
    logInfo(`Ember CLI project: ${this.root} unloaded`);
    logInfo('--------------------');
  }
  flags = {
    enableEagerRegistryInitialization: true,
  };
  init(server: Server) {
    this.providers.initFunctions.forEach((initFn) => {
      try {
        const initResult = initFn(server, this);

        if (typeof initResult === 'function') {
          this.destructors.push(initResult);
        }
      } catch (e) {
        logError(e);
        this.initIssues.push(e.toString());
      }
    });

    this.builtinProviders.initFunctions.forEach((initFn) => {
      try {
        const initResult = initFn(server, this);

        if (typeof initResult === 'function') {
          this.destructors.push(initResult);
        }
      } catch (e) {
        logError(e);
        this.initIssues.push(e.toString());
      }
    });

    if (this.flags.enableEagerRegistryInitialization) {
      // prefer explicit registry tree building
      findTestsForProject(this);
      findAppItemsForProject(this);
      findAddonItemsForProject(this);
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
