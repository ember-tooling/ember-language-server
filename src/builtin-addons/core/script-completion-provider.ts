import { CompletionItem } from 'vscode-languageserver';
import { CompletionFunctionParams } from '../../utils/addon-api';
import * as memoize from 'memoizee';
import { log, logError, logInfo } from '../../utils/logger';
import Server from '../../server';
import { Project } from '../../project-roots';
import {
  isStoreModelLookup,
  isRouteLookup,
  isModelReference,
  isNamedServiceInjection,
  isTransformReference,
  isComputedPropertyArgument,
  closestScriptNodeParent,
} from '../../utils/ast-helpers';
import { listRoutes, listModels, listServices, mGetProjectAddonsInfo, listTransforms } from '../../utils/layout-helpers';

const mListRoutes = memoize(listRoutes, { length: 1, maxAge: 60000 });
const mListModels = memoize(listModels, { length: 1, maxAge: 60000 });
const mListServices = memoize(listServices, { length: 1, maxAge: 60000 });
const mListTransforms = memoize(listTransforms, { length: 1, maxAge: 60000 });

export default class ScriptCompletionProvider {
  async initRegistry(_: Server, project: Project) {
    try {
      const initStartTime = Date.now();

      mListModels(project.root);
      mListServices(project.root);
      logInfo(project.root + ': script registry initialized in ' + (Date.now() - initStartTime) + 'ms');
    } catch (e) {
      logError(e);
    }
  }
  async onComplete(root: string, params: CompletionFunctionParams): Promise<CompletionItem[]> {
    const focusPath = params.focusPath;

    if (params.type !== 'script') {
      return params.results;
    }

    log('script:onComplete');
    const completions: CompletionItem[] = params.results;

    try {
      if (isStoreModelLookup(focusPath) || isModelReference(focusPath)) {
        log('isStoreModelLookup || isModelReference');
        mListModels(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'model') {
            completions.push(item);
          }
        });
      } else if (isRouteLookup(focusPath)) {
        log('isRouteLookup');
        mListRoutes(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'route') {
            completions.push(item);
          }
        });
      } else if (isNamedServiceInjection(focusPath)) {
        log('isNamedServiceInjection');
        mListServices(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'service') {
            completions.push(item);
          }
        });
      } else if (isComputedPropertyArgument(focusPath)) {
        log('isComputedPropertyArgument');

        if (!focusPath.parentPath || !focusPath.parentPath.parentPath) {
          return [];
        }

        const node = closestScriptNodeParent(focusPath, 'ObjectExpression', ['ObjectProperty']) || closestScriptNodeParent(focusPath, 'ClassBody');

        if (node === null) {
          log('isComputedPropertyArgument - unable to find keys');

          return [];
        }

        (node.properties || node.body || []).forEach((property: any) => {
          let name = null;

          if (property.key.type === 'StringLiteral') {
            name = property.key.value;
          } else if (property.key.type === 'Identifier') {
            name = property.key.name;
          }

          if (name !== null) {
            completions.push({
              kind: 10,
              label: name,
              detail: 'ObjectProperty',
            });
          }
        });
      } else if (isTransformReference(focusPath)) {
        log('isTransformReference');
        mListTransforms(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'transform') {
            completions.push(item);
          }
        });
      }
    } catch (e) {
      log('error', e);
    }

    log('completions', completions);

    return completions;
  }
}
