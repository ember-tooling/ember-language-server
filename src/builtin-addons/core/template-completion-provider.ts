import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { CompletionFunctionParams } from './../../utils/addon-api';
import { uniqBy } from 'lodash';

import * as memoize from 'memoizee';
import * as fs from 'fs';
import { emberBlockItems, emberMustacheItems, emberSubExpressionItems, emberModifierItems } from './ember-helpers';
import { templateContextLookup } from './template-context-provider';
import { provideComponentTemplatePaths } from './template-definition-provider';

import { log, logInfo, logError } from '../../utils/logger';
import ASTPath, { getLocalScope } from '../../glimmer-utils';
import Server from '../../server';
import { Project } from '../../project-roots';
import {
  isLinkToTarget,
  isComponentArgumentName,
  isLocalPathExpression,
  isArgumentPathExpression,
  isScopedPathExpression,
  isLinkComponentRouteTarget,
  isMustachePath,
  isBlockPath,
  isPathExpression,
  isSubExpressionPath,
  isAngleComponentPath,
  isModifierPath,
  isNamedBlockName,
} from '../../utils/ast-helpers';
import {
  listComponents,
  listMUComponents,
  listPodsComponents,
  listHelpers,
  listRoutes,
  listModifiers,
  builtinModifiers,
  mGetProjectAddonsInfo,
  hasNamespaceSupport,
} from '../../utils/layout-helpers';

import { normalizeToAngleBracketComponent, normalizeToClassicComponent } from '../../utils/normalizers';
import { getTemplateBlocks } from '../../utils/template-tokens-collector';
import { ASTNode } from 'ast-types';
import { ASTv1 } from '@glimmer/syntax';

