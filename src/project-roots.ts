'use strict';

import * as path from 'path';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import { logError, logInfo } from './utils/logger';
import * as walkSync from 'walk-sync';
import { isGlimmerNativeProject, isGlimmerXProject } from './utils/layout-helpers';
import { ProjectProviders, collectProjectProviders, initBuiltinProviders } from './utils/addon-api';
import Server from './server';

export interface Executors {
  [key: string]: (server: Server, command: string, args: any[]) => any;
}

export class Project {
  providers!: ProjectProviders;
  builtinProviders!: ProjectProviders;
  executors: Executors = {};
  constructor(public readonly root: string, server: Server) {
    this.providers = collectProjectProviders(root);
    this.builtinProviders = initBuiltinProviders();
    this.providers.initFunctions.forEach((initFn) => initFn(server, this));
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
      this.projects.set(path, new Project(path, this.server));
      logInfo(`Ember CLI project added at ${path}`);
    } catch (e) {
      logError(e);
    }
  }

  projectForUri(uri: string): Project | undefined {
    let path = uriToFilePath(uri);

    if (!path) return;

    let root = (Array.from(this.projects.keys()) || []).filter((root) => path!.indexOf(root) === 0).reduce((a, b) => (a.length > b.length ? a : b), '');

    return this.projects.get(root);
  }
}
