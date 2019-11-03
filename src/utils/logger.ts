import * as fs from 'fs';
import * as util from 'util';

const debug = false;
const log_file = debug ? fs.createWriteStream(__dirname + '/debug.log', { flags: 'w' }) : null;

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
