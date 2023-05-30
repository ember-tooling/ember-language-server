import { Position } from 'vscode-languageserver/node';
import ASTPath from '../glimmer-utils';
import { toPosition } from '../estree-utils';
import { getExtension } from '../utils/file-extension';
import { logDebugInfo, logInfo } from '../utils/logger';
import { searchAndExtractHbs } from '@lifeart/ember-extract-inline-templates';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseScriptFile } from 'ember-meta-explorer';
import { preprocess, ASTv1 } from '@glimmer/syntax';
import { Position as EsTreePosition } from 'estree';
import HandlebarsFixer from '../ai/handlebars-fixer';

export const PLACEHOLDER = 'ELSCompletionDummy';
export const extensionsToProvideTemplateCompletions = ['.hbs', '.js', '.ts', '.gjs', '.gts'];

export function getTextForGuessing(originalText: string, offset: number, PLACEHOLDER: string) {
  // logDebugInfo('getTextForGuessing', originalText, offset, PLACEHOLDER);

  return originalText.slice(0, offset) + PLACEHOLDER + originalText.slice(offset);
}

export function createFocusPath(ast: ASTv1.Template, position: EsTreePosition, validText: string) {
  return ASTPath.toPosition(ast, position, validText);
}

export async function getFocusPath(
  document: TextDocument,
  position: Position,
  placeholder = PLACEHOLDER,
  fixer: HandlebarsFixer
): Promise<null | {
  focusPath: ASTPath;
  originalText: string;
  normalPlaceholder: string;
  ast: ASTv1.Template;
}> {
  const documentContent = document.getText();
  const ext = getExtension(document);

  logInfo('ext:' + ext);
  logDebugInfo('placeholder' + placeholder);

  if (!extensionsToProvideTemplateCompletions.includes(ext as string)) {
    return null;
  }

  const isHBS = ext === '.hbs' || document.languageId === 'html' || document.languageId === 'handlebars' || document.languageId === 'html.handlebars';

  const originalText = isHBS
    ? documentContent
    : searchAndExtractHbs(documentContent, {
        parse(source: string) {
          return parseScriptFile(source);
        },
      });

  logDebugInfo('originalText', originalText);

  if (originalText.trim().length === 0) {
    logDebugInfo('originalText - empty');

    return null;
  }

  const offset = document.offsetAt(position);
  let ast: ASTv1.Template | null = null;

  let validText = '';

  try {
    logInfo('fixer.fix');
    validText = await fixer.fix(getTextForGuessing(originalText, offset, '$$'));

    try {
      ast = preprocess(validText.replace('$$', PLACEHOLDER));
    } catch (e) {
      logInfo(e.toString());
      logDebugInfo('fixer error2', e);
      ast = null;
    }
  } catch (e) {
    logInfo(e.toString());

    logDebugInfo('fixer error', e);
    ast = null;
  }

  if (ast === null) {
    return null;
  }

  const focusPath = createFocusPath(ast, toPosition(position), validText);

  if (!focusPath) {
    return null;
  }

  return {
    ast,
    focusPath,
    originalText,
    normalPlaceholder: PLACEHOLDER,
  };
}
