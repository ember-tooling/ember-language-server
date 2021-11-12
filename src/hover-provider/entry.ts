import { preprocess } from '@glimmer/syntax';
import { parseScriptFile } from 'ember-meta-explorer';
import { Hover, HoverParams, Position, TextDocumentIdentifier } from 'vscode-languageserver';
import { toPosition } from '../estree-utils';
import ASTPath from '../glimmer-utils';
import Server from '../server';
import { isScriptPath, isTemplatePath } from '../utils/layout-helpers';
import { logDebugInfo } from '../utils/logger';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
export class HoverProvider {
  constructor(private server: Server) {}
  async provideHover({ textDocument, position }: HoverParams): Promise<Hover | null> {
    const project = this.server.projectRoots.projectForUri(textDocument.uri);

    if (!project) {
      return null;
    }

    const { focusPath, type } = this.getFocusPath(textDocument, position);

    if (!focusPath) {
      return null;
    }

    const internalResults = await queryELSAddonsAPIChain(project.builtinProviders.hoverProviders, project.root, {
      textDocument,
      focusPath,
      type,
      position,
      results: [],
      server: this.server,
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.hoverProviders, project.root, {
      textDocument,
      focusPath,
      type,
      position,
      results: internalResults,
      server: this.server,
    });

    if (addonResults.length) {
      return addonResults[0];
    }

    return null;
  }

  getFocusPath(textDocument: TextDocumentIdentifier, position: Position) {
    const project = this.server.projectRoots.projectForUri(textDocument.uri);

    if (!project) {
      return {};
    }

    const document = this.server.documents.get(textDocument.uri);
    const content = document?.getText();

    if (!content) {
      return {};
    }

    let ast = null;
    let type: 'script' | 'template';

    try {
      if (isScriptPath(textDocument.uri)) {
        ast = parseScriptFile(content);
        type = 'script';
      } else if (isTemplatePath(textDocument.uri)) {
        ast = preprocess(content);
        type = 'template';
      } else {
        return {};
      }
    } catch (e) {
      logDebugInfo('error', e);

      return {};
    }

    const focusPath = ASTPath.toPosition(ast, toPosition(position), content);

    return { focusPath, type };
  }
}
