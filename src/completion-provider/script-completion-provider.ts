import { CompletionItem, TextDocumentPositionParams } from 'vscode-languageserver/node';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';
import { parseScriptFile as parse } from 'ember-meta-explorer';
// @ts-expect-error esmodule
import * as uniqBy from 'lodash/uniqBy';
import { getExtension } from '../utils/file-extension';
import { logDebugInfo } from '../utils/logger';
import GlimmerScriptCompletionProvider from './glimmer-script-completion-provider';

export default class ScriptCompletionProvider {
  constructor(private server: Server) {}
  async provideCompletions(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
    logDebugInfo('provideCompletions');

    const ext = getExtension(params.textDocument) as string;

    if (!['.js', '.ts', '.gjs', '.gts'].includes(ext)) {
      return [];
    }

    if (ext === '.gts' || ext === '.gjs') {
      // temporary workaround
      return new GlimmerScriptCompletionProvider(this.server).provideCompletions(params);
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

    const focusPath = ASTPath.toPosition(ast, toPosition(params.position), content) as any;

    if (!focusPath || !project || !document) {
      return [];
    }

    let textPrefix = focusPath.node.value || '';

    // it's likely hbs template literal, no specific prefix to autocomplete
    if (focusPath.node.type === 'TemplateElement') {
      textPrefix = '';
    }

    if (typeof textPrefix !== 'string') {
      if (textPrefix.raw) {
        textPrefix = textPrefix.raw || '';
      } else {
        textPrefix = '';
      }
    }

    const position = Object.freeze({ ...params.position });

    const completions: CompletionItem[] = await queryELSAddonsAPIChain(project.builtinProviders.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position,
      server: this.server,
      results: [],
      type: 'script',
    });

    const addonResults: CompletionItem[] = await queryELSAddonsAPIChain(project.providers.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position,
      server: this.server,
      results: completions,
      type: 'script',
    });

    return filter(uniqBy(addonResults, 'label'), textPrefix, {
      key: 'label',
      maxResults: 40,
    });
  }
}
