import Server from './../server';
import ASTPath from './../glimmer-utils';
import { TextDocumentPositionParams, Definition, Location } from 'vscode-languageserver';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import { toPosition } from './../estree-utils';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import { Project } from '../project-roots';

export default class ScriptDefinitionProvider {
  constructor(private server: Server) {}
  async handle(params: TextDocumentPositionParams, project: Project): Promise<Definition | null> {
    const uri = params.textDocument.uri;
    const { root } = project;
    const document = this.server.documents.get(uri);
    if (!document) {
      return null;
    }
    const content = document.getText();

    const ast = parse(content, {
      sourceType: 'module'
    });

    const astPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!astPath) {
      return null;
    }

    let results: Location[] = await queryELSAddonsAPIChain(project.builtinProviders.definitionProviders, root, {
      focusPath: astPath,
      type: 'script',
      textDocument: params.textDocument,
      position: params.position,
      results: [],
      server: this.server
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.definitionProviders, root, {
      focusPath: astPath,
      type: 'script',
      textDocument: params.textDocument,
      position: params.position,
      results,
      server: this.server
    });

    return addonResults;
  }
}
