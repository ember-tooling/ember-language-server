'use strict';

import * as path from 'path';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

import * as walkSync from 'walk-sync';

export class Project {
  constructor(public readonly root: string) {}
}

export default class ProjectRoots {
  workspaceRoot: string;

  projects = new Map<string, Project>();

  async initialize(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    const roots = walkSync(workspaceRoot, {
      directories: false,
      globs: ['**/ember-cli-build.js'],
      ignore: ['**/.git/**', '**/bower_components/**', '**/dist/**', '**/node_modules/**', '**/tmp/**']
    });

    roots.forEach((rootPath: string) => {
      const fullPath = path.dirname(path.join(workspaceRoot, rootPath));
      this.onProjectAdd(fullPath);
    });
  }

  onProjectAdd(path: string) {
    console.log(`Ember CLI project added at ${path}`);
    this.projects.set(path, new Project(path));
  }

  projectForUri(uri: string): Project | undefined {
    let path = uriToFilePath(uri);

    if (!path) return;

    let root = (Array.from(this.projects.keys()) || []).filter((root) => path!.indexOf(root) === 0).reduce((a, b) => (a.length > b.length ? a : b), '');

    return this.projects.get(root);
  }
}
