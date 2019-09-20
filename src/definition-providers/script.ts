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

type ItemType = 'Model' | 'Transform' | 'Service';
type LayoutCollectorFn = (root: string, itemName: string, podModulePrefix?: string) => string[];

function joinPaths(...args: string[]) {
  return ['.ts', '.js'].map((extName: string) => {
    const localArgs = args.slice(0);
    const lastArg = localArgs.pop() + extName;
    return path.join.apply(path, [...localArgs, lastArg]);
  });
}

class PathResolvers {
  [key: string]: LayoutCollectorFn;
  classicModelPaths(root: string, modelName: string) {
    return joinPaths(root, 'app', 'models', modelName);
  }
  classicTransformPaths(root: string, transformName: string) {
    return joinPaths(root, 'app', 'transforms', transformName);
  }
  classicServicePaths(root: string, modelName: string) {
    return joinPaths(root, 'app', 'services', modelName);
  }
  podTransformPaths(root: string, transformName: string, podPrefix: string) {
    return joinPaths(root, 'app', podPrefix, transformName, 'transform');
  }
  podModelPaths(root: string, modelName: string, podPrefix: string) {
    return joinPaths(root, 'app', podPrefix, modelName, 'model');
  }
  podServicePaths(root: string, modelName: string, podPrefix: string) {
    return joinPaths(root, 'app', podPrefix, modelName, 'service');
  }
  addonServicePaths(root: string, serviceName: string) {
    return getAddonPathsForType(root, 'services', serviceName);
  }
  addonImportPaths(root: string, pathName: string) {
    return getAddonImport(root, pathName);
  }
  classicImportPaths(root: string, pathName: string) {
    const pathParts = pathName.split('/');
    pathParts.shift();
    const params = [root, 'app', ...pathParts];
    return joinPaths.apply(null, params);
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
    const guessedPaths: string[] = [];
    const fnName = 'Import';
      this.resolvers[`classic${fnName}Paths`](root, importPath).forEach(
        (pathLocation: string) => {
          guessedPaths.push(pathLocation);
        }
      );
    this.resolvers.addonImportPaths(root, importPath).forEach(
      (pathLocation: string) => {
        guessedPaths.push(pathLocation);
      }
    );
    return pathsToLocations.apply(null, guessedPaths);
  }
  guessPathsForType(root: string, fnName: ItemType, typeName: string) {
    const guessedPaths: string[] = [];

      this.resolvers[`classic${fnName}Paths`](root, typeName).forEach(
        (pathLocation: string) => {
          guessedPaths.push(pathLocation);
        }
      );
      const podPrefix = getPodModulePrefix(root);
      if (podPrefix) {
        this.resolvers[`pod${fnName}Paths`](root, typeName, podPrefix).forEach(
          (pathLocation: string) => {
            guessedPaths.push(pathLocation);
          }
        );
      }

    if (fnName === 'Service') {
      this.resolvers.addonServicePaths(root, typeName).forEach((item: string) => {
        guessedPaths.push(item);
      });
    }
    return pathsToLocations.apply(null, guessedPaths);
  }
  handle(params: TextDocumentPositionParams, project: any): Definition | null {
    const uri = params.textDocument.uri;
    const { root } = project;
    const document = this.server.documents.get(uri);
    if (!document) {
      return null;
    }
    const content = document.getText();

    const ast = parse(content, {
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
