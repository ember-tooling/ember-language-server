import {
  CompletionItem,
  TextDocumentPositionParams
} from 'vscode-languageserver';

import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';

const { preprocess } = require('@glimmer/syntax');
const { uniqBy, startCase, camelCase } = require('lodash');
const memoize = require('memoizee');
import {
  emberBlockItems,
  emberMustacheItems,
  emberSubExpressionItems
} from './ember-helpers';
import { templateContextLookup } from './template-context-provider';
import { getExtension } from '../utils/file-extension';
import { log } from '../utils/logger';
import {
  isLinkToTarget,
  isMustachePath,
  isBlockPath,
  isSubExpressionPath,
  isAngleComponentPath,
  isModifierPath
} from '../utils/ast-helpers';
import {
  listComponents,
  listMUComponents,
  listPodsComponents,
  listHelpers,
  listRoutes,
  listModifiers,
  builtinModifiers,
  mGetProjectAddonsInfo
} from '../utils/layout-helpers';
import { searchAndExtractHbs } from 'extract-tagged-template-literals';

function toAngleBrackedName(name: string) {
  return name.split('/').map((part: string) => {
    return startCase(camelCase(part)).split(' ').join('');
  }).join('::');
}

const mTemplateContextLookup = memoize(templateContextLookup, {
  length: 3,
  maxAge: 60000
}); // 1 second
const mListModifiers = memoize(listModifiers, { length: 1, maxAge: 60000 }); // 1 second
const mListComponents = memoize(listComponents, { length: 1, maxAge: 60000 }); // 1 second
const mListMUComponents = memoize(listMUComponents, {
  length: 1,
  maxAge: 60000
}); // 1 second
const mListPodsComponents = memoize(listPodsComponents, {
  length: 1,
  maxAge: 60000
}); // 1 second
const mListHelpers = memoize(listHelpers, { length: 1, maxAge: 60000 }); // 1 second

const mListRoutes = memoize(listRoutes, { length: 1, maxAge: 60000 });

function mListMURouteLevelComponents(projectRoot: string, fileURI: string) {
  // /**/routes/**/-components/**/*.{js,ts,hbs}
  // we need to get current nesting level and resolve related components
  // only if we have -components under current fileURI template path
  if (!projectRoot || !fileURI) {
    return [];
  }
  return [];
}

const extensionsToProvideTemplateCompletions = ['.hbs', '.js', '.ts'];

type ComponentLabels = Array<{ label: string }>;

