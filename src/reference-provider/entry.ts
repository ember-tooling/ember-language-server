import { Location, ReferenceParams } from 'vscode-languageserver';
import Server from '../server';
import { queryELSAddonsAPIChain } from './../utils/addon-api';

export class ReferenceProvider {
  constructor(private server: Server) {}
  async provideReferences({ textDocument, position }: ReferenceParams): Promise<Location[]> {
    const project = this.server.projectRoots.projectForUri(textDocument.uri);
    if (!project) {
      return [];
    }
    const addonResults = await queryELSAddonsAPIChain(project.providers.referencesProviders, project.root, {
      textDocument,
      position,
      results: [],
      server: this.server
    });
    return addonResults;
  }
}
