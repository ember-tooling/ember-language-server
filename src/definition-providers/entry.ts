import { RequestHandler, TextDocumentPositionParams, Definition } from 'vscode-languageserver';

import Server from './../server';
import { getExtension } from './../utils/file-extension';
import TemplateDefinitionProvider from './template';
import ScriptDefinitionProvider from './script';

export default class DefinitionProvider {
  public template!: TemplateDefinitionProvider;
  public script!: ScriptDefinitionProvider;

  constructor(private server: Server) {
    this.template = new TemplateDefinitionProvider(server);
    this.script = new ScriptDefinitionProvider(server);
  }

  async handle(params: TextDocumentPositionParams): Promise<Definition | null> {
    let uri = params.textDocument.uri;
    // this.server.setStatusText('Running');
    const project = this.server.projectRoots.projectForUri(uri);

    if (!project) {
      return null;
    }

    let extension = getExtension(params.textDocument);

    if (extension === '.hbs') {
      return await this.template.handle(params, project);
    } else if (extension === '.js' || extension === '.ts') {
      return await this.script.handle(params, project);
    } else {
      return null;
    }
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }
}