const PLACEHOLDER = 'ELSCompletionDummy';
export default class TemplateCompletionProvider {
  constructor(private server: Server) {}
  getAllAngleBracketComponents(root: string, uri: string) {
  getAllAngleBracketComponents(root: string, uri: string): ComponentLabels {
    return uniqBy(
      ([] as CompletionItem[])
        .concat(
          mListMUComponents(root),
          mListComponents(root),
          mListPodsComponents(root),
          mListMURouteLevelComponents(root, uri),
          mGetProjectAddonsInfo(root).filter(({detail}: {detail: string}) => {
            return detail === 'component';
          })
        )
        .map((item) => {
          return Object.assign({}, item, {
            label: toAngleBrackedName(item.label)
          });
        }),
      'label'
    );
  }
  getMustachePathCandidates(root: string, uri: string, originalText: string) {
    let candidates: any = [
      ...mTemplateContextLookup(root, uri, originalText),
      ...mListComponents(root),
      ...mListMUComponents(root),
      ...mListPodsComponents(root),
      ...mListHelpers(root),
      ...mGetProjectAddonsInfo(root).filter(({detail}: {detail: string}) => {
        return detail === 'component' || detail === 'helper';
      })
    ];
    return candidates;
  }
  getBlockPathCandidates(root: string, uri: string, originalText: string) {
    let candidates = [
      ...mTemplateContextLookup(root, uri, originalText),
      ...mListComponents(root),
      ...mListMUComponents(root),
      ...mListPodsComponents(root),
      ...mGetProjectAddonsInfo(root).filter(({detail}: {detail: string}) => {
        return detail === 'component';
      })
    ];
    return candidates;
  }
  getSubExpressionPathCandidates(root: string, uri: string, originalText: string) {
    let candidates = [
      ...mTemplateContextLookup(root, uri, originalText),
      ...mListHelpers(root),
      ...mGetProjectAddonsInfo(root).filter(({detail}: {detail: string}) => {
        return detail === 'helper';
      })
    ];
    return candidates;
  }
  getTextForGuessing(originalText: string, offset: number, PLACEHOLDER: string) {
    return originalText.slice(0, offset) +
    PLACEHOLDER +
    originalText.slice(offset);
  }
  provideCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    log('provideCompletions');
    const ext = getExtension(params.textDocument);

    if (!extensionsToProvideTemplateCompletions.includes(ext)) {
      return [];
    }

    const uri = params.textDocument.uri;
    const project = this.server.projectRoots.projectForUri(uri);
    const document = this.server.documents.get(uri);
    if (!project || !document) {
      return [];
    }
    const { root } = project;
    const offset = document.offsetAt(params.position);
    const documentContent = document.getText();
    const originalText = (ext === '.hbs') ? documentContent : searchAndExtractHbs(documentContent);
    log('originalText', originalText);
    const completions: CompletionItem[] = [];
    let normalPlaceholder: any = PLACEHOLDER;
    let ast: any = {};

    const cases = [
      PLACEHOLDER + ' />',
      PLACEHOLDER,
      PLACEHOLDER + '"',
      PLACEHOLDER + '}}',
      PLACEHOLDER + '\''
    ];

    while (cases.length) {
      normalPlaceholder = cases.shift();
      try {
        let validText = this.getTextForGuessing(originalText, offset, normalPlaceholder);
        ast = preprocess(validText);
        log('validText', validText);
        break;
      } catch (e) {
        log('parsing-error', this.getTextForGuessing(originalText, offset, normalPlaceholder));
        ast = null;
      }
    }
    log('ast must exists');
    if (ast === null) {
      return [];
    }

    const focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath) {
      log('focus path does not exists');
      return [];
    }
    log(focusPath.node);
    try {
      if (isAngleComponentPath(focusPath)) {
        log('isAngleComponentPath');
        // <Foo>
        const candidates = this.getAllAngleBracketComponents(root, uri);
        log(candidates);
        completions.push(...uniqBy(candidates, 'label'));
      } else if (isMustachePath(focusPath)) {
        // {{foo-bar?}}
        const candidates = this.getMustachePathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberMustacheItems);
      } else if (isBlockPath(focusPath)) {
        // {{#foo-bar?}} {{/foo-bar}}
        const candidates = this.getBlockPathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberBlockItems);
      } else if (isSubExpressionPath(focusPath)) {
        // {{foo-bar name=(subexpr? )}}
        const candidates = this.getSubExpressionPathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberSubExpressionItems);
      } else if (isLinkToTarget(focusPath)) {
        // {{link-to "name" "target?"}}, {{#link-to "target?"}} {{/link-to}}
        completions.push(...uniqBy(mListRoutes(root), 'label'));
      } else if (isModifierPath(focusPath)) {
        const addonModifiers = mGetProjectAddonsInfo(root).filter(({detail}: {detail: string}) => {
          return detail === 'modifier';
        });
        completions.push(...uniqBy([...mListModifiers(root), ...addonModifiers, ...builtinModifiers()], 'label'));
      }
    } catch (e) {
      log('error', e);
    }

    log('prefix', getTextPrefix(focusPath, normalPlaceholder));
    return filter(completions, getTextPrefix(focusPath, normalPlaceholder), {
      key: 'label',
      maxResults: 40
    });
  }
}

function getTextPrefix({ node }: ASTPath, normalPlaceholder: string): string {
  let target = node.original || node.tag || '';
  return target.replace(normalPlaceholder, '').replace(PLACEHOLDER, '');
}
