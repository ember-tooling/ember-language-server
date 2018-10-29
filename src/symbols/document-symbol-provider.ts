import { SymbolInformation } from 'vscode-languageserver';

interface DocumentSymbolProvider {
  /**
   * Supported file extensions.
   * @example ['.html', '.js', '.ts']
   */
  extensions: string[];

  process(content: string): SymbolInformation[];
}

export default DocumentSymbolProvider;
