import { extname } from 'path';
import { readFileSync } from 'fs';

import { RequestHandler, TextDocumentPositionParams, Definition } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import { Position, SourceLocation } from 'estree';

import { preprocess, traverse } from '@glimmer/syntax';
import { toPosition, containsPosition } from './estree-utils';

export default class DefinitionProvider {
  handle(params: TextDocumentPositionParams): Definition {
    let uri = params.textDocument.uri;
    let filePath = uriToFilePath(uri);
    let extension = extname(filePath);

    if (extension === '.hbs') {
      let content = readFileSync(filePath, 'utf-8');
      let ast = preprocess(content);
      let focusPath = findFocusPath(ast, toPosition(params.position));
      if (this.isComponentName(focusPath)) {
        console.log('looking up component: ' + focusPath[focusPath.length - 1].original);
      }
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isComponentName(path: any[]) {
    let node = path[path.length - 1];
    if (!node || node.type !== 'PathExpression') {
      return false;
    }

    let parent = path[path.length - 2];
    if (!parent || parent.path !== node || (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement')) {
      return false;
    }

    return true;
  }
}

function findFocusPath(node: any, position: Position, seen = new Set()): any {
  seen.add(node);

  let path = [];
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
