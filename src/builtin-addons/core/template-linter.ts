import { AddonAPI, CodeActionFunctionParams } from '../../utils/addon-api';
import { Command, CodeAction, WorkspaceEdit, CodeActionKind, TextEdit } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import Server from '../../server';
import { Project } from '../../project-roots';
import { logError } from '../../utils/logger';
import { SourceLocation } from 'estree';
import { toPosition, toLSRange } from '../../estree-utils';
import ASTPath from '../../glimmer-utils';

function findValidNodeSelection(
  focusPath: ASTPath
): null | {
  selection: string | undefined;
  location: SourceLocation;
} {
  const validNodes = ['ElementNode', 'ElementModifierStatement', 'BlockStatement', 'MustacheStatement', 'Template'];
  let cursor: ASTPath | undefined = focusPath;

  while (cursor) {
    if (validNodes.includes(cursor.node.type)) {
      return {
        selection: focusPath.sourceForNode(),
        location: focusPath.node.loc,
      };
    }

    cursor = cursor.parentPath;
  }

  return null;
}

export default class ProjectTemplateLinter implements AddonAPI {
  private server!: Server;
  private project!: Project;
  onInit(server: Server, project: Project): void {
    this.server = server;
    this.project = project;
  }
  async onCodeAction(_: string, params: CodeActionFunctionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    if (!params.textDocument.uri.endsWith('.hbs')) {
      return null;
    }

    const diagnostics = params.context.diagnostics;
    const fixableIssues = diagnostics.filter((el) => el.source === 'ember-template-lint' && el.message.endsWith('(fixable)'));

    if (!fixableIssues) {
      return null;
    }

    const linterKlass = await this.server.templateLinter.linterForProject(this.project);

    if (!linterKlass) {
      return null;
    }

    const documentContent = params.document.getText();
    const ast = this.server.templateCompletionProvider.getAST(documentContent);
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
      codeActions = fixableIssues
        .map((issue) => {
          const { output, isFixed } = linter.verifyAndFix({
            source: meta.selection,
            moduleId: uriToFilePath(params.textDocument.uri),
            filePath: uriToFilePath(params.textDocument.uri),
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
        })
        .filter((el) => el !== null) as CodeAction[];
    } catch (e) {
      logError(e);
    }

    process.chdir(cwd);

    return codeActions as CodeAction[];
  }
}
