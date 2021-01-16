import { CodeActionFunctionParams } from '../../../utils/addon-api';
import { Command, CodeAction, WorkspaceEdit, CodeActionKind, TextEdit, Diagnostic } from 'vscode-languageserver/node';
import { logError } from '../../../utils/logger';

import { SourceLocation } from 'estree';
import { toLSRange } from '../../../estree-utils';
import { nodeLoc } from '../../../glimmer-utils';
import * as recast from 'ember-template-recast';
import { ASTv1, WalkerPath } from '@glimmer/syntax';
import BaseCodeActionProvider, { INodeSelectionInfo } from './base';

export default class TemplateLintCommentsCodeAction extends BaseCodeActionProvider {
  fixTemplateLintIssuesWithComment(commentableIssues: Diagnostic[], params: CodeActionFunctionParams, meta: INodeSelectionInfo): Array<CodeAction | null> {
    return commentableIssues.map((issue) => {
      if (!meta.selection) {
        return null;
      }

      try {
        const result = this.commentCodeAction(meta, `template-lint-disable ${issue.code}`);

        if (result === meta.selection) {
          return null;
        }

        const edit: WorkspaceEdit = {
          changes: {
            [params.textDocument.uri]: [TextEdit.replace(toLSRange(meta.location), result)],
          },
        };

        return CodeAction.create(`disable: ${issue.code}`, edit, CodeActionKind.QuickFix);
      } catch (e) {
        logError(e);

        return null;
      }
    });
  }
  commentCodeAction(meta: { selection: string | undefined; location: SourceLocation }, comment: string) {
    const transform = recast.transform;
    const seen = new Set();
    const offset = new Array(meta.location.start.column).fill(' ').join('');
    const template = `${offset}${meta.selection}`;
    const { code } = transform({
      template,
      plugin(env) {
        const { builders: b } = env.syntax;
        let items = 0;

        function addComment(
          node: ASTv1.ElementNode | ASTv1.BlockStatement | ASTv1.MustacheStatement,
          el: WalkerPath<ASTv1.ElementNode | ASTv1.BlockStatement | ASTv1.MustacheStatement>
        ) {
          if (seen.has(node) || items > 0 || !el.parent || !el.parent.node) {
            return;
          }

          seen.add(node);

          const parentNode = el.parent.node as { children?: ASTv1.Node[]; body?: ASTv1.Node[] };

          const children = parentNode.children || parentNode.body;

          if (children && node.loc) {
            items++;
            const loc = nodeLoc(node);
            const startColumn = loc.start.column;
            const text = ` ${comment} `;
            const textComment = '\n' + new Array(startColumn).fill(' ').join('');

            children.splice(children.indexOf(node), 0, (b.mustacheComment(text) as unknown) as ASTv1.CommentStatement);
            children.splice(children.indexOf(node), 0, (b.text(textComment) as unknown) as ASTv1.TextNode);
          }
        }

        return {
          ElementNode(node, nodePath: WalkerPath<ASTv1.ElementNode>) {
            addComment(node as ASTv1.ElementNode, nodePath);
          },
          BlockStatement(node, nodePath: WalkerPath<ASTv1.BlockStatement>) {
            addComment(node as ASTv1.BlockStatement, nodePath);
          },
          MustacheStatement(node, nodePath: WalkerPath<ASTv1.MustacheStatement>) {
            addComment(node as ASTv1.MustacheStatement, nodePath);
          },
        };
      },
    });

    return code.trimLeft();
  }
  public async onCodeAction(_: string, params: CodeActionFunctionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    const diagnostics = params.context.diagnostics as Diagnostic[];

    const commentableIssues = diagnostics.filter((el) => el.source === 'ember-template-lint' && !el.message.endsWith('(fixable)') && el.code);

    if (commentableIssues.length === 0) {
      return null;
    }

    const meta = this.metaForRange(params);

    if (!meta) {
      return null;
    }

    const fixedIssues = await this.fixTemplateLintIssuesWithComment(commentableIssues, params, meta);
    const codeActions = fixedIssues.filter((el) => el !== null) as CodeAction[];

    return codeActions;
  }
}
