import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { preprocess, traverse, ASTv1 } from '@glimmer/syntax';

export default class TemplateFoldingProvider {
  handle(document: TextDocument): FoldingRange[] {
    const content = document.getText();
    const ast = preprocess(content);
    const results: FoldingRange[] = [];

    function nodeToResults(node: ASTv1.Block | ASTv1.BlockStatement | ASTv1.ElementNode | ASTv1.MustacheCommentStatement) {
      const loc = node.loc.toJSON();

      if (loc.start.line !== loc.end.line) {
        const kind = node.type === 'MustacheCommentStatement' ? FoldingRangeKind.Comment : FoldingRangeKind.Region;

        results.push(FoldingRange.create(loc.start.line - 1, loc.end.line - 1, loc.start.column, loc.end.column, kind));
      }
    }

    traverse(ast, {
      BlockStatement(node: ASTv1.BlockStatement) {
        nodeToResults(node);

        if (node.inverse) {
          nodeToResults(node.inverse);
        }
      },
      MustacheCommentStatement(node: ASTv1.MustacheCommentStatement) {
        nodeToResults(node);
      },
      ElementNode(node: ASTv1.ElementNode) {
        nodeToResults(node);
      },
    });

    return results;
  }
}
