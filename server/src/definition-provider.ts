import * as path from 'path';

import { RequestHandler, TextDocumentPositionParams, Definition, Location, Range } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

import { parse } from 'esprima';

import { toPosition } from './estree-utils';
import Server from './server';
import ASTPath from './glimmer-utils';
import { FileInfo, ModuleFileInfo, TemplateFileInfo } from './file-info';

const { preprocess } = require('@glimmer/syntax');

export default class DefinitionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;
    let filePath = uriToFilePath(uri);
    if (!filePath) {
      return null;
    }

    const project = this.server.projectRoots.projectForPath(filePath);
    if (!project) {
      return null;
    }

    let extension = path.extname(filePath);

    if (extension === '.hbs') {
      let content = this.server.documents.get(uri).getText();
      let ast = preprocess(content);
      let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!focusPath) {
        return null;
      }

      if (this.isComponentOrHelperName(focusPath)) {
        const componentOrHelperName = focusPath.node.original;

        return project.fileIndex.files
          .filter(fileInfo => {
            if (fileInfo instanceof ModuleFileInfo) {
              return (fileInfo.type === 'component' || fileInfo.type === 'helper') &&
                fileInfo.slashName === componentOrHelperName;

            } else if (fileInfo instanceof TemplateFileInfo) {
              return fileInfo.forComponent && fileInfo.slashName === componentOrHelperName;
            }
          })
          .map(fileInfo => toLocation(fileInfo, project.root));
      }
    } else if (extension === '.js') {
      let content = this.server.documents.get(uri).getText();
      let ast = parse(content, {
        loc: true,
        sourceType: 'module',
      });
      let astPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!astPath) {
        return null;
      }

      if (isModelReference(astPath)) {
        let modelName = astPath.node.value;

        return project.fileIndex.files
          .filter(fileInfo => fileInfo instanceof ModuleFileInfo &&
            fileInfo.type === 'model' &&
            fileInfo.name === modelName)
          .map(fileInfo => toLocation(fileInfo, project.root));
      }
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isComponentOrHelperName(path: ASTPath) {
    let node = path.node;
    if (node.type !== 'PathExpression') {
      return false;
    }

    let parent = path.parent;
    if (!parent || parent.path !== node || (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement')) {
      return false;
    }

    return true;
  }
}

function isModelReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'Literal') { return false; }
  let parent = astPath.parent;
  if (!parent || parent.type !== 'CallExpression' || parent.arguments[0] !== node) { return false; }
  let identifier = (parent.callee.type === 'Identifier') ? parent.callee : parent.callee.property;
  return identifier.name === 'belongsTo' || identifier.name === 'hasMany';
}

function toLocation(fileInfo: FileInfo, root: string) {
  let uri = `file:${path.join(root, fileInfo.relativePath)}`;
  let range = Range.create(0, 0, 0, 0);
  return Location.create(uri, range);
}
