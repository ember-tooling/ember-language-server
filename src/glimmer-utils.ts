import { Position, SourceLocation } from 'estree';
import { containsPosition } from './estree-utils';
import { ASTv1 } from '@glimmer/syntax';

const reLines = /(.*?(?:\r\n?|\n|$))/gm;

function maybePathDeclaration(astPath: ASTPath) {
  if (isLocalScopedPathExpression(astPath)) {
    const scope = getLocalScope(astPath);
    const pathName = getLocalPathName(astPath.node);

    if (pathName) {
      const declaration = scope.find(({ name }) => name === pathName);

      if (!declaration) {
        return;
      }

      return declaration.path;
    }
  }
}

export function maybeComponentNameForPath(astPath: ASTPath) {
  const declaration = maybePathDeclaration(astPath);

  if (declaration && declaration.node.type === 'ElementNode') {
    return (declaration.node as ASTv1.ElementNode).tag;
  }
}

function getLocalPathName(node: any) {
  if (!node || node.type !== 'PathExpression' || !node.parts.length) {
    return undefined;
  }

  const pathName: string = node.parts[0];

  if (pathName === 'this') {
    return undefined;
  }

  return pathName;
}

export function isLocalScopedPathExpression(astPath: ASTPath) {
  const pathName = getLocalPathName(astPath.node);

  if (!pathName) {
    return false;
  }

  const scope = getLocalScope(astPath);
  const declarations = scope.filter(({ name }) => name === pathName);

  if (declarations.length) {
    return true;
  } else {
    return false;
  }
}

export function focusedBlockParamName(content: string, position: Position) {
  const source = content.match(reLines) as string[];
  const focusedLine = source[position.line - 1];
  let paramName = '';

  if (typeof focusedLine !== 'string') {
    return paramName;
  }

  const definitionStartIndex = focusedLine.indexOf('|');
  const definitionEndIndex = focusedLine.lastIndexOf('|');
  const column = position.column;

  if (definitionEndIndex >= column && definitionStartIndex <= column) {
    const lineParts = focusedLine.split('|');
    let localColIndex = lineParts[0].length + 1;
    const targetPart = lineParts[1];
    const targets = targetPart.split(' ');

    for (let i = 0; i < targets.length; i++) {
      const startIndex = localColIndex;
      const endIndex = startIndex + targets[i].length;

      if (column >= startIndex && column <= endIndex) {
        paramName = targets[i].trim();
        break;
      } else {
        localColIndex = endIndex + 1;
      }
    }

    return paramName;
  }

  return '';
}

class BlockParamDefinition {
  public type = 'BlockParam';
  public name: string;
  public path: ASTPath;
  constructor(name: string, path: ASTPath) {
    this.name = name;
    this.path = path;
  }
  get node() {
    return this.path.node;
  }
  get index(): number {
    const node = this.path.node;

    if (node.type === 'BlockStatement' && (node as ASTv1.BlockStatement).program) {
      return (node as ASTv1.BlockStatement).program.blockParams.indexOf(this.name);
    } else if (node.type === 'Block') {
      return (node as ASTv1.Block).blockParams.indexOf(this.name);
    } else if (node.type === 'ElementNode') {
      return (node as ASTv1.ElementNode).blockParams.indexOf(this.name);
    } else {
      return -1;
    }
  }
}

export function maybeBlockParamDefinition(astPath: ASTPath, content: string, position: Position): BlockParamDefinition | undefined {
  if (!isBlockParamDefinition(astPath, content, position)) {
    return;
  }

  const paramName = focusedBlockParamName(content, position);

  if (paramName === '') {
    return;
  }

  return new BlockParamDefinition(paramName, astPath);
}

export function isBlockParamDefinition(astPath: ASTPath, content: string, position: Position) {
  const node = astPath.node;

  if (node.type !== 'Block' && node.type !== 'BlockStatement' && node.type !== 'ElementNode') {
    return;
  }

  const source = content.match(reLines) as string[];
  const focusedLine = source[position.line - 1];

  if (focusedLine.lastIndexOf('|') > position.column && focusedLine.indexOf('|') < position.column) {
    return true;
  }
}

export function nodeLoc(node: ASTv1.BaseNode): SourceLocation {
  if ('toJSON' in node.loc) {
    return node.loc.toJSON();
  } else {
    return node.loc as SourceLocation;
  }
}

