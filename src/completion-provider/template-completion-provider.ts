import { extname, join, sep } from 'path';
import {
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';

const { preprocess } = require('@glimmer/syntax');
const _ = require('lodash');
const memoize = require('memoizee');
import {
  emberBlockItems,
  emberMustacheItems,
  emberSubExpressionItems
} from './ember-helpers';
import { templateContextLookup } from './template-context-provider';
import { getExtension } from '../utils/file-extension';
import { readFileSync, existsSync, createWriteStream } from 'fs';

const debug = false;
const util = require('util');
const log_file = createWriteStream(__dirname + '/debug.log', { flags: 'w' });

console.log = debug
  ? function(...args: any[]) {
      const output = args
        .map((a: any) => {
          return JSON.stringify(a);
        })
        .join(' ');
      log_file.write('----------------------------------------' + '\r\n');
      log_file.write(util.format(output) + '\r\n');
      log_file.write('----------------------------------------' + '\r\n');
    }
  : function() {};

const walkSync = require('walk-sync');

const mTemplateContextLookup = memoize(templateContextLookup, {
  length: 3,
  maxAge: 60000
}); // 1 second
const mListComponents = memoize(listComponents, { length: 1, maxAge: 60000 }); // 1 second
const mListHelpers = memoize(listHelpers, { length: 1, maxAge: 60000 }); // 1 second
const mGetProjectAddonsInfo = memoize(getProjectAddonsInfo, {
  length: 1,
  maxAge: 600000
}); // 1 second
const mListRoutes = memoize(listRoutes, { length: 1, maxAge: 60000 });

export default class TemplateCompletionProvider {
  constructor(private server: Server) {}

  provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    console.log('provideCompletions');
    const uri = params.textDocument.uri;

    if (getExtension(params.textDocument) !== '.hbs') {
      return [];
    }
    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return [];
    }
    let document = this.server.documents.get(uri);
    let offset = document.offsetAt(params.position);
    // console.log('offset', offset);
    let originalText = document.getText();
    // console.log('originalText', originalText);
    let text =
      originalText.slice(0, offset) +
      'ELSCompletionDummy' +
      originalText.slice(offset);
    let ast: any = {};
    // console.log('originalText', originalText);
    const helpers = _.uniqBy(
      mListComponents(project.root)
        .filter((item: any) => {
          return !item.label.includes('/');
        })
        .map((item: any) => {
          item.label = item.label
            .split('-')
            .reduce((result: string, name: string) => {
              return result + name.charAt(0).toUpperCase() + name.substr(1);
            }, '');
          return item;
        }),
      'label'
    );

    // looks like this is an angle-bracked component
    if (
      text.indexOf('<') !== -1 &&
      text.lastIndexOf('>') < text.lastIndexOf('<')
    ) {
      let tmp: any = text
        .replace('ELSCompletionDummy', '')
        .split('<')
        .pop();
      return filter(helpers, tmp, {
        key: 'label',
        maxResults: 40
      });
    }

    try {
    //   console.log('textFor AST', text);
      ast = preprocess(text);
    } catch (e) {
    //   console.log('unable to get ast', text);
      return helpers;
    }
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
    if (!focusPath) {
      // console.log(ast, params.position);
    //   console.log('focusPath - exit');
      return [];
    }
    // console.log('go', focusPath);
    const { root } = project;
    let completions: CompletionItem[] = [];
    // console.log('focusPath', focusPath);
    try {
      if (isMustachePath(focusPath)) {
        // console.log('isMustachePath');
        let candidates: any = [
          ...mTemplateContextLookup(root, uri, originalText),
          ...mListComponents(root),
          ...mListHelpers(root),
          ...mGetProjectAddonsInfo(root)
        ];
        completions.push(..._.uniqBy(candidates, 'label'));
        completions.push(...emberMustacheItems);
      } else if (isBlockPath(focusPath)) {
        // console.log('isBlockPath');
        let candidates = [
          ...mTemplateContextLookup(root, uri, originalText),
          ...mListComponents(root),
          ...mGetProjectAddonsInfo(root)
        ];
        completions.push(..._.uniqBy(candidates, 'label'));
        completions.push(...emberBlockItems);
      } else if (isSubExpressionPath(focusPath)) {
        // console.log('isSubExpressionPath');
        let candidates = [
          ...mTemplateContextLookup(root, uri, originalText),
          ...mListHelpers(root),
          ...mGetProjectAddonsInfo(root)
        ];
        completions.push(..._.uniqBy(candidates, 'label'));
        completions.push(...emberSubExpressionItems);
      } else if (isLinkToTarget(focusPath)) {
        // console.log('isLinkToTarget');
        completions.push(...mListRoutes(root));
      }
    } catch (e) {
      // console.log('e', e);
    }

    // const normalizedResults = _.uniqueBy(completions, 'label');
    // console.log('normalizedResults', completions);
    // console.log('getTextPrefix(focusPath)', getTextPrefix(focusPath));
    return filter(completions, getTextPrefix(focusPath), {
      key: 'label',
      maxResults: 40
    });
  }
}

