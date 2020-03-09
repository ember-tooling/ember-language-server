import { Diagnostic, Files, TextDocument } from 'vscode-languageserver';
import { getExtension } from './utils/file-extension';
import { toDiagnostic } from './utils/diagnostic';
import { searchAndExtractHbs } from 'extract-tagged-template-literals';
import { uriToFilePath } from 'vscode-languageserver/lib/files';
import { log, logError } from './utils/logger';
import * as findUp from 'find-up';
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

const extensionsToLint: string[] = ['.hbs', '.js', '.ts'];

function setCwd(cwd: string) {
  try {
    process.chdir(cwd);
  } catch (err) {
    logError(`chdir: ${err.toString()}`);
  }
}
export default class TemplateLinter {
  private _linterCache = new Map<Project, any>();

  constructor(private server: Server) {}

  async lint(textDocument: TextDocument) {
    const ext = getExtension(textDocument);

    if (ext !== null && !extensionsToLint.includes(ext)) {
      return;
    }

    const cwd = process.cwd();
    const project = this.server.projectRoots.projectForUri(textDocument.uri);

    if (!project) {
      return;
    }

    const documentContent = textDocument.getText();
    const source = ext === '.hbs' ? documentContent : searchAndExtractHbs(documentContent);
    if (!source.trim().length) {
      return;
    }

    const TemplateLinter = await this.getLinter(project);

    let linter = null;
    try {
      setCwd(project.root);
      linter = new TemplateLinter();
    } catch (e) {
      setCwd(cwd);
      return;
    }

    const errors = linter.verify({
      source,
      moduleId: uriToFilePath(textDocument.uri),
      filePath: uriToFilePath(textDocument.uri)
    });

    setCwd(cwd);

    const diagnostics: Diagnostic[] = errors.map((error: TemplateLinterError) => toDiagnostic(source, error));

    return diagnostics;
  }
  private templateLintConfig(cwd: string) {
    return findUp.sync('.template-lintrc.js', { cwd });
  }
  private async getLinter(project: Project) {
    if (this._linterCache.has(project)) {
      return this._linterCache.get(project);
    }

    try {
      // don't resolve template-lint (due to resolution error) if no linter config found;
      if (!this.templateLintConfig(project.root)) {
        return;
      }
      let nodePath = Files.resolveGlobalNodePath();
      if (!nodePath) {
        return;
      }
      // vs-code-online fix (we don't have global path, but it returned)
      if (!fs.existsSync(nodePath)) {
        // easy fix case
        nodePath = 'node_modules';
        if (!fs.existsSync(path.join(project.root, nodePath))) {
          return;
        }
      }
      const linterPath = await (Files.resolveModulePath(project.root, 'ember-template-lint', nodePath, () => {}) as Promise<any>);
      if (!linterPath) {
        return;
      }
      const linter = require(linterPath);
      this._linterCache.set(project, linter);
      return linter;
    } catch (error) {
      log('Module ember-template-lint not found.');
    }
  }
}
