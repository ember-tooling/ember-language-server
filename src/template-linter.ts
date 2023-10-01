import { Diagnostic, Files } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getExtension } from './utils/file-extension';
import { toDiagnostic, toHbsSource } from './utils/diagnostic';
import { getTemplateNodes } from '@lifeart/ember-extract-inline-templates';
import { parseScriptFile } from 'ember-meta-explorer';
import { URI } from 'vscode-uri';
import { log, logError, logDebugInfo } from './utils/logger';
import { pathToFileURL } from 'url';

import Server from './server';
import { Project } from './project';
import { getRequireSupport } from './utils/layout-helpers';
import { getFileRanges, RangeWalker } from './utils/glimmer-script';

type FindUp = (name: string, opts: { cwd: string; type: string }) => Promise<string | undefined>;
type LinterVerifyArgs = { source: string; moduleId: string; filePath: string };
class Linter {
  constructor() {
    return this;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verify(_params: LinterVerifyArgs): TemplateLinterError[] {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyAndFix(_params: LinterVerifyArgs): { isFixed: boolean; output: string } {
    return {
      output: '',
      isFixed: true,
    };
  }
}

export interface TemplateLinterError {
  fatal?: boolean;
  moduleId: string;
  rule?: string;
  filePath: string;
  severity: number;
  message: string;
  isFixable?: boolean;
  line?: number;
  column?: number;
  source?: string;
}

const extensionsToLint: string[] = ['.hbs', '.js', '.ts', '.gts', '.gjs'];

function setCwd(cwd: string) {
  try {
    process.chdir(cwd);
  } catch (err) {
    logError(err);
  }
}

export default class TemplateLinter {
  private _linterCache = new Map<Project, typeof Linter>();
  private _isEnabled = true;
  private _findUp: FindUp;

  constructor(private server: Server) {
    if (this.server.options.type === 'worker') {
      this.disable();
    }
  }

  disable() {
    this._isEnabled = false;
  }

  enable() {
    this._isEnabled = true;
  }

  get isEnabled() {
    return this._isEnabled;
  }

  private getProjectForDocument(textDocument: TextDocument) {
    const ext = getExtension(textDocument);

    if (ext !== null && !extensionsToLint.includes(ext)) {
      return;
    }

    return this.server.projectRoots.projectForUri(textDocument.uri);
  }

  private sourcesForDocument(textDocument: TextDocument, templateLintVersion: string): string[] {
    const ext = getExtension(textDocument);

    if (ext !== null && !extensionsToLint.includes(ext)) {
      return [];
    }

    const documentContent = textDocument.getText();

    // we assume that ember-template-lint v5 could handle js/ts/gts/gjs files

    if (templateLintVersion === '5') {
      return [documentContent];
    }

    if (ext === '.hbs') {
      if (documentContent.trim().length === 0) {
        return [];
      } else {
        return [documentContent];
      }
    } else if (ext === '.gjs' || ext === '.gts') {
      const ranges = getFileRanges(documentContent);

      const rangeWalker = new RangeWalker(ranges);
      const templates = rangeWalker.templates();

      return templates.map((t) => {
        return toHbsSource({
          startLine: t.loc.start.line,
          startColumn: t.loc.start.character,
          endColumn: t.loc.end.character,
          endLine: t.loc.end.line,
          template: t.content,
        });
      });
    } else {
      const nodes = getTemplateNodes(documentContent, {
        parse(source: string) {
          return parseScriptFile(source);
        },
      });
      const sources = nodes.filter((el) => {
        return el.template.trim().length > 0;
      });

      return sources.map((el) => {
        return toHbsSource(el);
      });
    }
  }
  async lint(textDocument: TextDocument): Promise<Diagnostic[] | undefined> {
    if (this._isEnabled === false) {
      return;
    }

    const cwd = process.cwd();
    const project = this.getProjectForDocument(textDocument);

    if (!project) {
      return;
    }

    const linterMeta = project.dependenciesMeta.find((dep) => dep.name === 'ember-template-lint');
    const linterVersion = linterMeta?.version.split('.')[0] || 'unknown';

    let sources = [];

    try {
      sources = this.sourcesForDocument(textDocument, linterVersion);
    } catch (e) {
      return;
    }

    if (!sources.length) {
      return;
    }

    const TemplateLinterKlass = await this.getLinter(project);

    if (!TemplateLinterKlass) {
      return;
    }

    let linter: Linter;

    try {
      setCwd(project.root);
      linter = new TemplateLinterKlass();
    } catch (e) {
      try {
        setCwd(cwd);
      } catch (e) {
        logDebugInfo(e.stack);
      }

      return;
    }

    let diagnostics: Diagnostic[] = [];

    try {
      const results = await Promise.all(
        sources.map(async (source) => {
          const errors = await Promise.resolve(
            linter.verify({
              source,
              moduleId: URI.parse(textDocument.uri).fsPath,
              filePath: URI.parse(textDocument.uri).fsPath,
            })
          );

          return errors.map((error: TemplateLinterError) => toDiagnostic(source, error));
        })
      );

      results.forEach((result) => {
        diagnostics = [...diagnostics, ...result];
      });
    } catch (e) {
      logError(e);
    }

    try {
      setCwd(cwd);
    } catch (e) {
      logDebugInfo(e.stack);
    }

    return diagnostics;
  }
  async getFindUp(): Promise<FindUp> {
    if (!this._findUp) {
      const { findUp } = await eval(`import('find-up')`);

      this._findUp = findUp;
    }

    return this._findUp;
  }
  private async templateLintConfig(cwd: string): Promise<string | undefined> {
    const findUp = await this.getFindUp();

    return findUp('.template-lintrc.js', { cwd, type: 'file' });
  }
  private async projectNodeModules(cwd: string): Promise<string | undefined> {
    const findUp = await this.getFindUp();

    return findUp('node_modules', { cwd, type: 'directory' });
  }
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  public async linterForProject(project: Project) {
    return await this.getLinter(project);
  }
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  private async getLinter(project: Project): Promise<typeof Linter | undefined> {
    if (this._linterCache.has(project)) {
      return this._linterCache.get(project);
    }

    try {
      // don't resolve template-lint (due to resolution error) if no linter config found;
      if (!(await this.templateLintConfig(project.root))) {
        return;
      }

      if (!getRequireSupport()) {
        return;
      }

      const nodePath = await this.projectNodeModules(project.root);

      if (!nodePath || !(await this.server.fs.exists(nodePath))) {
        return;
      }

      const linterPath = await (Files.resolveModulePath(project.root, 'ember-template-lint', nodePath, () => {
        /* intentionally empty default callback */
      }) as Promise<string>);

      if (!linterPath) {
        return;
      }

      try {
        // commonjs behavior

        // @ts-expect-error @todo - fix webpack imports
        const requireFunc = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const linter: typeof Linter = requireFunc(linterPath);

        this._linterCache.set(project, linter);

        return linter;
      } catch {
        // ember-template-lint v4 support (as esm module)
        // using eval here to stop webpack from bundling it
        const linter: typeof Linter = (await eval(`import("${pathToFileURL(linterPath)}")`)).default;

        this._linterCache.set(project, linter);

        return linter;
      }
    } catch (error) {
      log('Module ember-template-lint not found. ' + error.toString());
    }
  }
}
