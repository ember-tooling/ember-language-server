import { ASTv1 } from '@glimmer/syntax';
import { Hover } from 'vscode-languageserver';
import { Server } from '../..';
import { nodeLoc } from '../../glimmer-utils';
import { HoverFunctionParams } from '../../utils/addon-api';
import { isLocalizationHelperTranslataionName } from '../../utils/ast-helpers';
import { getTranslations } from './intl-utils';

export default class IntlHoverProvider {
  server: Server;
  onInit(server: Server) {
    this.server = server;
  }

  async onHover(root: string, params: HoverFunctionParams): Promise<Hover[]> {
    const { results, focusPath, type } = params;

    if (isLocalizationHelperTranslataionName(focusPath, type)) {
      const node = focusPath.node as ASTv1.StringLiteral;
      const key = node.value;
      const translations = await getTranslations(root, this.server);
      const location = nodeLoc(node);

      Object.keys(translations).forEach((tr) => {
        if (tr === key) {
          const detail = translations[tr].map((t) => `${t.locale} : ${t.text}`).join('\n');

          results.push({
            contents: { kind: 'plaintext', value: detail },
            range: {
              start: { line: location.start.line - 1, character: location.start.column },
              end: { line: location.end.line - 1, character: location.end.column },
            },
          });
        }
      });
    }

    return results;
  }
}
