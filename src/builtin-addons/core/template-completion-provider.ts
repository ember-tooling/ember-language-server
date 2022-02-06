import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { AddonMeta, CompletionFunctionParams } from './../../utils/addon-api';
// @ts-expect-error esmodule
import * as uniqBy from 'lodash/uniqBy';

import * as memoize from 'memoizee';
import { emberBlockItems, emberMustacheItems, emberSubExpressionItems, emberModifierItems } from './ember-helpers';
import { getPathsFromRegistry, provideComponentTemplatePaths } from './template-definition-provider';

import { logInfo, logDebugInfo, logError } from '../../utils/logger';
import ASTPath, { getLocalScope } from '../../glimmer-utils';
import Server from '../../server';
import { Project } from '../../project';
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
  listPodsComponents,
  listHelpers,
  listRoutes,
  listModifiers,
  builtinModifiers,
  mGetProjectAddonsInfo,
  hasNamespaceSupport,
  isRootStartingWithFilePath,
  isScriptPath,
  isTestFile,
  asyncFilter,
} from '../../utils/layout-helpers';

import { normalizeToAngleBracketComponent } from '../../utils/normalizers';
import { getTemplateBlocks } from '../../utils/template-tokens-collector';
import { ASTv1 } from '@glimmer/syntax';
import { URI } from 'vscode-uri';
import { componentsContextData } from './template-context-provider';
import { IRegistry } from '../../utils/registry-api';

const mListModifiers = memoize(listModifiers, { length: 1, maxAge: 60000 }); // 1 second
const mListComponents = memoize(listComponents, { length: 1, maxAge: 60000 }); // 1 second
const mListPodsComponents = memoize(listPodsComponents, {
  length: 1,
  maxAge: 60000,
}); // 1 second
const mListHelpers = memoize(listHelpers, { length: 1, maxAge: 60000 }); // 1 second

const mListRoutes = memoize(listRoutes, { length: 1, maxAge: 60000 });

/**
 * Generates a map of completion label (file name) to array of potential namespaced
 * paths.
 * @param addonsMeta addons meta array
 * @param server Server
 * @param focusPath currentfocus path
 * @returns { [key: string]: string[] }
 */
export function generateNamespacedComponentsHashMap(addonsMeta: Array<AddonMeta>, server: Server, isAngleComponent: boolean) {
  const resultMap: { [key: string]: string[] } = {};

  // Iterate over the addons meta
  addonsMeta.forEach((addonData: AddonMeta) => {
    if (addonData.version !== 1) {
      return;
    }

    // Get the component registry based on the addon root.
    // The component registry is a map where the file name is the key and the value are
    // potential file paths.
    // Eg: { foo: ['bar/bang/biz/foo.js'] }
    const addonRegistry = server.getRegistry(addonData.root).component;

    // For each addon meta, generate the namespaced label.
    Object.keys(addonRegistry).forEach((addonItem) => {
      const addonFilePaths = addonRegistry[addonItem];
      const itemLabel = isAngleComponent ? normalizeToAngleBracketComponent(addonItem) : addonItem;

      if (!resultMap[itemLabel]) {
        resultMap[itemLabel] = [];
      }

      // If file paths are present, then iterate over the filepath and generate the
      // namespaced label
      if (addonFilePaths.length) {
        addonFilePaths.forEach((filePath: string) => {
          // Check if filepath starts with addon's root
          if (isRootStartingWithFilePath(addonData.root, filePath)) {
            const rootNameParts = addonData.name.split('/');
            const addonName = rootNameParts.pop() || '';

            const label = isAngleComponent
              ? `${normalizeToAngleBracketComponent(addonName)}$${normalizeToAngleBracketComponent(addonItem)}`
              : `${addonName}$${addonItem}`;

            if (!resultMap[itemLabel].includes(label)) {
              resultMap[itemLabel].push(label);
            }
          }
        });
      }
    });
  });

  return resultMap;
}

function isArgumentName(name: string) {
  return name.startsWith('@');
}

