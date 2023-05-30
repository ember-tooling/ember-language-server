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
import { MatchResult } from '../utils/path-matcher';
import HandlebarsFixer from '../ai/handlebars-fixer';
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
      const info = await getFocusPath(synthDoc, params.position, undefined, new HandlebarsFixer());

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

    const files = result.data.files;
    const meta: MatchResult[] = files.map((f: string) => {
      return project.matchPathToType(f);
    });

    const appScript = meta.find((e) => e.kind === 'script' && e.scope === 'application');
    const appTemplate = meta.find((e) => e.kind === 'template' && e.scope === 'application');
    const addonScript = meta.find((e) => e.kind === 'script' && e.scope === 'addon');
    const addonTemplate = meta.find((e) => e.kind === 'template' && e.scope === 'addon');

    const fileRef = appScript || appTemplate || addonScript || addonTemplate;

    if (!fileRef) {
      return result;
    }

    const file = files[meta.indexOf(fileRef)];

    result.data.resolvedFile = file;

    const fileProject = project.addonForFile(file);
    let p = '';

    if (fileProject) {
      p = `${fileProject.name}/${fileRef.type}s/${fileRef.name}`;
    } else {
      p = path.relative(project.root, file).split('\\').join('/').replace('app', project.name);
      p = p.replace('.js', '').replace('.ts', '').replace('.gjs', '').replace('.gts', '').replace('.hbs', '');
    }

    if (p.endsWith('/index')) {
      p = p.replace('/index', '');
    }

    let name = result.label;

    if (name.charAt(0).toUpperCase() === name.charAt(0)) {
      name = name.includes('::') ? (name.split('::').pop() as string) : name;

      if (name.includes('$')) {
        name = name.split('$').pop() as string;
      }
      // component
    } else {
      // helper, modifier
      name = camelCase(name);
    }

    if (!name) {
      return result;
    }

    if (scopes.includes(name)) {
      return result;
    }

    const importPath = p;

    result.insertTextFormat = InsertTextFormat.Snippet;
    result.detail = `(${result.label}) ${result.detail || ''}`.trim();
    result.documentation = `
      import ${name} from '${importPath}';

      ${result.documentation || ''}
    `.trim();
    result.label = name;
    result.additionalTextEdits = [TextEdit.insert(Position.create(0, 0), `import ${name} from '${importPath}';\n`)];

    const loc = focusPath.node.loc.toJSON();

    const startPosition = Position.create(position.line, loc.start.column);
    let prefix = ``;

    const source = focusPath.sourceForNode();

    if (source?.startsWith('{{')) {
      prefix = '{{';
    } else if (source?.startsWith('(')) {
      prefix = '(';
    } else if (source?.startsWith('<')) {
      prefix = '<';
    } else if (source?.startsWith('@')) {
      prefix = '@';
    }

    const txt = `${prefix}${name}`;
    const endPosition = Position.create(position.line, loc.start.column + txt.length);

    result.textEdit = TextEdit.replace(
      {
        start: startPosition,
        end: endPosition,
      },
      txt
    );

    return result;
  }
}
