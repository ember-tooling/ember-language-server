import { CompletionItem, TextDocumentPositionParams, Position, TextDocumentIdentifier } from 'vscode-languageserver/node';
import Server from '../server';
import ASTPath, { BlockParamDefinition } from '../glimmer-utils';
import { filter } from 'fuzzaldrin';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import { preprocess, ASTv1 } from '@glimmer/syntax';
import { getExtension } from '../utils/file-extension';
import { logDebugInfo, logInfo } from '../utils/logger';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position as EsTreePosition } from 'estree';
import { createFocusPath, extensionsToProvideTemplateCompletions, getFocusPath, getTextForGuessing, PLACEHOLDER } from '../utils/glimmer-template';
import { Project } from '../project';

export default class TemplateCompletionProvider {
  constructor(private server: Server) {}
  getTextForGuessing(originalText: string, offset: number, PLACEHOLDER: string) {
    // logDebugInfo('getTextForGuessing', originalText, offset, PLACEHOLDER);
    return getTextForGuessing(originalText, offset, PLACEHOLDER);
  }
  getRoots(doc: TextDocumentIdentifier) {
    const project = this.server.projectRoots.projectForUri(doc.uri);
    const document = this.server.documents.get(doc.uri);

    return {
      project,
      document,
    };
  }
  getAST(textContent: string): ASTv1.Template {
    return preprocess(textContent);
  }
  createFocusPath(ast: any, position: EsTreePosition, validText: string) {
    return createFocusPath(ast, position, validText);
  }
  getFocusPath(document: TextDocument, position: Position, placeholder = PLACEHOLDER) {
    return getFocusPath(document, position, placeholder);
  }
  async provideCompletionsForFocusPath(
    results: { focusPath: any; originalText: string; normalPlaceholder: string },
    textDocument: TextDocumentIdentifier,
    position: Position,
    project: Project
  ) {
    const focusPath = results.focusPath;
    const originalText = results.originalText;
    const normalPlaceholder = results.normalPlaceholder;
    const root = project.root;

    const completions: CompletionItem[] = await queryELSAddonsAPIChain(project.builtinProviders.completionProviders, root, {
      focusPath,
      textDocument,
      position,
      results: [],
      server: this.server,
      type: 'template',
      originalText,
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.completionProviders, root, {
      focusPath,
      textDocument,
      position,
      results: completions,
      server: this.server,
      type: 'template',
    });
    const textPrefix = getTextPrefix(focusPath, normalPlaceholder);
    const alignedPosition = { ...position };
    const endCharacterPosition = position.character;

    if (textPrefix.length) {
      // eslint-disable-next-line
      alignedPosition.character -= textPrefix.length;
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
        line: alignedPosition.line,
        character: endCharacterPosition,
      };
      const shouldFixContent = normalPlaceholder.includes('}}{{');

      el.textEdit = {
        newText: shouldFixContent ? normalPlaceholder.split(PLACEHOLDER).join(el.label).replace('}}{{', '}}\n  \n{{') : el.label,
        range: {
          start: alignedPosition,
          end: endPosition,
        },
      };

      return el;
    });
  }
  async provideCompletions(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
    logDebugInfo('template:provideCompletions');
    const ext = getExtension(params.textDocument);

    // @to-do cleanup this creepy stuff (streamline autocomplete stuff);
    const extToHandle = extensionsToProvideTemplateCompletions.filter((e) => e !== '.gts' && e !== '.gjs');

    if (ext !== null && !extToHandle.includes(ext)) {
      logDebugInfo('template:provideCompletions:unsupportedExtension', ext);

      return [];
    }

    const position = Object.freeze({ ...params.position });
    const { project, document } = this.getRoots(params.textDocument);

    if (!project || !document) {
      logInfo(`No project for file: ${params.textDocument.uri}`);

      return [];
    }

    const results = this.getFocusPath(document, position, PLACEHOLDER);

    if (!results) {
      return [];
    }

    return this.provideCompletionsForFocusPath(results, params.textDocument, position, project);
  }
}

function getTextPrefix(astPath: ASTPath, normalPlaceholder: string): string {
  let node: BlockParamDefinition | ASTv1.Node = astPath.node as ASTv1.Node;

  if (node === undefined) {
    return normalPlaceholder;
  }

  // handle block params autocomplete case
  if (node.type === 'ElementNode' || node.type === 'BlockStatement') {
    const meta = astPath.metaForType('handlebars');
    const maybeBlockDefinition = meta && meta.maybeBlockParamDefinition;

    if (maybeBlockDefinition) {
      node = maybeBlockDefinition;
    }
  }

  let target = '';

  if ('original' in node) {
    target = String(node.original);
  } else if ('tag' in node) {
    target = node.tag;
  } else if ('name' in node) {
    target = String(node.name);
  } else if ('chars' in node) {
    target = node.chars;
  }

  return target.replace(normalPlaceholder, '').replace(PLACEHOLDER, '');
}