const mTemplateContextLookup = memoize(templateContextLookup, {
  length: 3,
  maxAge: 60000,
}); // 1 second
const mListModifiers = memoize(listModifiers, { length: 1, maxAge: 60000 }); // 1 second
const mListComponents = memoize(listComponents, { length: 1, maxAge: 60000 }); // 1 second
const mListMUComponents = memoize(listMUComponents, {
  length: 1,
  maxAge: 60000,
}); // 1 second
const mListPodsComponents = memoize(listPodsComponents, {
  length: 1,
  maxAge: 60000,
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

function isArgumentName(name: string) {
  return name.startsWith('@');
}

export default class TemplateCompletionProvider {
  project!: Project;
  server!: Server;
  hasNamespaceSupport = false;
  async initRegistry(_: Server, project: Project) {
    try {
      this.project = project;
      this.server = _;
      this.hasNamespaceSupport = hasNamespaceSupport(project.root);
      const initStartTime = Date.now();

      mListHelpers(project.root);
      mListModifiers(project.root);
      mListRoutes(project.root);
      mListComponents(project.root);
      mGetProjectAddonsInfo(project.root);
      logInfo(project.root + ': registry initialized in ' + (Date.now() - initStartTime) + 'ms');
    } catch (e) {
      logError(e);
    }
  }
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
            label: normalizeToAngleBracketComponent(item.label),
          });
        }),
      'label'
    );
  }
  getLocalPathExpressionCandidates(root: string, uri: string, originalText: string) {
    const candidates: CompletionItem[] = [...mTemplateContextLookup(root, uri, originalText)];

    return candidates;
  }
  getMustachePathCandidates(root: string) {
    const candidates: CompletionItem[] = [
      ...mListComponents(root),
      ...mListMUComponents(root),
      ...mListPodsComponents(root),
      ...mListHelpers(root),
      ...mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
        return detail === 'component' || detail === 'helper';
      }),
    ];

    return candidates;
  }
  getBlockPathCandidates(root: string) {
    const candidates: CompletionItem[] = [
      ...mListComponents(root),
      ...mListMUComponents(root),
      ...mListPodsComponents(root),
      ...mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
        return detail === 'component';
      }),
    ];

    return candidates;
  }
  getSubExpressionPathCandidates(root: string) {
    const candidates: CompletionItem[] = [
      ...mListHelpers(root),
      ...mGetProjectAddonsInfo(root).filter(({ detail }: { detail: string }) => {
        return detail === 'helper';
      }),
    ];

    return candidates;
  }
  getScopedValues(focusPath: ASTPath) {
    const scopedValues = getLocalScope(focusPath).map(({ name, node, path }) => {
      const blockSource =
        node.type === 'ElementNode'
          ? `<${(node as ASTv1.ElementNode).tag} as |...|>`
          : `{{#${path.parentPath && ((path.parentPath.node as ASTv1.BlockStatement).path as ASTv1.PathExpression).original} as |...|}}`;

      return {
        label: name,
        kind: CompletionItemKind.Variable,
        detail: `Param from ${blockSource}`,
      };
    });

    return scopedValues;
  }
  getParentComponentYields(root: string, focusPath: ASTNode & { tag: string }) {
    if (focusPath.type !== 'ElementNode') {
      return [];
    }

    const paths = provideComponentTemplatePaths(root, focusPath.tag).filter((p) => fs.existsSync(p));

    if (!paths.length) {
      return [];
    }

    const tpl = paths[0];

    const content = fs.readFileSync(tpl, 'utf8');

    return getTemplateBlocks(content).map((blockName: string) => {
      return {
        label: `:${blockName}`,
        kind: CompletionItemKind.Variable,
        detail: `Named block (Slot) for <${focusPath.tag}>`,
      };
    });
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
      if (isNamedBlockName(focusPath)) {
        log('isNamedBlockName');
        // <:main>
        const yields = this.getParentComponentYields(root, focusPath.parent);

        completions.push(...yields);
      } else if (isAngleComponentPath(focusPath) && !isNamedBlockName(focusPath)) {
        log('isAngleComponentPath');
        // <Foo>
        const candidates = this.getAllAngleBracketComponents(root, uri);
        const scopedValues = this.getScopedValues(focusPath);

        log(candidates, scopedValues);
        completions.push(...uniqBy([...candidates, ...scopedValues], 'label'));
      } else if (isComponentArgumentName(focusPath)) {
        // <Foo @name.. />

        const maybeComponentName = focusPath.parent.tag;
        const isValidComponent =
          !['Input', 'Textarea', 'LinkTo'].includes(maybeComponentName) &&
          !isArgumentName(maybeComponentName) &&
          !maybeComponentName.startsWith(':') &&
          !maybeComponentName.includes('.');

        if (isValidComponent) {
          const tpls: string[] = provideComponentTemplatePaths(root, maybeComponentName);
          const existingTpls = tpls.filter(fs.existsSync);

          if (existingTpls.length) {
            const existingAttributes = focusPath.parent.attributes.map((attr: any) => attr.name).filter((name: string) => isArgumentName(name));
            const content = fs.readFileSync(existingTpls[0], 'utf8');
            const candidates = this.getLocalPathExpressionCandidates(root, tpls[0], content);
            const preResults: CompletionItem[] = [];

            candidates.forEach((obj: CompletionItem) => {
              const name = obj.label.split('.')[0];

              if (isArgumentName(name) && !existingAttributes.includes(name)) {
                preResults.push({
                  label: name,
                  detail: obj.detail,
                  kind: obj.kind,
                });
              }
            });

            if (preResults.length) {
              completions.push(...uniqBy(preResults, 'label'));
            }
          }
        }
      } else if (isLocalPathExpression(focusPath)) {
        // {{foo-bar this.na?}}
        log('isLocalPathExpression');
        const candidates = this.getLocalPathExpressionCandidates(root, uri, originalText).filter((el) => {
          return el.label.startsWith('this.');
        });

        completions.push(...uniqBy(candidates, 'label'));
      } else if (isArgumentPathExpression(focusPath)) {
        // {{@ite..}}
        const candidates = this.getLocalPathExpressionCandidates(root, uri, originalText).filter((el) => {
          return isArgumentName(el.label);
        });

        completions.push(...uniqBy(candidates, 'label'));
      } else if (isMustachePath(focusPath)) {
        // {{foo-bar?}}
        log('isMustachePath');
        const candidates = this.getMustachePathCandidates(root);
        const localCandidates = this.getLocalPathExpressionCandidates(root, uri, originalText);

        if (isScopedPathExpression(focusPath)) {
          const scopedValues = this.getScopedValues(focusPath);

          completions.push(...uniqBy(scopedValues, 'label'));
        }

        completions.push(...uniqBy(localCandidates, 'label'));
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberMustacheItems);
      } else if (isBlockPath(focusPath)) {
        // {{#foo-bar?}} {{/foo-bar}}
        log('isBlockPath');
        const candidates = this.getBlockPathCandidates(root);

        if (isScopedPathExpression(focusPath)) {
          const scopedValues = this.getScopedValues(focusPath);

          completions.push(...uniqBy(scopedValues, 'label'));
        }

        completions.push(...emberBlockItems);
        completions.push(...uniqBy(candidates, 'label'));
      } else if (isSubExpressionPath(focusPath)) {
        // {{foo-bar name=(subexpr? )}}
        log('isSubExpressionPath');
        const candidates = this.getSubExpressionPathCandidates(root);

        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberSubExpressionItems);
      } else if (isPathExpression(focusPath)) {
        if (isScopedPathExpression(focusPath)) {
          const scopedValues = this.getScopedValues(focusPath);

          completions.push(...uniqBy(scopedValues, 'label'));
        }

        const candidates = this.getLocalPathExpressionCandidates(root, uri, originalText);

        completions.push(...uniqBy(candidates, 'label'));
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

    if (this.hasNamespaceSupport) {
      const registry = this.server.getRegistry(this.project.root);

      completions.forEach((item) => {
        if (item.detail === 'component') {
          const paths = registry.component[normalizeToClassicComponent(item.label)] || [];
          const roots = this.project.addonsMeta
            .filter(({ root }) => {
              return paths.find((p) => p.startsWith(root));
            })
            .sort((a, b) => {
              return b.root.length - a.root.length;
            });
          const closestRoot: null | string = roots.length ? roots[0].name : null;

          if (closestRoot !== null) {
            item.label = `${normalizeToAngleBracketComponent(closestRoot)}$${item.label}`;
          }
        }
      });
    }

    return completions;
  }
}
