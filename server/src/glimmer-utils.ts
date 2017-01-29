import { Position, SourceLocation } from 'estree';
import { containsPosition } from './estree-utils';

export function findFocusPath(node: any, position: Position, seen = new Set()): any {
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
    if (!node.hasOwnProperty(key)) {
      continue;
    }

    let value = node[key];
    if (!value || typeof value !== 'object' || seen.has(value)) {
      continue;
    }

    let childPath = findFocusPath(value, position, seen);
    if (childPath.length > 0) {
      path = path.concat(childPath);
      break;
    }
  }

  return path;
}
