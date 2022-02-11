import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { preprocess, traverse, ASTv1 } from '@glimmer/syntax';

export default class TemplateFoldingProvider {
  handle(document: TextDocument): FoldingRange[] | null {
    const content = document.getText();
    const ast = preprocess(content);
    const results: FoldingRange[] = [];

    traverse(ast, {
      BlockStatement(node: ASTv1.BlockStatement) {
        const loc = node.loc.toJSON();

        results.push(FoldingRange.create(loc.start.line - 1, loc.end.line - 1, loc.start.column, loc.end.column, FoldingRangeKind.Region));

        if (node.inverse) {
          const loc = node.inverse.loc.toJSON();

          results.push(FoldingRange.create(loc.start.line - 1, loc.end.line - 1, loc.start.column, loc.end.column, FoldingRangeKind.Region));
        }
      },
      MustacheCommentStatement(node: ASTv1.MustacheCommentStatement) {
        const loc = node.loc.toJSON();

        results.push(FoldingRange.create(loc.start.line - 1, loc.end.line - 1, loc.start.column, loc.end.column, FoldingRangeKind.Comment));
      },
      ElementNode(node: ASTv1.ElementNode) {
        const loc = node.loc.toJSON();

        results.push(FoldingRange.create(loc.start.line - 1, loc.end.line - 1, loc.start.column, loc.end.column, FoldingRangeKind.Region));
      },
    });

    return results;
  }
}
