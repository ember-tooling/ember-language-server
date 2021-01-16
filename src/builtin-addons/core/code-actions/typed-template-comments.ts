import { CodeActionFunctionParams } from '../../../utils/addon-api';
import { Command, CodeAction, WorkspaceEdit, CodeActionKind, TextEdit, Diagnostic } from 'vscode-languageserver/node';
import { logError } from '../../../utils/logger';
import { toLSRange } from '../../../estree-utils';
import TemplateLintCommentsCodeAction from './template-lint-comments';
import { INodeSelectionInfo } from './base';

export default class TypedTemplatesCodeAction extends TemplateLintCommentsCodeAction {
  fixTypedTemplatesIssues(typedTemplateIssue: Diagnostic[], params: CodeActionFunctionParams, meta: INodeSelectionInfo): Array<CodeAction | null> {
    const fixes = typedTemplateIssue.map((): null | CodeAction => {
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
    });

    return fixes;
  }
  public async onCodeAction(_: string, params: CodeActionFunctionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    const diagnostics = params.context.diagnostics as Diagnostic[];
    const typedTemplateIssue = diagnostics.filter((el) => el.source === 'typed-templates');

    if (typedTemplateIssue.length === 0) {
      return null;
    }

    const meta = this.metaForRange(params);

    if (!meta) {
      return null;
    }

    const fixedIssues = await this.fixTypedTemplatesIssues(typedTemplateIssue, params, meta);
    const codeActions = fixedIssues.filter((el) => el !== null) as CodeAction[];

    return codeActions;
  }
}
