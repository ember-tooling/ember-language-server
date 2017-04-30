import * as path from 'path';

import {FileInfo, ModuleFileInfo} from './file-info';
import Deferred from './utils/deferred';
import Server from './server';

const klaw = require('klaw');

const ignoredFolders: string[] = [
  '.git',
  'bower_components',
  'dist',
  'node_modules',
  'tmp',
];

export default class FileIndex {

  readonly root: string;
  readonly files: FileInfo[] = [];

  constructor(root: string, private readonly server: Server | null = null) {
    this.root = root;
  }

  public async invalidate() {
    let filter = (it: string) => ignoredFolders.indexOf(path.basename(it)) === -1;

    let deferred = new Deferred<void>();

    klaw(this.root, { filter })
      .on('data', (item: any) => this.add(item.path))
      .on('end', () => deferred.resolve());

    return deferred.promise;
  }

  public add(absolutePath: string): FileInfo | undefined {
    let relativePath = path.relative(this.root, absolutePath);
    let fileInfo = FileInfo.from(relativePath);
    if (fileInfo) {
      this.server && this.server.connection.console.log(`add ${relativePath} -> ${fileInfo.containerName}`);
      this.files.push(fileInfo);
    }
    return fileInfo;
  }

  public remove(absolutePath: string): FileInfo | undefined {
    let relativePath = path.relative(this.root, absolutePath);
    let index = this.files.findIndex(fileInfo => fileInfo.relativePath === relativePath);
    if (index !== -1) {
      let fileInfo = this.files.splice(index, 1)[0];
      this.server && this.server.connection.console.log(`remove ${relativePath} -> ${fileInfo.containerName}`);
      return fileInfo;
    }
  }

  public byModuleType(type: string) {
    return this.files.filter(it => it instanceof ModuleFileInfo && it.type === type);
  }
}
