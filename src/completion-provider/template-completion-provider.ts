import { CompletionItem, TextDocumentPositionParams } from 'vscode-languageserver';
import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import { preprocess } from '@glimmer/syntax';
import { getExtension } from '../utils/file-extension';
import { log } from '../utils/logger';
import { searchAndExtractHbs } from 'extract-tagged-template-literals';

const extensionsToProvideTemplateCompletions = ['.hbs', '.js', '.ts'];
const PLACEHOLDER = 'ELSCompletionDummy';
export default class TemplateCompletionProvider {
  constructor(private server: Server) {}
  getTextForGuessing(originalText: string, offset: number, PLACEHOLDER: string) {
    return originalText.slice(0, offset) + PLACEHOLDER + originalText.slice(offset);
  }
  async provideCompletions(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
    log('provideCompletions');
    const ext = getExtension(params.textDocument);

    if (ext !== null && !extensionsToProvideTemplateCompletions.includes(ext)) {
      return [];
    }

    const uri = params.textDocument.uri;
    const project = this.server.projectRoots.projectForUri(uri);
    const document = this.server.documents.get(uri);
    if (!project || !document) {
      return [];
    }
    const { root } = project;
    const offset = document.offsetAt(params.position);
    const position = document.positionAt(offset);
    const documentContent = document.getText();
    const originalText = ext === '.hbs' ? documentContent : searchAndExtractHbs(documentContent);
    log('originalText', originalText);
    let normalPlaceholder: any = PLACEHOLDER;
    let ast: any = {};

    const cases = [
      PLACEHOLDER + ' />',
      PLACEHOLDER,
      PLACEHOLDER + '"',
      PLACEHOLDER + "'",
      PLACEHOLDER + '}} />',
      PLACEHOLDER + '"}}',
      PLACEHOLDER + '}}',
      PLACEHOLDER + '}}{{/' + PLACEHOLDER + '}}',
      // {{#}} -> {{# + P}}{{/P + }}
      PLACEHOLDER + '}}{{/' + PLACEHOLDER,
      PLACEHOLDER + ')}}',
      PLACEHOLDER + '))}}',
      PLACEHOLDER + ')))}}'
    ];

    while (cases.length) {
      normalPlaceholder = cases.shift();
      try {
        let validText = this.getTextForGuessing(originalText, offset, normalPlaceholder);
        ast = preprocess(validText);
        log('validText', validText);
        break;
      } catch (e) {
        log('parsing-error', this.getTextForGuessing(originalText, offset, normalPlaceholder));
        ast = null;
      }
    }
    log('ast must exists');
    if (ast === null) {
      return [];
    }

    const focusPath = ASTPath.toPosition(ast, toPosition(params.position));

    if (!focusPath) {
      return [];
    }

    const completions: CompletionItem[] = await queryELSAddonsAPIChain(project.builtinProviders.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position: params.position,
      results: [],
      server: this.server,
      type: 'template',
      originalText
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position: params.position,
      results: completions,
      server: this.server,
      type: 'template'
    });
    const textPrefix = getTextPrefix(focusPath, normalPlaceholder);
    const endCharacterPosition = position.character;
    if (textPrefix.length) {
      position.character -= textPrefix.length;
    }
    return filter(addonResults, textPrefix, {
      key: 'label',
      maxResults: 40
    }).map((rawEl: CompletionItem) => {
      const el = Object.assign({}, rawEl);
      if (el.textEdit) {
        return el;
      }
      let endPosition = {
        line: position.line,
        character: endCharacterPosition
      };
      const shouldFixContent = normalPlaceholder.includes('}}{{');
      el.textEdit = {
        newText: shouldFixContent
          ? normalPlaceholder
              .split(PLACEHOLDER)
              .join(el.label)
              .replace('}}{{', '}}\n  \n{{')
          : el.label,
        range: {
          start: position,
          end: endPosition
        }
      };
      return el;
    });
  }
}

function getTextPrefix({ node }: ASTPath, normalPlaceholder: string): string {
  let target = node.original || node.tag || node.name || node.chars || '';
  return target.replace(normalPlaceholder, '').replace(PLACEHOLDER, '');
}
