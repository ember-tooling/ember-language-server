import * as path from 'path';
import * as fs from 'fs';

import {
  RequestHandler,
  TextDocumentPositionParams,
  Definition,
  Location,
  Range
} from 'vscode-languageserver';

import { parse } from 'babylon';

import { toPosition } from './estree-utils';
import Server from './server';
import ASTPath from './glimmer-utils';
import { getExtension } from './utils/file-extension';
import { getProjectAddonsRoots, getPodModulePrefix } from './completion-provider/template-completion-provider';
import URI from 'vscode-uri';
const _ = require('lodash');
const memoize = require('memoizee');

const mProjectAddonsRoots = memoize(getProjectAddonsRoots, {
  length: 1,
  maxAge: 600000
});
const mAddonPathsForComponentTemplates = memoize(
  getAddonPathsForComponentTemplates,
  { length: 2, maxAge: 600000 }
);

const { preprocess } = require('@glimmer/syntax');

function getAddonPathsForComponentTemplates(
  root: string,
  maybeComponentName: string
) {
  const roots = mProjectAddonsRoots(root);
  let existingPaths: string[] = [];
  let hasValidPath = false;
  roots.forEach((rootPath: string) => {
    if (hasValidPath) {
      return;
    }
    const addonPaths: string[][] = [];

    getAbstractComponentScriptsParts(rootPath, 'addon', maybeComponentName).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    getAbstractComponentScriptsParts(rootPath, 'app', maybeComponentName).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    getAbstractComponentTemplatesParts(rootPath, 'app', maybeComponentName).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    getAbstractComponentTemplatesParts(rootPath, 'addon', maybeComponentName).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    getAbstractHelpersParts(rootPath, 'app', maybeComponentName).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    getAbstractHelpersParts(rootPath, 'addon', maybeComponentName).forEach((parts: any) => {
      addonPaths.push(parts);
    });

    const validPaths = addonPaths
      .map((pathArr: string[]) => {
        return path.join.apply(path, pathArr.filter((part: any) => !!part));
      })
      .filter(fs.existsSync);
    if (validPaths.length) {
      hasValidPath = true;
      existingPaths = validPaths;
    }
  });

  const addonFolderFiles =
    existingPaths.filter(hasAddonFolderInPath);
  if (addonFolderFiles.length) {
    return addonFolderFiles;
  }
  return existingPaths;
}

function getPathsForComponentTemplates(
  root: string,
  maybeComponentName: string
): string[] {
  const podModulePrefix = getPodModulePrefix(root);
  let podComponentsScriptsParts: string[][] = [];
  if (podModulePrefix) {
    podComponentsScriptsParts = getAbstractComponentScriptsParts(root, 'app' + path.sep + podModulePrefix, maybeComponentName);
  }
  const paths = [...podComponentsScriptsParts, ...getAbstractComponentTemplatesParts(root, 'app', maybeComponentName)]
  .map((pathParts: any) => {
    return path.join.apply(path, pathParts.filter((part: any) => !!part));
  });
  return paths;
}

function getAbstractComponentScriptsParts(root: string, prefix: string, maybeComponentName: string) {
  return [
    [root, prefix, 'components', maybeComponentName + '.js'],
    [root, prefix, 'components', maybeComponentName + '.ts'],
    [root, prefix, 'components', maybeComponentName, 'component.js'],
    [root, prefix, 'components', maybeComponentName, 'component.ts']
  ];
}

function getAbstractComponentTemplatesParts(root: string, prefix: string, maybeComponentName: string) {
  return [
    [root, prefix, 'components', maybeComponentName, 'template.hbs'],
    [root, prefix, 'templates', 'components', maybeComponentName + '.hbs']
  ];
}

function getAbstractHelpersParts(root: string, prefix: string, maybeComponentName: string) {
  return [
    [root, prefix, 'helpers', `${maybeComponentName}.js`],
    [root, prefix, 'helpers', `${maybeComponentName}.ts`]
  ];
}

function getPathsForComponentScripts(
  root: string,
  maybeComponentName: string
): string[] {
  const podModulePrefix = getPodModulePrefix(root);
  let podComponentsScriptsParts: string[][] = [];
  if (podModulePrefix) {
    podComponentsScriptsParts = getAbstractComponentScriptsParts(root, 'app' + path.sep + podModulePrefix, maybeComponentName);
  }
  const paths = [...podComponentsScriptsParts, ...getAbstractComponentScriptsParts(root, 'app', maybeComponentName)].map((pathParts: any) => {
    return path.join.apply(path, pathParts.filter((part: any) => !!part));
  });
  return paths;
}

