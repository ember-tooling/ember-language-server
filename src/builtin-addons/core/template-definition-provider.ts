import * as path from 'path';
import * as fs from 'fs';

import { Definition, Location } from 'vscode-languageserver/node';
import { DefinitionFunctionParams } from './../../utils/addon-api';
import { isLinkToTarget, isLinkComponentRouteTarget, isOutlet } from './../../utils/ast-helpers';
import ASTPath from './../../glimmer-utils';
import { getGlobalRegistry, getRegistryForRoot } from './../../utils/registry-api';
import { normalizeToClassicComponent } from '../../utils/normalizers';
import { isTemplatePath, isTestFile, getComponentNameFromURI, isModuleUnificationApp, getPodModulePrefix } from './../../utils/layout-helpers';

import {
  getAbstractHelpersParts,
  getAddonPathsForComponentTemplates,
  getPathsForComponentTemplates,
  getPathsForComponentScripts,
  pathsToLocationsWithPosition,
  pathsToLocations,
} from './../../utils/definition-helpers';

import * as memoize from 'memoizee';
import { URI } from 'vscode-uri';
import { ASTv1 } from '@glimmer/syntax';
import { Project } from '../../project';
import Server from '../../server';

const mAddonPathsForComponentTemplates = memoize(getAddonPathsForComponentTemplates, { length: 2, maxAge: 600000 });

function getComponentAndAddonName(rawComponentName: string) {
  const componentParts = rawComponentName.split('$');
  const addonName = componentParts.length > 1 ? componentParts[0] : '';
  // If the component name doesnt have a batman syntax then just return the name of the component
  // Else returns the name of the component.
  const componentName = componentParts.pop() as string;

  return { addonName: normalizeToClassicComponent(addonName), componentName };
}

export function getPathsFromRegistry(type: 'helper' | 'modifier' | 'component', name: string, root: string): string[] {
  const absRoot = path.normalize(root);
  const registry = getGlobalRegistry();
  const bucket: Set<string> = registry[type].get(name) || new Set();

  return Array.from(bucket).filter((el: string) => path.normalize(el).includes(absRoot) && !isTestFile(path.normalize(el)) && fs.existsSync(el)) as string[];
}

export function provideComponentTemplatePaths(root: string, rawComponentName: string) {
  const maybeComponentName = normalizeToClassicComponent(rawComponentName);
  const items = getPathsFromRegistry('component', maybeComponentName, root);

  if (items.length) {
    const results = items.filter((el) => el.endsWith('.hbs'));

    if (results.length) {
      return results;
    }
  }

  let paths = [...getPathsForComponentTemplates(root, maybeComponentName)].filter(fs.existsSync);

  if (!paths.length) {
    paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
  }

  return paths;
}

export function provideRouteDefinition(root: string, routeName: string): Location[] {
  const routeParts = routeName.split('.');
  const lastRoutePart = routeParts.pop();
  const routePaths = isModuleUnificationApp(root)
    ? [
        [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'route.js'],
        [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'route.ts'],
        [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'controller.js'],
        [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'controller.ts'],
        [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'template.hbs'],
      ]
    : [
        [root, 'app', 'routes', ...routeParts, lastRoutePart + '.js'],
        [root, 'app', 'routes', ...routeParts, lastRoutePart + '.ts'],
        [root, 'app', 'controllers', ...routeParts, lastRoutePart + '.js'],
        [root, 'app', 'controllers', ...routeParts, lastRoutePart + '.ts'],
        [root, 'app', 'templates', ...routeParts, lastRoutePart + '.hbs'],
      ];
  const podPrefix = getPodModulePrefix(root);

  if (podPrefix) {
    routePaths.push([root, 'app', podPrefix, ...routeParts, lastRoutePart, 'route.js']);
    routePaths.push([root, 'app', podPrefix, ...routeParts, lastRoutePart, 'route.ts']);
    routePaths.push([root, 'app', podPrefix, ...routeParts, lastRoutePart, 'controller.js']);
    routePaths.push([root, 'app', podPrefix, ...routeParts, lastRoutePart, 'controller.ts']);
    routePaths.push([root, 'app', podPrefix, ...routeParts, lastRoutePart, 'template.hbs']);
  }

  const filteredPaths = routePaths.map((parts: string[]) => path.join.apply(null, parts)).filter(fs.existsSync);

  return pathsToLocations(...filteredPaths);
}

