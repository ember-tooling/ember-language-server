import { AddonAPI, CodeActionFunctionParams } from '../../../utils/addon-api';
import { Command, CodeAction } from 'vscode-languageserver/node';
import Server from '../../../server';
import { Project } from '../../../project-roots';
import { SourceLocation } from 'estree';
import { getExtension } from '../../../utils/file-extension';
import { searchAndExtractHbs } from '@lifeart/ember-extract-inline-templates';
import { parseScriptFile } from 'ember-meta-explorer';
import { toPosition } from '../../../estree-utils';
import ASTPath from '../../../glimmer-utils';
export interface INodeSelectionInfo {
  selection: string | undefined;
  location: SourceLocation;
}

function findValidNodeSelection(focusPath: ASTPath): null | INodeSelectionInfo {
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

export default class BaseCodeActionProvider implements AddonAPI {
  public server!: Server;
  public project!: Project;
  onInit(server: Server, project: Project): void {
    this.server = server;
    this.project = project;
  }
  public metaForRange(params: CodeActionFunctionParams): null | INodeSelectionInfo {
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

    return meta;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async onCodeAction(_: string, __: CodeActionFunctionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    return null;
  }
}
