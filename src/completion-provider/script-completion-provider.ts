import { CompletionItem, TextDocumentPositionParams } from 'vscode-languageserver';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import { uniqBy } from 'lodash';
import { getExtension } from '../utils/file-extension';
import { log } from '../utils/logger';

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

    let textPrefix = focusPath.node.value || '';
    if (typeof textPrefix !== 'string') {
      if (textPrefix.raw) {
        textPrefix = textPrefix.raw || '';
      } else {
        textPrefix = '';
      }
    }

    const completions: CompletionItem[] = await queryELSAddonsAPIChain(project.builtinProviders.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position: params.position,
      server: this.server,
      results: [],
      type: 'script'
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position: params.position,
      server: this.server,
      results: completions,
      type: 'script'
    });

    return filter(uniqBy(addonResults, 'label'), textPrefix, {
      key: 'label',
      maxResults: 40
    });
  }
}
