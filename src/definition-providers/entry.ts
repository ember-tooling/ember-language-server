import { RequestHandler, TextDocumentPositionParams, Definition } from 'vscode-languageserver/node';
import Server from './../server';
import { getExtension } from './../utils/file-extension';
import TemplateDefinitionProvider from './template';
import ScriptDefinitionProvider from './script';
import GlimmerScriptDefinitionProvider from './glimmer-script';
export default class DefinitionProvider {
  public template!: TemplateDefinitionProvider;
  public script!: ScriptDefinitionProvider;
  public glimmerScript!: GlimmerScriptDefinitionProvider;

  constructor(private server: Server) {
    this.template = new TemplateDefinitionProvider(server);
    this.script = new ScriptDefinitionProvider(server);
    this.glimmerScript = new GlimmerScriptDefinitionProvider(server);
  }

  async handle(params: TextDocumentPositionParams): Promise<Definition | null> {
    const uri = params.textDocument.uri;
    // this.server.setStatusText('Running');
    const project = this.server.projectRoots.projectForUri(uri);

    if (!project) {
      return null;
    }

    try {
      const extension = getExtension(params.textDocument);

      if (extension === '.hbs') {
        return await this.template.handle(params, project);
      } else if (extension === '.js' || extension === '.ts') {
        return await this.script.handle(params, project);
      } else if (extension === '.gts' || extension === '.gjs') {
        return await this.glimmerScript.handle(params, project);
      } else {
        return null;
      }
    } catch (e) {
      // logError(e);

      return null;
    }
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }
}
