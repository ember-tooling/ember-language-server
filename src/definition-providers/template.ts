import * as path from 'path';
import * as fs from 'fs';

import { RequestHandler, TextDocumentPositionParams, Definition } from 'vscode-languageserver';
import { searchAndExtractHbs } from 'extract-tagged-template-literals';
import { getExtension } from './../utils/file-extension';

import { isLinkToTarget, isLinkComponentRouteTarget } from './../utils/ast-helpers';

import { toPosition } from './../estree-utils';
import Server from './../server';
import ASTPath from './../glimmer-utils';

import { isTemplatePath, getComponentNameFromURI, isModuleUnificationApp, getPodModulePrefix } from './../utils/layout-helpers';

import {
  getAbstractHelpersParts,
  getAddonPathsForComponentTemplates,
  getPathsForComponentTemplates,
  getPathsForComponentScripts,
  pathsToLocationsWithPosition,
  pathsToLocations
} from './../utils/definition-helpers';

import { kebabCase } from 'lodash';
import * as memoize from 'memoizee';
import { preprocess } from '@glimmer/syntax';

const mAddonPathsForComponentTemplates = memoize(getAddonPathsForComponentTemplates, { length: 2, maxAge: 600000 });

function normalizeAngleTagName(tagName: string) {
  return tagName
    .split('::')
    .map((item: string) => kebabCase(item))
    .join('/');
}

export default class TemplateDefinitionProvider {
  constructor(private server: Server) {}
  handle(params: TextDocumentPositionParams, project: any): Definition | null {
    let uri = params.textDocument.uri;
    const root = project.root;
    const document = this.server.documents.get(uri);
    if (!document) {
      return null;
    }
    const ext = getExtension(params.textDocument);
    const isScript = ['.ts', '.js'].includes(ext as string);
    let content = isScript ? searchAndExtractHbs(document.getText()) : document.getText();
    let ast = preprocess(content);
    let focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath) {
      return null;
    }
    // <FooBar @some-component-name="my-component" /> || {{some-component some-name="my-component/name"}}
    if (this.maybeClassicComponentName(focusPath)) {
      return this.provideComponentDefinition(project.root, this.extractValueForMaybeClassicComponentName(focusPath));
    } else if (this.isAngleComponent(focusPath)) {
      // <FooBar />
      return this.provideAngleBrackedComponentDefinition(root, focusPath);
      // {{#foo-bar}} {{/foo-bar}}
    } else if (this.isComponentWithBlock(focusPath)) {
      return this.provideBlockComponentDefinition(root, focusPath);

      // {{action "fooBar"}}, (action "fooBar"), (action this.fooBar), this.someProperty
    } else if (this.isActionName(focusPath) || this.isLocalProperty(focusPath)) {
      return this.providePropertyDefinition(root, focusPath, uri);

      // {{foo-bar}}
    } else if (this.isComponentOrHelperName(focusPath)) {
      return this.provideMustacheDefinition(root, focusPath);

      // <FooBar @somePropertyToFindUsage="" />
    } else if (isLinkComponentRouteTarget(focusPath)) {
      // <LinkTo @route="name" />
      return this.provideRouteDefinition(project.root, focusPath.node.chars);
    } else if (this.isAnglePropertyAttribute(focusPath)) {
      return this.provideAngleBracketComponentAttributeUsage(root, focusPath);

      // {{hello propertyUsageToFind=someValue}}
    } else if (this.isHashPairKey(focusPath)) {
      return this.provideHashPropertyUsage(project.root, focusPath);
    } else if (isLinkToTarget(focusPath)) {
      return this.provideRouteDefinition(project.root, focusPath.node.original);
    }

