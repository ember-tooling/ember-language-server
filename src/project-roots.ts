'use strict';

import * as path from 'path';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import { logError, logInfo } from './utils/logger';
import * as walkSync from 'walk-sync';
import { isGlimmerNativeProject, isGlimmerXProject } from './utils/layout-helpers';
import { ProjectProviders, collectProjectProviders, initBuiltinProviders } from './utils/addon-api';
import Server from './server';
import { TextDocument, Diagnostic } from 'vscode-languageserver';

export type Eexcutor = (server: Server, command: string, args: any[]) => any;
export type Linter = (document: TextDocument) => Diagnostic[];
export interface Executors {
  [key: string]: Eexcutor;
}

export class Project {
  providers!: ProjectProviders;
  builtinProviders!: ProjectProviders;
  executors: Executors = {};
  linters: Linter[] = [];
  addCommandExecutor(key: string, cb: Eexcutor) {
    this.executors[key] = cb;
  }
  addLinter(cb: Linter) {
    this.linters.push(cb);
  }
  constructor(public readonly root: string) {
    this.providers = collectProjectProviders(root);
    this.builtinProviders = initBuiltinProviders();
  }
  init(server: Server) {
    this.builtinProviders.initFunctions.forEach((initFn) => initFn(server, this));
    this.providers.initFunctions.forEach((initFn) => initFn(server, this));
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
      return;
    }
    try {
      const project = new Project(path);
      this.projects.set(path, project);
      logInfo(`Ember CLI project added at ${path}`);
      project.init(this.server);
    } catch (e) {
      logError(e);
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
