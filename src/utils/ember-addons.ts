import * as path from 'path';
import * as fs from 'fs';
import Deferred from './deferred';

async function npmDependencies(projectPath: string): Promise<string[]> {

  try {
    const pgk = await readJSON(path.join(projectPath, 'package.json'));
    return Object.keys(pgk.dependencies || {}).concat(Object.keys(pgk.devDependencies || {}));

  } catch (err) {}

  return [];
}

// TODO move into file util
async function readJSON(filePath: string) {
  let { resolve, reject, promise } = new Deferred<any>();

  fs.readFile(filePath, 'utf8', function (err, data) {
    if (err) {
      reject(err);

    } else try {
      resolve(JSON.parse(data));

    } catch (err) {
      reject(err);
    }
  });

  return promise;
}

async function isEmberProject(dependencyPath: string) {
  // FIXME handle addons having `ember-cli-build.js` on theire .npmignore
  return exists(path.join(dependencyPath, 'ember-cli-build.js'));
}

// TODO move into file util
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

  const dependencies = await npmDependencies(projectPath);

  const dependencyPaths = await Promise.all(
    dependencies.map(async dependencyName => {
      const dependencyPath = path.join(projectPath, 'node_modules', dependencyName);
      const exists = await isEmberProject(dependencyPath);
      if (exists) {
        return dependencyPath;
      }
    })
  );

  return dependencyPaths.filter(dependencyPath => dependencyPath) as string [];
}
