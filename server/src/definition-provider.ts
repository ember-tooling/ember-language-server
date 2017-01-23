import { RequestHandler, TextDocumentPositionParams, Definition } from 'vscode-languageserver';

export default class DefinitionProvider {
  handle(params: TextDocumentPositionParams): Definition {
    console.log(params);
    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }
}
