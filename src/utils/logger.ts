import * as fs from 'fs';
import * as util from 'util';

import { RemoteConsole } from 'vscode-languageserver';

const debug = true;
const log_file = debug ? fs.createWriteStream(__dirname + '/debug.log', { flags: 'w' }) : null;
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

export function log(...args: any[]) {
  if (!debug || !log_file) {
    return;
  }

  const output = args
    .map((a: any) => {
      return JSON.stringify(a);
    })
    .join(' ');

  log_file.write('----------------------------------------' + '\r\n');
  log_file.write(util.format(output) + '\r\n');
  log_file.write('----------------------------------------' + '\r\n');
}
