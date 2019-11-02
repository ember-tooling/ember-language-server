import memoize from 'memoizee';
import walkSync from 'walk-sync';
import { join, sep, extname, dirname } from 'path';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

import { readFileSync, existsSync } from 'fs';

export const isModuleUnificationApp = memoize(isMuApp, {
  length: 1,
  maxAge: 60000
});
export const podModulePrefixForRoot = memoize(getPodModulePrefix, {
  length: 1,
  maxAge: 60000
});
export const mGetProjectAddonsInfo = memoize(getProjectAddonsInfo, {
  length: 1,
  maxAge: 600000
}); // 1 second

export const isAddonRoot = memoize(isProjectAddonRoot, {
  length: 1,
  maxAge: 600000
});

export function isMuApp(root: string) {
  return existsSync(join(root, 'src', 'ui'));
}

export function safeWalkSync(filePath: string | false, opts: any) {
  if (!filePath) {
    return [];
  }
  if (!existsSync(filePath)) {
    return [];
  }
  return walkSync(filePath, opts);
}

export function getPodModulePrefix(root: string): string | null {
  let podModulePrefix: any = '';
  // log('listPodsComponents');
  try {
    const appConfig = require(join(root, 'config', 'environment.js'));
    // log('appConfig', appConfig);
    podModulePrefix = appConfig('development').podModulePrefix || '';
    if (podModulePrefix.includes('/')) {
      podModulePrefix = podModulePrefix.split('/').pop();
    }
  } catch (e) {
    // log('catch', e);
    return null;
  }
  if (!podModulePrefix) {
    return null;
  }
  return podModulePrefix.trim().length > 0 ? podModulePrefix : null;
}

export function resolvePackageRoot(root: string, addonName: string, packagesFolder = 'node_modules') {
  const roots = root.split(sep);
  while (roots.length) {
    const maybePath = join(roots.join(sep), packagesFolder, addonName);
    const linkedPath = join(roots.join(sep), addonName);
    if (existsSync(join(maybePath, 'package.json'))) {
      return maybePath;
    } else if (existsSync(join(linkedPath, 'package.json'))) {
      return linkedPath;
    }
    roots.pop();
  }
  return false;
}

export function isProjectAddonRoot(root: string) {
  const pack = getPackageJSON(root);
  const hasIndexJs = existsSync(join(root, 'index.js'));
  return isEmberAddon(pack) && hasIndexJs;
}

export function getProjectInRepoAddonsRoots(root: string) {
  const prefix = isModuleUnificationApp(root) ? 'packages' : 'lib';
  const addons = safeWalkSync(
    join(root, prefix),
    {
      directories: true,
      globs: ['**/package.json']
    }
  );
  const roots: string[] = [];
  addons.map((relativePath: string) => {
    return dirname(join(root, prefix, relativePath));
  })
  .filter((packageRoot: string) => isProjectAddonRoot(packageRoot))
  .forEach((validRoot: string) => {
    roots.push(validRoot);
    getProjectAddonsRoots(validRoot, roots).forEach((relatedRoot: string) => {
      if (!roots.includes(relatedRoot)) {
        roots.push(relatedRoot);
      }
    });
  });
  return roots;
}

export function getProjectAddonsRoots(root: string, resolvedItems: string[] = [], packageFolderName = 'node_modules') {
  // log('getProjectAddonsInfo', root);
  const pack = getPackageJSON(root);
  if (resolvedItems.length) {
    if (!isEmberAddon(pack)) {
      return [];
    }
  }
  // log('getPackageJSON', pack);
  const items = resolvedItems.length ?
    [
      ...Object.keys(pack.dependencies || {}),
      ...Object.keys(pack.peerDependencies || {})
    ] : [
    ...Object.keys(pack.dependencies || {}),
    ...Object.keys(pack.peerDependencies || {}),
    ...Object.keys(pack.devDependencies || {})
  ];
  // log('items', items);

  const roots = items
    .map((item: string) => {
      return resolvePackageRoot(root, item, packageFolderName);
    })
    .filter((p: string | boolean) => {
      return p !== false;
    });
  const recursiveRoots: string[] = resolvedItems.slice(0);
  roots.forEach((rootItem: string) => {
    if (!recursiveRoots.includes(rootItem)) {
      recursiveRoots.push(rootItem);
      getProjectAddonsRoots(rootItem, recursiveRoots, packageFolderName).forEach((item: string) => {
        if (!recursiveRoots.includes(item)) {
          recursiveRoots.push(item);
        }
      });
    }
  });
  return recursiveRoots;
}

export function getPackageJSON(file: string) {
  try {
    const result = JSON.parse(readFileSync(join(file, 'package.json'), 'utf8'));
    return result;
  } catch (e) {
    return {};
  }
}

export function isEmberAddon(info: any) {
  return info.keywords && info.keywords.includes('ember-addon');
}

function addonVersion(info: any) {
  if (!isEmberAddon(info)) {
    return null;
  }
  return isEmberAddonV2(info) ? 2 : 1;
}

function isEmberAddonV2(info: any) {
  return info['ember-addon'] && info['ember-addon'].version === 2;
}

export function isTemplatePath(filePath: string) {
  return filePath.endsWith('.hbs');
}

export function hasAddonFolderInPath(name: string) {
  return name.includes(sep + 'addon' + sep);
}

