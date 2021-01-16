import { SymbolInformation, SymbolKind } from 'vscode-languageserver/node';
import { preprocess, traverse, ASTv1 } from '@glimmer/syntax';
import { log } from './../utils/logger';
import DocumentSymbolProvider from './document-symbol-provider';
import { toLSRange } from '../estree-utils';

export default class HBSDocumentSymbolProvider implements DocumentSymbolProvider {
  extensions: string[] = ['.hbs'];
  process(content: string): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];

    try {
      const ast = preprocess(content);

      traverse(ast, {
        ElementNode(node: ASTv1.ElementNode) {
          if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
            symbols.push(SymbolInformation.create(node.tag, SymbolKind.Variable, toLSRange(node.loc)));
          }
        },
        BlockStatement(node: ASTv1.BlockStatement) {
          if (node.hash.pairs.length) {
            node.hash.pairs.forEach((pair: ASTv1.HashPair) => {
              symbols.push(SymbolInformation.create(pair.key, SymbolKind.Property, toLSRange(pair.loc)));
            });
          }

          if (node.program.blockParams.length === 0) return;

          node.program.blockParams.forEach((blockParam: string) => {
            const symbol = SymbolInformation.create(blockParam, SymbolKind.Variable, toLSRange(node.loc));

            symbols.push(symbol);
          });
        },
        MustacheStatement(node: ASTv1.MustacheStatement) {
          if (node.hash.pairs.length) {
            node.hash.pairs.forEach((pair: ASTv1.HashPair) => {
              symbols.push(SymbolInformation.create(pair.key, SymbolKind.Property, toLSRange(pair.loc)));
            });
          }

          if (node.path.type === 'PathExpression') {
            if (node.path.head.type === 'AtHead') {
              const symbol = SymbolInformation.create(node.path.original, SymbolKind.Variable, toLSRange(node.path.loc));

              symbols.push(symbol);
            }
          }
        },
      });
    } catch (e) {
      log('symbolprovider:template:error', e, e.toString(), e.stack);
    }

    return symbols;
  }
}
