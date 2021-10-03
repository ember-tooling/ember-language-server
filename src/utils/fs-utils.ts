import type * as fs from 'fs';

export enum FileType {
  Directory = 2,
  File = 1,
  SymbolicLink = 64,
  Unknown = 0,
}

export interface FileStat {
  ctime: number;
  mtime: number;
  size: number;
  type: FileType;
}

export function fileTypeFromFsStat(item: fs.Stats): FileType {
  let fType: FileType = FileType.Unknown;

  if (item.isDirectory()) {
    fType = FileType.Directory;
  } else if (item.isSymbolicLink()) {
    fType = FileType.SymbolicLink;
  } else if (item.isFile()) {
    fType = FileType.File;
  }

  return fType;
}

export function convertToFsStat(item: FileStat): fs.Stats {
  const data: fs.Stats = {
    isFile() {
      return item.type === FileType.File;
    },
    isDirectory() {
      return item.type === FileType.Directory;
    },
    isSymbolicLink() {
      return item.type === FileType.SymbolicLink;
    },
    isBlockDevice() {
      return false;
    },
    isCharacterDevice() {
      return false;
    },
    isSocket() {
      return false;
    },
    isFIFO() {
      return false;
    },
    dev: 1,
    ino: 1,
    mode: 1,
    nlink: 1,
    uid: 1,
    gid: 1,
    rdev: 1,
    size: item.size,
    blksize: 1,
    blocks: 1,
    atimeMs: item.ctime,
    mtimeMs: item.mtime,
    ctimeMs: item.ctime,
    birthtimeMs: 1,
    get atime(): Date {
      return new Date(this.atimeMs);
    },
    get mtime(): Date {
      return new Date(this.mtimeMs);
    },
    get ctime(): Date {
      return new Date(this.ctimeMs);
    },
    get birthtime(): Date {
      return new Date(this.birthtimeMs);
    },
  };

  return data;
}
