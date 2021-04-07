/* eslint-disable semi */
import * as path from 'path';
import * as fs from 'fs';
import { createTempDir } from 'broccoli-test-helper';
import { URI } from 'vscode-uri';
import { MessageConnection } from 'vscode-jsonrpc/node';
import * as spawn from 'cross-spawn';
import { set } from 'lodash';

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
        set(newShape, parts.join('.'), {
          [fileName]: value,
        });
      } else {
        newShape[fileName] = value;
      }
    } else {
      set(newShape, parts.join('.'), value);
    }
  });

  return newShape;
}

export async function createProject(
  files,
  connection: MessageConnection,
  projectName?: string
): Promise<{ normalizedPath: string; result: UnknownResult; destroy(): void }> {
  const dir = await createTempDir();

  dir.write(normalizeToFs(files));
  const normalizedPath = projectName ? path.normalize(path.join(dir.path(), projectName)) : path.normalize(dir.path());

  const params = {
    command: 'els.registerProjectPath',
    arguments: [normalizedPath],
  };

  const result = (await connection.sendRequest(ExecuteCommandRequest.type, params)) as {
    registry: Registry;
  };

  return {
    normalizedPath,
    result,
    destroy: async () => {
      await dir.dispose();
    },
  };
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

export async function getResult(reqType, connection: MessageConnection, files, fileToInspect, position, projectName?: string) {
  const { normalizedPath, destroy, result } = await createProject(files, connection, projectName);
  const modelPath = path.join(normalizedPath, fileToInspect);
  const params = textDocument(modelPath, position);

  openFile(connection, modelPath);
  const response = await connection.sendRequest(reqType, params);

  await destroy();

  return {
    response: normalizeUri(response, normalizedPath),
    registry: normalizeRegistry(normalizedPath, result.registry as Registry),
    addonsMeta: normalizeAddonsMeta(normalizedPath, result.addonsMeta as { name: string; root: string }[]),
  };
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