export default class TemplateDefinitionProvider {
  server!: Server;
  project!: Project;
  async onInit(server: Server, project: Project) {
    this.server = server;
    this.project = project;
  }
  async onDefinition(root: string, params: DefinitionFunctionParams): Promise<Definition | null> {
    const uri = params.textDocument.uri;

    const focusPath = params.focusPath;
    let definitions: Location[] = params.results;

    if (params.type !== 'template') {
      return params.results;
    }

    if (isOutlet(focusPath)) {
      definitions = this.provideChildRouteDefinitions(root, uri);
    } else if (this.maybeClassicComponentName(focusPath)) {
      const { addonName, componentName } = getComponentAndAddonName(this.extractValueForMaybeClassicComponentName(focusPath));

      // <FooBar @some-component-name="my-component" /> || {{some-component some-name="my-component/name"}}
      definitions = this.provideComponentDefinition(root, componentName, addonName);
    } else if (this.isAngleComponent(focusPath)) {
      // <FooBar />
      definitions = this.provideAngleBrackedComponentDefinition(focusPath);
      // {{#foo-bar}} {{/foo-bar}}
    } else if (this.isComponentWithBlock(focusPath)) {
      definitions = this.provideBlockComponentDefinition(root, focusPath);
      // {{action "fooBar"}}, (action "fooBar"), (action this.fooBar), this.someProperty
    } else if (this.isActionName(focusPath) || this.isLocalProperty(focusPath)) {
      definitions = this.providePropertyDefinition(root, focusPath, uri);
      // {{foo-bar}}
    } else if (this.isComponentOrHelperName(focusPath)) {
      definitions = this.provideMustacheDefinition(root, focusPath);
      // <FooBar @somePropertyToFindUsage="" />
    } else if (isLinkComponentRouteTarget(focusPath)) {
      // <LinkTo @route="name" />
      definitions = this.provideRouteDefinition(root, (focusPath.node as ASTv1.TextNode).chars);
    } else if (this.isAnglePropertyAttribute(focusPath)) {
      definitions = this.provideAngleBracketComponentAttributeUsage(root, focusPath);
      // {{hello propertyUsageToFind=someValue}}
    } else if (this.isHashPairKey(focusPath)) {
      definitions = this.provideHashPropertyUsage(root, focusPath);
    } else if (isLinkToTarget(focusPath)) {
      definitions = this.provideRouteDefinition(root, (focusPath.node as ASTv1.PathExpression).original);
    }

    return definitions;
  }
  looksLikeClassicComponentName(name: string) {
    return name.length && !name.includes('.') && !name.includes(' ') && name === name.toLowerCase();
  }
  extractValueForMaybeClassicComponentName(focusPath: ASTPath) {
    let value = '';
    const node = focusPath.node;
    const parent = focusPath.parent;

    if (!parent) {
      return value;
    }

    if (node.type === 'StringLiteral' && parent.type === 'HashPair') {
      value = (node as ASTv1.StringLiteral).original;
    } else if (node.type === 'TextNode' && parent.type === 'AttrNode') {
      value = (node as ASTv1.TextNode).chars;
    }

    return value;
  }
  maybeClassicComponentName(focusPath: ASTPath) {
    const value = this.extractValueForMaybeClassicComponentName(focusPath);

    if (this.looksLikeClassicComponentName(value)) {
      return true;
    } else {
      return false;
    }
  }
  provideRouteDefinition(root: string, routeName: string): Location[] {
    return provideRouteDefinition(root, routeName);
  }
  _provideLikelyRawComponentTemplatePaths(root: string, rawComponentName: string, addonName: string) {
    const maybeComponentName = normalizeToClassicComponent(rawComponentName);
    let paths = getPathsFromRegistry('component', maybeComponentName, root);

    if (!paths.length) {
      paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName)].filter(fs.existsSync);
    }

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    if (addonName) {
      const addonMeta = this.project.addonsMeta.find((el) => el.name === addonName);

      if (addonMeta) {
        paths = paths.filter((p) => {
          return p.startsWith(addonMeta.root);
        });
      }
    }

    return paths;
  }
  provideLikelyComponentTemplatePath(rawComponentName: string): Location[] {
    // Check for batman syntax <Foo$Bar>
    const { addonName, componentName } = getComponentAndAddonName(rawComponentName);

    const paths: string[] = [];

    this.project.roots.forEach((root) => {
      const localPaths = this._provideLikelyRawComponentTemplatePaths(root, componentName, addonName);

      localPaths.forEach((p) => {
        if (!paths.includes(p)) {
          paths.push(p);
        }
      });
    });

    return pathsToLocations(...(paths.length > 1 ? paths.filter((postfix: string) => isTemplatePath(postfix)) : paths));
  }
  provideAngleBrackedComponentDefinition(focusPath: ASTPath) {
    return this.provideLikelyComponentTemplatePath((focusPath.node as ASTv1.ElementNode).tag);
  }
  provideBlockComponentDefinition(root: string, focusPath: ASTPath): Location[] {
    const maybeComponentName = ((focusPath.node as ASTv1.BlockStatement).path as ASTv1.PathExpression).original;
    let paths: string[] = getPathsForComponentTemplates(root, maybeComponentName).filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName).filter((name: string) => {
        return isTemplatePath(name);
      });
    }

    // mAddonPathsForComponentTemplates
    return pathsToLocationsWithPosition(paths, '{{yield');
  }

  provideChildRouteDefinitions(root: string, uri: string): Location[] {
    const rawPath = URI.parse(uri).fsPath.toLowerCase();
    const absRoot = path.normalize(root);
    const registry = getRegistryForRoot(absRoot);
    const allPaths = registry.routePath;
    let pathName: string | null = null;
    const paths: string[] = [];

    Object.keys(allPaths).forEach((name) => {
      const files = allPaths[name].map((item) => item.toLowerCase());

      if (files.includes(rawPath)) {
        pathName = name;
      } else {
        paths.push(name);
      }
    });

    if (pathName === null || paths.length === 0) {
      return [];
    }

    const files: string[] = [];
    const distance = 2;

    const interestingPaths = paths
      .filter((p) => {
        if (pathName === 'application') {
          return p.split('.').length <= distance;
        }

        if (!p.startsWith(`${pathName as string}.`)) {
          return false;
        }

        return p.replace(pathName as string, '').split('.').length <= distance;
      })
      .sort();

    interestingPaths.forEach((p) => {
      const registryItem = registry.routePath[p] || [];
      const items = registryItem.filter((el: string) => {
        return path.normalize(el).includes(absRoot) && !isTestFile(path.normalize(el)) && isTemplatePath(el);
      });

      if (items.length) {
        files.push(items[0]);
      }
    });

    return pathsToLocations(...files);
  }

  providePropertyDefinition(root: string, focusPath: ASTPath, uri: string): Location[] {
    const maybeComponentName = getComponentNameFromURI(root, uri);

    if (!maybeComponentName) {
      return [];
    }

    let paths: string[] = getPathsForComponentScripts(root, maybeComponentName).filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName).filter((name: string) => {
        return !isTemplatePath(name);
      });
    }

    const text = (focusPath.node as ASTv1.PathExpression).original;

    return pathsToLocationsWithPosition(paths, text.replace('this.', '').split('.')[0]);
  }

  provideComponentDefinition(root: string, maybeComponentName: string, addonName: string): Location[] {
    const helpers = getAbstractHelpersParts(root, 'app', maybeComponentName).map((pathParts: string[]) => {
      return path.join(...pathParts.filter((part: string) => !!part));
    });

    let paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName), ...helpers].filter(
      fs.existsSync
    );

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    if (addonName) {
      const addonMeta = this.project.addonsMeta.find((el) => el.name === addonName);

      if (addonMeta) {
        paths = paths.filter((p) => {
          return p.startsWith(addonMeta.root);
        });
      }
    }

    return pathsToLocations(...(paths.length > 1 ? paths.filter(isTemplatePath) : paths));
  }
  provideMustacheDefinition(root: string, focusPath: ASTPath) {
    const maybeComponentName =
      focusPath.node.type === 'ElementNode'
        ? normalizeToClassicComponent((focusPath.node as ASTv1.ElementNode).tag)
        : (focusPath.node as ASTv1.PathExpression).original;

    const { addonName, componentName } = getComponentAndAddonName(maybeComponentName);

    return this.provideComponentDefinition(root, componentName, addonName);
  }
  provideHashPropertyUsage(root: string, focusPath: ASTPath): Location[] {
    const parentPath = focusPath.parentPath;

    if (parentPath && parentPath.parent && parentPath.parent.path) {
      const maybeComponentName = parentPath.parent.path.original;

      if (!maybeComponentName.includes('.') && maybeComponentName.includes('-')) {
        let paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName)].filter(
          fs.existsSync
        );

        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
        }

        const finalPaths = paths.length > 1 ? paths.filter((postfix: string) => isTemplatePath(postfix)) : paths;

        return pathsToLocationsWithPosition(finalPaths, '@' + (focusPath.node as ASTv1.HashPair).key);
      }
    }

    return [];
  }
  provideAngleBracketComponentAttributeUsage(root: string, focusPath: ASTPath): Location[] {
    const maybeComponentName = normalizeToClassicComponent(focusPath.parent.tag);

    let paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName)].filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    const finalPaths = paths.length > 1 ? paths.filter((postfix: string) => isTemplatePath(postfix)) : paths;

    return pathsToLocationsWithPosition(finalPaths, (focusPath.node as ASTv1.AttrNode).name);
  }

  isLocalProperty(path: ASTPath) {
    const node = path.node as ASTv1.PathExpression;

    if (node.type === 'PathExpression') {
      return node.head.type === 'ThisHead';
    }

    return false;
  }

  isHashPairKey(path: ASTPath) {
    const node = path.node;

    return node.type === 'HashPair';
  }

  isAnglePropertyAttribute(path: ASTPath) {
    const node = path.node as ASTv1.AttrNode;

    if (node.type === 'AttrNode') {
      if (node.name.charAt(0) === '@') {
        return true;
      }
    }
  }

  isActionName(path: ASTPath) {
    const node = path.node;

    if (!path.parent) {
      return false;
    }

    if (
      path.parent.type !== 'MustacheStatement' &&
      path.parent.type !== 'PathExpression' &&
      path.parent.type !== 'SubExpression' &&
      path.parent.type !== 'ElementModifierStatement'
    ) {
      return false;
    }

    // @ts-expect-error @todo - fix typings
    if (!path.parent || path.parent.path.original !== 'action' || !path.parent.params[0] === node) {
      return false;
    }

    if (node.type === 'StringLiteral') {
      return true;
    } else if (node.type === 'PathExpression' && (node as ASTv1.PathExpression).head.type === 'ThisHead') {
      return true;
    }

    return false;
  }

  isComponentWithBlock(path: ASTPath) {
    const node = path.node as ASTv1.BlockStatement;

    return (
      node.type === 'BlockStatement' &&
      node.path.type === 'PathExpression' &&
      node.path.head.type !== 'ThisHead' &&
      node.path.original.includes('-') &&
      node.path.original.charAt(0) !== '-' &&
      !node.path.original.includes('.')
    );
  }

  isAngleComponent(path: ASTPath) {
    const node = path.node as ASTv1.ElementNode;

    if (node.type === 'ElementNode') {
      if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
        return true;
      }
    }
  }

  isComponentOrHelperName(path: ASTPath) {
    const node = path.node;

    if (this.isAngleComponent(path)) {
      return true;
    }

    const parent = path.parent;

    if (node.type === 'StringLiteral') {
      if (parent && parent.path && parent.path.original === 'component' && parent.params[0] === node) {
        return true;
      }
    }

    if (node.type !== 'PathExpression') {
      return false;
    }

    if (!parent || parent.path !== node || (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement' && parent.type !== 'SubExpression')) {
      return false;
    }

    return true;
  }
}
