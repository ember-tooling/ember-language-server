import * as path from 'path';
import Server from './../server';
import ASTPath from './../glimmer-utils';
import { TextDocumentPositionParams, Definition, Location } from 'vscode-languageserver';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import { toPosition } from './../estree-utils';
import { pathsToLocations, getAddonPathsForType, getAddonImport } from '../utils/definition-helpers';
import { kebabCase } from 'lodash';
import {
  isRouteLookup,
  isTransformReference,
  isModelReference,
  isImportPathDeclaration,
  isServiceInjection,
  isNamedServiceInjection,
  isTemplateElement
} from './../utils/ast-helpers';
import { queryELSAddonsAPI } from './../utils/addon-api';
import { isModuleUnificationApp, podModulePrefixForRoot } from './../utils/layout-helpers';
import { Project } from '../project-roots';

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
  muModelPaths(root: string, modelName: string) {
    return joinPaths(root, 'src', 'data', 'models', modelName, 'model');
  }
  muTransformPaths(root: string, transformName: string) {
    return joinPaths(root, 'src', 'data', 'transforms', transformName);
  }
  muServicePaths(root: string, transformName: string) {
    return joinPaths(root, 'src', 'services', transformName);
  }
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
  muImportPaths(root: string, pathName: string) {
    const pathParts = pathName.split('/');
    pathParts.shift();
    const params = [root, ...pathParts];
    return joinPaths.apply(null, params);
  }
}

export default class ScriptDefinietionProvider {
  private resolvers!: PathResolvers;
  constructor(private server: Server) {
    this.resolvers = new PathResolvers();
  }
  guessPathForImport(root: string, uri: string, importPath: string) {
    if (!uri) {
      return null;
    }
    const guessedPaths: string[] = [];
    const fnName = 'Import';
    if (isModuleUnificationApp(root)) {
      this.resolvers[`mu${fnName}Paths`](root, importPath).forEach((pathLocation: string) => {
        guessedPaths.push(pathLocation);
      });
    } else {
      this.resolvers[`classic${fnName}Paths`](root, importPath).forEach((pathLocation: string) => {
        guessedPaths.push(pathLocation);
      });
    }
    this.resolvers.addonImportPaths(root, importPath).forEach((pathLocation: string) => {
      guessedPaths.push(pathLocation);
    });
    return pathsToLocations.apply(null, guessedPaths);
  }
  guessPathsForType(root: string, fnName: ItemType, typeName: string) {
    const guessedPaths: string[] = [];

    if (isModuleUnificationApp(root)) {
      this.resolvers[`mu${fnName}Paths`](root, typeName).forEach((pathLocation: string) => {
        guessedPaths.push(pathLocation);
      });
    } else {
      this.resolvers[`classic${fnName}Paths`](root, typeName).forEach((pathLocation: string) => {
        guessedPaths.push(pathLocation);
      });
      const podPrefix = podModulePrefixForRoot(root);
      if (podPrefix) {
        this.resolvers[`pod${fnName}Paths`](root, typeName, podPrefix).forEach((pathLocation: string) => {
          guessedPaths.push(pathLocation);
        });
      }
    }

    if (fnName === 'Service') {
      this.resolvers.addonServicePaths(root, typeName).forEach((item: string) => {
        guessedPaths.push(item);
      });
    }
    return pathsToLocations.apply(null, guessedPaths);
  }
  async handle(params: TextDocumentPositionParams, project: Project): Promise<Definition | null> {
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

    let results: Location[] = [];

    if (isTemplateElement(astPath)) {
      let templateResults = await this.server.definitionProvider.template.handle(params, project);
      if (Array.isArray(templateResults)) {
        results = templateResults;
      }
    } else if (isModelReference(astPath)) {
      const modelName = astPath.node.value;
      results = this.guessPathsForType(root, 'Model', modelName);
    } else if (isTransformReference(astPath)) {
      const transformName = astPath.node.value;
      results = this.guessPathsForType(root, 'Transform', transformName);
    } else if (isImportPathDeclaration(astPath)) {
      results = this.guessPathForImport(root, uri, astPath.node.value);
    } else if (isServiceInjection(astPath)) {
      let serviceName = astPath.node.name;
      let args = astPath.parent.value.arguments;
      if (args.length && args[0].type === 'StringLiteral') {
        serviceName = args[0].value;
      }
      results = this.guessPathsForType(root, 'Service', kebabCase(serviceName));
    } else if (isNamedServiceInjection(astPath)) {
      let serviceName = astPath.node.value;
      results = this.guessPathsForType(root, 'Service', kebabCase(serviceName));
    } else if (isRouteLookup(astPath)) {
      let routePath = astPath.node.value;
      results = this.server.definitionProvider.template.provideRouteDefinition(root, routePath);
    }

    const addonResults = [
      ...(await queryELSAddonsAPI(project.providers.definitionProviders, root, {
        focusPath: astPath,
        type: 'template',
        textDocument: params.textDocument,
        position: params.position,
        results,
        server: this.server
      })),
      ...(await queryELSAddonsAPI(project.providers.resolveProviders, root, {
        focusPath: astPath,
        type: 'template',
        textDocument: params.textDocument,
        position: params.position,
        results,
        server: this.server
      }))
    ];

    return [...results, ...addonResults];
  }
}
