// async implementation of https://github.com/joliss/node-walk-sync/blob/master/index.ts

'use strict';

import * as path from 'path';
import * as pm from 'picomatch';
import FSProvider from '../fs-provider';
import { flatten } from 'lodash';
import { FileType } from './fs-utils';

function ensurePosix(filepath: string) {
  if (path.sep !== '/') {
    return filepath.split(path.sep).join('/');
  }

  return filepath;
}

class MatcherCollection {
  private matchers: pm.Matcher[];

  constructor(matchers: string[]) {
    this.matchers = [pm(matchers)];
  }

  match(value: string) {
    for (let i = 0; i < this.matchers.length; i++) {
      if (this.matchers[i](value)) {
        return true;
      }
    }

    return false;
  }
}

export default async function walkAsync(baseDir: string, inputOptions?: Options | string[]) {
  const options = handleOptions(inputOptions);

  let mapFunct: (arg: Entry) => string;

  if (options.includeBasePath) {
    mapFunct = function (entry: Entry) {
      return entry.basePath.split(path.sep).join('/').replace(/\/+$/, '') + '/' + entry.relativePath;
    };
  } else {
    mapFunct = function (entry: Entry) {
      return entry.relativePath;
    };
  }

  const pathSet: Set<string> = new Set();
  const data = await _walkAsync(baseDir, options, null, pathSet);

  try {
    return data.map(mapFunct);
  } finally {
    pathSet.clear();
  }
}

export function entries(baseDir: string, inputOptions?: Options | string[]) {
  const options = handleOptions(inputOptions);

  return _walkAsync(ensurePosix(baseDir), options, null, new Set());
}

export interface Options {
  includeBasePath?: boolean;
  globs?: string[];
  ignore?: string[];
  directories?: boolean;
  fs: FSProvider;
}

export class Entry {
  relativePath: string;
  basePath: string;
  _isDirectory: boolean;

  constructor(relativePath: string, basePath: string, isDirectory: boolean) {
    this.relativePath = relativePath;
    this.basePath = basePath;
    this._isDirectory = isDirectory;
  }

  get fullPath() {
    return `${this.basePath}/${this.relativePath}`;
  }

  isDirectory() {
    return this._isDirectory;
  }
}

function isDefined<T>(val: T | undefined): val is T {
  return typeof val !== 'undefined';
}

function handleOptions(_options?: Options | string[]): Options {
  // @ts-expect-error empty options
  let options: Options = {};

  if (Array.isArray(_options)) {
    options.globs = _options;
  } else if (_options) {
    options = _options;
  }

  return options;
}

function handleRelativePath(_relativePath: string | null) {
  if (_relativePath == null) {
    return '';
  } else if (_relativePath.slice(-1) !== '/') {
    return _relativePath + '/';
  } else {
    return _relativePath;
  }
}

function lexicographically(a: Entry, b: Entry) {
  const aPath = a.relativePath;
  const bPath = b.relativePath;

  if (aPath === bPath) {
    return 0;
  } else if (aPath < bPath) {
    return -1;
  } else {
    return 1;
  }
}

async function _walkAsync(baseDir: string, options: Options, _relativePath: string | null, visited: Set<string>): Promise<Entry[]> {
  const fs = options.fs;
  const relativePath = handleRelativePath(_relativePath);

  const realPath = fs.hasRealFsAccess ? fs.realpathSync(baseDir + '/' + relativePath) : path.join(baseDir, '/', relativePath);

  if (visited.has(realPath)) {
    return [];
  } else {
    visited.add(realPath);
  }

  try {
    const ignorePatterns = options.ignore;
    const globs = options.globs;
    let globMatcher;
    let ignoreMatcher: undefined | InstanceType<typeof MatcherCollection>;

    if (ignorePatterns) {
      ignoreMatcher = new MatcherCollection(ignorePatterns);
    }

    if (globs) {
      globMatcher = new MatcherCollection(globs);
    }

    let names: [string, FileType][] = [];

    try {
      names = await fs.readDirectory(baseDir + '/' + relativePath);
    } catch (e) {
      // EOL;
    }

    const rawEntries = names.map(async ([name, fType]) => {
      const entryRelativePath = relativePath + name;

      if (ignoreMatcher && ignoreMatcher.match(entryRelativePath)) {
        return;
      }

      if (fType === FileType.Directory) {
        return new Entry(entryRelativePath + '/', baseDir, true);
      } else if (fType === FileType.File || fType === FileType.SymbolicLink) {
        return new Entry(entryRelativePath, baseDir, false);
      }
    });

    const unfilteredEntries = await Promise.all(rawEntries);
    const entries = unfilteredEntries.filter(isDefined);
    const sortedEntries = entries.sort(lexicographically);

    const extras: Array<Entry | Promise<Entry[]>> = [];

    for (let i = 0; i < sortedEntries.length; ++i) {
      const entry = sortedEntries[i];

      if (entry.isDirectory()) {
        if (options.directories !== false && (!globMatcher || globMatcher.match(entry.relativePath))) {
          extras.push(entry);
        }

        extras.push(_walkAsync(baseDir, options, entry.relativePath, visited));
      } else {
        if (!globMatcher || globMatcher.match(entry.relativePath)) {
          extras.push(entry);
        }
      }
    }

    const results: Array<Entry | Entry[]> = await Promise.all(extras as any);

    return flatten(results);
  } finally {
    // EOL
  }
}
