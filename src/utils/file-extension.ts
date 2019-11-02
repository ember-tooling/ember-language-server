import * as path from 'path';
import { TextDocumentIdentifier } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

export function getExtension(textDocument: TextDocumentIdentifier): string | null {
  const filePath = uriToFilePath(textDocument.uri);
  const ext = filePath ? path.extname(filePath) : '';

  if (ext === '.handlebars') {
    return '.hbs';
  }
  return ext;
}

export function hasExtension(textDocument: TextDocumentIdentifier, ...extensions: string[]): boolean {
  const ext = getExtension(textDocument);

  return ext !== null && extensions.includes(ext);
}
