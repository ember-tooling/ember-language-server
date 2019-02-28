import * as path from 'path';
import * as fs from 'fs';

import {
  RequestHandler,
  TextDocumentPositionParams,
  Definition,
  Location,
  Range
} from 'vscode-languageserver';

import { parse } from 'babylon';
import URI from 'vscode-uri';
import { toPosition } from './estree-utils';
import Server from './server';
import ASTPath from './glimmer-utils';
import { getExtension } from './utils/file-extension';
import { isTransformReference, isModelReference } from './utils/ast-helpers';
import {
  isTemplatePath,
  getComponentNameFromURI
} from './utils/layout-helpers';

import {
  getAbstractHelpersParts,
  getAddonPathsForComponentTemplates,
  getPathsForComponentTemplates,
  getPathsForComponentScripts
} from './utils/definition-helpers';

const _ = require('lodash');
const memoize = require('memoizee');
const { preprocess } = require('@glimmer/syntax');

const mAddonPathsForComponentTemplates = memoize(
  getAddonPathsForComponentTemplates,
  { length: 2, maxAge: 600000 }
);

export default class DefinitionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;

    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return null;
    }

    let extension = getExtension(params.textDocument);

    if (extension === '.hbs') {
      let content = this.server.documents.get(uri).getText();
      let ast = preprocess(content);
      let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!focusPath) {
        return null;
      }

      if (this.isAngleComponent(focusPath)) {
        const maybeComponentName = _.kebabCase(focusPath.node.tag);

        let paths = [
          ...getPathsForComponentScripts(project.root, maybeComponentName),
          ...getPathsForComponentTemplates(project.root, maybeComponentName)
        ].filter(fs.existsSync);

        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          );
        }

        return pathsToLocations.apply(
          null,
          paths.length > 1
            ? paths.filter((postfix: string) => isTemplatePath(postfix))
            : paths
        );
      } else if (this.isComponentWithBlock(focusPath)) {
        let maybeComponentName = focusPath.node.path.original;
        let paths: string[] = getPathsForComponentTemplates(
          project.root,
          maybeComponentName
        ).filter(fs.existsSync);
        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          ).filter((name: string) => {
            return isTemplatePath(name);
          });
        }
        // mAddonPathsForComponentTemplates
        return pathsToLocationsWithPosition(paths, '{{yield');
      } else if (
        this.isActionName(focusPath) ||
        this.isLocalProperty(focusPath)
      ) {
        let maybeComponentName = getComponentNameFromURI(project.root, uri);
        let paths: string[] = getPathsForComponentScripts(
          project.root,
          maybeComponentName
        ).filter(fs.existsSync);
        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          ).filter((name: string) => {
            return !isTemplatePath(name);
          });
        }
        const text = focusPath.node.original;
        return pathsToLocationsWithPosition(
          paths,
          text.replace('this.', '').split('.')[0]
        );
      } else if (this.isComponentOrHelperName(focusPath)) {
        const maybeComponentName =
          focusPath.node.type === 'ElementNode'
            ? _.kebabCase(focusPath.node.tag)
            : focusPath.node.original;

        let helpers = getAbstractHelpersParts(
          project.root,
          'app',
          maybeComponentName
        ).map((pathParts: any) => {
          return path.join.apply(path, pathParts.filter((part: any) => !!part));
        });

        let paths = [
          ...getPathsForComponentScripts(project.root, maybeComponentName),
          ...getPathsForComponentTemplates(project.root, maybeComponentName),
          ...helpers
        ].filter(fs.existsSync);

        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          );
        }

        return pathsToLocations.apply(
          null,
          paths.length > 1 ? paths.filter(isTemplatePath) : paths
        );
      } else if (this.isAnglePropertyAttribute(focusPath)) {
        const maybeComponentName = _.kebabCase(focusPath.parent.tag);

        let paths = [
          ...getPathsForComponentScripts(project.root, maybeComponentName),
          ...getPathsForComponentTemplates(project.root, maybeComponentName)
        ].filter(fs.existsSync);

        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          );
        }

        const finalPaths =
          paths.length > 1
            ? paths.filter((postfix: string) => isTemplatePath(postfix))
            : paths;
        return pathsToLocationsWithPosition(finalPaths, focusPath.node.name);

        // let { line, column } =  toPosition(params.position);
        // let textLine = getLineFromText(content, line);
        // let leftLine = textLine.slice(0, column);
        // let rightLine = textLine.slice(column);
        // let leftEqual = leftLine.lastIndexOf('=');
        // if (leftEqual > -1) {
        //   let needle = leftLine.slice(leftEqual + 1).trim() + rightLine.slice(0, rightLine.indexOf(' ') || rightLine.length - 1).trim();
        //   if (needle.indexOf('this.') > -1) {
        //   }
        // }
      } else if (this.isHashPairKey(focusPath)) {
        let parentPath = focusPath.parentPath;
        if (parentPath && parentPath.parent && parentPath.parent.path) {
          const maybeComponentName = parentPath.parent.path.original;
          if (
            !maybeComponentName.includes('.') &&
            maybeComponentName.includes('-')
          ) {
            let paths = [
              ...getPathsForComponentScripts(project.root, maybeComponentName),
              ...getPathsForComponentTemplates(project.root, maybeComponentName)
            ].filter(fs.existsSync);

            if (!paths.length) {
              paths = mAddonPathsForComponentTemplates(
                project.root,
                maybeComponentName
              );
            }

            const finalPaths =
              paths.length > 1
                ? paths.filter((postfix: string) => isTemplatePath(postfix))
                : paths;
            return pathsToLocationsWithPosition(
              finalPaths,
              '@' + focusPath.node.key
            );
          }
        }
      }
    } else if (extension === '.js') {
      let content = this.server.documents.get(uri).getText();
      let ast = parse(content, {
        sourceType: 'module'
      });
      let astPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!astPath) {
        return null;
      }

      if (isModelReference(astPath)) {
        let modelName = astPath.node.value;
        const modelPath = path.join(
          project.root,
          'app',
          'models',
          `${modelName}.js`
        );
        const tsModelPath = path.join(
          project.root,
          'app',
          'models',
          `${modelName}.ts`
        );
        return pathsToLocations(modelPath, tsModelPath);
      } else if (isTransformReference(astPath)) {
        let transformName = astPath.node.value;

        const transformPath = path.join(
          project.root,
          'app',
          'transforms',
          `${transformName}.js`
        );
        const tsTransformPath = path.join(
          project.root,
          'app',
          'transforms',
          `${transformName}.ts`
        );
        return pathsToLocations(transformPath, tsTransformPath);
      }
    }

    return null;
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
    if (
      !path.parent ||
      path.parent.path.original !== 'action' ||
      !path.parent.params[0] === node
    ) {
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
      if (
        path.parent &&
        path.parent.path.original === 'component' &&
        path.parent.params[0] === node
      ) {
        return true;
      }
    }

    if (node.type !== 'PathExpression') {
      return false;
    }

    let parent = path.parent;
    if (
      !parent ||
      parent.path !== node ||
      (parent.type !== 'MustacheStatement' &&
        parent.type !== 'BlockStatement' &&
        parent.type !== 'SubExpression')
    ) {
      return false;
    }

    return true;
  }
}

