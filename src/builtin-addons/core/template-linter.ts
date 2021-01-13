import { AddonAPI, CodeActionFunctionParams } from '../../utils/addon-api';
import { Command, CodeAction, WorkspaceEdit, CodeActionKind, TextEdit } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import Server from '../../server';
import { Project } from '../../project-roots';
import { logError } from '../../utils/logger';
import { searchAndExtractHbs } from '@lifeart/ember-extract-inline-templates';
import { parseScriptFile } from 'ember-meta-explorer';
import { SourceLocation } from 'estree';
import { toPosition, toLSRange } from '../../estree-utils';
import ASTPath from '../../glimmer-utils';
import * as recast from 'ember-template-recast';
import { getExtension } from '../../utils/file-extension';

function findValidNodeSelection(
  focusPath: ASTPath
): null | {
  selection: string | undefined;
  location: SourceLocation;
} {
  const validNodes = ['ElementNode', 'BlockStatement', 'MustacheStatement', 'Template'];
  let cursor: ASTPath | undefined = focusPath;

  while (cursor && cursor.node) {
    if (validNodes.includes(cursor.node.type)) {
      return {
        selection: cursor.sourceForNode(),
        location: cursor.node.loc,
      };
    }

    cursor = cursor.parentPath;
  }

  return null;
}

const extensionsToLint: string[] = ['.hbs', '.js', '.ts'];

export default class ProjectTemplateLinter implements AddonAPI {
  private server!: Server;
  private project!: Project;
  onInit(server: Server, project: Project): void {
    this.server = server;
    this.project = project;
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

        function addComment(node: any, el: any) {
          if (seen.has(node)) {
            return;
          }

          if (items > 0) {
            return;
          }

          seen.add(node);
          const children = el.parent && el.parent.node && (el.parent.node.children || el.parent.node.body);

          if (children) {
            items++;
            const startColumn = node.loc.start.column;
            const text = ` ${comment} `;

            children.splice(children.indexOf(node), 0, b.mustacheComment(text));
            children.splice(children.indexOf(node), 0, b.text('\n' + new Array(startColumn).fill(' ').join('')));
          }
        }

        return {
          ElementNode(node, el) {
            addComment(node, el);
          },
          BlockStatement(node, el) {
            addComment(node, el);
          },
          MustacheStatement(node, el) {
            addComment(node, el);
          },
        };
      },
    });

    return code.trimLeft();
  }
  async onCodeAction(_: string, params: CodeActionFunctionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    const diagnostics = params.context.diagnostics;
    const fixableIssues = diagnostics.filter((el) => el.source === 'ember-template-lint' && el.message.endsWith('(fixable)'));
    const commentableIssues = diagnostics.filter((el) => el.source === 'ember-template-lint' && !el.message.endsWith('(fixable)') && el.code);
    const typedTemplateIssue = diagnostics.filter((el) => el.source === 'typed-templates');

    if (!fixableIssues.length && !commentableIssues.length && !typedTemplateIssue.length) {
      return null;
    }

    const linterKlass = await this.server.templateLinter.linterForProject(this.project);

    if (!linterKlass) {
      return null;
    }

    const documentContent = params.document.getText();
    const extension = getExtension(params.textDocument);
    let ast;

    if (!extensionsToLint.includes(extension as string)) {
      return null;
    }

    if (extension === '.hbs') {
      ast = this.server.templateCompletionProvider.getAST(documentContent);
    } else {
      const templateData = searchAndExtractHbs(documentContent, {
        parse(source: string) {
          return parseScriptFile(source);
        },
      });

      ast = this.server.templateCompletionProvider.getAST(templateData);
    }

    let focusPath = this.server.templateCompletionProvider.createFocusPath(ast, toPosition(params.range.start), documentContent);

    if (!focusPath) {
      return null;
    }

    focusPath = this.server.templateCompletionProvider.createFocusPath(ast, toPosition(params.range.end), documentContent);

    if (!focusPath) {
      return null;
    }

    const meta = findValidNodeSelection(focusPath);

    if (!meta) {
      return null;
    }

    const cwd = process.cwd();

    process.chdir(this.project.root);
    const linter = new linterKlass();
    let codeActions: CodeAction[] = [];

    try {
      codeActions = [
        ...fixableIssues.map((issue) => {
          const { output, isFixed } = linter.verifyAndFix({
            source: meta.selection,
            moduleId: URI.parse(params.textDocument.uri).fsPath,
            filePath: URI.parse(params.textDocument.uri).fsPath,
          });

          if (!isFixed) {
            return null;
          }

          const edit: WorkspaceEdit = {
            changes: {
              [params.textDocument.uri]: [TextEdit.replace(toLSRange(meta.location), output)],
            },
          };

          return CodeAction.create(`fix: ${issue.code}`, edit, CodeActionKind.QuickFix);
        }),
        ...typedTemplateIssue.map(() => {
          if (!meta.selection) {
            return null;
          }

          try {
            const result = this.commentCodeAction(meta, `@ts-ignore`);

            if (result === meta.selection) {
              return null;
            }

            const edit: WorkspaceEdit = {
              changes: {
                [params.textDocument.uri]: [TextEdit.replace(toLSRange(meta.location), result)],
              },
            };

            return CodeAction.create(`disable: typed-templates`, edit, CodeActionKind.QuickFix);
          } catch (e) {
            logError(e);

            return null;
          }
        }),
        ...commentableIssues.map((issue) => {
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
        }),
      ].filter((el) => el !== null) as CodeAction[];
    } catch (e) {
      logError(e);
    }

    process.chdir(cwd);

    return codeActions as CodeAction[];
  }
}
