import { CompletionItem, TextDocumentPositionParams } from 'vscode-languageserver';
import { queryELSAddonsAPI } from './../utils/addon-api';
import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import { uniqBy } from 'lodash';
import * as memoize from 'memoizee';
import { getExtension } from '../utils/file-extension';
import { log } from '../utils/logger';
import {
  isStoreModelLookup,
  isRouteLookup,
  isModelReference,
  isNamedServiceInjection,
  isTransformReference,
  isComputedPropertyArgument
} from '../utils/ast-helpers';
import { listRoutes, listModels, listServices, mGetProjectAddonsInfo, listTransforms } from '../utils/layout-helpers';

const mListRoutes = memoize(listRoutes, { length: 1, maxAge: 60000 });
const mListModels = memoize(listModels, { length: 1, maxAge: 60000 });
const mListServices = memoize(listServices, { length: 1, maxAge: 60000 });
const mListTransforms = memoize(listTransforms, { length: 1, maxAge: 60000 });

export default class ScriptCompletionProvider {
  constructor(private server: Server) {}
  async provideCompletions(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
    log('provideCompletions');
    if (!['.js', '.ts'].includes(getExtension(params.textDocument) as string)) {
      return [];
    }
    const uri = params.textDocument.uri;
    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return [];
    }
    const document = this.server.documents.get(uri);
    if (!document) {
      return [];
    }
    const { root } = project;
    const content = document.getText();

    let ast = null;
    try {
      ast = parse(content);
    } catch (e) {
      return [];
    }

    const focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath || !project || !document) {
      return [];
    }

    const completions: CompletionItem[] = [];
    let textPrefix = '';
    try {
      if (isStoreModelLookup(focusPath) || isModelReference(focusPath)) {
        textPrefix = focusPath.node.value;
        mListModels(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'model') {
            completions.push(item);
          }
        });
      } else if (isRouteLookup(focusPath)) {
        textPrefix = focusPath.node.value;
        mListRoutes(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'route') {
            completions.push(item);
          }
        });
      } else if (isNamedServiceInjection(focusPath)) {
        textPrefix = focusPath.node.value;
        mListServices(root).forEach((model: any) => {
          completions.push(model);
        });
        mGetProjectAddonsInfo(root).filter((item: CompletionItem) => {
          if (item.detail === 'service') {
            completions.push(item);
          }
        });
      } else if (isComputedPropertyArgument(focusPath)) {
        textPrefix = focusPath.node.value;
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
        textPrefix = focusPath.node.value;
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

    const addonResults = await queryELSAddonsAPI(project.providers.completionProviders, root, {
      focusPath,
      completions,
      textDocument: params.textDocument,
      position: params.position,
      server: this.server,
      type: 'script'
    });

    return filter(uniqBy([...completions, ...addonResults], 'label'), textPrefix, {
      key: 'label',
      maxResults: 40
    });
  }
}
