import * as path from 'path';
import Server from './../server';
import ASTPath from './../glimmer-utils';
import { TextDocumentPositionParams, Definition } from 'vscode-languageserver';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import { toPosition } from './../estree-utils';
import { pathsToLocations, getAddonPathsForType, getAddonImport } from '../utils/definition-helpers';
const { kebabCase } = require('lodash');
import { isRouteLookup, isTransformReference, isModelReference, isImportPathDeclaration, isServiceInjection, isNamedServiceInjection } from './../utils/ast-helpers';
import { getPodModulePrefix } from './../utils/layout-helpers';
import { Project } from '../project-roots';
import { ParseResult } from '@babel/core';

type ItemType = 'Model' | 'Transform' | 'Service';
type LayoutCollectorFn = (root: string, itemName: string, podModulePrefix?: string) => string[];

function joinPaths(...args: string[]): string[] {
  return ['.ts', '.js'].map(extName => {
    const localArgs = args.slice(0);
    const lastArg = localArgs.pop() + extName;
    return path.join(...localArgs, lastArg);
  });
}

class PathResolvers {
  [key: string]: LayoutCollectorFn;
  classicModelPaths(root: string, modelName: string): string[] {
    return joinPaths(root, 'app', 'models', modelName);
  }

  classicTransformPaths(root: string, transformName: string): string[] {
    return joinPaths(root, 'app', 'transforms', transformName);
  }

  classicServicePaths(root: string, modelName: string): string[] {
    return joinPaths(root, 'app', 'services', modelName);
  }

  podTransformPaths(root: string, transformName: string, podPrefix: string): string[] {
    return joinPaths(root, 'app', podPrefix, transformName, 'transform');
  }

  podModelPaths(root: string, modelName: string, podPrefix: string): string[] {
    return joinPaths(root, 'app', podPrefix, modelName, 'model');
  }

  podServicePaths(root: string, modelName: string, podPrefix: string): string[] {
    return joinPaths(root, 'app', podPrefix, modelName, 'service');
  }

  addonServicePaths(root: string, serviceName: string): string[] {
    return getAddonPathsForType(root, 'services', serviceName);
  }

  addonImportPaths(root: string, pathName: string): string[] {
    return getAddonImport(root, pathName);
  }

  classicImportPaths(root: string, pathName: string): string[] {
    const pathParts = pathName.split('/');
    pathParts.shift();
    return joinPaths(root, 'app', ...pathParts);
  }
}

export default class ScriptDefinitionProvider {
  private server: Server;
  private resolvers: PathResolvers;

  constructor(server: Server) {
    this.server = server;
    this.resolvers = new PathResolvers();
  }

  guessPathForImport(root: string, uri: string, importPath: string ) {
    if (!uri) {
      return null;
    }

    return pathsToLocations(
      ...this.resolvers.classicImportPaths(root, importPath),
      ...this.resolvers.addonImportPaths(root, importPath)
    );
  }

  guessPathsForType(root: string, fnName: ItemType, typeName: string) {
    const classicPaths = this.resolvers[`classic${fnName}Paths`](root, typeName);

    const podPrefix = getPodModulePrefix(root);
    const podsPaths = podPrefix
      ? this.resolvers[`pod${fnName}Paths`](root, typeName, podPrefix)
      : [];

    const addonPaths = fnName === 'Service'
      ? this.resolvers.addonServicePaths(root, typeName)
      : [];

    return pathsToLocations(
      ...classicPaths,
      ...podsPaths,
      ...addonPaths,
    );
  }

  handle(params: TextDocumentPositionParams, project: Project): Definition | null {
    const uri = params.textDocument.uri;
    const { root } = project;
    const document = this.server.documents.get(uri);
    if (!document) {
      return null;
    }
    const content = document.getText();

    const ast: ParseResult = parse(content, {
      sourceType: 'module'
    });

    const astPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!astPath) {
      return null;
    }

    if (isModelReference(astPath)) {
      const modelName = astPath.node.value;
      return this.guessPathsForType(root, 'Model', modelName);
    } else if (isTransformReference(astPath)) {
      const transformName = astPath.node.value;
      return this.guessPathsForType(root, 'Transform', transformName);
    } else if (isImportPathDeclaration(astPath)) {
      return this.guessPathForImport(root, uri, astPath.node.value);
    } else if (isServiceInjection(astPath)) {
      let serviceName = astPath.node.name;
      let args = astPath.parent.value.arguments;
      if (args.length && args[0].type === 'StringLiteral') {
        serviceName = args[0].value;
      }
      return this.guessPathsForType(root, 'Service', kebabCase(serviceName));
    } else if (isNamedServiceInjection(astPath)) {
      let serviceName = astPath.node.value;
      return this.guessPathsForType(root, 'Service', kebabCase(serviceName));
    } else if (isRouteLookup(astPath)) {
      let routePath = astPath.node.value;
      return this.server.definitionProvider.template.provideRouteDefinition(root, routePath);
    }

    return null;
  }
}
