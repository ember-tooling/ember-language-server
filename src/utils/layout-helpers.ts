const memoize = require('memoizee');
const walkSync = require('walk-sync');
import { join, sep, extname } from 'path';
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

export function resolvePackageRoot(root: string, addonName: string) {
  const roots = root.split(sep);
  while (roots.length) {
    const maybePath = join(roots.join(sep), 'node_modules', addonName);
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
  return isEmeberAddon(pack) && hasIndexJs;
}

export function getProjectAddonsRoots(root: string) {
  // log('getProjectAddonsInfo', root);
  const pack = getPackageJSON(root);
  // log('getPackageJSON', pack);
  const items = [
    ...Object.keys(pack.dependencies || {}),
    ...Object.keys(pack.devDependencies || {})
  ];
  // log('items', items);

  const roots = items
    .map((item: string) => {
      return resolvePackageRoot(root, item);
    })
    .filter((p: string | boolean) => {
      return p !== false;
    });
  return roots;
}

export function getPackageJSON(file: string) {
  try {
    const result = JSON.parse(readFileSync(join(file, 'package.json'), 'utf8'));
    return result;
  } catch (e) {
    return {};
  }
}

export function isEmeberAddon(info: any) {
  return info.keywords && info.keywords.includes('ember-addon');
}

export function isTemplatePath(filePath: string) {
  return filePath.endsWith('.hbs');
}

export function hasAddonFolderInPath(name: string) {
  return name.includes(sep + 'addon' + sep);
}

export function getProjectAddonsInfo(root: string) {
  const roots = getProjectAddonsRoots(root);
  // log('roots', roots);
  const meta: any = [];
  roots.forEach((packagePath: string) => {
    const info = getPackageJSON(packagePath);
    // log('info', info);
    if (isEmeberAddon(info)) {
      // log('isEmberAddon', packagePath);
      const extractedData = [
        ...listComponents(packagePath),
        ...listRoutes(packagePath),
        ...listHelpers(packagePath),
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

export function listModifiers(root: string): CompletionItem[] {
  const appPaths = safeWalkSync(join(root, 'app', 'modifiers'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });
  const addonPaths = safeWalkSync(join(root, 'addon', 'modifiers'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });
  const items = [...appPaths, ...addonPaths].map((filePath: string) => {
    return {
      kind: CompletionItemKind.Function,
      label: pureComponentName(filePath),
      detail: 'modifier'
    };
  });
  return items;
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

export function listModels(root: string): CompletionItem[] {
  const paths = safeWalkSync(join(root, 'app', 'models'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const items = paths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'model'
    };
  });

  return items;
}

export function listServices(root: string): CompletionItem[] {
  const paths = safeWalkSync(join(root, 'app', 'services'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const items = paths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'service'
    };
  });

  return items;
}

export function listHelpers(root: string): CompletionItem[] {
  // log('listHelpers');
  const paths = safeWalkSync(join(root, 'app', 'helpers'), {
    directories: false,
    globs: ['**/*.{js,ts}']
  });

  const items = paths.map((filePath: string) => {
    return {
      kind: CompletionItemKind.Function,
      label: pureComponentName(filePath),
      detail: 'helper'
    };
  });

  return items;
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
