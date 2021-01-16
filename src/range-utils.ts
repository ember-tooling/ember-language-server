import { Position, Range } from 'vscode-languageserver/node';

import { compare } from './position-utils';

export function contains(range: Range, position: Position): boolean {
  return compare(position, range.start) >= 0 && compare(position, range.end) <= 0;
}
