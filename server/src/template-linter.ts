import { Diagnostic, DiagnosticSeverity, Files, TextDocument } from 'vscode-languageserver';
import { uriToFilePath } from 'vscode-languageserver/lib/files';

import * as path from 'path';
import * as fs from 'fs';

import Server from './server';

export default class TemplateLinter {

  private _linter: any = {};

  constructor(private server: Server) {}

  async lint(textDocument: TextDocument) {
    if (textDocument.languageId !== 'handlebars') {
      return;
    }

    const config = this.getLinterConfig(textDocument.uri);

    if (!config) {
      return;
    }

    const TemplateLinter = await this.getLinter(textDocument.uri);
    const linter = new TemplateLinter(config);

    const errors = linter.verify({
      source: textDocument.getText(),
      moduleId: textDocument.uri
    });

    const diagnostics: Diagnostic[] = errors.map((error: any) => {
      return {
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: error.line - 1, character: error.column },
          end: { line: error.line - 1, character: error.column + 1 }
        },
        message: error.message,
        source: 'ember-template-lint'
      };
    });

    this.server.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  private getLinterConfig(uri: string): { configPath: string } | undefined {
    const filePath = uriToFilePath(uri);
    const rootPath = this.server.projectRoots.rootForPath(filePath);

    if (!rootPath) {
      return;
    }

    const configPath = path.join(rootPath, '.template-lintrc.js');

    if (!fs.existsSync(configPath)) {
      return;
    }

    return {
      configPath
    };
  }

  private async getLinter(uri: string) {
    const filePath = uriToFilePath(uri);
    const rootPath = this.server.projectRoots.rootForPath(filePath);

    if (!rootPath) {
      return;
    }

    if (this._linter[rootPath]) {
      return this._linter;
    }

    return Files.resolveModule(rootPath, 'ember-template-lint')
      .then(resolvedLinter => {
        this._linter[rootPath] = resolvedLinter;

        return resolvedLinter;
      }, () => {
        console.log('Module ember-template-lint not found.');
      });
  }
}
