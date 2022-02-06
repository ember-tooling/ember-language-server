import { CompletionItem, TextDocumentPositionParams, TextEdit, Position, InsertTextFormat } from 'vscode-languageserver/node';
import Server from '../server';
import ASTPath from '../glimmer-utils';
import { Project } from '../project';
import { getFileRanges, RangeWalker, getPlaceholderPathFromAst, getScope, documentPartForPosition } from '../utils/glimmer-script';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import { getFocusPath } from '../utils/glimmer-template';
import { TextDocument } from 'vscode-languageserver-textdocument';
// @ts-expect-error es module import
import * as camelCase from 'lodash/camelCase';
import * as path from 'path';
export default class GlimmerScriptCompletionProvider {
  constructor(private server: Server) {}
  async provideCompletions(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
    const document = this.server.documents.get(params.textDocument.uri);

    if (!document) {
      return [];
    }

    const rawContent = document.getText();

    const ranges = getFileRanges(rawContent);

    let rangeWalker = new RangeWalker(ranges);

    // strip not needed scopes example
    rangeWalker = rangeWalker.subtract(rangeWalker.hbsInlineComments(true));
    rangeWalker = rangeWalker.subtract(rangeWalker.hbsComments(true));
    rangeWalker = rangeWalker.subtract(rangeWalker.htmlComments(true));

    const templates = rangeWalker.templates(true);

    const cleanScriptWalker = rangeWalker.subtract(templates, true);

    const templateForPosition = documentPartForPosition(templates, params.position);

    if (templateForPosition) {
      const results: CompletionItem[] = [];
      let scopes: string[] = [];

      try {
        const ast = parse(cleanScriptWalker.content, {
          sourceType: 'module',
        });
        const placeholder = getPlaceholderPathFromAst(ast, templateForPosition.key);

        if (!placeholder) {
          return [];
        }

        scopes = getScope(placeholder.scope);
      } catch (e) {
        // oops
      }

      scopes.forEach((name) => {
        results.push({
          label: name,
        });
      });

      const synthDoc = TextDocument.create(document.uri, 'handlebars', document.version, templateForPosition.absoluteContent);
      const info = getFocusPath(synthDoc, params.position);

      if (!info) {
        return results;
      }

      const project = this.server.projectRoots.projectForUri(params.textDocument.uri);

      if (!project) {
        return results;
      }

      const legacyResults = await this.server.templateCompletionProvider.provideCompletionsForFocusPath(info, params.textDocument, params.position, project);

      legacyResults.forEach((result) => {
        results.push(this.transformLegacyResult(result, scopes, params.position, info.focusPath, project));
      });

      return results;
      // do logic to get more meta from js scope for template position
      // here we need glimmer logic to collect all available tokens from scope for autocomplete
    } else {
      return [];
    }
  }
  transformLegacyResult(result: CompletionItem, scopes: string[], position: Position, focusPath: ASTPath, project: Project): CompletionItem {
    if (!result.data?.files?.length) {
      return result;
    }

    const scripts: string[] = result.data.files.filter((f: string) => {
      const e = project.matchPathToType(f);

      return e && e.kind === 'script';
    });
    const script = scripts.find((e) => project.matchPathToType(e)?.scope === 'application');

    if (!script) {
      return result;
    }

    let p = path.relative(project.root, script).replace('app', project.name).replace('.js', '').replace('.ts', '').split('\\').join('/');

    if (p.endsWith('/index')) {
      p = p.replace('/index', '');
    }

    const name = result.label.includes('::') ? result.label.split('::').pop() : camelCase(result.label);

    if (!name) {
      return result;
    }

    if (scopes.includes(name)) {
      return result;
    }

    result.insertTextFormat = InsertTextFormat.Snippet;
    result.detail = `(${result.label}) ${result.detail || ''}`.trim();
    result.label = name;
    result.additionalTextEdits = [TextEdit.insert(Position.create(0, 0), `import ${name} from '${p}';\n`)];

    const loc = focusPath.node.loc.toJSON();

    result.textEdit = TextEdit.insert(Position.create(position.line, loc.start.column), name);

    return result;
  }
}
