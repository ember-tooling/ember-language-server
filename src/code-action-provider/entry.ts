import { Command, CodeAction, CodeActionParams } from 'vscode-languageserver';
import Server from '../server';
import { queryELSAddonsAPIChain } from './../utils/addon-api';

export class CodeActionProvider {
  constructor(private server: Server) {}
  async provideCodeActions({ textDocument, context, range }: CodeActionParams): Promise<(Command | CodeAction)[] | undefined | null> {
    const project = this.server.projectRoots.projectForUri(textDocument.uri);
    const document = this.server.documents.get(textDocument.uri);
    if (!project || !document) {
      return [];
    }
    const addonResults = await queryELSAddonsAPIChain(project.providers.codeActionProviders, project.root, {
      textDocument,
      context,
      range,
      results: [],
      project: project,
      document: document,
      server: this.server
    });
    return addonResults;
  }
}
