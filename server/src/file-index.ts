import * as path from 'path';

import {FileInfo, ModuleFileInfo} from './file-info';
import Deferred from './utils/deferred';

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

  constructor(root: string) {
    this.root = root;
  }

  public async invalidate() {
    let filter = (it: string) => ignoredFolders.indexOf(path.basename(it)) === -1;

    let deferred = new Deferred<void>();

    klaw(this.root, { filter })
      .on('data', (item: any) => {
        let relativePath = path.relative(this.root, item.path);
        let fileInfo = FileInfo.from(relativePath);
        if (fileInfo) {
          this.files.push(fileInfo);
        }
      })
      .on('end', () => deferred.resolve());

    return deferred.promise;
  }

  public byModuleType(type: string) {
    return this.files.filter(it => it instanceof ModuleFileInfo && it.type === type);
  }
}
