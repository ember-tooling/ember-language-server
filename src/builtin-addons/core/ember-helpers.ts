import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

type UsableIn = 'BlockPath' | 'MustachePath' | 'SubExpressionPath' | 'ModifierPath';

const HelperItem = CompletionItemKind.Function;
const ComponentItem = CompletionItemKind.Class;

class EmberCompletionItem implements CompletionItem {
  public detail: string;

  constructor(readonly label: string, readonly kind: CompletionItemKind, readonly usableIn: UsableIn[], readonly version?: string) {
    this.detail = 'Ember';

    if (version) {
      this.detail = `Ember ${this.version}`;
    }
  }
}

const emberCompletionItems: EmberCompletionItem[] = [
  new EmberCompletionItem('action', HelperItem, ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('component', HelperItem, ['BlockPath', 'MustachePath', 'SubExpressionPath'], '1.11.0'),
  new EmberCompletionItem('concat', HelperItem, ['MustachePath', 'SubExpressionPath'], '1.13.0'),
  new EmberCompletionItem('debugger', HelperItem, ['MustachePath']),
  new EmberCompletionItem('each', HelperItem, ['BlockPath']),
  new EmberCompletionItem('each-in', HelperItem, ['BlockPath'], '2.1.0'),
  new EmberCompletionItem('in-element', HelperItem, ['BlockPath']),
  new EmberCompletionItem('let', HelperItem, ['BlockPath']),
  new EmberCompletionItem('on', HelperItem, ['ModifierPath']),
  new EmberCompletionItem('get', HelperItem, ['MustachePath', 'SubExpressionPath'], '2.1.0'),
  new EmberCompletionItem('fn', HelperItem, ['MustachePath', 'SubExpressionPath'], '3.12.0'),
  new EmberCompletionItem('hash', HelperItem, ['SubExpressionPath']),
  new EmberCompletionItem('has-block', HelperItem, ['SubExpressionPath']),
  new EmberCompletionItem('if', HelperItem, ['BlockPath', 'MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('input', ComponentItem, ['MustachePath']),
  new EmberCompletionItem('link-to', ComponentItem, ['MustachePath']),
  new EmberCompletionItem('loc', HelperItem, ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('log', HelperItem, ['MustachePath']),
  new EmberCompletionItem('mount', HelperItem, ['MustachePath']),
  new EmberCompletionItem('mut', HelperItem, ['SubExpressionPath']),
  new EmberCompletionItem('outlet', HelperItem, ['MustachePath']),
  new EmberCompletionItem('yield', HelperItem, ['MustachePath']),
  new EmberCompletionItem('else', HelperItem, ['MustachePath']),
  new EmberCompletionItem('query-params', HelperItem, ['SubExpressionPath']),
  new EmberCompletionItem('render', HelperItem, ['MustachePath']),
  new EmberCompletionItem('textarea', ComponentItem, ['MustachePath']),
  new EmberCompletionItem('unbound', HelperItem, ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('unless', HelperItem, ['BlockPath', 'MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('with', HelperItem, ['BlockPath'])
];

function filterConfigs(type: UsableIn): EmberCompletionItem[] {
  return emberCompletionItems.filter(({ usableIn }) => usableIn.includes(type));
}

export const emberBlockItems: CompletionItem[] = filterConfigs('BlockPath');
export const emberMustacheItems: CompletionItem[] = filterConfigs('MustachePath');
export const emberSubExpressionItems: CompletionItem[] = filterConfigs('SubExpressionPath');
export const emberModifierItems: CompletionItem[] = filterConfigs('ModifierPath');
