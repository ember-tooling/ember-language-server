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

import { toPosition } from './estree-utils';
import Server from './server';
import ASTPath from './glimmer-utils';
import { getExtension } from './utils/file-extension';
import URI from 'vscode-uri';
const _ = require('lodash');

const { preprocess } = require('@glimmer/syntax');

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

      if (this.isComponentWithBlock(focusPath)) {
        let maybeComponentName = focusPath.node.path.original;
        const paths = [
          [
            project.root,
            'app',
            'components',
            maybeComponentName,
            'template.hbs'
          ],
          [
            project.root,
            'app',
            'templates',
            'components',
            maybeComponentName,
            '.hbs'
          ],
        ].map((pathParts: any) => {
          return path.join.apply(path, pathParts.filter((part: any) => !!part));
        });

        return pathsToLocationsWithPosition(paths, '{{yield');

      } else if (this.isActionName(focusPath) || this.isLocalProperty(focusPath)) {
        let fileName = uri.replace('file://', '').replace(project.root, '');
        let maybeComponentName = fileName
          .split(path.sep)
          .join('/')
          .split('/components/')[1];
        if (maybeComponentName.endsWith('/template.hbs')) {
          maybeComponentName = maybeComponentName.replace('/template.hbs', '');
        } else if (maybeComponentName.endsWith('.hbs')) {
          maybeComponentName = maybeComponentName.replace('.hbs', '');
        }
        const paths = [
          [project.root, 'app', 'components', maybeComponentName, '.js'],
          [project.root, 'app', 'components', maybeComponentName, '.ts'],
          [
            project.root,
            'app',
            'components',
            maybeComponentName,
            'component.js'
          ],
          [
            project.root,
            'app',
            'components',
            maybeComponentName,
            'component.ts'
          ]
        ].map((pathParts: any) => {
          return path.join.apply(path, pathParts.filter((part: any) => !!part));
        });

        return pathsToLocationsWithPosition(paths, focusPath.node.original.replace('this.', '').split('.')[0]);
      } else if (this.isComponentOrHelperName(focusPath)) {
        const componentOrHelperName =
          focusPath.node.type === 'ElementNode'
            ? _.kebabCase(focusPath.node.tag)
            : focusPath.node.original;
        const componentPathParts = componentOrHelperName.split('/');
        const maybeComponentName = componentPathParts.pop();
        const paths = [
          [
            project.root,
            'app',
            'components',
            ...componentPathParts,
            maybeComponentName,
            '.js'
          ],
          [
            project.root,
            'app',
            'components',
            ...componentPathParts,
            maybeComponentName,
            '.ts'
          ],
          [
            project.root,
            'app',
            'components',
            ...componentPathParts,
            maybeComponentName,
            'component.js'
          ],
          [
            project.root,
            'app',
            'components',
            ...componentPathParts,
            maybeComponentName,
            'component.ts'
          ],
          [
            project.root,
            'app',
            'components',
            ...componentPathParts,
            maybeComponentName,
            'template.hbs'
          ],
          [
            project.root,
            'app',
            'templates',
            'components',
            ...componentPathParts,
            maybeComponentName,
            '.hbs'
          ],
          [project.root, 'app', 'helpers', `${componentOrHelperName}.js`],
          [project.root, 'app', 'helpers', `${componentOrHelperName}.ts`]
        ].map((pathParts: any) => {
          return path.join.apply(path, pathParts.filter((part: any) => !!part));
        });

        return pathsToLocations.apply(null, paths);
      } else {
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

  isActionName(path: ASTPath) {
    let node = path.node;
    if (!path.parent || path.parent.path.original !== 'action' ||  !path.parent.params[0] === node) {
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
    return node.type === 'BlockStatement' && node.path.type === 'PathExpression' && node.path.this === false;
  }

  isComponentOrHelperName(path: ASTPath) {
    let node = path.node;
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
    if (node.type === 'ElementNode') {
      if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
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

function isModelReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = astPath.parent;
  if (
    !parent ||
    parent.type !== 'CallExpression' ||
    parent.arguments[0] !== node
  ) {
    return false;
  }
  let identifier =
    parent.callee.type === 'Identifier'
      ? parent.callee
      : parent.callee.property;
  return identifier.name === 'belongsTo' || identifier.name === 'hasMany';
}

function isTransformReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = astPath.parent;
  if (
    !parent ||
    parent.type !== 'CallExpression' ||
    parent.arguments[0] !== node
  ) {
    return false;
  }
  let identifier =
    parent.callee.type === 'Identifier'
      ? parent.callee
      : parent.callee.property;
  return identifier.name === 'attr';
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
      if (/\s/.test(bounds[0].charAt(bounds[0].length - 1)) || bounds[0].trim().length === 0) {
        startLine = index;
        startCharacter = textPosition;
      }
    }
  });
  return [startLine, startCharacter];
}

function pathsToLocationsWithPosition(paths: string[], findMe: string) {
  return paths.filter(fs.existsSync).map((fileName: string) => {
    const [ startLine, startCharacter ] = getFirstTextPostion(fileName, findMe);
    return Location.create(
      URI.file(fileName).toString(),
      Range.create(startLine, startCharacter, startLine, startCharacter + findMe.length)
    );
  });
}
