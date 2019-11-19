import { Location, ReferenceParams } from 'vscode-languageserver';
import Server from '../server';
export class ReferenceProvider {
  constructor(private server: Server) {}
  async provideReferences({ textDocument, position }: ReferenceParams): Promise<Location[]> {
    const project = this.server.projectRoots.projectForUri(textDocument.uri);
    if (!project) {
      return [];
    }
    const addonResults = await Promise.all(
      project.providers.referencesProviders.map((fn: any) => {
        return fn(project.root, { textDocument, position });
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
