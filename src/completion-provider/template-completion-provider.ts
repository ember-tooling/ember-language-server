import { CompletionItem, TextDocumentPositionParams, Position, TextDocumentIdentifier } from 'vscode-languageserver';
import Server from '../server';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { filter } from 'fuzzaldrin';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import { preprocess } from '@glimmer/syntax';
import { getExtension } from '../utils/file-extension';
import { log, logInfo } from '../utils/logger';
import { searchAndExtractHbs } from '@lifeart/ember-extract-inline-templates';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position as EsTreePosition } from 'estree';
import { parseScriptFile } from 'ember-meta-explorer';

const extensionsToProvideTemplateCompletions = ['.hbs', '.js', '.ts'];
const PLACEHOLDER = 'ELSCompletionDummy';

export default class TemplateCompletionProvider {
  constructor(private server: Server) {}
  getTextForGuessing(originalText: string, offset: number, PLACEHOLDER: string) {
    log('getTextForGuessing', originalText, offset, PLACEHOLDER);

    return originalText.slice(0, offset) + PLACEHOLDER + originalText.slice(offset);
  }
  getRoots(doc: TextDocumentIdentifier) {
    const project = this.server.projectRoots.projectForUri(doc.uri);
    const document = this.server.documents.get(doc.uri);

    return {
      project,
      document,
    };
  }
  getAST(textContent: string) {
    return preprocess(textContent);
  }
  createFocusPath(ast: any, position: EsTreePosition, validText: string) {
    return ASTPath.toPosition(ast, position, validText);
  }
  getFocusPath(
    document: TextDocument,
    position: Position,
    placeholder = PLACEHOLDER
  ): null | {
    focusPath: ASTPath;
    originalText: string;
    normalPlaceholder: string;
    ast: any;
  } {
    const documentContent = document.getText();
    const ext = getExtension(document);

    if (!extensionsToProvideTemplateCompletions.includes(ext as string)) {
      return null;
    }

    const originalText =
      ext === '.hbs'
        ? documentContent
        : searchAndExtractHbs(documentContent, {
            parse(source: string) {
              return parseScriptFile(source);
            },
          });

    log('originalText', originalText);

    if (originalText.trim().length === 0) {
      log('originalText - empty');

      return null;
    }

    const offset = document.offsetAt(position);
    let normalPlaceholder: any = placeholder;
    let ast: any = {};

    const cases = [
      PLACEHOLDER + ' />',
      PLACEHOLDER,
      PLACEHOLDER + '"',
      PLACEHOLDER + "'",
      // block params autocomplete
      PLACEHOLDER + '| />',
      PLACEHOLDER + '}} />',
      PLACEHOLDER + '"}}',
      PLACEHOLDER + '}}',
      PLACEHOLDER + '}}{{/' + PLACEHOLDER + '}}',
      // {{#}} -> {{# + P}}{{/P + }}
      PLACEHOLDER + '}}{{/' + PLACEHOLDER,
      PLACEHOLDER + ')}}',
      PLACEHOLDER + '))}}',
      PLACEHOLDER + ')))}}',
    ];

    let validText = '';

    while (cases.length) {
      normalPlaceholder = cases.shift();

      try {
        validText = this.getTextForGuessing(originalText, offset, normalPlaceholder);
        ast = this.getAST(validText);
        log('validText', validText);
        break;
      } catch (e) {
        log('parsing-error', this.getTextForGuessing(originalText, offset, normalPlaceholder));
        ast = null;
      }
    }

    log('ast must exists');

    if (ast === null) {
      return null;
    }

    const focusPath = this.createFocusPath(ast, toPosition(position), validText);

    if (!focusPath) {
      return null;
    }

    return {
      ast,
      focusPath,
      originalText,
      normalPlaceholder,
    };
  }
  async provideCompletions(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
    log('template:provideCompletions');
    const ext = getExtension(params.textDocument);

    if (ext !== null && !extensionsToProvideTemplateCompletions.includes(ext)) {
      log('template:provideCompletions:unsupportedExtension', ext);

      return [];
    }

    const position = params.position;
    const { project, document } = this.getRoots(params.textDocument);

    if (!project || !document) {
      logInfo(`No project for file: ${params.textDocument.uri}`);

      return [];
    }

    const { root } = project;
    const results = this.getFocusPath(document, position, PLACEHOLDER);

    if (!results) {
      return [];
    }

    const focusPath = results.focusPath;
    const originalText = results.originalText;
    const normalPlaceholder = results.normalPlaceholder;

    const completions: CompletionItem[] = await queryELSAddonsAPIChain(project.builtinProviders.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position: params.position,
      results: [],
      server: this.server,
      type: 'template',
      originalText,
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.completionProviders, root, {
      focusPath,
      textDocument: params.textDocument,
      position: params.position,
      results: completions,
      server: this.server,
      type: 'template',
    });
    const textPrefix = getTextPrefix(focusPath, normalPlaceholder);
    const endCharacterPosition = position.character;

    if (textPrefix.length) {
      // eslint-disable-next-line
      position.character -= textPrefix.length;
    }

    return filter(addonResults, textPrefix, {
      key: 'label',
      maxResults: 40,
    }).map((rawEl: CompletionItem) => {
      const el = Object.assign({}, rawEl);

      if (el.textEdit) {
        return el;
      }

      const endPosition = {
        line: position.line,
        character: endCharacterPosition,
      };
      const shouldFixContent = normalPlaceholder.includes('}}{{');

      el.textEdit = {
        newText: shouldFixContent ? normalPlaceholder.split(PLACEHOLDER).join(el.label).replace('}}{{', '}}\n  \n{{') : el.label,
        range: {
          start: position,
          end: endPosition,
        },
      };

      return el;
    });
  }
}

function getTextPrefix(astPath: ASTPath, normalPlaceholder: string): string {
  let node = astPath.node;

  if (node === undefined) {
    return normalPlaceholder;
  }

  // handle block params autocomplete case
  if (node.type === 'ElementNode' || node.type === 'BlockStatement') {
    const meta = astPath.metaForType('handlebars');
    const maybeBlockDefenition = meta && meta.maybeBlockParamDefinition;

    if (maybeBlockDefenition) {
      node = maybeBlockDefenition;
    }
  }

  const target = node.original || node.tag || node.name || node.chars || '';

  return target.replace(normalPlaceholder, '').replace(PLACEHOLDER, '');
}
