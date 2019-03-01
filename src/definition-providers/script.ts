import * as path from 'path';

import { TextDocumentPositionParams, Definition } from 'vscode-languageserver';

import { parse } from 'babylon';
import { toPosition } from './../estree-utils';
import Server from './../server';
import ASTPath from './../glimmer-utils';
import { pathsToLocations } from '../utils/definition-helpers';
import { isTransformReference, isModelReference } from './../utils/ast-helpers';
import {
  isModuleUnificationApp,
  podModulePrefixForRoot
} from './../utils/layout-helpers';

export default class ScriptDefinietionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams, project: any): Definition | null {
    const uri = params.textDocument.uri;
    const { root } = project;
    const content = this.server.documents.get(uri).getText();

    const ast = parse(content, {
      sourceType: 'module'
    });

    const astPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!astPath) {
      return null;
    }

    if (isModelReference(astPath)) {
      let modelName = astPath.node.value;

      const guessedPaths: string[] = [];

      if (isModuleUnificationApp(root)) {
        this.muModelPaths(root, modelName).forEach(
          (pathLocation: string) => {
            guessedPaths.push(pathLocation);
          }
        );
      } else {
        this.classicModelPaths(root, modelName).forEach(
          (pathLocation: string) => {
            guessedPaths.push(pathLocation);
          }
        );
        const podPrefix = podModulePrefixForRoot(root);
        if (podPrefix) {
          this.podModelPaths(root, modelName, podPrefix).forEach(
            (pathLocation: string) => {
              guessedPaths.push(pathLocation);
            }
          );
        }
      }
      return pathsToLocations.apply(null, guessedPaths);
    } else if (isTransformReference(astPath)) {
      let transformName = astPath.node.value;
      const guessedPaths: string[] = [];

      if (isModuleUnificationApp(root)) {
        this.muTransformPaths(root, transformName).forEach(
          (pathLocation: string) => {
            guessedPaths.push(pathLocation);
          }
        );
      } else {
        this.classicTransformPaths(root, transformName).forEach(
          (pathLocation: string) => {
            guessedPaths.push(pathLocation);
          }
        );

        const podPrefix = podModulePrefixForRoot(root);
        if (podPrefix) {
          this.podTransformPaths(
            root,
            transformName,
            podPrefix
          ).forEach((pathLocation: string) => {
            guessedPaths.push(pathLocation);
          });
        }
      }
      return pathsToLocations.apply(null, guessedPaths);
    }
    return null;
  }
  joinPaths(...args: string[]) {
    return ['.ts', '.js'].map((extName: string) => {
      const localArgs = args.slice(0);
      const lastArg = localArgs.pop() + extName;
      return path.join.apply(path, [...localArgs, lastArg]);
    });
  }
  muModelPaths(root: string, modelName: string) {
    return this.joinPaths(root, 'src', 'data', 'models', modelName, 'model');
  }
  muTransformPaths(root: string, transformName: string) {
    return this.joinPaths(root, 'src', 'data', 'transforms', transformName);
  }
  classicModelPaths(root: string, modelName: string) {
    return this.joinPaths(root, 'app', 'models', modelName);
  }
  classicTransformPaths(root: string, transformName: string) {
    return this.joinPaths(root, 'app', 'transforms', transformName);
  }
  podTransformPaths(root: string, transformName: string, podPrefix: string) {
    return this.joinPaths(root, 'app', podPrefix, transformName, 'transform');
  }
  podModelPaths(root: string, modelName: string, podPrefix: string) {
    return this.joinPaths(root, 'app', podPrefix, modelName, 'model');
  }
}
