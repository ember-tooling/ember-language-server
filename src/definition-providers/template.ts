import { RequestHandler, TextDocumentPositionParams, Definition, Location } from 'vscode-languageserver/node';
import { searchAndExtractHbs } from '@lifeart/ember-extract-inline-templates';
import { getExtension } from './../utils/file-extension';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import { toPosition } from './../estree-utils';
import Server from './../server';
import ASTPath from './../glimmer-utils';
import { preprocess } from '@glimmer/syntax';
import { Project } from '../project';
import { parseScriptFile } from 'ember-meta-explorer';
export default class TemplateDefinitionProvider {
  constructor(private server: Server) {}
  async handle(params: TextDocumentPositionParams, project: Project): Promise<Definition | null> {
    const uri = params.textDocument.uri;
    const root = project.root;
    const document = this.server.documents.get(uri);

    if (!document) {
      return null;
    }

    const ext = getExtension(params.textDocument);
    const isScript = ['.ts', '.js'].includes(ext as string);
    const content = isScript
      ? searchAndExtractHbs(document.getText(), {
          parse(source: string) {
            return parseScriptFile(source);
          },
        })
      : document.getText();
    const ast = preprocess(content);
    const focusPath = ASTPath.toPosition(ast, toPosition(params.position), content);

    if (!focusPath) {
      return null;
    }

    const definitions: Location[] = await queryELSAddonsAPIChain(project.builtinProviders.definitionProviders, root, {
      focusPath,
      type: 'template',
      textDocument: params.textDocument,
      position: params.position,
      results: [],
      server: this.server,
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.definitionProviders, root, {
      focusPath,
      type: 'template',
      textDocument: params.textDocument,
      position: params.position,
      results: definitions,
      server: this.server,
    });

    return addonResults;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }
}
