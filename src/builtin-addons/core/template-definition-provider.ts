import * as path from 'path';
import * as fs from 'fs';

import { Definition, Location } from 'vscode-languageserver';
import { DefinitionFunctionParams } from './../../utils/addon-api';
import { isLinkToTarget, isLinkComponentRouteTarget } from './../../utils/ast-helpers';
import ASTPath from './../../glimmer-utils';
import { getGlobalRegistry } from './../../utils/registry-api';
import { normalizeToClassicComponent } from '../../utils/normalizers';
import { isTemplatePath, getComponentNameFromURI, isModuleUnificationApp, getPodModulePrefix } from './../../utils/layout-helpers';

import {
  getAbstractHelpersParts,
  getAddonPathsForComponentTemplates,
  getPathsForComponentTemplates,
  getPathsForComponentScripts,
  pathsToLocationsWithPosition,
  pathsToLocations,
} from './../../utils/definition-helpers';

import * as memoize from 'memoizee';

const mAddonPathsForComponentTemplates = memoize(getAddonPathsForComponentTemplates, { length: 2, maxAge: 600000 });

export function getPathsFromRegistry(type: 'helper' | 'modifier' | 'component', name: string, root: string): string[] {
  const absRoot = path.normalize(root);
  const registry = getGlobalRegistry();
  const bucket: any = registry[type].get(name) || new Set();

  return Array.from(bucket).filter((el: string) => path.normalize(el).includes(absRoot) && fs.existsSync(el)) as string[];
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
  constructor() {}
  async onDefinition(root: string, params: DefinitionFunctionParams): Promise<Definition | null> {
    const uri = params.textDocument.uri;
    const focusPath = params.focusPath;
    let definitions: Location[] = params.results;
    if (params.type !== 'template') {
      return params.results;
    }

    // <FooBar @some-component-name="my-component" /> || {{some-component some-name="my-component/name"}}
    if (this.maybeClassicComponentName(focusPath)) {
      definitions = this.provideComponentDefinition(root, this.extractValueForMaybeClassicComponentName(focusPath));
    } else if (this.isAngleComponent(focusPath)) {
      // <FooBar />
      definitions = this.provideAngleBrackedComponentDefinition(root, focusPath);
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
      definitions = this.provideRouteDefinition(root, focusPath.node.chars);
    } else if (this.isAnglePropertyAttribute(focusPath)) {
      definitions = this.provideAngleBracketComponentAttributeUsage(root, focusPath);
      // {{hello propertyUsageToFind=someValue}}
    } else if (this.isHashPairKey(focusPath)) {
      definitions = this.provideHashPropertyUsage(root, focusPath);
    } else if (isLinkToTarget(focusPath)) {
      definitions = this.provideRouteDefinition(root, focusPath.node.original);
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
      value = node.original;
    } else if (node.type === 'TextNode' && parent.type === 'AttrNode') {
      value = node.chars;
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
  _provideComponentTemplatePaths(root: string, rawComponentName: string) {
    return provideComponentTemplatePaths(root, rawComponentName);
  }
  _provideLikelyRawComponentTemplatePaths(root: string, rawComponentName: string) {
    const maybeComponentName = normalizeToClassicComponent(rawComponentName);
    let paths = getPathsFromRegistry('component', maybeComponentName, root);
    if (!paths.length) {
      paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName)].filter(fs.existsSync);
    }
    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    return paths;
  }
  provideLikelyComponentTemplatePath(root: string, rawComponentName: string): Location[] {
    const paths = this._provideLikelyRawComponentTemplatePaths(root, rawComponentName);

    return pathsToLocations(...(paths.length > 1 ? paths.filter((postfix: string) => isTemplatePath(postfix)) : paths));
  }
  provideAngleBrackedComponentDefinition(root: string, focusPath: ASTPath) {
    return this.provideLikelyComponentTemplatePath(root, focusPath.node.tag);
  }
  provideBlockComponentDefinition(root: string, focusPath: ASTPath): Location[] {
    const maybeComponentName = focusPath.node.path.original;
    let paths: string[] = getPathsForComponentTemplates(root, maybeComponentName).filter(fs.existsSync);
    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName).filter((name: string) => {
        return isTemplatePath(name);
      });
    }

    // mAddonPathsForComponentTemplates
    return pathsToLocationsWithPosition(paths, '{{yield');
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
    const text = focusPath.node.original;

    return pathsToLocationsWithPosition(paths, text.replace('this.', '').split('.')[0]);
  }

  provideComponentDefinition(root: string, maybeComponentName: string): Location[] {
    const helpers = getAbstractHelpersParts(root, 'app', maybeComponentName).map((pathParts: any) => {
      return path.join(...pathParts.filter((part: any) => !!part));
    });

    let paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName), ...helpers].filter(
      fs.existsSync
    );

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    return pathsToLocations(...(paths.length > 1 ? paths.filter(isTemplatePath) : paths));
  }
  provideMustacheDefinition(root: string, focusPath: ASTPath) {
    const maybeComponentName = focusPath.node.type === 'ElementNode' ? normalizeToClassicComponent(focusPath.node.tag) : focusPath.node.original;

    return this.provideComponentDefinition(root, maybeComponentName);
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

        return pathsToLocationsWithPosition(finalPaths, '@' + focusPath.node.key);
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

    return pathsToLocationsWithPosition(finalPaths, focusPath.node.name);
  }

  isLocalProperty(path: ASTPath) {
    const node = path.node;
    if (node.type === 'PathExpression') {
      return node.this;
    }

    return false;
  }

  isHashPairKey(path: ASTPath) {
    const node = path.node;

    return node.type === 'HashPair';
  }

  isAnglePropertyAttribute(path: ASTPath) {
    const node = path.node;
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
    if (!path.parent || path.parent.path.original !== 'action' || !path.parent.params[0] === node) {
      return false;
    }
    if (node.type === 'StringLiteral') {
      return true;
    } else if (node.type === 'PathExpression' && node.this) {
      return true;
    }

    return false;
  }

  isComponentWithBlock(path: ASTPath) {
    const node = path.node;

    return (
      node.type === 'BlockStatement' &&
      node.path.type === 'PathExpression' &&
      node.path.this === false &&
      node.path.original.includes('-') &&
      node.path.original.charAt(0) !== '-' &&
      !node.path.original.includes('.')
    );
  }

  isAngleComponent(path: ASTPath) {
    const node = path.node;

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

    if (node.type === 'StringLiteral') {
      // if (node.original.includes('/')) {
      //   return true;
      // } else if (!node.original.includes('.') && node.original.includes('-')) {
      //   return true;
      // }
      if (path.parent && path.parent.path.original === 'component' && path.parent.params[0] === node) {
        return true;
      }
    }

    if (node.type !== 'PathExpression') {
      return false;
    }

    const parent = path.parent;
    if (!parent || parent.path !== node || (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement' && parent.type !== 'SubExpression')) {
      return false;
    }

    return true;
  }
}
