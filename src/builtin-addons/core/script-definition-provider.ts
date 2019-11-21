import * as path from 'path';
import { Definition, Location } from 'vscode-languageserver';
import { DefinitionFunctionParams } from './../../utils/addon-api';
import { pathsToLocations, getAddonPathsForType, getAddonImport } from '../../utils/definition-helpers';
import { kebabCase } from 'lodash';
import {
  isRouteLookup,
  isTransformReference,
  isModelReference,
  isImportPathDeclaration,
  isServiceInjection,
  isNamedServiceInjection,
  isTemplateElement
} from './../../utils/ast-helpers';
import { isModuleUnificationApp, podModulePrefixForRoot } from './../../utils/layout-helpers';
import { provideRouteDefinition } from './template-definition-provider';
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

export default class CoreScriptDefinitionProvider {
  private resolvers!: PathResolvers;
  constructor() {
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
  async onDefinition(root: string, params: DefinitionFunctionParams): Promise<Definition | null> {
    const { textDocument, focusPath, type, results, server, position } = params;
    if (type !== 'script') {
      return results;
    }
    const uri = textDocument.uri;
    let definitions: Location[] = results;
    const astPath = focusPath;
    if (isTemplateElement(astPath)) {
      let project = server.projectRoots.projectForUri(uri);
      if (!project) {
        return results;
      }
      let templateResults = await server.definitionProvider.template.handle(
        {
          textDocument,
          position
        },
        project
      );
      if (Array.isArray(templateResults)) {
        definitions = templateResults;
      }
    } else if (isModelReference(astPath)) {
      const modelName = astPath.node.value;
      definitions = this.guessPathsForType(root, 'Model', modelName);
    } else if (isTransformReference(astPath)) {
      const transformName = astPath.node.value;
      definitions = this.guessPathsForType(root, 'Transform', transformName);
    } else if (isImportPathDeclaration(astPath)) {
      definitions = this.guessPathForImport(root, uri, astPath.node.value);
    } else if (isServiceInjection(astPath)) {
      let serviceName = astPath.node.name;
      let args = astPath.parent.value.arguments;
      if (args.length && args[0].type === 'StringLiteral') {
        serviceName = args[0].value;
      }
      definitions = this.guessPathsForType(root, 'Service', kebabCase(serviceName));
    } else if (isNamedServiceInjection(astPath)) {
      let serviceName = astPath.node.value;
      definitions = this.guessPathsForType(root, 'Service', kebabCase(serviceName));
    } else if (isRouteLookup(astPath)) {
      let routePath = astPath.node.value;
      definitions = provideRouteDefinition(root, routePath);
    }

    return definitions || [];
  }
}
