import * as flat from 'flat';
import { tokenize, parseTokens, AST } from 'json-parse-ast';
import * as path from 'path';
import * as YAML from 'yaml';
import { Location, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { Server } from '../..';
import { logDebugInfo } from '../../utils/logger';

type Translations = {
  locale: string;
  text: string;
  location?: Location;
};
type TranslationsHashMap = Record<string, Translations[]>;

type TranslationFile =
  | {
      type: 'json';
      json: unknown;
      jsonAst: AST;
    }
  | {
      type: 'yaml';
      json: unknown;
      yamlAst: YAML.ParsedNode;
      yamlLineCounter: YAML.LineCounter;
    }
  | Record<string, never>;

export async function getTranslations(root: string, server: Server): Promise<TranslationsHashMap> {
  const hashMap = {};
  const intlEntry = path.join(root, 'translations');

  const intlEntryExists = await server.fs.exists(intlEntry);

  if (intlEntryExists) {
    await recursiveIntlTranslationsSearch(server, hashMap, intlEntry);
  }

  return hashMap;
}

async function recursiveIntlTranslationsSearch(server: Server, hashMap: TranslationsHashMap, startPath: string) {
  const localizations = await server.fs.readDirectory(startPath);

  for (const [fileName] of localizations) {
    const extName = path.extname(fileName);
    const localization = path.basename(fileName, extName);
    const filePath = path.join(startPath, fileName);

    try {
      const fileStats = await server.fs.stat(filePath);

      if (fileStats.isDirectory()) {
        await recursiveIntlTranslationsSearch(server, hashMap, filePath);
      } else {
        const translationFile = await objFromFile(server, filePath);

        if (!translationFile.json) {
          return;
        }

        addToHashMap(hashMap, translationFile, localization, filePath);
      }
    } catch (e) {
      logDebugInfo('error', e);
    }
  }
}

async function objFromFile(server: Server, filePath: string): Promise<TranslationFile> {
  const ext = path.extname(filePath);

  if (ext === '.yaml') {
    const content = await server.fs.readFile(filePath);

    if (content === null) {
      return {};
    }

    const lineCounter = new YAML.LineCounter();
    const ast = YAML.parseDocument(content, { lineCounter }).contents;

    return { type: 'yaml', json: YAML.parse(content), yamlAst: ast as YAML.ParsedNode, yamlLineCounter: lineCounter };
  } else if (ext === '.json') {
    const content = await server.fs.readFile(filePath);

    if (content === null) {
      return {};
    }

    const ast = parseTokens(tokenize(content));

    return { type: 'json', json: JSON.parse(content), jsonAst: ast };
  }

  return {};
}

function addToHashMap(hash: TranslationsHashMap, translationFile: TranslationFile, locale: string, filePath: string) {
  const items: Record<string, string> = flat(translationFile.json);
  const extension = path.extname(filePath);

  Object.keys(items).forEach((p) => {
    if (!(p in hash)) {
      hash[p] = [];
    }

    const uri = URI.file(filePath).toString();
    let position;

    if (extension === '.json' && translationFile.type === 'json') {
      position = getPositionInJson(translationFile.jsonAst, p);
    } else if (extension === '.yaml' && translationFile.type === 'yaml') {
      position = getPositionInYaml(translationFile.yamlAst, p, translationFile.yamlLineCounter);
    }

    const startLine = position ? position.start.line - 1 : 0;
    const endLine = position ? position.end.line - 1 : 0;
    const startColumn = position ? position.start.column - 1 : 0;
    const endColumn = position ? position.end.column - 1 : 0;
    const range = Range.create(startLine, startColumn, endLine, endColumn);

    hash[p].push({ locale, text: items[p], location: Location.create(uri, range) });
  });
}

function getPositionInJson(ast: AST, path: string) {
  const keys = path.split('.');
  let keypos = 0;
  let position;

  function traverseJsonAst(node: AST): { key: AST; value: AST } | undefined {
    if (node.type === 'Object') {
      const entries = node.extractValues?.() as { key: AST; value: AST }[];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (entry.key.value === keys[keypos]) {
          keypos++;

          if (keypos === keys.length) {
            return entry;
          }

          return traverseJsonAst(entry.value);
        }
      }
    }
  }

  const jsonAstNode = traverseJsonAst(ast);
  const valuePosition = jsonAstNode?.value.position;
  const keyPosition = jsonAstNode?.key?.position;

  if (jsonAstNode && valuePosition && keyPosition) {
    position = {
      start: { line: keyPosition.startLineNumber, column: keyPosition.startColumn - 1 },
      end: { line: valuePosition.endLineNumber, column: valuePosition.endColumn - 1 },
    };
  }

  return position;
}

function getPositionInYaml(ast: YAML.ParsedNode, path: string, lineCounter: YAML.LineCounter) {
  const keys = path.split('.');
  let keypos = 0;
  let position;

  function traverseYamlAst(node: YAML.YAMLMap<YAML.Scalar, YAML.Scalar | YAML.YAMLMap>): { start?: number; end?: number } | void {
    for (let i = 0; i < node.items.length; i++) {
      const item: YAML.Pair<YAML.Scalar, YAML.Scalar | YAML.YAMLMap> = node.items[i];

      if (keys[keypos] === item.key.value) {
        keypos++;

        if (keypos === keys.length) {
          return { start: item.key.range?.[0], end: item.value?.range?.[1] };
        }

        return traverseYamlAst(item.value as YAML.YAMLMap<YAML.Scalar, YAML.Scalar | YAML.YAMLMap>);
      }
    }
  }

  const yamlPosition = traverseYamlAst(ast as YAML.YAMLMap<YAML.Scalar, YAML.Scalar | YAML.YAMLMap>);

  if (yamlPosition && yamlPosition.start != null && yamlPosition.end != null) {
    const startPos = lineCounter?.linePos(yamlPosition.start);
    const endPos = lineCounter?.linePos(yamlPosition.end);

    if (startPos && endPos) {
      position = {
        start: { line: startPos.line, column: startPos.col },
        end: { line: endPos.line, column: endPos.col },
      };
    }
  }

  return position;
}
