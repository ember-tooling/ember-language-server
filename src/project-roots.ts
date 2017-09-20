'use strict';

import { basename, dirname } from 'path';
import { EventEmitter } from 'events';
import * as path from 'path';

import Deferred from './utils/deferred';
const glob = require('glob');

import FileIndex from './file-index';

export class Project {
  readonly fileIndex: FileIndex;

  constructor(public readonly root: string) {
    this.fileIndex = new FileIndex(root);
  }
}

export default class ProjectRoots {
  workspaceRoot: string;

  projects = new Map<string, Project>();

  async initialize(workspaceRoot: string, watcher: EventEmitter) {

    this.workspaceRoot = workspaceRoot;

    let promise = new Promise(resolve => {
      watcher.once('ready', resolve);
    });

    watcher.on('add', (path: string) => {
      if (basename(path) === 'ember-cli-build.js') {
        this.onProjectAdd(dirname(path));
      }

      promise.then(() => {
        let project = this.projectForPath(path);
        if (project) {
          project.fileIndex.add(path);
        }
      });
    });

    watcher.on('unlink', (path: string) => {
      if (basename(path) === 'ember-cli-build.js') {
        this.onProjectDelete(dirname(path));
      }

      promise.then(() => {
        let project = this.projectForPath(path);
        if (project) {
          project.fileIndex.remove(path);
        }
      });
    });

    await promise;
  }

  private async findAddonDirectories(projectPath: string) {
    const pattern = path.join(projectPath, 'node_modules', '*', 'ember-cli-build.js');

    let deferred = new Deferred<string[]>();

    glob(pattern, (err: Error, files: string[]) => {
      if (err) { return deferred.reject(err); }

      deferred.resolve(files.map(file => path.dirname(file)));
    });

    return deferred.promise;
  }

  async onProjectAdd(path: string) {
    let project = new Project(path);

    const addonsPaths = await this.findAddonDirectories(path);
    await Promise.all(addonsPaths.map((dirPath: string) =>
      project.fileIndex.addDirectory(dirPath))
    );

    this.projects.set(path, project);
  }

  onProjectDelete(path: string) {
    console.log(`Ember CLI project deleted at ${path}`);
    this.projects.delete(path);
  }

  projectForPath(path: string): Project | undefined {
    let root = (Array.from(this.projects.keys()) || [])
      .filter(root => path.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b, '');

    return this.projects.get(root);
  }
}
