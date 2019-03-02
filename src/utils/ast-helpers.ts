import ASTPath from './../glimmer-utils';

export function isTransformReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = astPath.parent;
  if (
    !parent ||
    parent.type !== 'CallExpression' ||
    parent.arguments[0] !== node
  ) {
    return false;
  }
  let identifier =
    parent.callee.type === 'Identifier'
      ? parent.callee
      : parent.callee.property;
  return identifier.name === 'attr';
}

export function isAngleComponentPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'ElementNode') {
    return false;
  }
  if (node.tag.length === 0) {
    return true;
  }
  if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
    return true;
  } else {
    return false;
  }
}

export function isMustachePath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') {
    return false;
  }
  return parent.path === node;
}

export function isBlockPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') {
    return false;
  }
  return parent.path === node;
}

export function isSubExpressionPath(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'PathExpression') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'SubExpression') {
    return false;
  }
  return parent.path === node;
}

export function isLinkToTarget(path: ASTPath): boolean {
  return isInlineLinkToTarget(path) || isBlockLinkToTarget(path);
}

export function isInlineLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'MustacheStatement') {
    return false;
  }
  return parent.params[1] === node && parent.path.original === 'link-to';
}

export function isBlockLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = path.parent;
  if (!parent || parent.type !== 'BlockStatement') {
    return false;
  }
  return parent.params[0] === node && parent.path.original === 'link-to';
}

export function isModelReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'StringLiteral') {
    return false;
  }
  let parent = astPath.parent;
  if (
    !parent ||
    parent.type !== 'CallExpression' ||
    parent.arguments[0] !== node
  ) {
    return false;
  }
  let identifier =
    parent.callee.type === 'Identifier'
      ? parent.callee
      : parent.callee.property;
  return identifier.name === 'belongsTo' || identifier.name === 'hasMany';
}
