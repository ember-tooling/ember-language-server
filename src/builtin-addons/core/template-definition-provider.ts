import * as path from 'path';

import { Definition, Location } from 'vscode-languageserver/node';
import { DefinitionFunctionParams } from './../../utils/addon-api';
import { isLinkToTarget, isLinkComponentRouteTarget, isOutlet } from './../../utils/ast-helpers';
import ASTPath, { getLocalScope } from './../../glimmer-utils';
import { IRegistry } from './../../utils/registry-api';
import { normalizeToClassicComponent } from '../../utils/normalizers';
import { isTemplatePath, isTestFile, isScriptPath, asyncFilter } from './../../utils/layout-helpers';

import { pathsToLocationsWithPosition, pathsToLocations } from './../../utils/definition-helpers';

import { URI } from 'vscode-uri';
import { ASTv1 } from '@glimmer/syntax';
import { Project } from '../../project';
import Server from '../../server';
import { isStyleFile } from '../../utils/layout-helpers';
import FSProvider from '../../fs-provider';
import { getAllTemplateTokens } from '../../utils/usages-api';

function getComponentAndAddonName(rawComponentName: string) {
  const componentParts = rawComponentName.split('$');
  const addonName = componentParts.length > 1 ? componentParts[0] : '';
  // If the component name doesn't have a batman syntax then just return the name of the component
  // Else returns the name of the component.
  const componentName = componentParts.pop() as string;

  return { addonName: normalizeToClassicComponent(addonName), componentName };
}

export function getPathsFromRegistry(type: 'helper' | 'modifier' | 'component' | 'routePath', name: string, registry: IRegistry): string[] {
  const bucket: string[] = registry[type][name] || [];

  return bucket.filter((el: string) => !isStyleFile(path.normalize(el)) && !isTestFile(path.normalize(el))) as string[];
}

export function provideComponentTemplatePaths(registry: IRegistry, rawComponentName: string) {
  const maybeComponentName = normalizeToClassicComponent(rawComponentName);
  const items = getPathsFromRegistry('component', maybeComponentName, registry);

  if (items.length) {
    const results = items.filter((el) => isTemplatePath(el));

    if (results.length) {
      return results;
    } else {
      return [];
    }
  } else {
    return [];
  }
}

export async function provideRouteDefinition(registry: IRegistry, routeName: string, fs: FSProvider): Promise<Location[]> {
  const items = getPathsFromRegistry('routePath', routeName, registry).filter((el) => !isTestFile(el));
  const existingItems = await asyncFilter(items, fs.exists);

  return pathsToLocations(...existingItems);
}

