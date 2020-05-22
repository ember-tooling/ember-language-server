import { SymbolInformation, SymbolKind } from 'vscode-languageserver';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import DocumentSymbolProvider from './document-symbol-provider';
import { toLSRange } from '../estree-utils';
import { log } from './../utils/logger';
import { visit } from 'ast-types';

export default class JSDocumentSymbolProvider implements DocumentSymbolProvider {
  extensions: string[] = ['.js'];

  process(content: string): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];

    try {
      const ast = parse(content);

      visit(ast, {
        visitProperty(path: any) {
          const node = path.node;

          const symbol = SymbolInformation.create(node.key.name, SymbolKind.Property, toLSRange(node.key.loc));

          symbols.push(symbol);

          this.traverse(path);
        },
      });
    } catch (e) {
      log('symbolprovider:script:error', e, e.toString(), e.stack);
    }

    return symbols;
  }
}
