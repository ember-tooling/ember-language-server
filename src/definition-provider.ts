import * as path from 'path';
import * as fs from 'fs';

import {
  RequestHandler,
  TextDocumentPositionParams,
  Definition,
  Location,
  Range
} from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

import { parse } from 'babylon';

import { toPosition } from './estree-utils';
import Server from './server';
import ASTPath from './glimmer-utils';
import { getExtension } from './utils/file-extension';

const { preprocess } = require('@glimmer/syntax');

export default class DefinitionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;
    let filePath = uriToFilePath(uri);
    if (!filePath) {
      return null;
    }

    const project = this.server.projectRoots.projectForPath(filePath);
    if (!project) {
      return null;
    }

    let extension = getExtension(params.textDocument);
    const projectFilePath = function(
      folderInsideApp: string,
      fileName: string
    ) {
      const args = [path, project.root, 'app'].concat(
        folderInsideApp.split('/').filter(path => path.length),
        [fileName]
      );
      return path.join.apply(args);
    };

    if (extension === '.hbs') {
      let content = this.server.documents.get(uri).getText();
      let ast = preprocess(content);
      let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!focusPath) {
        return null;
      }

      if (this.isComponentOrHelperName(focusPath)) {
        const componentOrHelperName = focusPath.node.original;
        const jsComponentPath = projectFilePath(
          'components',
          `${componentOrHelperName}.js`
        );
        const tsComponentPath = projectFilePath(
          'components',
          `${componentOrHelperName}.ts`
        );
        const templatePath = projectFilePath(
          'templates/components',
          `${componentOrHelperName}.hbs`
        );
        const basicPodTemplatePath = projectFilePath(
          'components',
          `${componentOrHelperName}.hbs`
        );
        const tsHelerPath = projectFilePath(
          'helpers',
          `${componentOrHelperName}.ts`
        );
        const jsHelperPath = projectFilePath(
          'helpers',
          `${componentOrHelperName}.js`
        );
        return pathsToLocations(
          templatePath,
          basicPodTemplatePath,
          jsComponentPath,
          tsComponentPath,
          jsHelperPath,
          tsHelerPath
        );
      }
    } else if (extension === '.js' || extension === '.ts') {
      let content = this.server.documents.get(uri).getText();
      let getOptions = (extension: string) => {
        return {
          sourceType: 'module',
          plugins: extension === '.ts' ? ['typescript'] : []
        };
      };
      let ast = parse(content, (getOptions(extension) as any));
      let astPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!astPath) {
        return null;
      }

      if (isModelReference(astPath)) {
        let modelName = astPath.node.value;

        const jsModelPath = projectFilePath('models', `${modelName}.js`);
        const tsModelPath = projectFilePath('models', `${modelName}.ts`);

        return pathsToLocations(jsModelPath, tsModelPath);
      } else if (isTransformReference(astPath)) {
        let transformName = astPath.node.value;

        const jsTransformPath = projectFilePath(
          'transforms',
          `${transformName}.js`
        );
        const tsTransformPath = projectFilePath(
          'transforms',
          `${transformName}.ts`
        );
        return pathsToLocations(jsTransformPath, tsTransformPath);
      }
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isComponentOrHelperName(path: ASTPath) {
    let node = path.node;
    if (node.type !== 'PathExpression') {
      return false;
    }

    let parent = path.parent;
    if (
      !parent ||
      parent.path !== node ||
      (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement')
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
    return Location.create(`file://${modulePath}`, Range.create(0, 0, 0, 0));
  });
}
