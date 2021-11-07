import { Definition } from 'vscode-languageserver';
import { DefinitionFunctionParams, Server } from '../..';
import { isLocalizationHelperTranslataionName } from '../../utils/ast-helpers';
import { getTranslations } from './intl-utils';

export default class IntlDefinitionProvider {
  server: Server;

  async onInit(server: Server) {
    this.server = server;
  }

  async onDefinition(root: string, params: DefinitionFunctionParams): Promise<Definition[]> {
    const { focusPath, type, results } = params;

    if (isLocalizationHelperTranslataionName(focusPath, type)) {
      const items = await getTranslations(root, this.server);
      const node = focusPath.node as any;
      const key = node.value;

      Object.keys(items).forEach((tr) => {
        if (tr === key) {
          items[tr].forEach((t) => {
            if (t.location) {
              results.push(t.location);
            }
          });
        }
      });
    }

    return results;
  }
}
