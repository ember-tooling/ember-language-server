import { TextDocument, Location, Position, CancellationToken } from 'vscode-languageserver';
import Server from '../server';

export class ReferenceProvider {
  constructor(private server: Server) {}
  async provideReferences(document: TextDocument, position: Position, options: { includeDeclaration: boolean }, token: CancellationToken): Promise<Location[]> {
    const project = this.server.projectRoots.projectForUri(document.uri);
    if (!project) {
      return [];
    }
    const addonResults = await Promise.all(
      project.providers.referencesProviders.map((fn) => {
        return fn(project.root, { document, position, options, token });
      })
    );

    const results: Location[] = [];
    addonResults.forEach((locations: Location[]) => {
      if (locations.length) {
        locations.forEach((loc) => {
          results.push(loc);
        });
      }
    });
    return results;
  }
}