export function getProjectAddonsInfo(root: string) {
  const roots = [].concat(
    getProjectAddonsRoots(root) as any,
    getProjectInRepoAddonsRoots(root) as any)
  .filter((pathItem: any) => typeof pathItem === 'string');
  // log('roots', roots);
  const meta: any = [];
  roots.forEach((packagePath: string) => {
    const info = getPackageJSON(packagePath);
    // log('info', info);
    const version = addonVersion(info);
    if (version === null) {
      return;
    }
    if (version === 1) {
      // log('isEmberAddon', packagePath);
      const extractedData = [
        ...listComponents(packagePath),
        ...listRoutes(packagePath),
        ...listHelpers(packagePath),
        ...listModels(packagePath),
        ...listTransforms(packagePath),
        ...listServices(packagePath),
        ...listModifiers(packagePath)
      ];
      // log('extractedData', extractedData);
      if (extractedData.length) {
        meta.push(extractedData);
      }
    }
  });
  // log('meta', meta);
  const normalizedResult: any[] = meta.reduce((arrs: any[], item: any[]) => {
    if (!item.length) {
      return arrs;
    }
    return arrs.concat(item);
  }, []);

  return normalizedResult;
}

export function pureComponentName(relativePath: string) {
  const ext = extname(relativePath); // .hbs
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.slice(1);
  }
  if (relativePath.endsWith(`/template${ext}`)) {
    return relativePath.replace(`/template${ext}`, '');
  } else if (relativePath.endsWith(`/component${ext}`)) {
    return relativePath.replace(`/component${ext}`, '');
  } else if (relativePath.endsWith(`/helper${ext}`)) {
    return relativePath.replace(`/helper${ext}`, '');
  } else if (relativePath.endsWith(`/index${ext}`)) {
    return relativePath.replace(`/index${ext}`, '');
  } else {
    return relativePath.replace(ext, '');
  }
}

export function listPodsComponents(root: string): CompletionItem[] {
  let podModulePrefix = podModulePrefixForRoot(root);
  if (podModulePrefix === null) {
    return [];
  }
  // log('listComponents');
  const jsPaths = safeWalkSync(
    join(root, 'app', podModulePrefix, 'components'),
    {
      directories: false,
      globs: ['**/*.{js,ts,hbs}']
    }
  );

  const items = jsPaths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'component'
    };
  });

  // log('pods-items', items);
  return items;
}

export function listMUComponents(root: string): CompletionItem[] {
  const jsPaths = safeWalkSync(join(root, 'src', 'ui', 'components'), {
    directories: false,
    globs: ['**/*.{js,ts,hbs}']
  });

  const items = jsPaths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'component'
    };
  });

  return items;
}

export function builtinModifiers(): CompletionItem[] {
  return [
    {
      kind: CompletionItemKind.Method,
      label: 'action',
      detail: 'modifier'
    }
  ];
}

export function listComponents(root: string): CompletionItem[] {
  // log('listComponents');
  const jsPaths = safeWalkSync(join(root, 'app', 'components'), {
    directories: false,
    globs: ['**/*.{js,ts,hbs}']
  });

  const hbsPaths = safeWalkSync(join(root, 'app', 'templates', 'components'), {
    directories: false,
    globs: ['**/*.hbs']
  });

  const paths = [...jsPaths, ...hbsPaths];

  const items = paths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'component'
    };
  });

  return items;
}

function listCollection(root: string, prefix: 'app' | 'addon', collectionName: 'transforms' | 'modifiers' | 'services' | 'models' | 'helpers', kindType: CompletionItemKind, detail: 'transform' | 'service' | 'model' | 'helper' | 'modifier') {
  const paths = safeWalkSync(join(root, prefix, collectionName), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const items = paths.map((filePath: string) => {
    return {
      kind: kindType,
      label: pureComponentName(filePath),
      detail
    };
  });

  return items;
}

export function listModifiers(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'modifiers', CompletionItemKind.Function, 'modifier');
}

export function listModels(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'models', CompletionItemKind.Class, 'model');
}

export function listServices(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'services', CompletionItemKind.Class, 'service');
}

export function listHelpers(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'helpers', CompletionItemKind.Function, 'helper');
}

export function listTransforms(root: string): CompletionItem[] {
  return listCollection(root, 'app', 'transforms', CompletionItemKind.Function, 'transform');
}

export function listRoutes(root: string): CompletionItem[] {
  // log('listRoutes');
  const paths = safeWalkSync(join(root, 'app', 'routes'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const templatePaths = safeWalkSync(join(root, 'app', 'templates'), {
    directories: false,
    globs: ['**/*.hbs']
  }).filter((name: string) => {
    const skipEndings = ['-loading', '-error', '/loading', '/error', 'index', 'application'];
    return !name.startsWith('components/') && skipEndings.filter((ending: string) => name.endsWith(ending + '.hbs')).length === 0;
  });

  const items = [...templatePaths, ...paths].map((filePath: string) => {
    const label = filePath.replace(extname(filePath), '').replace(/\//g, '.');
    return {
      kind: CompletionItemKind.File,
      label,
      detail: 'route'
    };
  });

  return items;
}

export function getComponentNameFromURI(root: string, uri: string) {
  let fileName = uri.replace('file://', '').replace(root, '');
  let splitter = fileName.includes(sep + '-components' + sep)
    ? '/-components/'
    : '/components/';
  let maybeComponentName = fileName
    .split(sep)
    .join('/')
    .split(splitter)[1];

  if (!maybeComponentName) {
    return null;
  }
  return pureComponentName(maybeComponentName);
}
