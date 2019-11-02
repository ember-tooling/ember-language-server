import { Position, SourceLocation } from 'estree';
import { containsPosition } from './estree-utils';

export default class ASTPath {
  static toPosition(ast: any, position: Position): ASTPath | undefined {
    let path = _findFocusPath(ast, position);
    if (path) {
      return new ASTPath(path);
    }
  }

  private constructor(private readonly path: any[], private readonly index: number = path.length - 1) {}

  get node(): any {
    return this.path[this.index];
  }

  get parent(): any | undefined {
    return this.path[this.index - 1];
  }

  get parentPath(): ASTPath | undefined {
    return new ASTPath(this.path, this.index - 1);
  }
}

function _findFocusPath(node: any, position: Position, seen = new Set()): any {
  seen.add(node);

  let path: any[] = [];
  let range: SourceLocation = node.loc;
  if (range) {
    if (containsPosition(range, position)) {
      path.push(node);
    } else {
      return [];
    }
  }

  for (let key in node) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) {
      continue;
    }

    let value = node[key];
    if (!value || typeof value !== 'object' || seen.has(value)) {
      continue;
    }

    let childPath = _findFocusPath(value, position, seen);
    if (childPath.length > 0) {
      path = path.concat(childPath);
      break;
    }
  }

  return path;
}