export default class TemplateDefinitionProvider {
  get registry(): IRegistry {
    return this.project.registry;
  }
  server!: Server;
  project!: Project;
  async onInit(server: Server, project: Project) {
    this.server = server;
    this.project = project;
  }
  async onDefinition(_: string, params: DefinitionFunctionParams): Promise<Definition | null> {
    const uri = params.textDocument.uri;

    const focusPath = params.focusPath;
    let definitions: Location[] = params.results;

    if (params.type !== 'template') {
      return params.results;
    }

    if (isOutlet(focusPath)) {
      definitions = await this.provideChildRouteDefinitions(uri);
    } else if (this.maybeClassicComponentName(focusPath)) {
      const { addonName, componentName } = getComponentAndAddonName(this.extractValueForMaybeClassicComponentName(focusPath));

      // <FooBar @some-component-name="my-component" /> || {{some-component some-name="my-component/name"}}
      definitions = await this.provideComponentDefinition(componentName, addonName);
    } else if (this.isAngleComponent(focusPath)) {
      // <FooBar />
      definitions = await this.provideAngleBracketedComponentDefinition(focusPath);
      // {{#foo-bar}} {{/foo-bar}}
    } else if (this.isMayBeComponentFromPath(focusPath)) {
      const [key, ...tail] = (focusPath.node as ASTv1.ElementNode).tag.split('.');
      const scopes = getLocalScope(focusPath);
      const target = scopes.find((el) => el.name === key);

      if (target) {
        const keyPath = `${target.slotName}:${target.index}:${tail.join('.')}`;

        const allTokens = getAllTemplateTokens().component;
        const meta = allTokens[target.componentName];

        if (meta.yieldScopes && meta.yieldScopes[keyPath]) {
          const info = meta.yieldScopes[keyPath];

          if (info) {
            const [kind, name] = info;
            const names = Array.isArray(name) ? name : [name];
            const data = names.map((itemName) => getPathsFromRegistry(kind, itemName, this.registry));

            definitions = pathsToLocations(...data.reduce((acc, curr) => acc.concat(curr), []));
          }
        }
      }
    } else if (this.isComponentWithBlock(focusPath)) {
      definitions = await this.provideBlockComponentDefinition(focusPath);
      // {{action "fooBar"}}, (action "fooBar"), (action this.fooBar), this.someProperty
    } else if (this.isActionName(focusPath) || this.isLocalProperty(focusPath)) {
      definitions = await this.providePropertyDefinition(focusPath, uri);
      // {{foo-bar}}
    } else if (this.isComponentOrHelperName(focusPath)) {
      definitions = await this.provideMustacheDefinition(focusPath);
      // <FooBar @somePropertyToFindUsage="" />
    } else if (isLinkComponentRouteTarget(focusPath)) {
      // <LinkTo @route="name" />
      definitions = await this.provideRouteDefinition((focusPath.node as ASTv1.TextNode).chars);
    } else if (this.isAnglePropertyAttribute(focusPath)) {
      definitions = await this.provideAngleBracketComponentAttributeUsage(focusPath);
      // {{hello propertyUsageToFind=someValue}}
    } else if (this.isHashPairKey(focusPath)) {
      definitions = await this.provideHashPropertyUsage(focusPath);
    } else if (isLinkToTarget(focusPath)) {
      definitions = await this.provideRouteDefinition((focusPath.node as ASTv1.PathExpression).original);
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
  async provideRouteDefinition(routeName: string): Promise<Location[]> {
    return await provideRouteDefinition(this.registry, routeName, this.server.fs);
  }
  _provideLikelyRawComponentTemplatePaths(rawComponentName: string, addonName: string) {
    const maybeComponentName = normalizeToClassicComponent(rawComponentName);
    let paths = getPathsFromRegistry('component', maybeComponentName, this.registry);

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
  async provideLikelyComponentTemplatePath(rawComponentName: string): Promise<Location[]> {
    // Check for batman syntax <Foo$Bar>
    const { addonName, componentName } = getComponentAndAddonName(rawComponentName);

    const paths: Set<string> = new Set();

    const localPaths = this._provideLikelyRawComponentTemplatePaths(componentName, addonName);

    localPaths.forEach((p) => {
      paths.add(p);
    });

    const selectedPaths = paths.size > 1 ? Array.from(paths).filter((postfix: string) => isTemplatePath(postfix)) : Array.from(paths);

    const existingPaths = await asyncFilter(selectedPaths, this.server.fs.exists);

    return pathsToLocations(...existingPaths);
  }
  provideAngleBracketedComponentDefinition(focusPath: ASTPath) {
    return this.provideLikelyComponentTemplatePath((focusPath.node as ASTv1.ElementNode).tag);
  }
  async provideBlockComponentDefinition(focusPath: ASTPath): Promise<Location[]> {
    const maybeComponentName = normalizeToClassicComponent(((focusPath.node as ASTv1.BlockStatement).path as ASTv1.PathExpression).original);

    const paths = getPathsFromRegistry('component', maybeComponentName, this.registry).filter((el) => isTemplatePath(el));

    const existingPaths = await asyncFilter(paths, this.server.fs.exists);

    // mAddonPathsForComponentTemplates
    return pathsToLocationsWithPosition(existingPaths, '{{yield');
  }

  async provideChildRouteDefinitions(uri: string): Promise<Location[]> {
    const rawPath = URI.parse(uri).fsPath.toLowerCase();
    const registry = this.registry;
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
        return !isTestFile(path.normalize(el)) && isTemplatePath(el);
      });

      if (items.length) {
        files.push(items[0]);
      }
    });

