import { SourceLocation } from 'estree';
import { Range, Position } from 'vscode-languageserver';

export function locToRange(loc: SourceLocation): Range {
  let start = Position.create(loc.start.line - 1, loc.start.column);
  let end = Position.create(loc.end.line - 1, loc.end.column);
  return Range.create(start, end);
}
