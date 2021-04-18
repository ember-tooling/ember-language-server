import * as fs from 'fs';
import * as util from 'util';
import { resolve } from 'path';

import { RemoteConsole } from 'vscode-languageserver/node';

// Log debugging to the ELS package root, if possible
const debug = process.env.ELS_DEBUG || false;
const log_file = debug ? fs.createWriteStream(resolve(__dirname, '../../debug.log'), { flags: 'w' }) : null;

let remoteConsole: RemoteConsole | null = null;

export function logError(err: any) {
  if (remoteConsole) {
    remoteConsole.error(err.stack);
  } else {
    log(err, err.toString(), err.stack);
  }
}

export function logInfo(str: string) {
  if (remoteConsole) {
    remoteConsole.info(str);
  } else {
    log(str);
  }
}

export function setConsole(item: RemoteConsole | null) {
  remoteConsole = item;
}

export function safeStringify(obj: unknown, indent = 2) {
  const cache = new WeakSet();
  const retVal = JSON.stringify(
    obj,
    (_, value) =>
      typeof value === 'object' && value !== null
        ? cache.has(value)
          ? undefined // Duplicate reference found, discard key
          : cache.add(value) && value // Store value in our collection
        : value,
    indent
  );

  return retVal;
}

export function log(...args: unknown[]) {
  const output = args.map((a) => safeStringify(a)).join(' ');

  if (remoteConsole) {
    remoteConsole.log(output);
  }

  if (!log_file) {
    return;
  }

  log_file.write('----------------------------------------' + '\r\n');
  log_file.write(util.format(output) + '\r\n');
  log_file.write('----------------------------------------' + '\r\n');
}
