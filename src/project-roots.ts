'use strict';

import * as path from 'path';
import { logError, logInfo } from './utils/logger';
import * as walkSync from 'walk-sync';
import { URI } from 'vscode-uri';
import * as fs from 'fs';
import {
  isGlimmerNativeProject,
  isGlimmerXProject,
  getPodModulePrefix,
  findTestsForProject,
  findAddonItemsForProject,
  findAppItemsForProject,
  isELSAddonRoot,
} from './utils/layout-helpers';
import { addToRegistry, removeFromRegistry, normalizeMatchNaming, NormalizedRegistryItem } from './utils/registry-api';
import { ProjectProviders, collectProjectProviders, initBuiltinProviders, AddonMeta } from './utils/addon-api';
import Server from './server';
import { Diagnostic, FileChangeType } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PodMatcher, ClassicPathMatcher } from './utils/path-matcher';
export type Executor = (server: Server, command: string, args: any[]) => Promise<any>;
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
  executors: Executors = {};
  watchers: Watcher[] = [];
  destructors: Destructor[] = [];
  linters: Linter[] = [];
  initIssues: Error[] = [];
  files: Map<string, { version: number }> = new Map();
  podModulePrefix = '';
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
  constructor(public readonly root: string, addons: string[]) {
    this.providers = collectProjectProviders(root, addons);
    this.addonsMeta = this.providers.addonsMeta.filter((el) => el.root !== this.root);
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
  init(server: Server) {
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
    // prefer explicit registry tree building
    findTestsForProject(this);
    findAppItemsForProject(this);
    findAddonItemsForProject(this);
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

export default class ProjectRoots {
  constructor(private server: Server) {}
  workspaceRoot: string;

  projects = new Map<string, Project>();

  localAddons: string[] = [];

  reloadProjects() {
    Array.from(this.projects).forEach(([root]) => {
      this.reloadProject(root);
    });
  }

  reloadProject(projectRoot: string) {
    this.removeProject(projectRoot);
    this.onProjectAdd(projectRoot);
  }

  removeProject(projectRoot: string) {
    const project = this.projectForPath(projectRoot);

    if (project) {
      project.unload();
    }

    this.projects.delete(projectRoot);
  }

  setLocalAddons(paths: string[]) {
    paths.forEach((element: string) => {
      const addonPath = path.resolve(element);

      if (fs.existsSync(addonPath) && isELSAddonRoot(addonPath)) {
        if (!this.localAddons.includes(addonPath)) {
          this.localAddons.push(addonPath);
        }
      }
    });
  }

  findProjectsInsideRoot(workspaceRoot: string) {
    const roots = walkSync(workspaceRoot, {
      directories: false,
      globs: ['**/ember-cli-build.js', '**/package.json'],
      ignore: ['**/.git/**', '**/bower_components/**', '**/dist/**', '**/node_modules/**', '**/tmp/**'],
    });

    roots.forEach((rootPath: string) => {
      const filePath = path.join(workspaceRoot, rootPath);
      const fullPath = path.dirname(filePath);

      if (filePath.endsWith('package.json')) {
        try {
          if (isGlimmerNativeProject(fullPath) || isGlimmerXProject(fullPath)) {
            this.onProjectAdd(fullPath);
          }
        } catch (e) {
          logError(e);
        }
      } else {
        this.onProjectAdd(fullPath);
      }
    });
  }

  async initialize(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    this.findProjectsInsideRoot(this.workspaceRoot);
  }

  onProjectAdd(rawPath: string) {
    const projectPath = path.resolve(URI.parse(rawPath).fsPath);

    if (this.projects.has(projectPath)) {
      const project = this.projects.get(projectPath) as Project;

      return {
        initIssues: project.initIssues,
        providers: project.providers,
        registry: this.server.getRegistry(project.root),
      };
    }

    try {
      const project = new Project(projectPath, this.localAddons);

      this.projects.set(projectPath, project);
      logInfo(`Ember CLI project added at ${projectPath}`);
      project.init(this.server);

      return {
        initIssues: project.initIssues,
        providers: project.providers,
        registry: this.server.getRegistry(project.root),
      };
    } catch (e) {
      logError(e);

      return false;
    }
  }

  projectForUri(uri: string): Project | undefined {
    const filePath = URI.parse(uri).fsPath;

    if (!filePath) {
      return;
    }

    return this.projectForPath(filePath);
  }

  projectForPath(rawPath: string): Project | undefined {
    const filePath = path.resolve(rawPath).toLowerCase();
    /*
      to fix C:\\Users\\lifeart\\AppData\\Local\\Temp\\tmp-30396kTX1RpAxCCyc
      and c:\\Users\\lifeart\\AppData\\Local\\Temp\\tmp-30396kTX1RpAxCCyc\\app\\components\\hello.hbs
      we need to lowercase items (because of capital C);
    */
    const rootMap: { [key: string]: string } = {};

    const projectRoots = (Array.from(this.projects.keys()) || []).map((root) => {
      const lowerName = root.toLowerCase();

      rootMap[lowerName] = root;

      return lowerName;
    });

    const rawRoot = projectRoots
      .filter((root) => filePath.startsWith(root))
      .reduce((a, b) => {
        return a.length > b.length ? a : b;
      }, '');
    const root = rootMap[rawRoot] || '';

    return this.projects.get(root);
  }
}
