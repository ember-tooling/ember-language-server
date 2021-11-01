import { Hover, HoverParams } from 'vscode-languageserver/node';
import Server from '../server';
import { queryELSAddonsAPIChain } from './../utils/addon-api';

export class HoverProvider {
  constructor(private server: Server) {}
  async provideHovers({ textDocument, position }: HoverParams): Promise<Hover[]> {
    const project = this.server.projectRoots.projectForUri(textDocument.uri);

    if (!project) {
      return [];
    }

    const addonResults = await queryELSAddonsAPIChain(project.providers.hoverProviders, project.root, {
      textDocument,
      position,
      results: [],
      server: this.server,
    });

    return addonResults;
  }
}
