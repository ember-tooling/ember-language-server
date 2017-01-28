import * as path from 'path';
import { tmpdir } from 'os';

import { expect } from 'chai';

const fs = require('fs-extra');
const chokidar = require('chokidar');

describe('chokidar', function() {
  let workDir = path.join(tmpdir(), 'chokidar-test');

  beforeEach(function() {
    fs.emptyDirSync(workDir);
  });

  afterEach(function() {
    fs.removeSync(workDir);
  });

  function withWatcher(cb: Function) {
    return withCustomWatcher({}, cb);
  }

  async function withCustomWatcher(options = {}, cb: Function) {
    let watcher = chokidar.watch(workDir, options);
    try {
      await cb(watcher);
    } finally {
      watcher.close();
    }
  }

  it('watches an empty folder', function() {
    return withWatcher(async (watcher: any) => {
      await readyEvent(watcher);

      let watched = watcher.getWatched();
      expect(watched).to.deep.equal({
        [tmpdir()]: ['chokidar-test'],
        [workDir]: [],
      });
    });
  });

  it('watches a nested project structure', function() {
    fs.outputFileSync(path.join(workDir, 'a', 'ember-cli-build.js'));
    fs.outputFileSync(path.join(workDir, 'b', 'c', 'ember-cli-build.js'));

    return withWatcher(async (watcher: any) => {
      await readyEvent(watcher);

      let watched = watcher.getWatched();
      expect(watched).to.deep.equal({
        [tmpdir()]: ['chokidar-test'],
        [workDir]: ['a', 'b'],
        [path.join(workDir, 'a')]: ['ember-cli-build.js'],
        [path.join(workDir, 'b')]: ['c'],
        [path.join(workDir, 'b', 'c')]: ['ember-cli-build.js'],
      });
    });
  });
});

function readyEvent(watcher: any) {
  return new Promise(resolve => {
    watcher.once('ready', resolve);
  });
}
