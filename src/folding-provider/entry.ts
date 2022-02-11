import TemplateFoldingProvider from './template-folding-provider';
import { FoldingRangeParams, FoldingRange } from 'vscode-languageserver';
import { Server } from '..';

export default class FoldingProvider {
  constructor(private server: Server) {}
  private templateFoldingProvider = new TemplateFoldingProvider();
  onFoldingRanges(params: FoldingRangeParams): FoldingRange[] | null {
    const document = this.server.documents.get(params.textDocument.uri);

    if (!document) {
      return null;
    }

    if (document.languageId !== 'handlebars') {
      return null;
    }

    try {
      return this.templateFoldingProvider.handle(document);
    } catch (e) {
      return null;
    }
  }
}
