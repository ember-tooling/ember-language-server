import { extname } from 'path';

import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import FileIndex from '../file-index';
import { FileInfo, ModuleFileInfo } from '../file-info';

const { preprocess } = require('@glimmer/syntax');

export default class TemplateCompletionProvider {
  constructor(private server: Server) {}

  provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    const uri = params.textDocument.uri;
    const filePath = uriToFilePath(uri);

    if (!filePath || extname(filePath) !== '.hbs') {
      return [];
    }

    const project = this.server.projectRoots.projectForPath(filePath);
    if (!project) {
      return [];
    }

    let document = this.server.documents.get(uri);
    let offset = document.offsetAt(params.position);
    let originalText = document.getText();
    let text = originalText.slice(0, offset) + 'ELSCompletionDummy' + originalText.slice(offset);
    let ast = preprocess(text);
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
    if (!focusPath) {
      return [];
    }

    let completions: CompletionItem[] = [];

    if (isMustachePath(focusPath)) {
      completions.push(...listComponents(project.fileIndex));
      completions.push(...listHelpers(project.fileIndex));
    } else if (isBlockPath(focusPath)) {
      completions.push(...listComponents(project.fileIndex));
    } else if (isSubExpressionPath(focusPath)) {
      completions.push(...listHelpers(project.fileIndex));
    }

    return completions;
  }
}

function listComponents(index: FileIndex): CompletionItem[] {
  return index.files.filter(isComponent).map(toCompletionItem);
}

function listHelpers(index: FileIndex): CompletionItem[] {
  return index.files.filter(isHelper).map(toCompletionItem);
}

function isMustachePath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') { return false; }
  return parent.path === node;
}

function isBlockPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') { return false; }
  return parent.path === node;
}

function isSubExpressionPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'SubExpression') { return false; }
  return parent.path === node;
}

function isComponent(fileInfo: FileInfo) {
  return fileInfo instanceof ModuleFileInfo && fileInfo.type === 'component';
}

function isHelper(fileInfo: FileInfo) {
  return fileInfo instanceof ModuleFileInfo && fileInfo.type === 'helper';
}

function toCompletionItem(fileInfo: ModuleFileInfo) {
  let kind = toCompletionItemKind(fileInfo.type);

  return {
    kind,
    label: fileInfo.slashName,
    detail: fileInfo.type,
  };
}

function toCompletionItemKind(type: string): CompletionItemKind {
  return (type === 'helper') ? CompletionItemKind.Function : CompletionItemKind.Class;
}