function resolvePackageRoot(root: string, addonName: string) {
  const roots = root.split(sep);
  while (roots.length) {
    const maybePath = join(roots.join(sep), 'node_modules', addonName);
    const linkedPath = join(roots.join(sep), addonName);
    if (existsSync(join(maybePath, 'package.json'))) {
      return maybePath;
    } else if (existsSync(join(linkedPath, 'package.json'))) {
      return linkedPath;
    }
    roots.pop();
  }
  return false;
}

function getPackageJSON(file: string) {
  try {
    const result = JSON.parse(readFileSync(join(file, 'package.json'), 'utf8'));
    return result;
  } catch (e) {
    return {};
  }
}

function isEmeberAddon(info: any) {
  return info.keywords && info.keywords.includes('ember-addon');
}

function getProjectAddonsInfo(root: string) {
  // console.log('getProjectAddonsInfo', root);
  const pack = getPackageJSON(root);
  // console.log('getPackageJSON', pack);
  const items = [
    ...Object.keys(pack.dependencies || {}),
    ...Object.keys(pack.devDependencies || {})
  ];
  // console.log('items', items);

  const roots = items
    .map((item: string) => {
      return resolvePackageRoot(root, item);
    })
    .filter((p: string | boolean) => {
      return p !== false;
    });
  // console.log('roots', roots);
  const meta: any = [];
  roots.forEach((packagePath: string) => {
    const info = getPackageJSON(packagePath);
    // console.log('info', info);
    if (isEmeberAddon(info)) {
      // console.log('isEmberAddon', packagePath);
      const extractedData = [
        ...listComponents(packagePath),
        ...listRoutes(packagePath),
        ...listHelpers(packagePath)
      ];
      // console.log('extractedData', extractedData);
      if (extractedData.length) {
        meta.push(extractedData);
      }
    }
  });
  // console.log('meta', meta);
  const normalizedResult: any[] = meta.reduce((arrs: any[], item: any[]) => {
    if (!item.length) {
      return arrs;
    }
    return arrs.concat(item);
  }, []);

  return normalizedResult;
}

function safeWalkSync(filePath: string, opts: any) {
  if (!existsSync(filePath)) {
    return [];
  }
  return walkSync(filePath, opts);
}

function listComponents(root: string): CompletionItem[] {
  // console.log('listComponents');
  const jsPaths = safeWalkSync(join(root, 'app', 'components'), {
    directories: false,
    globs: ['**/*.{js,ts,hbs}']
  }).map((name: string) => {
    if (name.endsWith('/template.hbs')) {
      return name.replace('/template', '');
    } else if (name.includes('/component.')) {
      return name.replace('/component', '');
    } else {
      return name;
    }
  });

  const hbsPaths = safeWalkSync(join(root, 'app', 'templates', 'components'), {
    directories: false,
    globs: ['**/*.hbs']
  });

  const paths = [...jsPaths, ...hbsPaths];

  const items = paths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: filePath.replace(extname(filePath), ''),
      detail: 'component'
    };
  });

  return items;
}

function listHelpers(root: string): CompletionItem[] {
  // console.log('listHelpers');
  const paths = safeWalkSync(join(root, 'app', 'helpers'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const items = paths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Function,
      label: filePath.replace(extname(filePath), ''),
      detail: 'helper'
    };
  });

  return items;
}

function listRoutes(root: string): CompletionItem[] {
  // console.log('listRoutes');
  const paths = safeWalkSync(join(root, 'app', 'routes'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const items = paths.map((filePath: string) => {
    const label = filePath.replace(extname(filePath), '').replace(/\//g, '.');
    return {
      kind: CompletionItemKind.File,
      label,
      detail: 'route'
    };
  });

  return items;
}

function isMustachePath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') {
    return false;
  }
  return parent.path === node;
}

function isBlockPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') {
    return false;
  }
  return parent.path === node;
}

function isSubExpressionPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'SubExpression') {
    return false;
  }
  return parent.path === node;
}

function isLinkToTarget(path: ASTPath): boolean {
  return isInlineLinkToTarget(path) || isBlockLinkToTarget(path);
}

function isInlineLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') {
    return false;
  }
  return parent.params[1] === node && parent.path.original === 'link-to';
}

function isBlockLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') {
    return false;
  }
  return parent.params[0] === node && parent.path.original === 'link-to';
}

function getTextPrefix({ node: { original = '' } }: ASTPath): string {
  return original.replace('ELSCompletionDummy', '');
}
