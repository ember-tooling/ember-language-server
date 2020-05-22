import * as path from 'path';
import * as fs from 'fs';
import * as memoize from 'memoizee';
import { Location, Range } from 'vscode-languageserver';

import { URI } from 'vscode-uri';

import { isModuleUnificationApp, podModulePrefixForRoot, hasAddonFolderInPath, getProjectAddonsRoots, getProjectInRepoAddonsRoots } from './layout-helpers';
const mProjectAddonsRoots = memoize(getProjectAddonsRoots, {
  length: 1,
  maxAge: 600000
});
const mProjectInRepoAddonsRoots = memoize(getProjectInRepoAddonsRoots, {
  length: 1,
  maxAge: 600000
});

export function pathsToLocations(...paths: string[]): Location[] {
  return paths.filter(fs.existsSync).map((modulePath) => {
    return Location.create(URI.file(modulePath).toString(), Range.create(0, 0, 0, 0));
  });
}

export function getFirstTextPostion(text: string, content: string) {
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
      if (/\s/.test(bounds[0].charAt(bounds[0].length - 1)) || bounds[0].trim().length === 0) {
        if (/^[A-Za-z]+$/.test(bounds[1].charAt(0)) === false) {
          startLine = index;
          startCharacter = textPosition;
        }
      }
    }
  });
  return [startLine, startCharacter];
}

export function pathsToLocationsWithPosition(paths: string[], findMe: string) {
  return paths.filter(fs.existsSync).map((fileName: string) => {
    const text = fs.readFileSync(fileName, 'utf8');
    const [startLine, startCharacter] = getFirstTextPostion(text, findMe);
    return Location.create(URI.file(fileName).toString(), Range.create(startLine, startCharacter, startLine, startCharacter + findMe.length));
  });
}

export function getAbstractHelpersParts(root: string, prefix: string, maybeComponentName: string) {
  return [[root, prefix, 'helpers', `${maybeComponentName}.js`], [root, prefix, 'helpers', `${maybeComponentName}.ts`]];
}

export function getAbstractParts(root: string, prefix: string, collection: string, name: string) {
  return [[root, prefix, collection, `${name}.js`], [root, prefix, collection, `${name}.ts`]];
}

export function getAbstractPartsWithTemplates(root: string, prefix: string, collection: string, name: string) {
  return [[root, prefix, collection, `${name}.js`], [root, prefix, collection, `${name}.ts`], [root, prefix, collection, `${name}.hbs`]];
}

export function getAbstractComponentScriptsParts(root: string, prefix: string, maybeComponentName: string) {
  return [
    [root, prefix, 'components', maybeComponentName + '.js'],
    [root, prefix, 'components', maybeComponentName + '.ts'],
    [root, prefix, 'components', maybeComponentName, 'component.js'],
    [root, prefix, 'components', maybeComponentName, 'component.ts'],
    [root, prefix, 'components', maybeComponentName, 'index.js'],
    [root, prefix, 'components', maybeComponentName, 'index.ts']
  ];
}

export function getAbstractComponentTemplatesParts(root: string, prefix: string, maybeComponentName: string) {
  return [
    [root, prefix, 'components', maybeComponentName, 'template.hbs'],
    [root, prefix, 'components', maybeComponentName, 'index.hbs'],
    [root, prefix, 'components', maybeComponentName + '.hbs'],
    [root, prefix, 'templates', 'components', maybeComponentName + '.hbs']
  ];
}

export function getPathsForComponentScripts(root: string, maybeComponentName: string): string[] {
  const podModulePrefix = podModulePrefixForRoot(root);
  let podComponentsScriptsParts: string[][] = [];
  let muComponentsScriptsParts: string[][] = [];
  let classicComponentsScriptsParts: string[][] = [];
  if (podModulePrefix) {
    podComponentsScriptsParts = getAbstractComponentScriptsParts(root, 'app/' + podModulePrefix, maybeComponentName);
  }
  if (isModuleUnificationApp(root)) {
    muComponentsScriptsParts = getAbstractComponentScriptsParts(root, 'src/ui', maybeComponentName);
  } else {
    classicComponentsScriptsParts = getAbstractComponentScriptsParts(root, 'app', maybeComponentName);
  }
  const paths = [...muComponentsScriptsParts, ...podComponentsScriptsParts, ...classicComponentsScriptsParts].map((pathParts: any) => {
    return path.join.apply(path, pathParts.filter((part: any) => !!part));
  });
  return paths;
}

