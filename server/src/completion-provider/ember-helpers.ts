import {
  CompletionItem,
  CompletionItemKind
} from 'vscode-languageserver';

type UsableIn = 'BlockPath' | 'MustachePath' | 'SubExpressionPath';

const HelperItem = CompletionItemKind.Function;
const ComponentItem = CompletionItemKind.Class;

class EmberCompletionItem implements CompletionItem {

  public detail: string;

  constructor(
    public label: string,
    public kind: CompletionItemKind,
    public usableIn: UsableIn[]
  ) {
  }
}

const emberHelperConfigs: EmberCompletionItem[] = [
  new EmberCompletionItem('action',       HelperItem,    ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('component',    HelperItem,    ['BlockPath', 'MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('concat',       HelperItem,    ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('debugger',     HelperItem,    ['MustachePath']),
  new EmberCompletionItem('each',         HelperItem,    ['BlockPath']),
  new EmberCompletionItem('each-in',      HelperItem,    ['BlockPath']),
  new EmberCompletionItem('get',          HelperItem,    ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('hash',         HelperItem,    ['SubExpressionPath']),
  new EmberCompletionItem('if',           HelperItem,    ['BlockPath', 'MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('input',        ComponentItem, ['MustachePath']),
  new EmberCompletionItem('link-to',      ComponentItem, ['MustachePath']),
  new EmberCompletionItem('loc',          HelperItem,    ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('log',          HelperItem,    ['MustachePath']),
  new EmberCompletionItem('mount',        HelperItem,    ['MustachePath']),
  new EmberCompletionItem('mut',          HelperItem,    ['SubExpressionPath']),
  new EmberCompletionItem('outlet',       HelperItem,    ['MustachePath']),
  new EmberCompletionItem('partial',      HelperItem,    ['MustachePath']),
  new EmberCompletionItem('query-params', HelperItem,    ['SubExpressionPath']),
  new EmberCompletionItem('render',       HelperItem,    ['MustachePath']),
  new EmberCompletionItem('textarea',     ComponentItem, ['MustachePath']),
  new EmberCompletionItem('unbound',      HelperItem,    ['MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('unless',       HelperItem,    ['BlockPath', 'MustachePath', 'SubExpressionPath']),
  new EmberCompletionItem('with',         HelperItem,    ['BlockPath'])
];

function filterConfigs(type: UsableIn): EmberCompletionItem[] {
  return emberHelperConfigs.filter(({ usableIn }) => usableIn.includes(type));
}

export const emberBlockItems: CompletionItem[] = filterConfigs('BlockPath');
export const emberMustacheItems: CompletionItem[] = filterConfigs('MustachePath');
export const emberSubExpressionItems: CompletionItem[] = filterConfigs('SubExpressionPath');