function pathsToLocations(...paths: string[]): Location[] {
  return paths.filter(fs.existsSync).map(modulePath => {
    return Location.create(
      URI.file(modulePath).toString(),
      Range.create(0, 0, 0, 0)
    );
  });
}

// function getLineFromText(text: string, line: number) {
//   const arrayOfLines = text.match(/[^\r\n]+/g) || [];
//   return arrayOfLines[line - 1] || '';
// }

function getFirstTextPostion(filePath: string, content: string) {
  const text = fs.readFileSync(filePath, 'utf8');
  const arrayOfLines = text.match(/(.*?(?:\r\n?|\n|$))/gm) || [];
  let startLine = 0;
  let startCharacter = 0;
  arrayOfLines.forEach((line: string, index: number) => {
    if (startLine || startCharacter) {
      return;
    }
    let textPosition = line.indexOf(content);
    let bounds = line.split(content);
    if (textPosition > -1) {
      if (
        /\s/.test(bounds[0].charAt(bounds[0].length - 1)) ||
        bounds[0].trim().length === 0
      ) {
        if (/^[A-Za-z]+$/.test(bounds[1].charAt(0)) === false) {
          startLine = index;
          startCharacter = textPosition;
        }
      }
    }
  });
  return [startLine, startCharacter];
}

function pathsToLocationsWithPosition(paths: string[], findMe: string) {
  return paths.filter(fs.existsSync).map((fileName: string) => {
    const [startLine, startCharacter] = getFirstTextPostion(fileName, findMe);
    return Location.create(
      URI.file(fileName).toString(),
      Range.create(
        startLine,
        startCharacter,
        startLine,
        startCharacter + findMe.length
      )
    );
  });
}
