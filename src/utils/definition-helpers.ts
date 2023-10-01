import * as path from 'path';
import * as memoize from 'memoizee';
import { Location, Range } from 'vscode-languageserver/node';

import { URI } from 'vscode-uri';

import { podModulePrefixForRoot, hasAddonFolderInPath, getProjectAddonsRoots, getProjectInRepoAddonsRoots, asyncFilter } from './layout-helpers';
import { fsProvider } from '../fs-provider';

const mProjectAddonsRoots = memoize(getProjectAddonsRoots, {
  length: 3,
  maxAge: 600000,
});
const mProjectInRepoAddonsRoots = memoize(getProjectInRepoAddonsRoots, {
  length: 1,
  maxAge: 600000,
});

export function pathsToLocations(...paths: string[]): Location[] {
  return paths.map((modulePath) => {
    return Location.create(URI.file(modulePath).toString(), Range.create(0, 0, 0, 0));
  });
}

export function getFirstTextPosition(text: string, content: string) {
  const arrayOfLines = text.match(/(.*?(?:\r\n?|\n|$))/gm) || [];
  let startLine = 0;
  let startCharacter = 0;

  arrayOfLines.forEach((line: string, index: number) => {
    if (startLine || startCharacter) {
      return;
    }

    const textPosition = line.indexOf(content);
    const bounds = line.split(content);

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

export async function importPathsToLocations(paths: string[], importName?: string): Promise<Location[]> {
  if (importName) {
    const locations = paths.map(async (modulePath) => {
      const file = await fsProvider().readFile(modulePath);

      if (file === null) {
        return null;
      }

      const arr = file.split(/\r?\n/).map((l) => l.trim());

      const idxFound = arr.findIndex((line) => line.includes(importName) && line.startsWith('export '));
      const useIndex = idxFound > -1 ? idxFound : 0;
      const start = idxFound > -1 ? arr[idxFound].indexOf(importName) : 0;
      const end = idxFound > -1 ? start + importName.length : 0;

      return Location.create(URI.file(modulePath).toString(), Range.create(useIndex, start, useIndex, end));
    });
    const results = await Promise.all(locations);

    return results.filter((r) => r !== null) as Location[];
  }

  return Promise.resolve(pathsToLocations(...paths));
}

export async function pathsToLocationsWithPosition(paths: string[], findMe: string): Promise<Location[]> {
  const results = paths.map(async (fileName: string) => {
    const text = await fsProvider().readFile(fileName);

    if (text === null) {
      return null;
    }

    const [startLine, startCharacter] = getFirstTextPosition(text, findMe);

    return Location.create(URI.file(fileName).toString(), Range.create(startLine, startCharacter, startLine, startCharacter + findMe.length));
  });

  const data = await Promise.all(results);

  return data.filter((el) => el !== null) as Location[];
}

export function getAbstractParts(root: string, prefix: string, collection: string, name: string) {
  return [
    [root, prefix, collection, `${name}.js`],
    [root, prefix, collection, `${name}.ts`],
  ];
}

export function getAbstractPartsWithTemplates(root: string, prefix: string, collection: string[]) {
  const importParts = [...collection];
  const name = importParts.pop();

  return [
    [root, prefix, ...importParts, `${name}.js`],
    [root, prefix, ...importParts, `${name}.ts`],
    [root, prefix, ...importParts, `${name}.hbs`],
  ];
}

export function getAbstractComponentScriptsParts(root: string, prefix: string, maybeComponentName: string) {
  return [
    [root, prefix, 'components', maybeComponentName + '.js'],
    [root, prefix, 'components', maybeComponentName + '.ts'],
    [root, prefix, 'components', maybeComponentName, 'component.js'],
    [root, prefix, 'components', maybeComponentName, 'component.ts'],
    [root, prefix, 'components', maybeComponentName, 'index.js'],
    [root, prefix, 'components', maybeComponentName, 'index.ts'],
  ];
}

export function getAbstractComponentTemplatesParts(root: string, prefix: string, maybeComponentName: string) {
  return [
    [root, prefix, 'components', maybeComponentName, 'template.hbs'],
    [root, prefix, 'components', maybeComponentName, 'index.hbs'],
    [root, prefix, 'components', maybeComponentName + '.hbs'],
    [root, prefix, 'templates', 'components', maybeComponentName + '.hbs'],
  ];
}

export function getPathsForComponentScripts(root: string, maybeComponentName: string): string[] {
  const podModulePrefix = podModulePrefixForRoot(root);
  let podComponentsScriptsParts: string[][] = [];
  let classicComponentsScriptsParts: string[][] = [];

  if (podModulePrefix) {
    podComponentsScriptsParts = getAbstractComponentScriptsParts(root, 'app/' + podModulePrefix, maybeComponentName);
  }

  classicComponentsScriptsParts = getAbstractComponentScriptsParts(root, 'app', maybeComponentName);

  const paths = [...podComponentsScriptsParts, ...classicComponentsScriptsParts].map((pathParts: any) => {
    return path.join(...pathParts.filter((part: string) => !!part));
  });

  return paths;
}

export function getPathsForComponentTemplates(root: string, maybeComponentName: string): string[] {
  const podModulePrefix = podModulePrefixForRoot(root);
  let podComponentsScriptsParts: string[][] = [];
  let classicComponentsScriptsParts: string[][] = [];

  if (podModulePrefix) {
    podComponentsScriptsParts = getAbstractComponentTemplatesParts(root, 'app' + path.sep + podModulePrefix, maybeComponentName);
  }

  classicComponentsScriptsParts = getAbstractComponentTemplatesParts(root, 'app', maybeComponentName);

  const paths = [...podComponentsScriptsParts, ...classicComponentsScriptsParts].map((pathParts: any) => {
    return path.join(...pathParts.filter((part: any) => !!part));
  });

  return paths;
}

export async function getAddonImport(root: string, importPath: string) {
  const importParts = importPath.split('/');
  let addonName = importParts.shift();

  if (addonName && addonName.startsWith('@')) {
    addonName = addonName + path.sep + importParts.shift();
  }

  if (!addonName) {
    return [];
  }

  const items: string[] = [];
  const [addonRoots, inRepoRoots] = await Promise.all([mProjectAddonsRoots(root), mProjectInRepoAddonsRoots(root)]);

  const roots = items.concat(addonRoots, inRepoRoots);
  let existingPaths: string[] = [];
  let hasValidPath = false;

  for (const rootPath of roots) {
    if (!rootPath.endsWith(addonName as string)) {
      continue;
    }

    if (hasValidPath) {
      continue;
    }

    const addonPaths: string[][] = [];
    const possibleLocations = [
      [rootPath, 'app', importParts],
      [rootPath, 'addon', importParts],
      [rootPath, '', importParts],
    ];

    possibleLocations.forEach((locationArr: Parameters<typeof getAbstractPartsWithTemplates>) => {
      getAbstractPartsWithTemplates(...locationArr).forEach((parts: any) => {
        addonPaths.push(parts);
      });
    });

    const rawPaths = addonPaths.map((pathArr: string[]): string => {
      return path.join(...pathArr.filter((part: any) => !!part));
    });

    const validPaths = await asyncFilter(rawPaths, fsProvider().exists);

    if (validPaths.length) {
      hasValidPath = true;
      existingPaths = validPaths;
    }
  }

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);

  if (addonFolderFiles.length) {
    return addonFolderFiles;
  }

  return existingPaths;
}

export async function getAddonPathsForType(root: string, collection: 'services' | 'models' | 'modifiers' | 'helpers' | 'routes', name: string) {
  const items: string[] = [];
  const [addonRoots, inRepoRoots] = await Promise.all([mProjectAddonsRoots(root), mProjectInRepoAddonsRoots(root)]);
  const roots = items.concat(addonRoots, inRepoRoots);
  let existingPaths: string[] = [];
  let hasValidPath = false;

  for (const rootPath of roots) {
    if (hasValidPath) {
      break;
    }

    const addonPaths: string[][] = [];

    getAbstractParts(rootPath, 'app', collection, name).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    getAbstractParts(rootPath, 'addon', collection, name).forEach((parts: any) => {
      addonPaths.push(parts);
    });
    const rawPaths = addonPaths.map((pathArr: string[]): string => {
      return path.join(...pathArr.filter((part: any) => !!part));
    });

    const validPaths = await asyncFilter(rawPaths, fsProvider().exists);

    if (validPaths.length) {
      hasValidPath = true;
      existingPaths = validPaths;
    }
  }

  const addonFolderFiles = existingPaths.filter(hasAddonFolderInPath);

  if (addonFolderFiles.length) {
    return addonFolderFiles;
  }

  return existingPaths;
}
