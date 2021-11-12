import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { CompletionFunctionParams, Server } from '../..';
import { isLocalizationHelperTranslataionName } from '../../utils/ast-helpers';
import { getTranslations } from './intl-utils';

export default class IntlCompletionProvider {
  server: Server;

  async onInit(server: Server) {
    this.server = server;
  }

  async onComplete(root: string, params: CompletionFunctionParams): Promise<CompletionItem[]> {
    const { focusPath, position, results, type } = params;

    if (isLocalizationHelperTranslataionName(focusPath, type)) {
      const items = await getTranslations(root, this.server);
      const PLACEHOLDER = 'ELSCompletionDummy';
      const node = focusPath.node as any;
      let indexOfPlaceholder = node.value.indexOf(PLACEHOLDER);

      if (indexOfPlaceholder === -1 && focusPath.parent && focusPath.parent.callee && focusPath.parent.callee.property) {
        // in js call
        indexOfPlaceholder = position.character - focusPath.parent.callee.property.loc.start.column - 3; // column start of `t` call + `t("` (3 symbols)
      }

      const key = node.value.slice(0, indexOfPlaceholder);
      const startPosition = {
        character: position.character - key.length,
        line: position.line,
      };

      Object.keys(items).forEach((tr) => {
        const keystr = tr + items[tr].map((t) => t.text);
        const detail = items[tr].map((t) => `${t.locale} : ${t.text}`).join('\n');

        if (!keystr.toLowerCase().includes(key.toLowerCase())) {
          return;
        }

        const endPosition = {
          character: startPosition.character,
          line: position.line,
        };

        if (tr.includes(key)) {
          results.push({
            label: tr,
            kind: CompletionItemKind.Value,
            textEdit: {
              newText: tr,
              range: {
                start: startPosition,
                end: endPosition,
              },
            },
            documentation: detail,
          });
        }

        items[tr].forEach((t) => {
          if (!t.text.toLowerCase().includes(key.toLowerCase())) {
            return;
          }

          results.push({
            label: t.text,
            kind: CompletionItemKind.Value,
            textEdit: {
              newText: tr,
              range: {
                start: startPosition,
                end: endPosition,
              },
            },
            filterText: t.text + ' ' + t.locale,
            documentation: detail,
          });
        });
      });
    }

    return results;
  }
}
