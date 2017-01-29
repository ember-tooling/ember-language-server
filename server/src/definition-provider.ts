import { extname } from 'path';
import { readFileSync } from 'fs';

import { RequestHandler, TextDocumentPositionParams, Definition, Location, Range } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

import { toPosition } from './estree-utils';
import Server from './server';
import { findFocusPath } from './glimmer-utils';

import { ModuleType, Module } from './module-index';

const { preprocess } = require('@glimmer/syntax');

export default class DefinitionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;
    let filePath = uriToFilePath(uri);
    if (!filePath) {
      return null;
    }

    let extension = extname(filePath);

    if (extension === '.hbs') {
      let content = readFileSync(filePath, 'utf-8');
      let ast = preprocess(content);
      let focusPath = findFocusPath(ast, toPosition(params.position));

      if (this.isComponentOrHelperName(focusPath)) {
        const componentOrHelperName = focusPath[focusPath.length - 1].original;
        const moduleIndex = this.server.projectRoots.modulesForPath(filePath);

        if (!moduleIndex) {
          return null;
        }

        const templates = moduleIndex.getModules(ModuleType.ComponentTemplate);
        const template = templates.find(module => module.name === componentOrHelperName);
        const components = moduleIndex.getModules(ModuleType.Component);
        const component = components.find(module => module.name === componentOrHelperName);
        const helpers = moduleIndex.getModules(ModuleType.Helper);
        const helper = helpers.find(module => module.name === componentOrHelperName);

        return [template, component, helper]
          .filter(module => module)
          .map((module: Module) => Location.create(`file:${module.path}`, Range.create(0, 0, 0, 0)));
      }
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isComponentOrHelperName(path: any[]) {
    let node = path[path.length - 1];
    if (!node || node.type !== 'PathExpression') {
      return false;
    }

    let parent = path[path.length - 2];
    if (!parent || parent.path !== node || (parent.type !== 'MustacheStatement' && parent.type !== 'BlockStatement')) {
      return false;
    }

    return true;
  }
}
