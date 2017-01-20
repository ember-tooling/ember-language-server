'use strict';

import { basename, dirname } from 'path';

import { InitializeParams } from 'vscode-languageserver';

import Server from "./server";

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

  constructor(private server: Server) {}

  async initialize(params: InitializeParams) {
    this.workspaceRoot = params.rootPath;

    console.log(`Searching for Ember projects in ${this.workspaceRoot}`);

    this.projectRoots = await findProjectRoots(this.workspaceRoot);

    console.log(`Ember CLI projects found at:${this.projectRoots.map(it => `\n- ${it}`)}`);
  }
}

export function findProjectRoots(workspaceRoot: string): Promise<string[]> {
  return new Promise(resolve => {
    let filter = it => ignoredFolders.indexOf(basename(it)) === -1;

    let projectRoots = [];
    klaw(workspaceRoot, { filter })
      .on('data', item => {
        if (basename(item.path) === 'ember-cli-build.js') {
          projectRoots.push(dirname(item.path));
        }
      })
      .on('end', () => resolve(projectRoots));
  });
}
