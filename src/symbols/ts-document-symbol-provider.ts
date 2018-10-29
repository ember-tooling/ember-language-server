import { SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { parse } from 'babylon';
import DocumentSymbolProvider from './document-symbol-provider';
import { toLSRange } from '../estree-utils';

const types = require('ast-types');

export default class TSDocumentSymbolProvider implements DocumentSymbolProvider {
  extensions: string[] = ['.ts'];

  process(content: string): SymbolInformation[] {
    const ast = parse(content, {
	  sourceType: 'module',
	  plugins: ['@babel/plugin-syntax-typescript']
    });

    let symbols: SymbolInformation[] = [];

    types.visit(ast, {
      visitProperty(path: any) {
        let node = path.node;

        let symbol = SymbolInformation.create(node.key.name, SymbolKind.Property, toLSRange(node.key.loc));
        symbols.push(symbol);

        this.traverse(path);
      },
    });

    return symbols;
  }
}
