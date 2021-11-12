/* eslint-disable semi */
import * as path from 'path';
import * as fs from 'fs';
import { createTempDir, Tree } from 'broccoli-test-helper';
import { URI } from 'vscode-uri';
import { MessageConnection } from 'vscode-jsonrpc/node';
import * as spawn from 'cross-spawn';
import { set, merge, get } from 'lodash';
import { AddonMeta } from '../../src/utils/addon-api';
import { CompletionItem } from 'vscode-languageserver/node';
import { DefinitionRequest, DocumentSymbol, DocumentSymbolRequest, Hover, HoverRequest, ReferencesRequest } from 'vscode-languageserver-protocol/node';

import {
  DidOpenTextDocumentNotification,
  InitializeRequest,
  ExecuteCommandRequest,
  Definition,
  DidOpenTextDocumentParams,
  CompletionRequest,
} from 'vscode-languageserver-protocol/node';
import { FileStat, FileType, fileTypeFromFsStat } from '../../src/utils/fs-utils';
import { IRegistry } from '../../src/utils/registry-api';

export function startServer(asyncFs = false) {
  const options: Array<string | undefined> = [
    '--reporter',
    'none',
    'node',
    './inst/start-server.js',
    '--stdio',
    asyncFs ? '--async-fs' : undefined,
    '--no-clean',
  ];

  return spawn(
    'node_modules/.bin/nyc',
    options.filter((el) => el !== undefined),
    {
      cwd: path.join(__dirname, '../..'),
    }
  );
}

export type UnknownResult = Record<string, unknown> & {
  registry: IRegistry;
  initIssues: string[];
  addonsMeta: { name: string; root: string }[];
};

export type Registry = {
  [key: string]: {
    [key: string]: string[];
  };
};

export function asyncFSProvider() {
  // likely we should emit special error objects instead of nulls
  // if (error !== null && typeof error === 'object' && (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EPERM')) {
  //   return;
  // }

  const commands: Record<string, unknown> = {};

  commands['els.fs.readFile'] = async (uri: URI) => {
    const fsPath = URI.from(uri).fsPath;
    let data: unknown;

    try {
      data = fs.readFileSync(fsPath, 'utf8');
    } catch (e) {
      data = null;
    }

    return data;
  };

  commands['els.fs.stat'] = async (uri: URI): Promise<FileStat | null> => {
    const fsPath = URI.from(uri).fsPath;
    let data: fs.Stats = null;

    try {
      data = fs.statSync(fsPath);

      const fType = fileTypeFromFsStat(data);

      return {
        mtime: data.mtimeMs,
        ctime: data.ctimeMs,
        size: data.size,
        type: fType,
      };
    } catch (e) {
      data = null;
    }

    return data as null;
  };

  commands['els.fs.readDirectory'] = async (uri: URI) => {
    const fsPath = URI.from(uri).fsPath;

    let data: unknown;

    try {
      data = fs.readdirSync(fsPath);
    } catch (e) {
      data = null;
    }

    if (data === null) {
      return null;
    }

    return (data as string[])
      .map((el) => {
        let stat = FileType.Unknown;

        try {
          const statData = fs.statSync(path.join(fsPath, path.sep, el));

          stat = fileTypeFromFsStat(statData);
        } catch (e) {
          return null;
          // EOL;
        }

        return [el, stat];
      })
      .filter((el) => el !== null);
  };

  return commands;
}

export async function registerCommandExecutor(connection: MessageConnection, handlers: Record<string, (...args: unknown[]) => unknown>) {
  const disposable = connection.onRequest(ExecuteCommandRequest.type, async ({ command, arguments: args }) => {
    if (command in handlers) {
      return handlers[command](...args);
    } else {
      throw new Error(`Unhandled command: "${command}"`);
    }
  });

  return disposable;
}

export async function reloadProjects(connection: MessageConnection, project = undefined) {
  const result = await connection.sendRequest(ExecuteCommandRequest.type, {
    command: 'els.reloadProject',
    arguments: project ? [project] : [],
  });

  return result;
}

