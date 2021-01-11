import * as path from 'path';
import * as fs from 'fs';
import { createTempDir } from 'broccoli-test-helper';
import { URI } from 'vscode-uri';
import { MessageConnection } from 'vscode-jsonrpc';
import * as spawn from 'cross-spawn';
import { DidOpenTextDocumentNotification, InitializeRequest, ExecuteCommandRequest, Definition } from 'vscode-languageserver-protocol';

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

export async function reloadProjects(connection, project = undefined) {
  const result = await connection.sendRequest(ExecuteCommandRequest.type, {
    command: 'els.reloadProject',
    arguments: project ? [project] : [],
  });

  return result;
}

export async function createProject(files, connection): Promise<{ normalizedPath: string; result: UnknownResult; destroy(): void }> {
  const dir = await createTempDir();

  dir.write(files);
  const normalizedPath = path.normalize(dir.path());
  const result = (await connection.sendRequest(ExecuteCommandRequest.type, ['els:registerProjectPath', normalizedPath])) as {
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

export async function getResult(reqType, connection, files, fileToInspect, position) {
  const { normalizedPath, destroy, result } = await createProject(files, connection);
  const modelPath = path.join(normalizedPath, fileToInspect);
  const params = textDocument(modelPath, position);

  openFile(connection, modelPath);
  const response = await connection.sendRequest(reqType, params);

  await destroy();

  return { response: normalizeUri(response, normalizedPath), registry: normalizeRegistry(normalizedPath, result.registry as Registry) };
}

export function openFile(connection: MessageConnection, filePath: string) {
  connection.sendNotification(DidOpenTextDocumentNotification.method, {
    textDocument: {
      uri: URI.file(filePath).toString(),
      text: fs.readFileSync(filePath, 'utf8'),
    },
  });
}

export function normalizePath(file: string) {
  return file.split('\\').join('/');
}

function replaceTempUriPart(uri: string, base: string) {
  const fsPath = normalizePath(URI.parse(uri).fsPath);
  const basePath = normalizePath(URI.parse(base).fsPath);

  return fsPath.split(basePath).pop();
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

export function initServer(connection: MessageConnection) {
  const params = {
    rootUri: URI.file(path.join(__dirname, '..', 'fixtures', 'full-project')).toString(),
    capabilities: {},
    initializationOptions: {
      isELSTesting: true,
    },
  };

  return connection.sendRequest((InitializeRequest.type as unknown) as string, params);
}
