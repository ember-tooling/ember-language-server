'use strict';

import { basename, dirname } from 'path';
import { EventEmitter } from 'events';

import FileIndex from './file-index';
import Server from './server';

export class Project {
  readonly fileIndex: FileIndex;

  constructor(public readonly root: string, server: Server) {
    this.fileIndex = new FileIndex(root, server);
  }
}

export default class ProjectRoots {
  workspaceRoot: string;

  projects = new Map<string, Project>();

  constructor(private readonly server: Server) {}

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

  onProjectAdd(path: string) {
    this.server.connection.console.log(`Ember CLI project added at ${path}`);
    this.projects.set(path, new Project(path, this.server));
  }

  onProjectDelete(path: string) {
    this.server.connection.console.log(`Ember CLI project deleted at ${path}`);
    this.projects.delete(path);
  }

  projectForPath(path: string): Project | undefined {
    let root = (Array.from(this.projects.keys()) || [])
      .filter(root => path.indexOf(root) === 0)
      .reduce((a, b) => a.length > b.length ? a : b, '');

    return this.projects.get(root);
  }
}
