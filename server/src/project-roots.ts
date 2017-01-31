'use strict';

import { basename, dirname } from 'path';

import FileIndex from './file-index';

const klaw = require('klaw');

const ignoredFolders: string[] = [
  '.git',
  'bower_components',
  'node_modules',
  'tmp',
];

export default class ProjectRoots {
  workspaceRoot: string;
  projectRoots: string[];

  private indexes: Map<string, FileIndex> = new Map();

  constructor() {}

  async initialize(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    console.log(`Searching for Ember projects in ${this.workspaceRoot}`);

    this.projectRoots = await findProjectRoots(this.workspaceRoot);

    await Promise.all(this.projectRoots.map(async projectRoot => {
      const index = new FileIndex(projectRoot);
      this.indexes.set(projectRoot, index);

      await index.invalidate();
    }));

    console.log(`Ember CLI projects found at:${this.projectRoots.map(it => `\n- ${it}`)}`);
  }

  rootForPath(path: string) {
    return (this.projectRoots || [])
      .filter(root => path.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b, '');
  }

  indexForProjectRoot(projectRoot: string): FileIndex | undefined {
    return this.indexes.get(projectRoot);
  }

  indexForPath(path: string): FileIndex | undefined {
    return this.indexForProjectRoot(this.rootForPath(path));
  }
}

export function findProjectRoots(workspaceRoot: string): Promise<string[]> {
  return new Promise(resolve => {
    let filter = (it: string) => ignoredFolders.indexOf(basename(it)) === -1;

    let projectRoots: string[] = [];
    klaw(workspaceRoot, { filter })
      .on('data', (item: any) => {
        if (basename(item.path) === 'ember-cli-build.js') {
          projectRoots.push(dirname(item.path));
        }
      })
      .on('end', () => resolve(projectRoots));
  });
}
