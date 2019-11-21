import { CompletionItem } from 'vscode-languageserver';
import { CompletionFunctionParams } from '../../utils/addon-api';
import * as memoize from 'memoizee';
import { log } from '../../utils/logger';
import {
  isStoreModelLookup,
  isRouteLookup,
  isModelReference,
  isNamedServiceInjection,
  isTransformReference,
  isComputedPropertyArgument
} from '../../utils/ast-helpers';
import { listRoutes, listModels, listServices, mGetProjectAddonsInfo, listTransforms } from '../../utils/layout-helpers';

const mListRoutes = memoize(listRoutes, { length: 1, maxAge: 60000 });
const mListModels = memoize(listModels, { length: 1, maxAge: 60000 });
const mListServices = memoize(listServices, { length: 1, maxAge: 60000 });
const mListTransforms = memoize(listTransforms, { length: 1, maxAge: 60000 });

export default class ScriptCompletionProvider {
  constructor() {}
  async onComplete(root: string, params: CompletionFunctionParams): Promise<CompletionItem[]> {
    const focusPath = params.focusPath;
    if (params.type !== 'script') {
      return params.results;
    }
    const completions: CompletionItem[] = params.results;
    try {
      if (isStoreModelLookup(focusPath) || isModelReference(focusPath)) {
        mListModels(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'model') {
            completions.push(item);
          }
        });
      } else if (isRouteLookup(focusPath)) {
        mListRoutes(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'route') {
            completions.push(item);
          }
        });
      } else if (isNamedServiceInjection(focusPath)) {
        mListServices(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'service') {
            completions.push(item);
          }
        });
      } else if (isComputedPropertyArgument(focusPath)) {
        if (!focusPath.parentPath || !focusPath.parentPath.parentPath) {
          return [];
        }
        const obj = focusPath.parentPath.parentPath.parent;
        (obj.properties || []).forEach((property: any) => {
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
              detail: 'ObjectProperty'
            });
          }
        });
      } else if (isTransformReference(focusPath)) {
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

    return completions;
  }
}
