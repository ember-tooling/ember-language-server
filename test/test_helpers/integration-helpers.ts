/* eslint-disable semi */
import * as path from 'path';
import * as fs from 'fs';
import { createTempDir } from 'broccoli-test-helper';
import { URI } from 'vscode-uri';
import { MessageConnection } from 'vscode-jsonrpc/node';
import * as spawn from 'cross-spawn';
import { set, merge, get } from 'lodash';

import {
  DidOpenTextDocumentNotification,
  InitializeRequest,
  ExecuteCommandRequest,
  Definition,
  DidOpenTextDocumentParams,
} from 'vscode-languageserver-protocol/node';

export function startServer() {
  return spawn('node_modules/.bin/nyc', ['--reporter', 'none', 'node', './inst/start-server.js', '--stdio', '--no-clean'], {
    cwd: path.join(__dirname, '../..'),
  });
}

export type UnknownResult = Record<string, unknown>;
export type Registry = {
  [key: string]: {
    [key: string]: string[];
  };
};

export async function reloadProjects(connection: MessageConnection, project = undefined) {
  const result = await connection.sendRequest(ExecuteCommandRequest.type, {
    command: 'els.reloadProject',
    arguments: project ? [project] : [],
  });

  return result;
}

export async function initFileStructure(files) {
  const dir = await createTempDir();

  dir.write(files);

  return {
    path: path.normalize(dir.path()),
    destroy() {
      return dir.dispose();
    },
  };
}

type RecursiveRecord<T> = Record<string, string | T>;

export function flattenFsProject(obj: Record<string, unknown | string> | string) {
  if (typeof obj === 'string') {
    return obj;
  }

  const result = {};

  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'string') {
      result[`${key}`] = obj[key];
    } else if (typeof obj[key] === 'object') {
      Object.keys(obj[key]).forEach((subKey) => {
        result[`${key}/${subKey}`] = flattenFsProject(obj[key][subKey]);
      });
    }
  });

  const isAllNestedKeysConverted = Object.values(result).every((value) => typeof value === 'string');

  if (!isAllNestedKeysConverted) {
    return flattenFsProject(result);
  }

  return result;
}

export function fsProjectToObject(projectRoot: string) {
  const folder = fs.readdirSync(projectRoot, {
    withFileTypes: true,
  });
  const result = {};
  const ignoredFileExtensions = ['md', 'html', 'css', 'txt'];

  folder.forEach((file) => {
    const fsPath = path.join(projectRoot, file.name);

    if (file.isDirectory()) {
      result[file.name] = fsProjectToObject(fsPath);
    } else if (file.isFile() && !file.name.startsWith('.') && !(file.name === 'project.json')) {
      const ext = file.name.split('.').pop();

      if (ignoredFileExtensions.includes(ext)) {
        return;
      }

      result[file.name] = fs.readFileSync(fsPath, 'utf8');
    }
  });

  return result;
}

export function fsProjectToJSON(projectRoot: string) {
  const obj = fsProjectToObject(projectRoot);
  const json = flattenFsProject(obj);

  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify(json, null, 2), { encoding: 'utf8' });
}

export function normalizeToFs(files: RecursiveRecord<string | RecursiveRecord<string>>): RecursiveRecord<string | RecursiveRecord<string>> {
  const newShape = {};

  Object.keys(files).forEach((key) => {
    const parts = key.split('/');
    const isRef = typeof files[key] !== 'string';
    const value = isRef ? normalizeToFs(files[key as keyof typeof files] as RecursiveRecord<string>) : files[key];
    const isFilePath = key.includes('.');

    if (isFilePath) {
      const fileName = parts.pop();

      if (parts.length) {
        const valueToMerge = {
          [fileName]: value,
        };
        const valuePath = parts.join('.');
        const existingValueOnPath = get(newShape, valuePath, {});

        set(newShape, valuePath, merge(existingValueOnPath, valueToMerge));
      } else {
        newShape[fileName] = value;
      }
    } else {
      let entry = newShape;

      parts.forEach((p, index) => {
        const isLast = index === parts.length - 1;

        if (!(p in entry)) {
          entry[p] = {};
        }

        if (isLast) {
          merge(entry[p], value);
        } else {
          entry = entry[p];
        }
      });
    }
  });

  return newShape;
}

async function _buildResult(connection: MessageConnection, normalizedPath: string) {
  const params = {
    command: 'els.registerProjectPath',
    arguments: [normalizedPath],
  };

  return (await connection.sendRequest(ExecuteCommandRequest.type, params)) as {
    registry: Registry;
  };
}