    const existingFiles = await asyncFilter(files, this.server.fs.exists);

    return pathsToLocations(...existingFiles);
  }

  async providePropertyDefinition(focusPath: ASTPath, uri: string): Promise<Location[]> {
    const rawPath = URI.parse(uri).fsPath;

    if (!rawPath) {
      return Promise.resolve([]);
    }

    const filePath = path.resolve(rawPath);

    const data = this.project.matchPathToType(filePath);

    if (data === null || data.type !== 'component') {
      return Promise.resolve([]);
    }

    const maybeComponentName = normalizeToClassicComponent(data.name);
    const paths = getPathsFromRegistry('component', maybeComponentName, this.registry).filter((el) => isScriptPath(el));

    const existingPaths = await asyncFilter(paths, this.server.fs.exists);
    const text = (focusPath.node as ASTv1.PathExpression).original;

    return pathsToLocationsWithPosition(existingPaths, text.replace('this.', '').split('.')[0]);
  }

  async provideComponentDefinition(rawComponentName: string, addonName: string): Promise<Location[]> {
    const maybeComponentName = normalizeToClassicComponent(rawComponentName);

    let paths = [...getPathsFromRegistry('component', maybeComponentName, this.registry), ...getPathsFromRegistry('helper', maybeComponentName, this.registry)];

    if (addonName) {
      const addonMeta = this.project.addonsMeta.find((el) => el.name === addonName);

      if (addonMeta) {
        paths = paths.filter((p) => {
          return p.startsWith(addonMeta.root);
        });
      }
    }

    const selectedPaths = paths.length > 1 ? paths.filter(isTemplatePath) : paths;

    const existingPaths = await asyncFilter(selectedPaths, this.server.fs.exists);

    return pathsToLocations(...existingPaths);
  }
  provideMustacheDefinition(focusPath: ASTPath) {
    const maybeComponentName =
      focusPath.node.type === 'ElementNode'
        ? normalizeToClassicComponent((focusPath.node as ASTv1.ElementNode).tag)
        : (focusPath.node as ASTv1.PathExpression).original;

    const { addonName, componentName } = getComponentAndAddonName(maybeComponentName);

    return this.provideComponentDefinition(componentName, addonName);
  }
  async provideHashPropertyUsage(focusPath: ASTPath): Promise<Location[]> {
    const parentPath = focusPath.parentPath;

    if (parentPath && parentPath.parent && parentPath.parent.path) {
      const maybeComponentName = parentPath.parent.path.original;

      if (!maybeComponentName.includes('.') && maybeComponentName.includes('-')) {
        const paths = getPathsFromRegistry('component', maybeComponentName, this.registry).filter((postfix: string) => isTemplatePath(postfix));
        const existingPaths = await asyncFilter(paths, this.server.fs.exists);

        return pathsToLocationsWithPosition(existingPaths, '@' + (focusPath.node as ASTv1.HashPair).key);
      }
    }

    return Promise.resolve([]);
  }
  async provideAngleBracketComponentAttributeUsage(focusPath: ASTPath): Promise<Location[]> {
    const maybeComponentName = normalizeToClassicComponent(focusPath.parent.tag);

    const paths = getPathsFromRegistry('component', maybeComponentName, this.registry).filter((postfix: string) => isTemplatePath(postfix));

    const existingPaths = await asyncFilter(paths, this.server.fs.exists);

    return pathsToLocationsWithPosition(existingPaths, (focusPath.node as ASTv1.AttrNode).name);
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

  isMayBeComponentFromPath(path: ASTPath) {
    const node = path.node as ASTv1.ElementNode;

    if (node.type === 'ElementNode') {
      if (node.tag.indexOf('.') > -1) {
        return true;
      }
    }
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