export function getPathsForComponentTemplates(root: string, maybeComponentName: string): string[] {
  const podModulePrefix = podModulePrefixForRoot(root);
  let podComponentsScriptsParts: string[][] = [];
  let muComponentsScriptsParts: string[][] = [];
  let classicComponentsScriptsParts: string[][] = [];
  if (podModulePrefix) {
    podComponentsScriptsParts = getAbstractComponentTemplatesParts(root, 'app' + path.sep + podModulePrefix, maybeComponentName);
  }
  if (isModuleUnificationApp(root)) {
    muComponentsScriptsParts = getAbstractComponentTemplatesParts(root, 'src/ui', maybeComponentName);
  } else {
    classicComponentsScriptsParts = getAbstractComponentTemplatesParts(root, 'app', maybeComponentName);
  }
  const paths = [...podComponentsScriptsParts, ...muComponentsScriptsParts, ...classicComponentsScriptsParts].map((pathParts: any) => {
    return path.join.apply(path, pathParts.filter((part: any) => !!part));
  });
  return paths;
}

export function getAddonImport(root: string, importPath: string) {
  let importParts = importPath.split('/');
  let addonName = importParts.shift();
  if (addonName && addonName.startsWith('@')) {
    addonName = addonName + path.sep + importParts.shift();
  }
  if (!addonName) {
    return [];
  }
  const items: string[] = [];
  const roots = items.concat(mProjectAddonsRoots(root), mProjectInRepoAddonsRoots(root));
  let existingPaths: string[] = [];
  let hasValidPath = false;
  roots.forEach((rootPath: string) => {
    if (!rootPath.endsWith(addonName as string)) {
      return;
    }
    if (hasValidPath) {
      return;
    }
    const addonPaths: string[][] = [];
    const possibleLocations = [[rootPath, 'app', ...importParts], [rootPath, 'addon', ...importParts], [rootPath, ...importParts]];
    possibleLocations.forEach((locationArr: any) => {
      getAbstractPartsWithTemplates.apply(null, locationArr).forEach((parts: any) => {
        addonPaths.push(parts);
      });
    });
    const validPaths = addonPaths
      .map((pathArr: string[]): string => {
        return path.join.apply(path, pathArr.filter((part: any) => !!part));
      })
      .filter(fs.existsSync);
    if (validPaths.length) {
      hasValidPath = true;
      existingPaths = validPaths;
    }
  });

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);
  if (addonFolderFiles.length) {
    return addonFolderFiles;
  }
  return existingPaths;
}

export function getAddonPathsForType(root: string, collection: 'services' | 'models' | 'modifiers' | 'helpers' | 'routes', name: string) {
  const items: string[] = [];
  const roots = items.concat(mProjectAddonsRoots(root), mProjectInRepoAddonsRoots(root));
  let existingPaths: string[] = [];
  let hasValidPath = false;
  roots.forEach((rootPath: string) => {
    if (hasValidPath) {
      return;
    }
    const addonPaths: string[][] = [];
    getAbstractParts(rootPath, 'app', collection, name).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    getAbstractParts(rootPath, 'addon', collection, name).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    const validPaths = addonPaths
      .map((pathArr: string[]): string => {
        return path.join.apply(path, pathArr.filter((part: any) => !!part));
      })
      .filter(fs.existsSync);
    if (validPaths.length) {
      hasValidPath = true;
      existingPaths = validPaths;
    }
  });

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);
  if (addonFolderFiles.length) {
    return addonFolderFiles;
  }
  return existingPaths;
}

export function getAddonPathsForComponentTemplates(root: string, maybeComponentName: string) {
  const items: string[] = [];
  const roots = items.concat(mProjectAddonsRoots(root), mProjectInRepoAddonsRoots(root));
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
      .map((pathArr: string[]): string => {
        return path.join.apply(path, pathArr.filter((part: any) => !!part));
      })
      .filter(fs.existsSync);
    if (validPaths.length) {
      hasValidPath = true;
      existingPaths = validPaths;
    }
  });

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);
  if (addonFolderFiles.length) {
    return addonFolderFiles;
  }
  return existingPaths;
}
