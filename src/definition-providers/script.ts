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
    let uri = params.textDocument.uri;

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

      const guessedPaths: string[] = [];

      if (isModuleUnificationApp(project.root)) {
        this.muModelPaths(project.root, modelName).forEach(
          (pathLocation: string) => {
            guessedPaths.push(pathLocation);
          }
        );
      } else {
        this.classicModelPaths(project.root, modelName).forEach(
          (pathLocation: string) => {
            guessedPaths.push(pathLocation);
          }
        );
        const podPrefix = podModulePrefixForRoot(project.root);
        if (podPrefix) {
          this.podModelPaths(project.root, modelName, podPrefix).forEach(
            (pathLocation: string) => {
              guessedPaths.push(pathLocation);
            }
          );
        }
      }

      return pathsToLocations.apply(null, guessedPaths);
    } else if (isTransformReference(astPath)) {
      let transformName = astPath.node.value;
      const guessedPaths = this.classicTransformPaths(project.root, transformName);
      return pathsToLocations.apply(null, guessedPaths);
    }
    return null;
  }
  muModelPaths(root: string, modelName: string) {
    return ['ts', 'js'].map((extName: string) => {
      return path.join(
        root,
        'src',
        'data',
        'models',
        modelName,
        `model.${extName}`
      );
    });
  }
  classicModelPaths(root: string, modelName: string) {
    return ['ts', 'js'].map((extName: string) => {
      return path.join(root, 'app', 'models', `${modelName}.${extName}`);
    });
  }
  classicTransformPaths(root: string, transformName: string) {
    return ['ts', 'js'].map((extName: string) => {
      return path.join(root, 'app', 'transforms', `${transformName}.${extName}`);
    });
  }
  podModelPaths(root: string, modelName: string, podPrefix: string) {
    return ['ts', 'js'].map((extName: string) => {
      return path.join(root, 'app', podPrefix, modelName, `model.${extName}`);
    });
  }
}
