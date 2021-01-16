import { CodeActionFunctionParams } from '../../../utils/addon-api';
import { Command, CodeAction, WorkspaceEdit, CodeActionKind, TextEdit, Diagnostic } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { toLSRange } from '../../../estree-utils';
import BaseCodeActionProvider, { INodeSelectionInfo } from './base';

export default class TemplateLintFixesCodeAction extends BaseCodeActionProvider {
  async fixTemplateLintIssues(issues: Diagnostic[], params: CodeActionFunctionParams, meta: INodeSelectionInfo): Promise<Array<CodeAction | null>> {
    const linterKlass = await this.server.templateLinter.linterForProject(this.project);

    if (!linterKlass) {
      return [null];
    }

    const cwd = process.cwd();

    try {
      process.chdir(this.project.root);
      const linter = new linterKlass();

      const fixes = issues.map(
        async (issue): Promise<null | CodeAction> => {
          const { output, isFixed } = await Promise.resolve(
            linter.verifyAndFix({
              source: meta.selection,
              moduleId: URI.parse(params.textDocument.uri).fsPath,
              filePath: URI.parse(params.textDocument.uri).fsPath,
            })
          );

          if (!isFixed) {
            return null;
          }

          const edit: WorkspaceEdit = {
            changes: {
              [params.textDocument.uri]: [TextEdit.replace(toLSRange(meta.location), output)],
            },
          };

          return CodeAction.create(`fix: ${issue.code}`, edit, CodeActionKind.QuickFix);
        }
      );
      const resolvedFixes = await Promise.all(fixes);

      return resolvedFixes;
    } catch (e) {
      return [];
    } finally {
      process.chdir(cwd);
    }
  }
  public async onCodeAction(_: string, params: CodeActionFunctionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    const diagnostics = params.context.diagnostics as Diagnostic[];
    const fixableIssues = diagnostics.filter((el) => el.source === 'ember-template-lint' && el.message.endsWith('(fixable)'));

    if (fixableIssues.length === 0) {
      return null;
    }

    const meta = this.metaForRange(params);

    if (!meta) {
      return null;
    }

    const fixedIssues = await this.fixTemplateLintIssues(fixableIssues, params, meta);
    const codeActions = fixedIssues.filter((el) => el !== null) as CodeAction[];

    return codeActions;
  }
}
