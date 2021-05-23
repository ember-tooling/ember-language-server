import { PodMatcher, ClassicPathMatcher } from './utils/path-matcher';
import { addToRegistry, removeFromRegistry, normalizeMatchNaming, NormalizedRegistryItem } from './utils/registry-api';
import { ProjectProviders, collectProjectProviders, initBuiltinProviders, AddonMeta, DependencyMeta } from './utils/addon-api';
import {
  getPodModulePrefix,
  findTestsForProject,
  findAddonItemsForProject,
  findAppItemsForProject,
  isRootStartingWithFilePath,
  getDepIfExists,
  getPackageJSON,
  cached,
  PackageInfo,
} from './utils/layout-helpers';
import Server from './server';
import { Diagnostic, FileChangeType } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import { logError, logInfo } from './utils/logger';
import { URI } from 'vscode-uri';

export type Executor = (server: Server, command: string, args: unknown[]) => Promise<unknown>;
export type Destructor = (project: Project) => void;
export type Linter = (document: TextDocument) => Promise<Diagnostic[] | null>;
export type Watcher = (uri: string, change: FileChangeType) => void;
export interface Executors {
  [key: string]: Executor;
}

export class Project {
  private classicMatcher!: ClassicPathMatcher;
  private podMatcher!: PodMatcher;
  providers!: ProjectProviders;
  builtinProviders!: ProjectProviders;
  addonsMeta: AddonMeta[] = [];
  dependenciesMeta: DependencyMeta[] = [];
  executors: Executors = {};
  watchers: Watcher[] = [];
  destructors: Destructor[] = [];
  linters: Linter[] = [];
  initIssues: Error[] = [];
  files: Map<string, { version: number }> = new Map();
  podModulePrefix = '';
  @cached
  get roots() {
    const mainRoot = this.root;
    const otherRoots = this.addonsMeta.filter((addon) => addon.version !== null).map((meta) => meta.root);
    const ignoredParts = ['node_modules'];
    const filteredRoots = otherRoots.filter((el) => {
      return ignoredParts.every((part) => !el.includes(part));
    });
    // because all registry searches based on "startsWith", we could omit roots in same namespace,
    // like {root/a, root/b}, because we will get results of it from {root} itself
    const differentRoots = filteredRoots.filter((root) => !isRootStartingWithFilePath(root, mainRoot));

    return [mainRoot, ...differentRoots];
  }
  matchPathToType(filePath: string) {
    return this.classicMatcher.metaFromPath(filePath) || this.podMatcher.metaFromPath(filePath);
  }
  trackChange(uri: string, change: FileChangeType) {
    // prevent leaks
    if (this.files.size > 10000) {
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
      this.files.delete(filePath);

      if (normalizedItem) {
        removeFromRegistry(normalizedItem.name, normalizedItem.type, [filePath]);
      }
    } else {
      if (normalizedItem) {
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
  @cached
  get packageJSON(): PackageInfo {
    return getPackageJSON(this.root);
  }
  get name() {
    return this.packageJSON.name;
  }
  constructor(public readonly root: string, addons: string[]) {
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
    const maybePrefix = getPodModulePrefix(root);

    if (maybePrefix) {
      this.podModulePrefix = 'app/' + maybePrefix;
    } else {
      this.podModulePrefix = 'app';
    }

    this.classicMatcher = new ClassicPathMatcher(this.root);
    this.podMatcher = new PodMatcher(this.root, this.podModulePrefix);
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
        this.initIssues.push(e);
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
        this.initIssues.push(e);
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
  }
}
