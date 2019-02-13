import { join } from 'path';
import uniqueBy from '../utils/unique-by';
import {
    CompletionItem,
    CompletionItemKind
} from 'vscode-languageserver';
const walkSync = require('walk-sync');

export function templateContextLookup(root: string, currentFilePath: string) {
    const nameParts = currentFilePath.split('/components/');
    if (nameParts.length !== 2) {
        return [];
    }
    const componentName = nameParts[1].split('.')[0];
    return componentsContextData(root, componentName);
}

function componentsContextData(root: string, postfix: string): CompletionItem[] {
    const jsPaths = walkSync(join(root, 'app', 'components'), {
      directories: false,
      globs: [`**/${postfix}.js`]
    });
    const infoItems = [].concat.apply([], jsPaths.map(recursiveExtractComponentContexDataFromPath));
    const items = infoItems
      .map((propertyPath: { kind: string, label: string, detail: string}) => {
        return {
          kind: CompletionItemKind[propertyPath.kind],
          label: propertyPath.label,
          detail: propertyPath.detail,
        };
      });
    return uniqueBy(items, 'label');
  }