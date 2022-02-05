/* eslint-disable @typescript-eslint/no-unused-vars */
import Server from './../server';
import ASTPath from './../glimmer-utils';
import { TextDocumentPositionParams, Definition, Location } from 'vscode-languageserver/node';
import { parseScriptFile as parse } from 'ember-meta-explorer';
import { containsPosition, toPosition } from './../estree-utils';
import { queryELSAddonsAPIChain } from './../utils/addon-api';
import { Project } from '../project';
import { getFileRanges, RangeWalker } from '../utils/glimmer-script';

export default class GlimmerScriptDefinitionProvider {
  constructor(private server: Server) {}
  async handle(params: TextDocumentPositionParams, project: Project): Promise<Definition | null> {
    const uri = params.textDocument.uri;
    const { root } = project;
    const document = this.server.documents.get(uri);

    if (!document) {
      return null;
    }

    const content = document.getText();

    const ranges = getFileRanges(content);

    let rangeWalker = new RangeWalker(ranges);

    // strip not needed scopes example
    rangeWalker = rangeWalker.subtract([...rangeWalker.hbsInlineComments(true), ...rangeWalker.hbsComments(true)]);
    rangeWalker = rangeWalker.subtract(rangeWalker.htmlComments(true));

    const templates = rangeWalker.templates(true);

    const cleanScript = rangeWalker.subtract(templates);

    const templateForPosition = templates.find((el) => {
      return containsPosition(
        {
          start: {
            line: el.loc.start.line,
            column: el.loc.start.character,
          },
          end: {
            line: el.loc.end.line,
            column: el.loc.end.character,
          },
        },
        toPosition(params.position)
      );
    });

    if (templateForPosition) {
      // do logic to get more meta from js scope for template position
      // here we need glimmer logic to collect all available tokens from scope for autocomplete
    } else {
      // looks like we could "fix" template and continue in script branch;
    }
    // @to-do - figure out how to patch babel ast with hbs
    // or don't patch it, and just have 2 refs from hbs ast to scope of js ast

    const ast = parse(cleanScript.content, {
      sourceType: 'module',
    });

    const astPath = ASTPath.toPosition(ast, toPosition(params.position), content);

    if (!astPath) {
      return null;
    }

    const results: Location[] = await queryELSAddonsAPIChain(project.builtinProviders.definitionProviders, root, {
      focusPath: astPath,
      type: 'glimmerScript',
      textDocument: params.textDocument,
      position: params.position,
      results: [],
      server: this.server,
    });

    const addonResults = await queryELSAddonsAPIChain(project.providers.definitionProviders, root, {
      focusPath: astPath,
      type: 'glimmerScript',
      textDocument: params.textDocument,
      position: params.position,
      results,
      server: this.server,
    });

    return addonResults;
  }
}
