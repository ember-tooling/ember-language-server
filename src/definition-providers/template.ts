import { RequestHandler, TextDocumentPositionParams, Definition, Location } from 'vscode-languageserver';
import { searchAndExtractHbs } from 'extract-tagged-template-literals';
import { getExtension } from './../utils/file-extension';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import { toPosition } from './../estree-utils';
import Server from './../server';
import ASTPath from './../glimmer-utils';
import { preprocess } from '@glimmer/syntax';
import { Project } from '../project-roots';

export default class TemplateDefinitionProvider {
  constructor(private server: Server) {}
  async handle(params: TextDocumentPositionParams, project: Project): Promise<Definition | null> {
    let uri = params.textDocument.uri;
    const root = project.root;
    const document = this.server.documents.get(uri);
    if (!document) {
      return null;
    }
    const ext = getExtension(params.textDocument);
    const isScript = ['.ts', '.js'].includes(ext as string);
    let content = isScript ? searchAndExtractHbs(document.getText()) : document.getText();
    let ast = preprocess(content);
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
    if (!focusPath) {
      return null;
    }

    let definitions: Location[] = await queryELSAddonsAPIChain(project.builtinProviders.definitionProviders, root, {
      focusPath,
      type: 'template',
      textDocument: params.textDocument,
      position: params.position,
      results: [],
      server: this.server
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.definitionProviders, root, {
      focusPath,
      type: 'template',
      textDocument: params.textDocument,
      position: params.position,
      results: definitions,
      server: this.server
    });

    return addonResults;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }
}
