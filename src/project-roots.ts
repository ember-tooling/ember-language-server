'use strict';

import * as path from 'path';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import { logError, logInfo } from './utils/logger';
import * as walkSync from 'walk-sync';
import * as fs from 'fs';
import {
  isGlimmerNativeProject,
  isGlimmerXProject,
  getPodModulePrefix,
  findTestsForProject,
  findAppItemsForProject,
  isELSAddonRoot
} from './utils/layout-helpers';
import { addToRegistry, removeFromRegistry, normalizeMatchNaming, NormalizedRegistryItem } from './utils/registry-api';
import { ProjectProviders, collectProjectProviders, initBuiltinProviders } from './utils/addon-api';
import Server from './server';
import { TextDocument, Diagnostic, FileChangeType } from 'vscode-languageserver';
import { PodMatcher, ClassicPathMatcher } from './utils/path-matcher';
export type Executor = (server: Server, command: string, args: any[]) => any;
export type Destructor = (project: Project) => any;
export type Linter = (document: TextDocument) => Diagnostic[];
export type Watcher = (uri: string, change: FileChangeType) => any;
export interface Executors {
  [key: string]: Executor;
}

export class Project {
  private classicMatcher!: ClassicPathMatcher;
  private podMatcher!: PodMatcher;
  providers!: ProjectProviders;
  builtinProviders!: ProjectProviders;
  executors: Executors = {};
  watchers: Watcher[] = [];
  destructors: Destructor[] = [];
  linters: Linter[] = [];
  initIssues: Error[] = [];
  files: Map<string, { version: number }> = new Map();
  podModulePrefix: string = '';
  matchPathToType(filePath: string) {
    return this.classicMatcher.metaFromPath(filePath) || this.podMatcher.metaFromPath(filePath);
  }
  trackChange(uri: string, change: FileChangeType) {
    // prevent leaks
    if (this.files.size > 10000) {
      logError('too many files for project ' + this.root);
      this.files.clear();
    }
    const rawPath = uriToFilePath(uri);
    if (!rawPath) {
      return;
    }
    const filePath = path.resolve(rawPath);
    let item = this.matchPathToType(filePath);
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
      let file = this.files.get(filePath);
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
    this.builtinProviders = initBuiltinProviders();
    const maybePrefix = getPodModulePrefix(root);
    if (maybePrefix) {
      this.podModulePrefix = 'app/' + maybePrefix;
    }
    this.classicMatcher = new ClassicPathMatcher();
    this.podMatcher = new PodMatcher();
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
        let initResult = initFn(server, this);
        if (typeof initResult === 'function') {
          this.destructors.push(initResult);
        }
      } catch (e) {
        logError(e);
        this.initIssues.push(e);
      }
    });
    findTestsForProject(this);
    findAppItemsForProject(this);
    this.providers.initFunctions.forEach((initFn) => {
      try {
        let initResult = initFn(server, this);
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
      logInfo('loded language server addons:');
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
      ignore: ['**/.git/**', '**/bower_components/**', '**/dist/**', '**/node_modules/**', '**/tmp/**']
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

  onProjectAdd(path: string) {
    if (this.projects.has(path)) {
      return false;
    }
    try {
      const project = new Project(path, this.localAddons);
      this.projects.set(path, project);
      logInfo(`Ember CLI project added at ${path}`);
      project.init(this.server);
      return {
        initIssues: project.initIssues,
        providers: project.providers,
        registry: this.server.getRegistry(project.root)
      };
    } catch (e) {
      logError(e);
      return false;
    }
  }

  projectForUri(uri: string): Project | undefined {
    let path = uriToFilePath(uri);

    if (!path) return;
    return this.projectForPath(path);
  }

  projectForPath(path: string): Project | undefined {
    let root = (Array.from(this.projects.keys()) || []).filter((root) => path!.indexOf(root) === 0).reduce((a, b) => (a.length > b.length ? a : b), '');
    return this.projects.get(root);
  }
}