export default class TemplateCompletionProvider {
  get registry(): IRegistry {
    return this.project.registry;
  }
  project!: Project;
  server!: Server;
  hasNamespaceSupport = false;
  meta = {
    projectAddonsInfoInitialized: false,
    helpersRegistryInitialized: false,
    modifiersRegistryInitialized: false,
    componentsRegistryInitialized: false,
    podComponentsRegistryInitialized: false,
    routesRegistryInitialized: false,
  };
  enableRegistryCache(value: keyof typeof TemplateCompletionProvider.prototype['meta']) {
    if (this.server.flags.hasExternalFileWatcher) {
      this.meta[value] = true;
    } else {
      this.server.connection.console.warn(
        'Unable to user global registry state, falling back to cache api, to fix this message install [els-addon-file-watcher]'
      );
    }
  }
  async initRegistry(_: Server, project: Project) {
    this.project = project;
    this.server = _;
    this.hasNamespaceSupport = await hasNamespaceSupport(project.root);

    if (project.flags.enableEagerRegistryInitialization) {
      try {
        const initStartTime = Date.now();

        await mListHelpers(project);
        this.enableRegistryCache('helpersRegistryInitialized');

        await mListModifiers(project);
        this.enableRegistryCache('modifiersRegistryInitialized');

        await mListRoutes(project);
        this.enableRegistryCache('routesRegistryInitialized');

        await mListComponents(project);
        this.enableRegistryCache('componentsRegistryInitialized');

        await mGetProjectAddonsInfo(project.root);
        this.enableRegistryCache('projectAddonsInfoInitialized');

        this.project.invalidateRegistry();

        logInfo(project.root + ': registry initialized in ' + (Date.now() - initStartTime) + 'ms');
      } catch (e) {
        logError(e);
      }
    } else {
      logInfo('EagerRegistryInitialization is disabled for "' + project.name + '" (template-completion-provider)');
    }
  }
  async getAllAngleBracketComponents(root: string) {
    const items: CompletionItem[] = [];

    if (!this.meta.projectAddonsInfoInitialized) {
      await mGetProjectAddonsInfo(root);
      this.enableRegistryCache('projectAddonsInfoInitialized');
      this.project.invalidateRegistry();
    }

    if (!this.meta.componentsRegistryInitialized) {
      await mListComponents(this.project);
      this.enableRegistryCache('componentsRegistryInitialized');
    }

    if (!this.meta.podComponentsRegistryInitialized) {
      await mListPodsComponents(this.project);
      this.enableRegistryCache('podComponentsRegistryInitialized');
    }

    const registry = this.project.registry;

    return uniqBy(
      items
        .concat(
          Object.keys(registry.component).map((rawName) => {
            return {
              label: rawName,
              data: {
                files: registry.component[rawName],
              },
              kind: CompletionItemKind.Class,
              detail: 'component',
            };
          })
        )
        .map((item: CompletionItem) => {
          return Object.assign({}, item, {
            label: normalizeToAngleBracketComponent(item.label),
          });
        }),
      'label'
    );
  }
  async templateContextLookup(rawCurrentFilePath: string, templateContent: string): Promise<CompletionItem[]> {
    const fsPath = URI.parse(rawCurrentFilePath).fsPath;
    const componentName = this.project.matchPathToType(fsPath)?.name;

    // todo - add branching for route templates support
    if (!componentName) {
      return [];
    }

    const maybeScripts = getPathsFromRegistry('component', componentName, this.registry).filter((el) => !isTestFile(el) && isScriptPath(el));

    const items: CompletionItem[] = await componentsContextData(this.server.fs, maybeScripts, templateContent);

    return items;
  }
  async getLocalPathExpressionCandidates(uri: string, originalText: string) {
    const candidates: CompletionItem[] = await this.templateContextLookup(uri, originalText);

    return candidates;
  }
  async getMustachePathCandidates(root: string) {
    if (!this.meta.projectAddonsInfoInitialized) {
      await mGetProjectAddonsInfo(root);
      this.enableRegistryCache('projectAddonsInfoInitialized');
      this.project.invalidateRegistry();
    }

    if (!this.meta.componentsRegistryInitialized) {
      await mListComponents(this.project);
      this.enableRegistryCache('componentsRegistryInitialized');
    }

    if (!this.meta.podComponentsRegistryInitialized) {
      await mListPodsComponents(this.project);
      this.enableRegistryCache('podComponentsRegistryInitialized');
    }

    if (!this.meta.helpersRegistryInitialized) {
      await mListHelpers(this.project);
      this.enableRegistryCache('helpersRegistryInitialized');
    }

    const registry = this.project.registry;

    const candidates: CompletionItem[] = [
      ...Object.keys(registry.component).map((rawName) => {
        return {
          label: rawName,
          data: {
            files: registry.component[rawName],
          },
          kind: CompletionItemKind.Class,
          detail: 'component',
        };
      }),
      ...Object.keys(registry.helper).map((rawName) => {
        return {
          label: rawName,
          kind: CompletionItemKind.Function,
          data: {
            files: registry.helper[rawName],
          },
          detail: 'helper',
        };
      }),
    ];

    return candidates;
  }
  async getBlockPathCandidates(root: string): Promise<CompletionItem[]> {
    if (!this.meta.projectAddonsInfoInitialized) {
      await mGetProjectAddonsInfo(root);
      this.enableRegistryCache('projectAddonsInfoInitialized');
      this.project.invalidateRegistry();
    }

    if (!this.meta.componentsRegistryInitialized) {
      await mListComponents(this.project);
      this.enableRegistryCache('componentsRegistryInitialized');
    }

    if (!this.meta.podComponentsRegistryInitialized) {
      await mListPodsComponents(this.project);
      this.enableRegistryCache('podComponentsRegistryInitialized');
    }

    const registry = this.project.registry;

    return Object.keys(registry.component).map((rawName) => {
      return {
        label: rawName,
        data: {
          files: registry.component[rawName],
        },
        kind: CompletionItemKind.Class,
        detail: 'component',
      };
    });
  }
  async getSubExpressionPathCandidates() {
    if (!this.meta.helpersRegistryInitialized) {
      await mListHelpers(this.project);
      this.enableRegistryCache('helpersRegistryInitialized');
    }

    if (!this.meta.projectAddonsInfoInitialized) {
      await mGetProjectAddonsInfo(this.project.root);
      this.enableRegistryCache('projectAddonsInfoInitialized');
      this.project.invalidateRegistry();
    }

    const registry = this.project.registry;

    return Object.keys(registry.helper).map((helperName) => {
      return {
        label: helperName,
        data: {
          files: registry.helper[helperName],
        },
        kind: CompletionItemKind.Function,
        detail: 'helper',
      };
    });
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
  async getParentComponentYields(focusPath: any) {
    if (focusPath.type !== 'ElementNode') {
      return [];
    }

    const paths: string[] = [];

    const rawScopedPaths = provideComponentTemplatePaths(this.registry, focusPath.tag);
    const scopedPaths = await asyncFilter(rawScopedPaths, this.server.fs.exists);

    scopedPaths.forEach((p) => {
      if (!paths.includes(p)) {
        paths.push(p);
      }
    });

    if (!paths.length) {
      return [];
    }

    const tpl = paths[0];

    const content = await this.server.fs.readFile(tpl);

    if (content === null) {
      return [];
    }

    try {
      return getTemplateBlocks(content).map((blockName: string) => {
        return {
          label: `:${blockName}`,
          kind: CompletionItemKind.Variable,
          detail: `Named block (Slot) for <${focusPath.tag}>`,
        };
      });
    } catch (e) {
      return [];
    }
  }
  async onComplete(root: string, params: CompletionFunctionParams): Promise<CompletionItem[]> {
    logDebugInfo('provideCompletions');

    if (params.type !== 'template') {
      return params.results;
    }

    const completions: CompletionItem[] = params.results;
    const focusPath = params.focusPath;
    const uri = params.textDocument.uri;
    const originalText = params.originalText || '';

    try {
      if (isNamedBlockName(focusPath)) {
        logDebugInfo('isNamedBlockName');
        // <:main>
        const yields = await this.getParentComponentYields(focusPath.parent);

        completions.push(...yields);
      } else if (isAngleComponentPath(focusPath) && !isNamedBlockName(focusPath)) {
        logDebugInfo('isAngleComponentPath');
        // <Foo>
        const candidates = await this.getAllAngleBracketComponents(root);
        const scopedValues = this.getScopedValues(focusPath);

        logDebugInfo(candidates, scopedValues);
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
          const tpls: string[] = [];

          const localtpls = provideComponentTemplatePaths(this.registry, maybeComponentName);

          localtpls.forEach((item) => {
            if (!tpls.includes(item)) {
              tpls.push(item);
            }
          });

          const existingTpls = await asyncFilter(tpls, this.server.fs.exists);

          if (existingTpls.length) {
            const existingAttributes = focusPath.parent.attributes.map((attr: ASTv1.AttrNode) => attr.name).filter((name: string) => isArgumentName(name));
            const content = await this.server.fs.readFile(existingTpls[0]);

            if (content !== null) {
              const candidates = await this.getLocalPathExpressionCandidates(tpls[0], content);
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
        }
      } else if (isLocalPathExpression(focusPath)) {
        // {{foo-bar this.na?}}
        logDebugInfo('isLocalPathExpression');
        const rawCandidates = await this.getLocalPathExpressionCandidates(uri, originalText);
        const candidates = rawCandidates.filter((el) => {
          return el.label.startsWith('this.');
        });

        completions.push(...uniqBy(candidates, 'label'));
      } else if (isArgumentPathExpression(focusPath)) {
        // {{@ite..}}
        const rawCandidates = await this.getLocalPathExpressionCandidates(uri, originalText);
        const candidates = rawCandidates.filter((el) => {
          return isArgumentName(el.label);
        });

        completions.push(...uniqBy(candidates, 'label'));
      } else if (isMustachePath(focusPath)) {
        // {{foo-bar?}}
        logDebugInfo('isMustachePath');
        const candidates = await this.getMustachePathCandidates(root);
        const localCandidates = await this.getLocalPathExpressionCandidates(uri, originalText);

        if (isScopedPathExpression(focusPath)) {
          const scopedValues = this.getScopedValues(focusPath);

          completions.push(...uniqBy(scopedValues, 'label'));
        }

        completions.push(...uniqBy(localCandidates, 'label'));
        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberMustacheItems);
      } else if (isBlockPath(focusPath)) {
        // {{#foo-bar?}} {{/foo-bar}}
        logDebugInfo('isBlockPath');
        const candidates = await this.getBlockPathCandidates(root);

        if (isScopedPathExpression(focusPath)) {
          const scopedValues = this.getScopedValues(focusPath);

          completions.push(...uniqBy(scopedValues, 'label'));
        }

        completions.push(...emberBlockItems);
        completions.push(...uniqBy(candidates, 'label'));
      } else if (isSubExpressionPath(focusPath)) {
        // {{foo-bar name=(subexpr? )}}
        logDebugInfo('isSubExpressionPath');
        const candidates = await this.getSubExpressionPathCandidates();

        completions.push(...uniqBy(candidates, 'label'));
        completions.push(...emberSubExpressionItems);
      } else if (isPathExpression(focusPath)) {
        if (isScopedPathExpression(focusPath)) {
          const scopedValues = this.getScopedValues(focusPath);

          completions.push(...uniqBy(scopedValues, 'label'));
        }

        const candidates = await this.getLocalPathExpressionCandidates(uri, originalText);

        completions.push(...uniqBy(candidates, 'label'));
      } else if (isLinkToTarget(focusPath)) {
        // {{link-to "name" "target?"}}, {{#link-to "target?"}} {{/link-to}}
        logDebugInfo('isLinkToTarget');

        if (!this.meta.routesRegistryInitialized) {
          await mListRoutes(this.project);
          this.enableRegistryCache('routesRegistryInitialized');
        }

        const registry = this.project.registry;

        const results = Object.keys(registry.routePath).map((name) => {
          return {
            label: name,
            kind: CompletionItemKind.File,
            detail: 'route',
          };
        });

        completions.push(...results);
      } else if (isLinkComponentRouteTarget(focusPath)) {
        // <LinkTo @route="foo.." />
        logDebugInfo('isLinkComponentRouteTarget');

        if (!this.meta.routesRegistryInitialized) {
          await mListRoutes(this.project);
          this.enableRegistryCache('routesRegistryInitialized');
        }

        const registry = this.project.registry;

        const results = Object.keys(registry.routePath).map((name) => {
          return {
            label: name,
            kind: CompletionItemKind.File,
            detail: 'route',
          };
        });

        completions.push(...results);
      } else if (isModifierPath(focusPath)) {
        logDebugInfo('isModifierPath');

        if (!this.meta.modifiersRegistryInitialized) {
          await mListModifiers(this.project);
          this.enableRegistryCache('modifiersRegistryInitialized');
        }

        if (!this.meta.projectAddonsInfoInitialized) {
          await mGetProjectAddonsInfo(root);
          this.enableRegistryCache('projectAddonsInfoInitialized');
          this.project.invalidateRegistry();
        }

        const registry = this.project.registry;

        const resolvedModifiers = Object.keys(registry.modifier).map((name) => {
          return {
            label: name,
            data: {
              files: registry.modifier[name],
            },
            kind: CompletionItemKind.Function,
            detail: 'modifier',
          };
        });

        completions.push(...uniqBy([...emberModifierItems, ...resolvedModifiers, ...builtinModifiers()], 'label'));
      }
    } catch (e) {
      logError(e);
    }

    if (this.hasNamespaceSupport) {
      const hasSomeComponents = completions.some((completion) => completion.detail === 'component');

      if (hasSomeComponents) {
        const resultsMap = generateNamespacedComponentsHashMap(this.project.addonsMeta, this.server, isAngleComponentPath(focusPath));
        const newCompletions: CompletionItem[] = [];

        // Iterate over the completions and add name spaced labels if applicable.
        completions.forEach((completionItem) => {
          const matchingLabels = resultsMap[completionItem.label];

          if (matchingLabels) {
            matchingLabels.forEach((labelItem: string) => {
              const completionObj = { ...completionItem };

              completionObj.label = labelItem;
              newCompletions.push(completionObj);
            });
          } else {
            newCompletions.push(completionItem);
          }
        });

        return newCompletions;
      }
    }

    return completions;
  }
}
