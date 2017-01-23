import { Range, Position } from 'vscode-languageserver';

export function locToRange(loc): Range {
  let start = Position.create(loc.start.line - 1, loc.start.column);
  let end = Position.create(loc.end.line - 1, loc.end.column);
  return Range.create(start, end);
}
