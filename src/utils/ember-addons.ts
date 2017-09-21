import * as path from 'path';
import * as fs from 'fs';
import Deferred from './deferred';

function npmDependencies(projectPath: string): string[] {

  let dependencies: string[] = [];

  try {
    const pgk = require(path.join(projectPath, 'package.json'));
    dependencies = Object.keys(pgk.dependencies || []).concat(Object.keys(pgk.devDependencies || []));
  } catch (err) {}

  return dependencies;
}

async function exists(filePath: string): Promise<boolean> {

  let { resolve, reject, promise } = new Deferred<boolean>();

  fs.stat(filePath, err => {
    if (err == null) {
      resolve(true);
    } else if (err.code === 'ENOENT') {
        resolve(false);
    } else {
      reject(err.code);
    }
  });

  return promise;
}

export default async function emberAddons(projectPath: string): Promise<string[]> {
  return Promise.all(
    npmDependencies(projectPath)
      .map(dependencyName => path.join(projectPath, 'node_modules', dependencyName))
      .filter(dependencyPath => exists(path.join(dependencyPath, 'ember-cli-build.js')))
  );
}