function getComponentNameFromURI(root: string, uri: string) {
  let fileName = uri.replace('file://', '').replace(root, '');
  let maybeComponentName = fileName
    .split(path.sep)
    .join('/')
    .split('/components/')[1];
  if (maybeComponentName.endsWith('/template.hbs')) {
    maybeComponentName = maybeComponentName.replace('/template.hbs', '');
  } else if (isTemplatePath(maybeComponentName)) {
    maybeComponentName = maybeComponentName.replace('.hbs', '');
  }
  return maybeComponentName;
}

export default class DefinitionProvider {
  constructor(private server: Server) {}

  handle(params: TextDocumentPositionParams): Definition | null {
    let uri = params.textDocument.uri;

    const project = this.server.projectRoots.projectForUri(uri);
    if (!project) {
      return null;
    }

    let extension = getExtension(params.textDocument);

    if (extension === '.hbs') {
      let content = this.server.documents.get(uri).getText();
      let ast = preprocess(content);
      let focusPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!focusPath) {
        return null;
      }

      if (this.isAngleComponent(focusPath)) {
        const maybeComponentName = _.kebabCase(focusPath.node.tag);

        let paths = [
          ...getPathsForComponentScripts(project.root, maybeComponentName),
          ...getPathsForComponentTemplates(project.root, maybeComponentName)
        ].filter(fs.existsSync);

        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          );
        }

        return pathsToLocations.apply(
          null,
          paths.length > 1
            ? paths.filter((postfix: string) => isTemplatePath(postfix))
            : paths
        );
      } else if (this.isComponentWithBlock(focusPath)) {
        let maybeComponentName = focusPath.node.path.original;
        let paths: string[] = getPathsForComponentTemplates(
          project.root,
          maybeComponentName
        ).filter(fs.existsSync);
        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          ).filter((name: string) => {
            return isTemplatePath(name);
          });
        }
        // mAddonPathsForComponentTemplates
        return pathsToLocationsWithPosition(paths, '{{yield');
      } else if (
        this.isActionName(focusPath) ||
        this.isLocalProperty(focusPath) ||
        this.isHashPairWithLocalValue(focusPath)
      ) {
        let maybeComponentName = getComponentNameFromURI(project.root, uri);
        let paths: string[] = getPathsForComponentScripts(
          project.root,
          maybeComponentName
        ).filter(fs.existsSync);
        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          ).filter((name: string) => {
            return !isTemplatePath(name);
          });
        }
        const text =
          focusPath.node.type !== 'HashPair'
            ? focusPath.node.original
            : focusPath.node.value.original;
        return pathsToLocationsWithPosition(
          paths,
          text.replace('this.', '').split('.')[0]
        );
      } else if (this.isComponentOrHelperName(focusPath)) {
        const maybeComponentName =
          focusPath.node.type === 'ElementNode'
            ? _.kebabCase(focusPath.node.tag)
            : focusPath.node.original;

        let helpers = getAbstractHelpersParts(project.root, 'app', maybeComponentName)
        .map((pathParts: any) => {
          return path.join.apply(path, pathParts.filter((part: any) => !!part));
        });

        let paths = [
          ...getPathsForComponentScripts(project.root, maybeComponentName),
          ...getPathsForComponentTemplates(project.root, maybeComponentName),
          ...helpers
        ].filter(fs.existsSync);

        if (!paths.length) {
          paths = mAddonPathsForComponentTemplates(
            project.root,
            maybeComponentName
          );
        }

        return pathsToLocations.apply(
          null,
          paths.length > 1
            ? paths.filter(isTemplatePath)
            : paths
        );
      } else {
        // let { line, column } =  toPosition(params.position);
        // let textLine = getLineFromText(content, line);
        // let leftLine = textLine.slice(0, column);
        // let rightLine = textLine.slice(column);
        // let leftEqual = leftLine.lastIndexOf('=');
        // if (leftEqual > -1) {
        //   let needle = leftLine.slice(leftEqual + 1).trim() + rightLine.slice(0, rightLine.indexOf(' ') || rightLine.length - 1).trim();
        //   if (needle.indexOf('this.') > -1) {
        //   }
        // }
      }
    } else if (extension === '.js') {
      let content = this.server.documents.get(uri).getText();
      let ast = parse(content, {
        sourceType: 'module'
      });
      let astPath = ASTPath.toPosition(ast, toPosition(params.position));
      if (!astPath) {
        return null;
      }

      if (isModelReference(astPath)) {
        let modelName = astPath.node.value;
        const modelPath = path.join(
          project.root,
          'app',
          'models',
          `${modelName}.js`
        );
        const tsModelPath = path.join(
          project.root,
          'app',
          'models',
          `${modelName}.ts`
        );
        return pathsToLocations(modelPath, tsModelPath);
      } else if (isTransformReference(astPath)) {
        let transformName = astPath.node.value;

        const transformPath = path.join(
          project.root,
          'app',
          'transforms',
          `${transformName}.js`
        );
        const tsTransformPath = path.join(
          project.root,
          'app',
          'transforms',
          `${transformName}.ts`
        );
        return pathsToLocations(transformPath, tsTransformPath);
      }
    }

    return null;
  }

  get handler(): RequestHandler<TextDocumentPositionParams, Definition, void> {
    return this.handle.bind(this);
  }

  isLocalProperty(path: ASTPath) {
    let node = path.node;
    if (node.type === 'PathExpression') {
      return node.this;
    }
    return false;
  }

  isHashPairWithLocalValue(path: ASTPath) {
    let node = path.node;
    return (
      node.type === 'HashPair' &&
      node.value.type === 'PathExpression' &&
      node.value.this
    );
  }

  isActionName(path: ASTPath) {
    let node = path.node;
    if (path.parent.type !== 'PathExpression') {
      return false;
    }
    if (
      !path.parent ||
      path.parent.path.original !== 'action' ||
      !path.parent.params[0] === node
    ) {
      return false;
    }
    if (node.type === 'StringLiteral') {
      return true;
    } else if (node.type === 'PathExpression' && node.this) {
      return true;
    }
    return false;
  }

  isComponentWithBlock(path: ASTPath) {
    let node = path.node;
    return (
      node.type === 'BlockStatement' &&
      node.path.type === 'PathExpression' &&
      node.path.this === false &&
      node.path.original.includes('-') &&
      node.path.original.charAt(0) !== '-' &&
      !node.path.original.includes('.')
    );
  }

  isAngleComponent(path: ASTPath) {
    let node = path.node;

    if (node.type === 'ElementNode') {
      if (node.tag.charAt(0) === node.tag.charAt(0).toUpperCase()) {
        return true;
      }
    }
  }

  isComponentOrHelperName(path: ASTPath) {
    let node = path.node;

    if (this.isAngleComponent(path)) {
      return true;
    }

    if (node.type === 'StringLiteral') {
      // if (node.original.includes('/')) {
      //   return true;
      // } else if (!node.original.includes('.') && node.original.includes('-')) {
      //   return true;
      // }
      if (
        path.parent &&
        path.parent.path.original === 'component' &&
        path.parent.params[0] === node
      ) {
        return true;
      }
    }

    if (node.type !== 'PathExpression') {
      return false;
    }

    let parent = path.parent;
    if (
      !parent ||
      parent.path !== node ||
      (parent.type !== 'MustacheStatement' &&
        parent.type !== 'BlockStatement' &&
        parent.type !== 'SubExpression')
    ) {
      return false;
    }

    return true;
  }
}

