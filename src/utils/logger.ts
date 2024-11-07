import * as util from 'util';
import { resolve } from 'path';

import { RemoteConsole } from 'vscode-languageserver/node';
import { fsProvider } from '../fs-provider';

function getEnv() {
  if (typeof process !== undefined) {
    return process.env;
  } else {
    return {};
  }
}

// Log debugging to the ELS package root, if possible
// eslint-disable-next-line no-extra-boolean-cast
const debug = !!getEnv().CI ? true : getEnv().ELS_DEBUG || false;
const log_file = debug ? fsProvider().createWriteStream(resolve(__dirname, `../../debug.${process.pid}.log`), { flags: 'w' }) : null;

let remoteConsole: RemoteConsole | null = null;

export function logError(err: Error & { stack: string }) {
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

export function instrumentTime(label: string) {
  let last = Date.now();

  return {
    reset: () => {
      last = Date.now();
    },
    log: (msg: string) => {
      const now = Date.now();
      const diff = now - last;

      last = now;

      logInfo(`[${label}] +${diff}ms :: ${msg}`);
    },
  };
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

export function logDebugInfo(...args: unknown[]) {
  if (!log_file) {
    return;
  }

  const output = args.map((a) => safeStringify(a)).join(' ');

  log_file.write('----------------------------------------' + '\r\n');
  log_file.write(util.format(output) + '\r\n');
  log_file.write('----------------------------------------' + '\r\n');
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
