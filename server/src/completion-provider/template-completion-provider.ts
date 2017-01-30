import { extname } from 'path';

import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

import Server from '../server';
import { findFocusPath } from '../glimmer-utils';
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
    let focusPath = findFocusPath(ast, toPosition(params.position));

    let node = focusPath[focusPath.length - 1];
    if (!node || node.type !== 'PathExpression') {
      return [];
    }

    return getComponentAndHelperCompletions(project.fileIndex);
  }
}

function getComponentAndHelperCompletions(index: FileIndex): CompletionItem[] {
  return index.files.filter(fileInfo => isComponent(fileInfo) || isHelper(fileInfo)).map((fileInfo: ModuleFileInfo) => {
    let kind: CompletionItemKind = CompletionItemKind.Class;

    if (fileInfo.type === 'helper') {
      kind = CompletionItemKind.Function;
    }

    return {
      kind,
      label: fileInfo.slashName,
      data: {
        name: fileInfo.slashName,
        type: fileInfo.type,
      }
    };
  });
}

function isComponent(fileInfo: FileInfo) {
  return fileInfo instanceof ModuleFileInfo && fileInfo.type === 'component';
}

function isHelper(fileInfo: FileInfo) {
  return fileInfo instanceof ModuleFileInfo && fileInfo.type === 'helper';
}
