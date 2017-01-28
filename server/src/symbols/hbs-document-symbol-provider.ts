import { SymbolInformation, SymbolKind } from 'vscode-languageserver';
const { preprocess, traverse } = require('@glimmer/syntax');

import DocumentSymbolProvider from './document-symbol-provider';
import { locToRange } from '../ast';

export default class HBSDocumentSymbolProvider implements DocumentSymbolProvider {
  extensions: string[] = ['.hbs'];

  process(content: string): SymbolInformation[] {
    let ast = preprocess(content);

    let symbols: SymbolInformation[] = [];

    traverse(ast, {
      BlockStatement(node: any) {
        if (node.program.blockParams.length === 0) return;

        node.program.blockParams.forEach((blockParam: string) => {
          let symbol = SymbolInformation.create(blockParam, SymbolKind.Variable, locToRange(node.loc));
          symbols.push(symbol);
        });
      }
    });

    return symbols;
  }
}
