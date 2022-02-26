import TemplateFoldingProvider from './template-folding-provider';
import { FoldingRangeParams, FoldingRange } from 'vscode-languageserver';
import { Server } from '..';
import { getFileRanges, RangeWalker } from '../utils/glimmer-script';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { searchAndExtractHbs } from '@lifeart/ember-extract-inline-templates';
import { parseScriptFile } from 'ember-meta-explorer';

export default class FoldingProvider {
  isEnabled = true;
  constructor(private server: Server) {}
  private templateFoldingProvider = new TemplateFoldingProvider();
  enable() {
    this.isEnabled = true;
  }
  disable() {
    this.isEnabled = false;
  }
  onFoldingRanges(params: FoldingRangeParams): FoldingRange[] | null {
    if (!this.isEnabled) {
      return null;
    }

    const document = this.server.documents.get(params.textDocument.uri);

    if (!document) {
      return null;
    }

    if (document.uri.endsWith('.hbs')) {
      try {
        return this.templateFoldingProvider.handle(document);
      } catch (e) {
        return null;
      }
    } else if (document.uri.endsWith('.gts') || document.uri.endsWith('.gjs')) {
      try {
        const ranges = getFileRanges(document.getText());
        const templatesData = new RangeWalker(ranges).templates(true);
        const documents = templatesData.map((tpl) => TextDocument.create(document.uri, 'handlebars', document.version, tpl.absoluteContent));
        const results: FoldingRange[] = [];

        documents.forEach((d) => {
          this.templateFoldingProvider.handle(d).forEach((result) => {
            results.push(result);
          });
        });

        return results;
      } catch (e) {
        return null;
      }
    } else if (document.uri.endsWith('.js') || document.uri.endsWith('.ts')) {
      try {
        const text = searchAndExtractHbs(document.getText(), {
          parse(source: string) {
            return parseScriptFile(source);
          },
        });

        return this.templateFoldingProvider.handle(TextDocument.create(document.uri, 'handlebars', document.version, text));
      } catch (e) {
        return null;
      }
    }

    return null;
  }
}
