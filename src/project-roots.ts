'use strict';

import { dirname, join } from 'path';

const walkSync = require('walk-sync');

export class Project {

  constructor(public readonly root: string) {
  }
}

export default class ProjectRoots {
  workspaceRoot: string;

  projects = new Map<string, Project>();

  async initialize(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    const roots = walkSync(workspaceRoot, {
      directories: false,
      globs: ['**/ember-cli-build.js'],
      ignore: [
        '**/.git/**',
        '**/bower_components/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/tmp/**',
      ]
    });

    roots.forEach((rootPath: string) => {
      const fullPath = dirname(join(workspaceRoot, rootPath));
      this.onProjectAdd(fullPath);
    });
  }

  onProjectAdd(path: string) {
    console.log(`Ember CLI project added at ${path}`);
    this.projects.set(path, new Project(path));
  }

  projectForPath(path: string): Project | undefined {
    let root = (Array.from(this.projects.keys()) || [])
      .filter(root => path.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b, '');

    return this.projects.get(root);
  }
}
