import { Diagnostic, Files, TextDocument } from 'vscode-languageserver';
import { hasExtension } from './utils/file-extension';
import { toDiagnostic } from './utils/diagnostic';

import * as path from 'path';
import * as fs from 'fs';

import Server from './server';
import { Project } from './project-roots';

export interface TemplateLinterError {
  fatal?: boolean;
  moduleId: string;
  rule?: string;
  severity: number;
  message: string;
  line?: number;
  column?: number;
  source?: string;
}

export default class TemplateLinter {

  private _linterCache = new Map<Project, any>();

  constructor(private server: Server) {}

  async lint(textDocument: TextDocument) {
    if (!hasExtension(textDocument, '.hbs')) {
      return;
    }

    const config = this.getLinterConfig(textDocument.uri);

    if (!config) {
      return;
    }

    const TemplateLinter = await this.getLinter(textDocument.uri);
    const linter = new TemplateLinter(config);

    const source = textDocument.getText();
    const filePath = textDocument.uri;
    const moduleId = filePath.slice(0, -4);

    const errors = linter.verify({ source, filePath, moduleId });

    const diagnostics: Diagnostic[] = errors.map((error: TemplateLinterError) =>
      toDiagnostic(source, error)
    );

    this.server.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  private getLinterConfig(uri: string): { configPath: string } | undefined {
    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return;
    }

    const configPath = path.join(project.root, '.template-lintrc.js');
    if (!fs.existsSync(configPath)) {
      return;
    }

    return { configPath };
  }

  private async getLinter(uri: string) {
    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return;
    }

    if (this._linterCache.has(project)) {
      return this._linterCache.get(project);
    }

    try {
      const linter = await (Files.resolveModule(project.root, 'ember-template-lint') as Promise<any>);
      this._linterCache.set(project, linter);
      return linter;
    } catch (error) {
      console.log('Module ember-template-lint not found.');
    }
  }
}