export async function createProject(
  files,
  connection: MessageConnection,
  projectName?: string | string[],
  config?: { local: { addons: string[]; ignoredProjects: string[] } }
): Promise<{ normalizedPath: string | string[]; originalPath: string; result: UnknownResult | UnknownResult[]; destroy(): void }> {
  const dir = await createTempDir();

  dir.write(normalizeToFs(files));

  if (config && Array.isArray(config.local.ignoredProjects)) {
    const ignoredProjects = config.local.ignoredProjects;

    const configParams = {
      command: 'els.setConfig',
      arguments: [{ local: { addons: [], ignoredProjects: ignoredProjects } }],
    };

    await connection.sendRequest(ExecuteCommandRequest.type, configParams);
  }

  if (Array.isArray(projectName)) {
    const resultsArr = [];
    const normalizedPaths = [];

    for (let i = 0; i < projectName.length; i++) {
      const currProject = projectName[i];
      const normalizedPath = currProject ? path.normalize(path.join(dir.path(), currProject)) : path.normalize(dir.path());

      normalizedPaths.push(normalizedPath);
      resultsArr.push(await _buildResult(connection, normalizedPath));
    }

    return {
      normalizedPath: normalizedPaths,
      originalPath: path.normalize(dir.path()),
      result: resultsArr,
      destroy: async () => {
        await dir.dispose();
      },
    };
  } else {
    const normalizedPath = projectName ? path.normalize(path.join(dir.path(), projectName)) : path.normalize(dir.path());
    const result = await _buildResult(connection, normalizedPath);

    return {
      normalizedPath,
      originalPath: path.normalize(dir.path()),
      result,
      destroy: async () => {
        await dir.dispose();
      },
    };
  }
}

export function textDocument(modelPath, position = { line: 0, character: 0 }) {
  const params = {
    textDocument: {
      uri: URI.file(modelPath).toString(),
    },
    position,
  };

  return params;
}

function _buildResponse(response: unknown, normalizedPath: string, result: UnknownResult) {
  return {
    response: normalizeUri(response, normalizedPath),
    registry: normalizeRegistry(normalizedPath, result.registry as Registry),
    addonsMeta: normalizeAddonsMeta(normalizedPath, result.addonsMeta as { name: string; root: string }[]),
  };
}

export async function getResult(
  reqType,
  connection: MessageConnection,
  files,
  fileToInspect,
  position,
  projectName?: string | string[],
  config?: { local: { addons: string[]; ignoredProjects: string[] } }
) {
  const { normalizedPath, originalPath, destroy, result } = await createProject(files, connection, projectName, config);
  const modelPath = path.join(originalPath, fileToInspect);

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Unabe to find file path to inspect in file system. - ${fileToInspect}`);
  }

  const params = textDocument(modelPath, position);

  openFile(connection, modelPath);
  const response = await connection.sendRequest(reqType, params);

  await destroy();

  if (Array.isArray(projectName)) {
    const resultsArr = [];

    for (let i = 0; i < projectName.length; i++) {
      resultsArr.push(_buildResponse(response, normalizedPath[i], result[i]));
    }

    return resultsArr;
  }

  return _buildResponse(response, normalizedPath as string, result as UnknownResult);
}

export function openFile(connection: MessageConnection, filePath: string) {
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: URI.file(filePath).toString(),
      text: fs.readFileSync(filePath, 'utf8'),
    },
  } as DidOpenTextDocumentParams);
}

export function normalizePath(file: string) {
  return file.split('\\').join('/');
}

function replaceTempUriPart(uri: string, base: string) {
  const fsPath = normalizePath(URI.parse(uri).fsPath);
  const basePath = normalizePath(URI.parse(base).fsPath);

  return fsPath.split(basePath).pop();
}

export function normalizeAddonsMeta(root: string, addonsMeta: { root: string; name: string }[]) {
  return addonsMeta.map((el) => {
    el.root = normalizePath(path.relative(root, el.root));

    return el;
  });
}

export function normalizeRegistry(root: string, registry: Registry) {
  const normalizedRegistry: Registry = {};

  Object.keys(registry).forEach((key) => {
    normalizedRegistry[key] = {};
    Object.keys(registry[key]).forEach((name) => {
      normalizedRegistry[key][name] = registry[key][name].map((el) => normalizePath(path.relative(root, el)));
    });

    if (!Object.keys(normalizedRegistry[key]).length) {
      delete normalizedRegistry[key];
    }
  });

  return normalizedRegistry;
}

export function normalizeUri(objects: Definition, base?: string) {
  if (objects === null) {
    return objects;
  }

  if (!Array.isArray(objects)) {
    if (objects.uri) {
      // objects.uri = replaceDynamicUriPart(objects.uri);

      if (base) {
        objects.uri = replaceTempUriPart(objects.uri, base);
      }
    }

    return objects;
  }

  return objects.map((object) => {
    if (object === null) {
      return object;
    }

    return normalizeUri(object, base);
  });
}

export function makeProject(appFiles = {}, addons = {}) {
  const dependencies = {};
  const node_modules = {};

  Object.keys(addons).forEach((name) => {
    dependencies[name] = '*';
    node_modules[name] = addons[name];
  });
  const fileStructure = Object.assign({}, appFiles, {
    node_modules,
    'package.json': JSON.stringify({
      dependencies,
    }),
  });

  return fileStructure;
}

export function makeAddonPackage(name, config, addonConfig = undefined) {
  const pack = {
    name,
    'ember-language-server': config,
  };

  if (addonConfig) {
    pack['ember-addon'] = addonConfig;
  }

  return JSON.stringify(pack);
}

export function initServer(connection: MessageConnection, projectName: string) {
  const params = {
    rootUri: URI.file(path.join(__dirname, '..', 'fixtures', projectName)).toString(),
    capabilities: {},
    initializationOptions: {
      isELSTesting: true,
    },
  };

  return connection.sendRequest(InitializeRequest.type, params);
}
