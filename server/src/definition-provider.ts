import * as path from 'path';

import { RequestHandler, TextDocumentPositionParams, Definition, Location, Range } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

import { toPosition } from './estree-utils';
import Server from './server';
import { findFocusPath } from './glimmer-utils';
import { ModuleFileInfo, TemplateFileInfo } from './file-info';

const { preprocess } = require('@glimmer/syntax');

export default class DefinitionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;
    let filePath = uriToFilePath(uri);
    if (!filePath) {
      return null;
    }

    let extension = path.extname(filePath);

    if (extension === '.hbs') {
      let content = this.server.documents.get(uri).getText();
      let ast = preprocess(content);
      let focusPath = findFocusPath(ast, toPosition(params.position));

      if (this.isComponentOrHelperName(focusPath)) {
        const componentOrHelperName = focusPath[focusPath.length - 1].original;
        const index = this.server.projectRoots.indexForPath(filePath);
        if (!index) {
          return null;
        }

        return index.files
          .filter(fileInfo => {
            if (fileInfo instanceof ModuleFileInfo) {
              return (fileInfo.type === 'component' || fileInfo.type === 'helper') &&
                fileInfo.slashName === componentOrHelperName;

            } else if (fileInfo instanceof TemplateFileInfo) {
              return fileInfo.forComponent && fileInfo.slashName === componentOrHelperName;
            }
          })
          .map(fileInfo => {
            let uri = `file:${path.join(index.root, fileInfo.relativePath)}`;
            let range = Range.create(0, 0, 0, 0);
            return Location.create(uri, range);
          });
      }
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isComponentOrHelperName(path: any[]) {
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
