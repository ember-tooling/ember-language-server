import ASTPath from './../glimmer-utils';

function isFirstStringParamInCallExpression(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (!isString(node)) {
    return false;
  }
  let parent = astPath.parent;
  if (!isCallExpression(parent)) {
    return false;
  }
  if (!expressionHasArgument(parent, node, 0)) {
    return false;
  }
  if (!parent.callee || !parent.callee.property) {
    return false;
  }
  return true;
}

export function isRouteLookup(astPath: ASTPath): boolean {
  if (!isFirstStringParamInCallExpression(astPath)) {
    return false;
  }
  let parent = astPath.parent;
  const matches = ['transitionTo', 'intermediateTransitionTo', 'paramsFor', 'transitionToRoute'];
  return expressionHasIdentifierName(parent, matches);
}

export function isTemplateElement(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (node.type !== 'TemplateElement') {
    return false;
  }
  let parent = astPath.parent;
  if (parent.type !== 'TemplateLiteral') {
    return false;
  }
  let grandpa = astPath.parentPath && astPath.parentPath.parent;
  if (grandpa.type !== 'TaggedTemplateExpression') {
    return false;
  }
  if (grandpa.tag && grandpa.tag.type === 'Identifier' && grandpa.tag.name === 'hbs') {
    return true;
  }
  return false;
}

export function isStoreModelLookup(astPath: ASTPath): boolean {
  if (!isFirstStringParamInCallExpression(astPath)) {
    return false;
  }
  let parent = astPath.parent;
  const matches = ['findRecord', 'createRecord', 'findAll', 'queryRecord', 'peekAll', 'query', 'peekRecord', 'adapterFor', 'hasRecordForId'];
  return expressionHasIdentifierName(parent, matches);
}

export function isComputedPropertyArgument(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (!isString(node)) {
    return false;
  }
  let parent = astPath.parent;
  if (!isCallExpression(parent)) {
    return false;
  }
  if (!expressionHasArgument(parent, node)) {
    return false;
  }
  if (!expressionHasIdentifierName(parent, 'computed')) {
    return false;
  }
  const grandParent = astPath.parentPath;
  if (!grandParent) {
    return false;
  }
  return hasNodeType(grandParent.parent, 'ObjectProperty');
}

export function isTransformReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (!isString(node)) {
    return false;
  }
  let parent = astPath.parent;
  if (!isCallExpression(parent)) {
    return false;
  }
  if (!expressionHasArgument(parent, node, 0)) {
    return false;
  }
  return expressionHasIdentifierName(parent, 'attr');
}

export function isAngleComponentPath(path: ASTPath): boolean {
  let node = path.node;
  if (!hasNodeType(node, 'ElementNode')) {
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

export function isModifierPath(path: ASTPath): boolean {
  let node = path.node;
  if (!isPathExpression(node)) {
    return false;
  }
  if (node.data) {
    return false;
  }
  let parent = path.parent;
  if (!hasNodeType(parent, 'ElementModifierStatement')) {
    return false;
  }
  return node === parent.path;
}

export function isMustachePath(path: ASTPath): boolean {
  let node = path.node;
  if (!isPathExpression(node)) {
    return false;
  }
  let parent = path.parent;
  if (!hasNodeType(parent, 'MustacheStatement')) {
    return false;
  }
  return parent.path === node;
}

export function isBlockPath(path: ASTPath): boolean {
  let node = path.node;
  if (!isPathExpression(node)) {
    return false;
  }
  let parent = path.parent;
  if (!isBlock(parent)) {
    return false;
  }
  return parent.path === node;
}

export function isSubExpressionPath(path: ASTPath): boolean {
  let node = path.node;
  if (!isPathExpression(node)) {
    return false;
  }
  let parent = path.parent;
  if (!hasNodeType(parent, 'SubExpression')) {
    return false;
  }
  return parent.path === node;
}

export function isLinkToTarget(path: ASTPath): boolean {
  return isInlineLinkToTarget(path) || isBlockLinkToTarget(path);
}

export function isInlineLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (!isString(node)) {
    return false;
  }
  let parent = path.parent;
  if (!hasNodeType(parent, 'MustacheStatement')) {
    return false;
  }
  return parent.params[1] === node && parent.path.original === 'link-to';
}

export function isBlockLinkToTarget(path: ASTPath): boolean {
  let node = path.node;
  if (!isString(node)) {
    return false;
  }
  let parent = path.parent;
  if (!isBlock(parent)) {
    return false;
  }
  return parent.params[0] === node && parent.path.original === 'link-to';
}

export function isImportPathDeclaration(path: ASTPath): boolean {
  let node = path.node;
  if (!isString(node)) {
    return false;
  }
  let parent = path.parent;
  if (!hasNodeType(parent, 'ImportDeclaration')) {
    return false;
  }
  return true;
}

export function isServiceInjection(path: ASTPath): boolean {
  let node = path.node;
  if (!hasNodeType(node, 'Identifier')) {
    return false;
  }
  let parent = path.parent;
  if (!hasNodeType(parent, 'ObjectProperty')) {
    return false;
  }
  if (!isCallExpression(parent.value)) {
    return false;
  }
  return expressionHasIdentifierName(parent.value, 'service');
}

export function isNamedServiceInjection(path: ASTPath): boolean {
  let node = path.node;
  if (!isString(node)) {
    return false;
  }
  let parent = path.parent;
  if (!isCallExpression(parent)) {
    return false;
  }
  return expressionHasIdentifierName(parent, 'service');
}

export function isModelReference(astPath: ASTPath): boolean {
  let node = astPath.node;
  if (!isString(node)) {
    return false;
  }
  let parent = astPath.parent;
  if (!isCallExpression(parent)) {
    return false;
  }
  if (!expressionHasArgument(parent, node, 0)) {
    return false;
  }
  return expressionHasIdentifierName(parent, ['belongsTo', 'hasMany']);
}
function hasNodeType(node: any, type: string) {
  if (!node) {
    return false;
  }
  return node.type === type;
}
function isBlock(node: any): boolean {
  return hasNodeType(node, 'BlockStatement');
}
function isString(node: any): boolean {
  return hasNodeType(node, 'StringLiteral');
}
function isCallExpression(node: any): boolean {
  return hasNodeType(node, 'CallExpression');
}
export function isLocalPathExpression(path: any): boolean {
  return isPathExpression(path.node) && path.node.this === true;
}
export function isComponentArgumentName(path: any): boolean {
  return hasNodeType(path.node, 'AttrNode') && path.node.name.startsWith('@');
}
export function isLinkComponentRouteTarget(path: any): boolean {
  return hasNodeType(path.node, 'TextNode') && hasNodeType(path.parent, 'AttrNode') && path.parent.name === '@route';
}
function isPathExpression(node: any): boolean {
  return hasNodeType(node, 'PathExpression');
}
function expressionHasIdentifierName(exp: any, name: string | string[]) {
  const names = typeof name === 'string' ? [name] : name;
  let identifier = hasNodeType(exp.callee, 'Identifier') ? exp.callee : exp.callee.property;
  return names.includes(identifier.name);
}
function expressionHasArgument(exp: any, arg: any, position = -1) {
  if (!exp || !exp.arguments) {
    return false;
  }
  let index = exp.arguments.indexOf(arg);
  if (index === -1) {
    return false;
  }
  if (position === -1) {
    return true;
  }
  if (position === index) {
    return true;
  } else {
    return false;
  }
}