function isModelReference(astPath: ASTPath): boolean {
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

function isTransformReference(astPath: ASTPath): boolean {
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

function pathsToLocations(...paths: string[]): Location[] {
  return paths.filter(fs.existsSync).map(modulePath => {
    return Location.create(
      URI.file(modulePath).toString(),
      Range.create(0, 0, 0, 0)
    );
  });
}

function isTemplatePath(filePath: string) {
  return filePath.endsWith('.hbs');
}

function hasAddonFolderInPath(name: string) {
  return name.includes(path.sep + 'addon' + path.sep);
}

// function getLineFromText(text: string, line: number) {
//   const arrayOfLines = text.match(/[^\r\n]+/g) || [];
//   return arrayOfLines[line - 1] || '';
// }

function getFirstTextPostion(filePath: string, content: string) {
  const text = fs.readFileSync(filePath, 'utf8');
  const arrayOfLines = text.match(/(.*?(?:\r\n?|\n|$))/gm) || [];
  let startLine = 0;
  let startCharacter = 0;
  arrayOfLines.forEach((line: string, index: number) => {
    if (startLine || startCharacter) {
      return;
    }
    let textPosition = line.indexOf(content);
    let bounds = line.split(content);
    if (textPosition > -1) {
      if (
        /\s/.test(bounds[0].charAt(bounds[0].length - 1)) ||
        bounds[0].trim().length === 0
      ) {
        if (/^[A-Za-z]+$/.test(bounds[1].charAt(0)) === false) {
          startLine = index;
          startCharacter = textPosition;
        }
      }
    }
  });
  return [startLine, startCharacter];
}

function pathsToLocationsWithPosition(paths: string[], findMe: string) {
  return paths.filter(fs.existsSync).map((fileName: string) => {
    const [startLine, startCharacter] = getFirstTextPostion(fileName, findMe);
    return Location.create(
      URI.file(fileName).toString(),
      Range.create(
        startLine,
        startCharacter,
        startLine,
        startCharacter + findMe.length
      )
    );
  });
}