export async function initFileStructure(files: Tree) {
  const dir = await createTempDir();

  dir.write(files);

  return {
    path: path.normalize(dir.path()),
    async destroy() {
      await dir.dispose();
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

async function registerProject(connection: MessageConnection, normalizedPath: string) {
  const params = {
    command: 'els.registerProjectPath',
    arguments: [normalizedPath],
  };

  const data = (await connection.sendRequest(ExecuteCommandRequest.type, params)) as {
    registry: Registry;
  };

  return data;
}

export async function setServerConfig(connection: MessageConnection, config = { local: { addons: [], ignoredProjects: [] } }) {
  const configParams = {
    command: 'els.setConfig',
    arguments: [config],
  };

  await connection.sendRequest(ExecuteCommandRequest.type, configParams);
}

// @ts-expect-error overload signature
export async function createProject(
  files: unknown,
  connection: MessageConnection,
  projectName: string[]
): Promise<{ normalizedPath: string[]; originalPath: string; result: UnknownResult[]; destroy(): Promise<void> }>;
export async function createProject(
  files: unknown,
  connection: MessageConnection,
  projectName: string
): Promise<{ normalizedPath: string; originalPath: string; result: UnknownResult; destroy(): Promise<void> }>;
export async function createProject(
  files: unknown,
  connection: MessageConnection
): Promise<{ normalizedPath: string; originalPath: string; result: UnknownResult; destroy(): Promise<void> }>;

export async function createProject(
  files: RecursiveRecord<string | RecursiveRecord<string>>,
  connection: MessageConnection,
  projectName?: string | string[]
): Promise<{ normalizedPath: unknown; originalPath: string; result: UnknownResult | UnknownResult[]; destroy(): Promise<void> }> {
  const dir = await createTempDir();

  dir.write(normalizeToFs(files));

  if (Array.isArray(projectName)) {
    const resultsArr = [];
    const normalizedPaths = [];

    for (let i = 0; i < projectName.length; i++) {
      const currProject = projectName[i];
      const normalizedPath = currProject ? path.normalize(path.join(dir.path(), currProject)) : path.normalize(dir.path());

      normalizedPaths.push(normalizedPath);

      const projectData = await registerProject(connection, normalizedPath);

      // project may be not created, because it's marked as ignored
      if (projectData) {
        resultsArr.push(projectData);
      } else {
        resultsArr.push({
          registry: {},
          addonsMeta: [],
          response: null,
        });
      }
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
    const result = await registerProject(connection, normalizedPath);

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

export function textDocument(modelPath: string, position = { line: 0, character: 0 }) {
  const params = {
    textDocument: {
      uri: URI.file(modelPath).toString(),
    },
    position,
  };

  return params;
}

interface IResponse<T> {
  initIssues?: string[];
  response: T;
  // eslint-disable-next-line @typescript-eslint/ban-types
  registry: object;
  addonsMeta: AddonMeta[];
}

function _buildResponse<T>(response: T, normalizedPath: string, result: UnknownResult): IResponse<T> {
  const content: IResponse<T> = {
    response: normalizeUri(response as Record<string, unknown>, normalizedPath),
    registry: normalizeRegistry(normalizedPath, result.registry as Registry),
    addonsMeta: normalizeAddonsMeta(normalizedPath, result.addonsMeta as AddonMeta[]),
  };

  if (Array.isArray(result.initIssues) && result.initIssues.length) {
    content.initIssues = result.initIssues;
  }

  return content;
}

export async function getResult(
  reqType: typeof HoverRequest.method,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number },
  projectName?: string[]
): Promise<IResponse<Hover[]>[]>;
export async function getResult(
  reqType: typeof CompletionRequest.method,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number },
  projectName: string[]
): Promise<IResponse<CompletionItem[]>[]>;
export async function getResult(
  reqType: typeof CompletionRequest.method,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number },
  projectName: string
): Promise<IResponse<CompletionItem[]>>;
export async function getResult(
  reqType: typeof CompletionRequest.method,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number }
): Promise<IResponse<CompletionItem[]>>;

export async function getResult(
  reqType: typeof DefinitionRequest.method,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number },
  projectName?: string[]
): Promise<IResponse<Definition[]>[]>;
export async function getResult(
  reqType: typeof DefinitionRequest.method,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number },
  projectName?: string
): Promise<IResponse<Definition>>;
export async function getResult(
  reqType: typeof DefinitionRequest.method,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number }
): Promise<IResponse<Definition[]>>;

export async function getResult(
  reqType: typeof DocumentSymbolRequest.type,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number }
): Promise<IResponse<DocumentSymbol[]>>;

export async function getResult(
  reqType: typeof ReferencesRequest.type,
  connection: MessageConnection,
  files,
  fileToInspect: string,
  position: { line: number; character: number }
): Promise<IResponse<Location[]>>;

export async function getResult(
  reqType: unknown,
  connection: MessageConnection,
  files: unknown,
  fileToInspect: string,
  position: { line: number; character: number },
  projectName?: string[] | string
): Promise<IResponse<unknown> | IResponse<unknown>[]> {
  // @ts-expect-error overload
  const { normalizedPath, originalPath, destroy, result } = await createProject(files, connection, projectName);

  const modelPath = path.join(originalPath, fileToInspect);

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Unabe to find file path to inspect in file system. - ${fileToInspect}`);
  }

  const params = textDocument(modelPath, position);

  openFile(connection, modelPath);
  const response = await connection.sendRequest(reqType as never, params);

  await destroy();

  if (Array.isArray(projectName)) {
    const resultsArr: IResponse<unknown>[] = [];

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

export function normalizeAddonsMeta(root: string, addonsMeta: AddonMeta[]) {
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

export function normalizeUri(objects: null | unknown[] | Record<string, unknown>, base?: string) {
  if (objects === null) {
    return objects;
  }

  if (!Array.isArray(objects)) {
    if (objects.uri) {
      // objects.uri = replaceDynamicUriPart(objects.uri);

      if (base) {
        objects.uri = replaceTempUriPart(objects.uri as string, base);
      }
    }

    return objects;
  }

  return objects.map((object) => {
    if (object === null) {
      return object;
    }

    return normalizeUri(object as Record<string, unknown>, base);
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

export function makeAddonPackage(name: string, config: { entry: string }, addonConfig = undefined) {
  const pack = {
    name,
    'ember-language-server': config,
  };

  if (addonConfig) {
    pack['ember-addon'] = addonConfig;
  }

  return JSON.stringify(pack);
}

export function initServer(connection: MessageConnection, projectName: string): Promise<{ serverInfo: { name: string; version: string } }> {
  const params = {
    rootUri: URI.file(path.join(__dirname, '..', 'fixtures', projectName)).toString(),
    capabilities: {},
    initializationOptions: {
      isELSTesting: true,
    },
  };

  return connection.sendRequest(InitializeRequest.type as never, params);
}
