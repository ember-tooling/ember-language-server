'use strict';

import { basename, dirname } from 'path';

import { InitializeParams, Files } from 'vscode-languageserver';

const klaw = require('klaw');

const ignoredFolders: string[] = [
  '.git',
  'bower_components',
  'node_modules',
  'tmp',
];

export default class ProjectRoots {
  workspaceRoot: string | undefined;
  projectRoots: string[];

  constructor() {}

  async initialize(params: InitializeParams) {
    if (params.rootUri) {
      this.workspaceRoot = Files.uriToFilePath(params.rootUri);

      console.log(`Searching for Ember projects in ${this.workspaceRoot}`);
    }

    if (this.workspaceRoot) {
      this.projectRoots = await findProjectRoots(this.workspaceRoot);

      console.log(`Ember CLI projects found at:${this.projectRoots.map(it => `\n- ${it}`)}`);
    }
  }

  rootForPath(path: string) {
    return this.projectRoots
      .filter(root => path.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b);
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