export function sourceForNode(node: ASTv1.BaseNode, content = '') {
  // mostly copy/pasta from ember-template-lint and tildeio/htmlbars with a few tweaks:
  // https://github.com/tildeio/htmlbars/blob/v0.14.17/packages/htmlbars-syntax/lib/parser.js#L59-L90
  // https://github.com/ember-template-lint/ember-template-lint/blob/v2.0.0-beta.3/lib/rules/base.js#L511

  if (!node || !node.loc) {
    return;
  }

  const loc = nodeLoc(node);

  const firstLine = loc.start.line - 1;
  const lastLine = loc.end.line - 1;
  let currentLine = firstLine - 1;
  const firstColumn = loc.start.column;
  const lastColumn = loc.end.column;
  const string = [];
  const source = content.match(reLines) as string[];

  if (currentLine > source.length) {
    return;
  }

  let line;

  while (currentLine < lastLine) {
    currentLine++;
    line = source[currentLine];

    if (currentLine === firstLine) {
      if (firstLine === lastLine) {
        string.push(line.slice(firstColumn, lastColumn));
      } else {
        string.push(line.slice(firstColumn));
      }
    } else if (currentLine === lastLine) {
      string.push(line.slice(0, lastColumn));
    } else {
      string.push(line);
    }
  }

  return string.join('');
}

export function getLocalScope(astPath: ASTPath) {
  const scopeValues: BlockParamDefinition[] = [];
  let cursor: ASTPath | undefined = astPath.parentPath;

  while (cursor) {
    const node = cursor.node;

    if (node && (node.type === 'ElementNode' || node.type === 'Block')) {
      const params = (node as ASTv1.ElementNode | ASTv1.Block).blockParams;

      params.forEach((param: string) => {
        scopeValues.push(new BlockParamDefinition(param, cursor as ASTPath));
      });
    }

    cursor = cursor.parentPath;
  }

  return scopeValues;
}

class HandlebarsASTPathMeta {
  constructor(private readonly astPath: ASTPath, private readonly position: Position, private readonly content: string) {}
  get maybeBlockParamDefinition() {
    return maybeBlockParamDefinition(this.astPath, this.content, this.position);
  }
  get maybeBlockParamDeclarationBlockPath() {
    return maybePathDeclaration(this.astPath);
  }
  get localScope() {
    return getLocalScope(this.astPath);
  }
}
export default class ASTPath {
  static toPosition(ast: any, position: Position, content = ''): ASTPath | undefined {
    const path = _findFocusPath(ast, position);

    if (path) {
      return new ASTPath(path, path.length - 1, content, position);
    }
  }

  private constructor(private readonly path: any[], private readonly index: number, private readonly content: string, private readonly position: Position) {}

  get node(): ASTv1.BaseNode {
    return this.path[this.index];
  }

  get parent(): any | undefined {
    return this.path[this.index - 1];
  }

  metaForType(astType: 'handlebars'): HandlebarsASTPathMeta | null {
    if (astType === 'handlebars') {
      return new HandlebarsASTPathMeta(this, this.position, this.content);
    } else {
      return null;
    }
  }

  sourceForNode() {
    return sourceForNode(this.node, this.content);
  }

  sourceForParent() {
    return sourceForNode(this.parent, this.content);
  }

  get parentPath(): ASTPath | undefined {
    if (this.index - 1 < 0) {
      return undefined;
    }

    return new ASTPath(this.path, this.index - 1, this.content, this.position);
  }
}

function _findFocusPath(node: ASTv1.BaseNode, position: Position, seen = new Set()): any {
  seen.add(node);

  let path: any[] = [];
  const range: SourceLocation | null = node.loc ? nodeLoc(node) : null;

  if (range) {
    if (containsPosition(range, position)) {
      path.push(node);
    } else {
      return [];
    }
  }

  for (const key in node) {
    if (key === 'loc') {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(node, key)) {
      continue;
    }

    const value = (node as any)[key];

    if (!value || typeof value !== 'object' || seen.has(value)) {
      continue;
    }

    const childPath = _findFocusPath(value as ASTv1.BaseNode, position, seen);

    if (childPath.length > 0) {
      path = path.concat(childPath);
      break;
    }
  }

  return path;
}
