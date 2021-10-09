import * as fs from 'fs';
import { DocumentUri } from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { convertToFsStat, FileStat, FileType, fileTypeFromFsStat } from './utils/fs-utils';
import Server from './server';
import * as path from 'path';

let currentFSImplementation!: FSProvider;

export function setFSImplementation(fs: FSProvider) {
  currentFSImplementation = fs;
}

export function fsProvider(): FSProvider {
  if (!currentFSImplementation) {
    setFSImplementation(new FSProvider());
  }

  return currentFSImplementation;
}

export default class FSProvider {
  constructor() {
    this.createWriteStream = this.createWriteStream.bind(this);
    this.exists = this.exists.bind(this);
    this.readDirectory = this.readDirectory.bind(this);
    this.readFile = this.readFile.bind(this);
    this.realpathSync = this.realpathSync.bind(this);
    this.stat = this.stat.bind(this);
  }
  // expected VSCode api, replacement of existsSync
  get hasRealFsAccess() {
    return true;
  }
  async exists(uri: DocumentUri | fs.PathLike): Promise<boolean> {
    const entry = URI.isUri(uri) ? URI.parse(uri as DocumentUri).fsPath : uri;

    try {
      await fs.statSync(entry);

      return true;
    } catch (e) {
      return false;
    }
  }
  async stat(uri: DocumentUri | fs.PathLike): Promise<fs.Stats> {
    const entry = URI.isUri(uri) ? URI.parse(uri as DocumentUri).fsPath : uri;

    return fs.statSync(entry);
  }
  // expected VSCode api, replacement of readFileSync
  async readFile(uri: DocumentUri | fs.PathLike): Promise<string> {
    const entry = URI.isUri(uri) ? URI.parse(uri as DocumentUri).fsPath : uri;
    const item = fs.readFileSync(entry, null);

    // need this lines to debug slowness issues
    // await new Promise((resolve) => setTimeout(resolve, 200));

    return item.toString('utf8');
  }
  // logger api
  createWriteStream(filePath: fs.PathLike, flags: { flags: string }) {
    return fs.createWriteStream(filePath, flags);
  }
  async readDirectory(filePath: string): Promise<[string, FileType][]> {
    try {
      const files: string[] = fs.readdirSync(filePath).map((el) => {
        return el;
      });

      return files.map((fName) => {
        let fType = FileType.Unknown;

        try {
          fType = fileTypeFromFsStat(fs.statSync(path.join(filePath, '/', fName)));
        } catch (e) {
          // EOL;
        }

        return [fName, fType];
      });
    } catch (e) {
      throw null;
    }
  }
  realpathSync(filePath: fs.PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null) {
    if (!this.hasRealFsAccess) {
      throw new Error('RealpathSync supported only in real FS environments');
    }

    return fs.realpathSync(filePath, options);
  }
}

export class AsyncFsProvider extends FSProvider {
  server!: Server;
  constructor(server: Server) {
    super();
    this.server = server;
  }
  get hasRealFsAccess() {
    return false;
  }
  private getGetUri(uri: DocumentUri | fs.PathLike): URI {
    const entry = URI.file(uri as string);

    return entry;
  }
  private sendCommand(command: string, ...options: unknown[]) {
    return this.server.sendCommand(command, ...options);
  }
  async stat(uri: DocumentUri | fs.PathLike): Promise<fs.Stats> {
    const entry = this.getGetUri(uri);

    const data: FileStat = (await this.sendCommand('els.fs.stat', entry)) as FileStat;

    if (data === null) {
      throw null;
    }

    return convertToFsStat(data);
  }
  async readFile(uri: DocumentUri | fs.PathLike): Promise<string> {
    const entry = this.getGetUri(uri);

    const result = await this.sendCommand('els.fs.readFile', entry);

    if (typeof result !== 'string') {
      return '';
    }

    return result as string;
  }
  async readDirectory(rawUri: string): Promise<[string, FileType][]> {
    let uri = rawUri;

    if (rawUri.endsWith('/') || rawUri.endsWith('\\')) {
      uri = uri.slice(0, -1);
    }

    const entry = this.getGetUri(uri);

    const data: [string, FileType][] = (await this.sendCommand('els.fs.readDirectory', entry)) as [string, FileType][];

    if (data === null) {
      throw null;
    }

    return data;
  }
  async exists(uri: DocumentUri | fs.PathLike): Promise<boolean> {
    const entry = this.getGetUri(uri);

    const result = await this.sendCommand('els.fs.stat', entry);

    if (result === null) {
      return false;
    } else {
      return true;
    }
  }
}
