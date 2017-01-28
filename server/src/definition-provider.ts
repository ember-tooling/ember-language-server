import { extname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

import { RequestHandler, TextDocumentPositionParams, Definition, Location, Range } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import { Position, SourceLocation } from 'estree';

import { toPosition, containsPosition } from './estree-utils';
import Server from './server';

const { preprocess } = require('@glimmer/syntax');

export default class DefinitionProvider {
  constructor(private server: Server) {}

  async handle(params: TextDocumentPositionParams): Promise<Definition | null> {
    let uri = params.textDocument.uri;
    let filePath = uriToFilePath(uri);
    if (!filePath) {
      return null;
    }

    let root = await this.server.projectRoots.rootForPath(filePath);
    let extension = extname(filePath);

    if (extension === '.hbs') {
      let content = readFileSync(filePath, 'utf-8');
      let ast = preprocess(content);
      let focusPath = findFocusPath(ast, toPosition(params.position));
      if (this.isComponentName(focusPath)) {
        let componentPath = focusPath[focusPath.length - 1].original;
        console.log(`looking up component: ${componentPath}`);

        let definition: Location[] = [];

        let jsPath = join(root, 'app', 'components', `${componentPath}.js`);
        if (existsSync(jsPath)) {
          console.log(`found ${jsPath}`);
          definition.push(Location.create(`file:${jsPath}`, Range.create(0, 0, 0, 0)));
        }

        let hbsPath = join(root, 'app', 'templates', 'components', `${componentPath}.hbs`);
        if (existsSync(hbsPath)) {
          console.log(`found ${hbsPath}`);
          definition.push(Location.create(`file:${hbsPath}`, Range.create(0, 0, 0, 0)));
        }

        return definition;
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
