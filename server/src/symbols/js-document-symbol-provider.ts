import { SymbolInformation, SymbolKind } from 'vscode-languageserver-types';
import { parse } from 'esprima'

const types = require("ast-types");

import DocumentSymbolProvider from "./document-symbol-provider";
import { locToRange } from "../ast";

export default class JSDocumentSymbolProvider implements DocumentSymbolProvider {
    extensions: string[] = ['.js'];

    process(content: string): SymbolInformation[] {
        let ast = parse(content, {
            loc: true,
            sourceType: 'module',
        });

        let symbols: SymbolInformation[] = [];

        types.visit(ast, {
            visitProperty(path) {
                let node = path.node;

                let symbol = SymbolInformation.create(node.key.name, SymbolKind.Property, locToRange(node.key.loc));
                symbols.push(symbol);

                this.traverse(path);
            },
        });

        return symbols;
    }
}
