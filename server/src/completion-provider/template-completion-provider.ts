import { extname } from 'path';

import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

import Server from '../server';
import ModuleIndex, { ModuleType } from '../module-index';
import { findFocusPath } from '../definition-provider';
import { toPosition } from '../estree-utils';

const { preprocess } = require('@glimmer/syntax');

export default class TemplateCompletionProvider {
  constructor(private server: Server) {}

  provideCompletions(textDocumentPosition: TextDocumentPositionParams): CompletionItem[] {

    let items: CompletionItem[] = [];
    const uri = textDocumentPosition.textDocument.uri;
    const filePath = uriToFilePath(uri);

    if (!filePath || extname(filePath) !== '.hbs') {
      return items;
    }

    const moduleIndex = this.server.projectRoots.modulesForPath(filePath);

    if (!moduleIndex) {
      return items;
    }

    let content = this.server.documents.get(uri).getText();
    content = content.replace('{{}}', '{{am-i-doing-this-right}}'); // Prevent the parser from throwing errors
    let ast = preprocess(content);
    let focusPath = findFocusPath(ast, toPosition(textDocumentPosition.position));

    let node = focusPath[focusPath.length - 1];

    if (!node || node.type !== 'PathExpression') {
      return items;
    }

    if (node.type === 'PathExpression') {
      items.push(...getComponentAndHelperCompletions(moduleIndex));
    };

    return items;
  }
}

function getComponentAndHelperCompletions(moduleIndex: ModuleIndex): CompletionItem[] {
    const components = moduleIndex.getModules(ModuleType.Component);
    const helpers = moduleIndex.getModules(ModuleType.Helper);

    return [...components, ...helpers].map(module => {
      let kind: CompletionItemKind = CompletionItemKind.Class;

      if (module.type === ModuleType.Helper) {
        kind = CompletionItemKind.Function;
      }

      return {
        kind,
        label: module.name,
        data: {
          name: module.name, type: module.type
        }
      };
    });
  }
