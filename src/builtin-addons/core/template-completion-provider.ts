import { CompletionItem } from 'vscode-languageserver';
import { CompletionFunctionParams } from './../../utils/addon-api';
import { uniqBy, startCase, camelCase } from 'lodash';

import * as memoize from 'memoizee';
import * as fs from 'fs';
import { emberBlockItems, emberMustacheItems, emberSubExpressionItems, emberModifierItems } from './ember-helpers';
import { templateContextLookup } from './template-context-provider';
import { provideComponentTemplatePaths } from './template-definition-provider';

import { log } from '../../utils/logger';
import {
  isLinkToTarget,
  isComponentArgumentName,
  isLocalPathExpression,
  isLinkComponentRouteTarget,
  isMustachePath,
  isBlockPath,
  isSubExpressionPath,
  isAngleComponentPath,
  isModifierPath
} from '../../utils/ast-helpers';
import {
  listComponents,
  listMUComponents,
  listPodsComponents,
  listHelpers,
  listRoutes,
  listModifiers,
  builtinModifiers,
  mGetProjectAddonsInfo
} from '../../utils/layout-helpers';

export function toAngleBrackedName(name: string) {
  return name
    .split('/')
    .map((part: string) => {
      return startCase(camelCase(part))
        .split(' ')
        .join('');
    })
    .join('::');
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

export default class TemplateCompletionProvider {
  constructor() {}
  getAllAngleBracketComponents(root: string, uri: string) {
    const items: CompletionItem[] = [];
    return uniqBy(
      items
        .concat(
          mListMUComponents(root),
          mListComponents(root),
          mListPodsComponents(root),
          mListMURouteLevelComponents(root, uri),
          mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
            return detail === 'component';
          })
        )
        .map((item: any) => {
          return Object.assign({}, item, {
            label: toAngleBrackedName(item.label)
          });
        }),
      'label'
    );
  }
  getPathExpressionCandidates(root: string, uri: string, originalText: string) {
    let candidates: CompletionItem[] = [...mTemplateContextLookup(root, uri, originalText)];
    return candidates;
  }
  getMustachePathCandidates(root: string, uri: string, originalText: string) {
    let candidates: CompletionItem[] = [
      ...mTemplateContextLookup(root, uri, originalText),
      ...mListComponents(root),
      ...mListMUComponents(root),
      ...mListPodsComponents(root),
      ...mListHelpers(root),
      ...mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
        return detail === 'component' || detail === 'helper';
      })
    ];
    return candidates;
  }
  getBlockPathCandidates(root: string, uri: string, originalText: string) {
    let candidates: CompletionItem[] = [
      ...mTemplateContextLookup(root, uri, originalText),
      ...mListComponents(root),
      ...mListMUComponents(root),
      ...mListPodsComponents(root),
      ...mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
        return detail === 'component';
      })
    ];
    return candidates;
  }
  getSubExpressionPathCandidates(root: string, uri: string, originalText: string) {
    let candidates: CompletionItem[] = [
      ...mTemplateContextLookup(root, uri, originalText),
      ...mListHelpers(root),
      ...mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
        return detail === 'helper';
      })
    ];
    return candidates;
  }
  getTextForGuessing(originalText: string, offset: number, PLACEHOLDER: string) {
    return originalText.slice(0, offset) + PLACEHOLDER + originalText.slice(offset);
  }
  async onComplete(root: string, params: CompletionFunctionParams): Promise<CompletionItem[]> {
    log('provideCompletions');

    if (params.type !== 'template') {
      return params.results;
    }
    const completions: CompletionItem[] = params.results;
    const focusPath = params.focusPath;
    const uri = params.textDocument.uri;
    const originalText = params.originalText || '';

    try {
      if (isAngleComponentPath(focusPath)) {
        log('isAngleComponentPath');
        // <Foo>
        const candidates = this.getAllAngleBracketComponents(root, uri);
        log(candidates);
        completions.push(...uniqBy(candidates, 'label'));
      } else if (isComponentArgumentName(focusPath)) {
        // <Foo @name.. />

        const maybeComponentName = focusPath.parent.tag;
        const isValidComponent =
          !['Input', 'Textarea', 'LinkTo'].includes(maybeComponentName) &&
          !maybeComponentName.startsWith('@') &&
          !maybeComponentName.startsWith(':') &&
          !maybeComponentName.includes('.');
        if (isValidComponent) {
          const tpls: any[] = provideComponentTemplatePaths(root, maybeComponentName);
          const existingTpls = tpls.filter(fs.existsSync);
          if (existingTpls.length) {
            const existingAttributes = focusPath.parent.attributes.map((attr: any) => attr.name).filter((name: string) => name.startsWith('@'));
            const content = fs.readFileSync(existingTpls[0], 'utf8');
            let candidates = this.getPathExpressionCandidates(root, tpls[0], content);
            let preResults: CompletionItem[] = [];
            candidates.forEach((obj: CompletionItem) => {
              const name = obj.label.split('.')[0];
              if (name.startsWith('@') && !existingAttributes.includes(name)) {
                preResults.push({
                  label: name,
                  detail: obj.detail,
                  kind: obj.kind
                });
              }
            });
            if (preResults.length) {
              completions.push(...uniqBy(preResults, 'label'));
            }
          }
        }
      } else if (isMustachePath(focusPath)) {
        // {{foo-bar?}}
        log('isMustachePath');
        const candidates = this.getMustachePathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberMustacheItems);
      } else if (isBlockPath(focusPath)) {
        // {{#foo-bar?}} {{/foo-bar}}
        log('isBlockPath');
        const candidates = this.getBlockPathCandidates(root, uri, originalText);
        completions.push(...emberBlockItems);
        completions.push(...uniqBy(candidates, 'label'));
      } else if (isSubExpressionPath(focusPath)) {
        // {{foo-bar name=(subexpr? )}}
        log('isSubExpressionPath');
        const candidates = this.getSubExpressionPathCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberSubExpressionItems);
      } else if (isLocalPathExpression(focusPath)) {
        // {{foo-bar this.na?}}
        log('isLocalPathExpression');
        const candidates = this.getPathExpressionCandidates(root, uri, originalText);
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberMustacheItems);
      } else if (isLinkToTarget(focusPath)) {
        // {{link-to "name" "target?"}}, {{#link-to "target?"}} {{/link-to}}
        log('isLinkToTarget');
        completions.push(...uniqBy(mListRoutes(root), 'label'));
      } else if (isLinkComponentRouteTarget(focusPath)) {
        // <LinkTo @route="foo.." />
        log('isLinkComponentRouteTarget');
        completions.push(...uniqBy(mListRoutes(root), 'label'));
      } else if (isModifierPath(focusPath)) {
        log('isModifierPath');
        const addonModifiers = mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
          return detail === 'modifier';
        });
        completions.push(...uniqBy([...emberModifierItems, ...mListModifiers(root), ...addonModifiers, ...builtinModifiers()], 'label'));
      }
    } catch (e) {
      log('error', e);
    }

    return completions;
  }
}
