import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TemplateLinterError } from '../template-linter';

const ParseErrorExp = /^Parse error on line (\d+)/;
const OnLineErrorExp = / \(on line (\d+)\)\.$/;

interface ITemplateNode {
  template: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export function toHbsSource(templateNode: ITemplateNode): string {
  let lastParsedLine = 1;
  const sortedTemplateNodes = [templateNode];
  const output = sortedTemplateNodes.reduce((acc: string, node: ITemplateNode): string => {
    const verticalGap = lastParsedLine < node.startLine ? '\n'.repeat(node.startLine - lastParsedLine) : '';
    const indentation = node.startColumn > 1 && !node.template.startsWith('\n') ? ' '.repeat(node.startColumn) : '';
    // We have to remove the trailing whitespace(s) after the last new line `\n` for **mutliline inline template(s)**
    // otherwise, we will have trailing whitespace lint error !!
    const rightTrimmedTemplate = node.template.replace(/(\n)[ ]+$/, (_, newLine) => newLine);

    lastParsedLine = node.endLine;
    acc += verticalGap + indentation + rightTrimmedTemplate;

    return acc;
  }, '');

  return output;
}

function convertEmberTemplateLintSeverity(value: number): DiagnosticSeverity {
  // lint values
  const TODO_SEVERITY = -1;
  const IGNORE_SEVERITY = 0;
  const WARNING_SEVERITY = 1;
  const ERROR_SEVERITY = 2;

  if (value === TODO_SEVERITY) {
    return DiagnosticSeverity.Hint;
  } else if (value === ERROR_SEVERITY) {
    return DiagnosticSeverity.Error;
  } else if (value === WARNING_SEVERITY) {
    return DiagnosticSeverity.Warning;
  } else if (value === IGNORE_SEVERITY) {
    return DiagnosticSeverity.Information;
  }

  return DiagnosticSeverity.Error;
}

function severityForError(error: TemplateLinterError): DiagnosticSeverity {
  if (error.rule) {
    return convertEmberTemplateLintSeverity(error.severity);
  } else {
    return DiagnosticSeverity.Error;
  }
}

export function toDiagnostic(source: string, error: TemplateLinterError): Diagnostic {
  const result = {
    severity: severityForError(error),
    range: toRange(source, error),
    message: toMessage(error),
    code: error.rule || 'syntax',
    source: error.rule ? 'ember-template-lint' : 'glimmer-engine',
  };

  if (result.source === 'ember-template-lint') {
    (result as any).codeDescription = {
      href: `https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/${result.code}.md`,
    };
  }

  return result as Diagnostic;
}

function toLineRange(source: string, idx: number): [number, number] {
  const line = (source.split('\n')[idx] || '').replace(/\s+$/, '');
  const pre = line.match(/^(\s*)/);

  const start = pre ? pre[1].length : 0;
  const end = line.length || start + 1;

  return [start, end];
}

function toMessage({ message, isFixable }: TemplateLinterError): string {
  if (ParseErrorExp.test(message)) {
    return message.split('\n').pop() || '';
  }

  message = message.replace(OnLineErrorExp, '');

  if (isFixable) {
    message = `${message} (fixable)`;
  }

  return message;
}

function toRange(source: string, error: TemplateLinterError): Range {
  let line: number;
  let column: number;

  const match = error.message.match(ParseErrorExp) || error.message.match(OnLineErrorExp);

  if (match) {
    line = Number(match[1]) - 1;
  } else if (error.line) {
    line = error.line - 1;
  } else {
    line = 0;
  }

  const [start, end] = toLineRange(source, line);

  if (typeof error.column === 'number') {
    column = error.column;
  } else {
    column = start;
  }

  return {
    start: { line, character: column },
    end: { line, character: end },
  };
}