    return null;
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
    let value = this.extractValueForMaybeClassicComponentName(focusPath);
    if (this.looksLikeClassicComponentName(value)) {
      return true;
    } else {
      return false;
    }
  }
  provideRouteDefinition(root: string, routeName: string) {
    const routeParts = routeName.split('.');
    const lastRoutePart = routeParts.pop();
    const routePaths = isModuleUnificationApp(root)
      ? [
          [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'route.js'],
          [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'route.ts'],
          [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'controller.js'],
          [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'controller.ts'],
          [root, 'src/ui/routes', ...routeParts, lastRoutePart, 'template.hbs']
        ]
      : [
          [root, 'app', 'routes', ...routeParts, lastRoutePart + '.js'],
          [root, 'app', 'routes', ...routeParts, lastRoutePart + '.ts'],
          [root, 'app', 'controllers', ...routeParts, lastRoutePart + '.js'],
          [root, 'app', 'controllers', ...routeParts, lastRoutePart + '.ts'],
          [root, 'app', 'templates', ...routeParts, lastRoutePart + '.hbs']
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
    return pathsToLocations.apply(null, filteredPaths);
  }
  _provideComponentTemplatePaths(root: string, rawComponentName: string) {
    const maybeComponentName = normalizeAngleTagName(rawComponentName);
    let paths = [...getPathsForComponentTemplates(root, maybeComponentName)].filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }
    return paths;
  }
  _provideLikelyRawComponentTemplatePaths(root: string, rawComponentName: string) {
    const maybeComponentName = normalizeAngleTagName(rawComponentName);
    let paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName)].filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }
    return paths;
  }
  provideLikelyComponentTemplatePath(root: string, rawComponentName: string) {
    let paths = this._provideLikelyRawComponentTemplatePaths(root, rawComponentName);
    return pathsToLocations.apply(null, paths.length > 1 ? paths.filter((postfix: string) => isTemplatePath(postfix)) : paths);
  }
  provideAngleBrackedComponentDefinition(root: string, focusPath: ASTPath) {
    return this.provideLikelyComponentTemplatePath(root, focusPath.node.tag);
  }
  provideBlockComponentDefinition(root: string, focusPath: ASTPath): null | Definition {
    let maybeComponentName = focusPath.node.path.original;
    let paths: string[] = getPathsForComponentTemplates(root, maybeComponentName).filter(fs.existsSync);
    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName).filter((name: string) => {
        return isTemplatePath(name);
      });
    }
    // mAddonPathsForComponentTemplates
    return pathsToLocationsWithPosition(paths, '{{yield');
  }
  providePropertyDefinition(root: string, focusPath: ASTPath, uri: string): null | Definition {
    let maybeComponentName = getComponentNameFromURI(root, uri);
    if (!maybeComponentName) {
      return null;
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
  provideComponentDefinition(root: string, maybeComponentName: string) {
    let helpers = getAbstractHelpersParts(root, 'app', maybeComponentName).map((pathParts: any) => {
      return path.join.apply(path, pathParts.filter((part: any) => !!part));
    });

    let paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName), ...helpers].filter(
      fs.existsSync
    );

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    return pathsToLocations.apply(null, paths.length > 1 ? paths.filter(isTemplatePath) : paths);
  }
  provideMustacheDefinition(root: string, focusPath: ASTPath) {
    const maybeComponentName = focusPath.node.type === 'ElementNode' ? normalizeAngleTagName(focusPath.node.tag) : focusPath.node.original;
    return this.provideComponentDefinition(root, maybeComponentName);
  }
  provideHashPropertyUsage(root: string, focusPath: ASTPath): null | Definition {
    let parentPath = focusPath.parentPath;
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
    return null;
  }
  provideAngleBracketComponentAttributeUsage(root: string, focusPath: ASTPath): null | Definition {
    const maybeComponentName = normalizeAngleTagName(focusPath.parent.tag);

    let paths = [...getPathsForComponentScripts(root, maybeComponentName), ...getPathsForComponentTemplates(root, maybeComponentName)].filter(fs.existsSync);

    if (!paths.length) {
      paths = mAddonPathsForComponentTemplates(root, maybeComponentName);
    }

    const finalPaths = paths.length > 1 ? paths.filter((postfix: string) => isTemplatePath(postfix)) : paths;
    return pathsToLocationsWithPosition(finalPaths, focusPath.node.name);
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isLocalProperty(path: ASTPath) {
    let node = path.node;
    if (node.type === 'PathExpression') {
      return node.this;
    }
    return false;
  }

  isHashPairKey(path: ASTPath) {
    let node = path.node;
    return node.type === 'HashPair';
  }

  isAnglePropertyAttribute(path: ASTPath) {
    let node = path.node;
    if (node.type === 'AttrNode') {
      if (node.name.charAt(0) === '@') {
        return true;
      }
    }
  }

  isActionName(path: ASTPath) {
    let node = path.node;
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
    let node = path.node;
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
    let node = path.node;

    if (node.type === 'ElementNode') {
      if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
        return true;
      }
    }
  }

  isComponentOrHelperName(path: ASTPath) {
    let node = path.node;

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

    let parent = path.parent;
    if (!parent || parent.path !== node || (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement' && parent.type !== 'SubExpression')) {
      return false;
    }

    return true;
  }
}
