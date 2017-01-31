import {
  CompletionItem,
  CompletionItemKind
} from 'vscode-languageserver';

type UsableIn = 'BlockPath' | 'MustachePath' | 'SubExpressionPath';
type EmberHelperConfig = [string, CompletionItemKind, UsableIn[]];

const {
  Function: HelperItem,
  Class: ComponentItem
} = CompletionItemKind;

const emberHelperConfigs: EmberHelperConfig[] = [
  ['action',       HelperItem,    ['MustachePath', 'SubExpressionPath']],
  ['component',    HelperItem,    ['BlockPath', 'MustachePath', 'SubExpressionPath']],
  ['concat',       HelperItem,    ['MustachePath', 'SubExpressionPath']],
  ['debugger',     HelperItem,    ['MustachePath']],
  ['each',         HelperItem,    ['BlockPath']],
  ['each-in',      HelperItem,    ['BlockPath']],
  ['get',          HelperItem,    ['MustachePath', 'SubExpressionPath']],
  ['hash',         HelperItem,    ['SubExpressionPath']],
  ['if',           HelperItem,    ['BlockPath', 'MustachePath', 'SubExpressionPath']],
  ['input',        ComponentItem, ['MustachePath']],
  ['link-to',      ComponentItem, ['MustachePath']],
  ['loc',          HelperItem,    ['MustachePath', 'SubExpressionPath']],
  ['log',          HelperItem,    ['MustachePath']],
  ['mount',        HelperItem,    ['MustachePath']],
  ['mut',          HelperItem,    ['SubExpressionPath']],
  ['outlet',       HelperItem,    ['MustachePath']],
  ['partial',      HelperItem,    ['MustachePath']],
  ['query-params', HelperItem,    ['SubExpressionPath']],
  ['render',       HelperItem,    ['MustachePath']],
  ['textarea',     ComponentItem, ['MustachePath']],
  ['unbound',      HelperItem,    ['MustachePath', 'SubExpressionPath']],
  ['unless',       HelperItem,    ['BlockPath', 'MustachePath', 'SubExpressionPath']],
  ['with',         HelperItem,    ['BlockPath']]
];

function filterConfigs(type: UsableIn): EmberHelperConfig[] {
  return emberHelperConfigs.filter(([, , types]) => types.includes(type));
}

function createCompletionItem([label, kind]: EmberHelperConfig): CompletionItem {
  return { label, kind };
}

export const emberBlockItems: CompletionItem[] = filterConfigs('BlockPath').map(createCompletionItem);
export const emberMustacheItems: CompletionItem[] = filterConfigs('MustachePath').map(createCompletionItem);
export const emberSubExpressionItems: CompletionItem[] = filterConfigs('SubExpressionPath').map(createCompletionItem);
