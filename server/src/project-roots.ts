'use strict';

import { basename, dirname } from 'path';
import { EventEmitter } from 'events';

import FileIndex from './file-index';

export default class ProjectRoots {
  workspaceRoot: string;

  projects = new Set<string>();

  private indexes: Map<string, FileIndex> = new Map();

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
        let index = this.indexForPath(path);
        if (index) {
          index.add(path);
        }
      });
    });

    watcher.on('unlink', (path: string) => {
      if (basename(path) === 'ember-cli-build.js') {
        this.onProjectDelete(dirname(path));
      }

      promise.then(() => {
        let index = this.indexForPath(path);
        if (index) {
          index.remove(path);
        }
      });
    });

    await promise;
  }

  onProjectAdd(path: string) {
    console.log(`Ember CLI project added at ${path}`);
    this.projects.add(path);
    this.indexes.set(path, new FileIndex(path));
  }

  onProjectDelete(path: string) {
    console.log(`Ember CLI project deleted at ${path}`);
    this.projects.delete(path);
    this.indexes.delete(path);
  }

  projectForPath(path: string) {
    return (Array.from(this.projects.values()) || [])
      .filter(root => path.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b, '');
  }

  private indexForProjectRoot(projectRoot: string): FileIndex | undefined {
    return this.indexes.get(projectRoot);
  }

  indexForPath(absolutePath: string): FileIndex | undefined {
    let project = this.projectForPath(absolutePath);
    return this.indexForProjectRoot(project);
  }
}
