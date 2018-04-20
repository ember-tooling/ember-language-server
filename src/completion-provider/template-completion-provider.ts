import { extname, join } from 'path';

import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';

const { preprocess } = require('@glimmer/syntax');

import {
  emberBlockItems,
  emberMustacheItems,
  emberSubExpressionItems
} from './ember-helpers';
import uniqueBy from '../utils/unique-by';
import { Project } from '../project-roots';

const walkSync = require('walk-sync');

export default class TemplateCompletionProvider {
  constructor(private server: Server) {}

  provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    const uri = params.textDocument.uri;
    const filePath = uriToFilePath(uri);

    if (!filePath || extname(filePath) !== '.hbs') {
      return [];
    }

    const project = this.server.projectRoots.projectForPath(filePath);
    if (!project) {
      return [];
    }

    let document = this.server.documents.get(uri);
    let offset = document.offsetAt(params.position);
    let originalText = document.getText();
    let text = originalText.slice(0, offset) + 'ELSCompletionDummy' + originalText.slice(offset);
    let ast = preprocess(text);
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
    if (!focusPath) {
      return [];
    }

    let completions: CompletionItem[] = [];

    if (isMustachePath(focusPath)) {
      completions.push(...listComponents(project));
      completions.push(...listHelpers(project));
      completions.push(...emberMustacheItems);
    } else if (isBlockPath(focusPath)) {
      completions.push(...listComponents(project));
      completions.push(...emberBlockItems);
    } else if (isSubExpressionPath(focusPath)) {
      completions.push(...listHelpers(project));
      completions.push(...emberSubExpressionItems);
    } else if (isLinkToTarget(focusPath)) {
      completions.push(...listRoutes(project));
    }

    return filter(completions, getTextPrefix(focusPath), { key: 'label' });
  }
}

function listComponents(project: Project): CompletionItem[] {
  const { root } = project;
  const jsPaths = walkSync(join(root, 'app', 'components'));
  const hbsPaths = walkSync(join(root, 'app', 'templates', 'components'));
  const paths = [...jsPaths, ...hbsPaths];

  const items = paths
    .filter((filePath: string) => filePath.endsWith('.js') || filePath.endsWith('.hbs'))
    .map((filePath: string) => {
      return {
        kind: CompletionItemKind.Class,
        label: filePath.replace(extname(filePath), ''),
        detail: 'component',
      };
    });

  return uniqueBy(items, 'label');
}

function listHelpers(project: Project): CompletionItem[] {
  const { root } = project;
  const jsPaths = walkSync(join(root, 'app', 'helpers'));
  const paths = [...jsPaths];

  const items = paths
    .filter((filePath: string) => filePath.endsWith('.js'))
    .map((filePath: string) => {
      return {
        kind: CompletionItemKind.Function,
        label: filePath.replace(extname(filePath), ''),
        detail: 'helper',
      };
    });

  return uniqueBy(items, 'label');
}

function listRoutes(project: Project): CompletionItem[] {
  const { root } = project;
  const jsPaths = walkSync(join(root, 'app', 'routes'));
  const paths = [...jsPaths];

  const items = paths
    .filter((filePath: string) => filePath.endsWith('.js'))
    .map((filePath: string) => {
      const label = filePath
        .replace(extname(filePath), '')
        .replace(/\//g, '.');
      return {
        kind: CompletionItemKind.File,
        label,
        detail: 'route',
      };
    });

  return uniqueBy(items, 'label');
}

function isMustachePath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') { return false; }
  return parent.path === node;
}

function isBlockPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') { return false; }
  return parent.path === node;
}

function isSubExpressionPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'SubExpression') { return false; }
  return parent.path === node;
}

function isLinkToTarget(path: ASTPath): boolean {
  return isInlineLinkToTarget(path) || isBlockLinkToTarget(path);
}

function isInlineLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') { return false; }
  return parent.params[1] === node && parent.path.original === 'link-to';
}

function isBlockLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') { return false; }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') { return false; }
  return parent.params[0] === node && parent.path.original === 'link-to';
}

function getTextPrefix({ node: { original = '' } }: ASTPath): string {
  return original.replace('ELSCompletionDummy', '');
}
