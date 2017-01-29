import {
  CompletionItem,
  CompletionItemKind
} from 'vscode-languageserver';

const EmberHelpers: CompletionItem[] = [
  {
    kind: CompletionItemKind.Function,
    label: 'action'
  }, {
    kind: CompletionItemKind.Function,
    label: 'component'
  }, {
    kind: CompletionItemKind.Function,
    label: 'concat'
  }, {
    kind: CompletionItemKind.Function,
    label: 'debugger'
  }, {
    kind: CompletionItemKind.Function,
    label: 'each'
  }, {
    kind: CompletionItemKind.Function,
    label: 'each-in'
  }, {
    kind: CompletionItemKind.Function,
    label: 'get'
  }, {
    kind: CompletionItemKind.Function,
    label: 'hash'
  }, {
    kind: CompletionItemKind.Function,
    label: 'if'
  }, {
    kind: CompletionItemKind.Class,
    label: 'input'
  }, {
    kind: CompletionItemKind.Class,
    label: 'link-to'
  }, {
    kind: CompletionItemKind.Function,
    label: 'loc'
  }, {
    kind: CompletionItemKind.Function,
    label: 'log'
  }, {
    kind: CompletionItemKind.Function,
    label: 'mount'
  }, {
    kind: CompletionItemKind.Function,
    label: 'mut'
  }, {
    kind: CompletionItemKind.Function,
    label: 'outlet'
  }, {
    kind: CompletionItemKind.Function,
    label: 'partial'
  }, {
    kind: CompletionItemKind.Function,
    label: 'query-params'
  }, {
    kind: CompletionItemKind.Function,
    label: 'render'
  }, {
    kind: CompletionItemKind.Class,
    label: 'textarea'
  }, {
    kind: CompletionItemKind.Function,
    label: 'unbound'
  }, {
    kind: CompletionItemKind.Function,
    label: 'unless'
  }, {
    kind: CompletionItemKind.Function,
    label: 'with'
  }
];

export default EmberHelpers;
