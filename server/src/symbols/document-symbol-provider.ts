import { SymbolInformation } from 'vscode-languageserver-types';

interface DocumentSymbolProvider {
  /**
   * Supported file extensions.
   * @example ['.html', '.js']
   */
  extensions: string[];

  process(content: string): SymbolInformation[];
}

export default DocumentSymbolProvider;
