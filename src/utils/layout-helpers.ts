import * as memoize from 'memoizee';
import * as walkSync from 'walk-sync';
import * as fs from 'fs';
import * as path from 'path';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { Project } from '../project-roots';
import { addToRegistry, normalizeMatchNaming } from './registry-api';

// const GLOBAL_REGISTRY = ['primitive-name'][['relatedFiles']];

export const ADDON_CONFIG_KEY = 'ember-language-server';

export function normalizeRoutePath(name: string) {
  return name.split('/').join('.');
}

export function hasEmberLanguageServerExtension(info: PackageInfo) {
  return info[ADDON_CONFIG_KEY] !== undefined;
}

export const isModuleUnificationApp = memoize(isMuApp, {
  length: 1,
  maxAge: 60000,
});
export const podModulePrefixForRoot = memoize(getPodModulePrefix, {
  length: 1,
  maxAge: 60000,
});
export const mGetProjectAddonsInfo = memoize(getProjectAddonsInfo, {
  length: 1,
  maxAge: 600000,
}); // 1 second

const mProjectAddonsRoots = memoize(getProjectAddonsRoots, {
  length: 1,
  maxAge: 600000,
});
const mProjectInRepoAddonsRoots = memoize(getProjectInRepoAddonsRoots, {
  length: 1,
  maxAge: 600000,
});

export const isAddonRoot = memoize(isProjectAddonRoot, {
  length: 1,
  maxAge: 600000,
});

type UnknownConfig = Record<string, unknown>;

export interface PackageInfo {
  keywords?: string[];
  name?: string;
  'ember-language-server'?: UnknownConfig;
  peerDependencies?: UnknownConfig;
  devDependencies?: UnknownConfig;
  dependencies?: UnknownConfig;
  'ember-addon'?: {
    version?: number;
    before?: string | string[];
    after?: string | string[];
  };
}

export function isMuApp(root: string) {
  return fs.existsSync(path.join(root, 'src', 'ui'));
}

export function safeWalkSync(filePath: string | false, opts: any) {
  if (!filePath) {
    return [];
  }

  if (!fs.existsSync(filePath)) {
    return [];
  }

  return walkSync(filePath, opts);
}

export function getPodModulePrefix(root: string): string | null {
  let podModulePrefix = '';

  // log('listPodsComponents');
  try {
    // @ts-expect-error @todo - fix webpack imports
    const requireFunc = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appConfig = requireFunc(path.join(root, 'config', 'environment.js'));

    // log('appConfig', appConfig);
    podModulePrefix = appConfig('development').podModulePrefix || '';

    if (podModulePrefix.includes('/')) {
      podModulePrefix = podModulePrefix.split('/').pop() as string;
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
  const roots = root.split(path.sep);

  while (roots.length) {
    const prefix = roots.join(path.sep);
    const maybePath = path.join(prefix, packagesFolder, addonName);
    const linkedPath = path.join(prefix, addonName);

    if (fs.existsSync(path.join(maybePath, 'package.json'))) {
      return maybePath;
    } else if (fs.existsSync(path.join(linkedPath, 'package.json'))) {
      return linkedPath;
    }

    roots.pop();
  }

  return false;
}

export function isProjectAddonRoot(root: string) {
  const pack = getPackageJSON(root);
  const hasIndexJs = fs.existsSync(path.join(root, 'index.js'));

  return isEmberAddon(pack) && hasIndexJs;
}

export function isELSAddonRoot(root: string) {
  const pack = getPackageJSON(root);

  return hasEmberLanguageServerExtension(pack);
}

export function getProjectInRepoAddonsRoots(root: string) {
  const prefix = isModuleUnificationApp(root) ? 'packages' : 'lib';
  const addons = safeWalkSync(path.join(root, prefix), {
    directories: true,
    globs: ['**/package.json'],
  });
  const engineAddons = safeWalkSync(path.join(root, 'engines'), {
    directories: true,
    globs: ['**/package.json'],
  });
  const roots: string[] = [];

  addons
    .map((relativePath: string) => {
      return path.dirname(path.join(root, prefix, relativePath));
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

  engineAddons
    .map((relativePath: string) => {
      return path.dirname(path.join(root, 'engines', relativePath));
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

export function listGlimmerXComponents(root: string) {
  try {
    const jsPaths = safeWalkSync(root, {
      directories: false,
      globs: ['**/*.{js,ts,jsx,hbs}'],
      ignore: ['dist', 'lib', 'node_modules', 'tmp', 'cache', '.*', '.cache', '.git', '.*.{js,ts,jsx,hbs,gbx}'],
    });

    return jsPaths
      .map((p) => {
        const fileName = p.split('/').pop();

        if (fileName === undefined) {
          return '';
        }

        return fileName.slice(0, fileName.lastIndexOf('.'));
      })
      .filter((p) => {
        return p.length && p.charAt(0) === p.charAt(0).toUpperCase() && !p.endsWith('-test') && !p.endsWith('.test');
      })
      .map((name) => {
        return {
          kind: CompletionItemKind.Class,
          label: name,
          detail: 'component',
        };
      });
  } catch (e) {
    return [];
  }
}

export function listGlimmerNativeComponents(root: string) {
  try {
    const possiblePath = resolvePackageRoot(root, 'glimmer-native', 'node_modules');

    if (!possiblePath) {
      return [];
    }

    const components = fs.readdirSync(path.join(possiblePath, 'dist', 'src', 'glimmer', 'native-components'));

    return components.map((name) => {
      return {
        kind: CompletionItemKind.Class,
        label: name,
        detail: 'component',
      };
    });
  } catch (e) {
    return [];
  }
}

function hasDep(pack: any, depName: string) {
  if (pack.dependencies && pack.dependencies[depName]) {
    return true;
  }

  if (pack.devDependencies && pack.devDependencies[depName]) {
    return true;
  }

  if (pack.peerDependencies && pack.peerDependencies[depName]) {
    return true;
  }

  return false;
}

export function isGlimmerNativeProject(root: string) {
  const pack = getPackageJSON(root);

  return hasDep(pack, 'glimmer-native');
}

export function isGlimmerXProject(root: string) {
  const pack = getPackageJSON(root);

  return hasDep(pack, '@glimmerx/core') || hasDep(pack, 'glimmer-lite-core');
}

export function getProjectAddonsRoots(root: string, resolvedItems: string[] = [], packageFolderName = 'node_modules') {
  const pack = getPackageJSON(root);

  if (resolvedItems.length) {
    if (!isEmberAddon(pack)) {
      return [];
    }
  }

  // log('getPackageJSON', pack);
  const items = resolvedItems.length
    ? [...Object.keys(pack.dependencies || {}), ...Object.keys(pack.peerDependencies || {})]
    : [...Object.keys(pack.dependencies || {}), ...Object.keys(pack.peerDependencies || {}), ...Object.keys(pack.devDependencies || {})];
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
    const packInfo = getPackageJSON(rootItem);

    // we don't need to go deeper if package itself not an ember-addon or els-extension
    if (!isEmberAddon(packInfo) && !hasEmberLanguageServerExtension(packInfo)) {
      return;
    }

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

export function getPackageJSON(file: string): PackageInfo {
  try {
    const result = JSON.parse(fs.readFileSync(path.join(file, 'package.json'), 'utf8'));

    return result;
  } catch (e) {
    return {};
  }
}

export function isEmberAddon(info: PackageInfo) {
  return info.keywords && info.keywords.includes('ember-addon');
}

function addonVersion(info: PackageInfo) {
  if (!isEmberAddon(info)) {
    return null;
  }

  return isEmberAddonV2(info) ? 2 : 1;
}

function isEmberAddonV2(info: PackageInfo) {
  return info['ember-addon'] && info['ember-addon'].version === 2;
}

export function isTemplatePath(filePath: string) {
  return filePath.endsWith('.hbs');
}

export function normalizedPath(filePath: string) {
  if (filePath.includes('\\')) {
    return filePath.split('\\').join('/');
  } else {
    return filePath;
  }
}

export function isTestFile(filePath: string) {
  return normalizedPath(filePath).includes('/tests/');
}

export function hasAddonFolderInPath(name: string) {
  return name.includes(path.sep + 'addon' + path.sep) || name.includes(path.sep + 'addon-test-support' + path.sep);
}

export function getProjectAddonsInfo(root: string, appName?: string) {
  const childAppRoot = appName ? mProjectInRepoAddonsRoots(path.join(root, appName)) : [];

  const roots = ([] as string[])
    .concat(mProjectAddonsRoots(root), mProjectInRepoAddonsRoots(root), childAppRoot as any)
    .filter((pathItem: any) => typeof pathItem === 'string');
  // log('roots', roots);
  const meta: any = [];

  const isNamespaceSupported = hasNamespaceSupport(root);

  roots.forEach((packagePath: string) => {
    const info = getPackageJSON(packagePath);
    // log('info', info);
    const version = addonVersion(info);

    if (version === null) {
      return;
    }

    if (version === 1) {
      const addonName = info.name;
      const extractedData = [
        ...listComponents(packagePath, addonName, isNamespaceSupported),
        ...listRoutes(packagePath),
        ...listHelpers(packagePath),
        ...listModels(packagePath),
        ...listTransforms(packagePath),
        ...listServices(packagePath),
        ...listModifiers(packagePath),
      ];

      // log('extractedData', extractedData);
      if (extractedData.length) {
        meta.push(extractedData);
      }
    }
  });

  // log('meta', meta);
  if (isGlimmerNativeProject(root)) {
    meta.push(listGlimmerNativeComponents(root));
  }

  if (isGlimmerXProject(root)) {
    meta.push(listGlimmerXComponents(root));
  }

  const normalizedResult: any[] = meta.reduce((arrs: any[], item: any[]) => {
    if (!item.length) {
      return arrs;
    }

    return arrs.concat(item);
  }, []);

  return normalizedResult;
}

export function pureComponentName(relativePath: string) {
  const ext = path.extname(relativePath); // .hbs

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
  } else if (relativePath.endsWith(`/styles${ext}`)) {
    return relativePath.replace(`/styles${ext}`, '');
  } else {
    return relativePath.replace(ext, '');
  }
}

export function listPodsComponents(root: string): CompletionItem[] {
  const podModulePrefix = podModulePrefixForRoot(root);

  if (podModulePrefix === null) {
    return [];
  }

  const entryPath = path.resolve(path.join(root, 'app', podModulePrefix, 'components'));

  const jsPaths = safeWalkSync(entryPath, {
    directories: false,
    globs: ['**/*.{js,ts,hbs,css,less,scss}'],
  });

  const items = jsPaths.map((filePath: string) => {
    addToRegistry(pureComponentName(filePath), 'component', [path.join(entryPath, filePath)]);

    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'component',
    };
  });

  // log('pods-items', items);
  return items;
}

export function listMUComponents(root: string): CompletionItem[] {
  const entryPath = path.resolve(path.join(root, 'src', 'ui', 'components'));
  const jsPaths = safeWalkSync(entryPath, {
    directories: false,
    globs: ['**/*.{js,ts,hbs}'],
  });

  const items = jsPaths.map((filePath: string) => {
    addToRegistry(pureComponentName(filePath), 'component', [path.join(entryPath, filePath)]);

    return {
      kind: CompletionItemKind.Class,
      label: pureComponentName(filePath),
      detail: 'component',
    };
  });

  return items;
}

export function builtinModifiers(): CompletionItem[] {
  return [
    {
      kind: CompletionItemKind.Method,
      label: 'action',
      detail: 'modifier',
    },
  ];
}

function hasNamespaceSupport(root: string) {
  const pack = getPackageJSON(root);

  return hasDep(pack, 'ember-holy-futuristic-template-namespacing-batman');
}

export function listComponents(_root: string, addonName?: string, isNamespaceSupported?: boolean): CompletionItem[] {
  // log('listComponents');
  const root = path.resolve(_root);
  const scriptEntry = path.join(root, 'app', 'components');
  const templateEntry = path.join(root, 'app', 'templates', 'components');
  const addonComponents = path.join(root, 'addon', 'components');
  const addonTemplates = path.join(root, 'addon', 'templates', 'components');
  const addonComponentsPaths = safeWalkSync(addonComponents, {
    directories: false,
    globs: ['**/*.{js,ts,hbs}'],
  });
  const addonTemplatesPaths = safeWalkSync(addonTemplates, {
    directories: false,
    globs: ['**/*.{js,ts,hbs}'],
  });

  addonComponentsPaths.forEach((p) => {
    addToRegistry(pureComponentName(p), 'component', [path.join(addonComponents, p)]);
  });
  addonTemplatesPaths.forEach((p) => {
    addToRegistry(pureComponentName(p), 'component', [path.join(addonTemplates, p)]);
  });

  const jsPaths = safeWalkSync(scriptEntry, {
    directories: false,
    globs: ['**/*.{js,ts,hbs,css,less,scss}'],
  });

  jsPaths.forEach((p) => {
    addToRegistry(pureComponentName(p), 'component', [path.join(scriptEntry, p)]);
  });

  const hbsPaths = safeWalkSync(templateEntry, {
    directories: false,
    globs: ['**/*.hbs'],
  });

  hbsPaths.forEach((p) => {
    addToRegistry(pureComponentName(p), 'component', [path.join(templateEntry, p)]);
  });

  const paths = [...jsPaths, ...hbsPaths, ...addonComponentsPaths, ...addonTemplatesPaths];

  const items = paths.map((filePath: string) => {
    const label = addonName && isNamespaceSupported ? `${addonName}$${pureComponentName(filePath)}` : pureComponentName(filePath);

    return {
      kind: CompletionItemKind.Class,
      label,
      detail: 'component',
    };
  });

  return items;
}

function findRegistryItemsForProject(project: Project, prefix: string, globs: string[]): void {
  const entry = path.resolve(path.join(project.root, prefix));
  const paths = safeWalkSync(entry, {
    directories: false,
    globs,
  });

  paths.forEach((filePath: string) => {
    const fullPath = path.join(entry, filePath);
    const item = project.matchPathToType(fullPath);

    if (item) {
      const normalizedItem = normalizeMatchNaming(item);

      addToRegistry(normalizedItem.name, normalizedItem.type, [fullPath]);
    }
  });
}

export function findTestsForProject(project: Project) {
  findRegistryItemsForProject(project, 'tests', ['**/*.{js,ts}']);
}

export function findAppItemsForProject(project: Project) {
  findRegistryItemsForProject(project, 'app', ['**/*.{js,ts,css,less,sass,hbs}']);
}

export function findAddonItemsForProject(project: Project) {
  findRegistryItemsForProject(project, 'addon', ['**/*.{js,ts,css,less,sass,hbs}']);
}

function listCollection(
  root: string,
  prefix: 'app' | 'addon',
  collectionName: 'transforms' | 'modifiers' | 'services' | 'models' | 'helpers',
  kindType: CompletionItemKind,
  detail: 'transform' | 'service' | 'model' | 'helper' | 'modifier'
) {
  const entry = path.resolve(path.join(root, prefix, collectionName));
  const paths = safeWalkSync(entry, {
    directories: false,
    globs: ['**/*.{js,ts}'],
  });

  const items = paths.map((filePath: string) => {
    addToRegistry(pureComponentName(filePath), detail, [path.join(entry, filePath)]);

    return {
      kind: kindType,
      label: pureComponentName(filePath),
      detail,
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

export function listRoutes(_root: string): CompletionItem[] {
  const root = path.resolve(_root);
  const scriptEntry = path.join(root, 'app', 'routes');
  const templateEntry = path.join(root, 'app', 'templates');
  const controllersEntry = path.join(root, 'app', 'controllers');
  const paths = safeWalkSync(scriptEntry, {
    directories: false,
    globs: ['**/*.{js,ts}'],
  });

  const templatePaths = safeWalkSync(templateEntry, {
    directories: false,
    globs: ['**/*.hbs'],
  }).filter((name: string) => {
    const skipEndings = ['-loading', '-error', '/loading', '/error'];

    return !name.startsWith('components/') && skipEndings.filter((ending: string) => name.endsWith(ending + '.hbs')).length === 0;
  });

  const controllers = safeWalkSync(controllersEntry, {
    directories: false,
    globs: ['**/*.{js,ts}'],
  });

  let items: any[] = [];

  items = items.concat(
    templatePaths.map((filePath) => {
      const label = filePath.replace(path.extname(filePath), '').replace(/\//g, '.');

      addToRegistry(label, 'routePath', [path.join(templateEntry, filePath)]);

      return {
        kind: CompletionItemKind.File,
        label,
        detail: 'route',
      };
    })
  );

  items = items.concat(
    paths.map((filePath) => {
      const label = filePath.replace(path.extname(filePath), '').replace(/\//g, '.');

      addToRegistry(label, 'routePath', [path.join(scriptEntry, filePath)]);

      return {
        kind: CompletionItemKind.File,
        label,
        detail: 'route',
      };
    })
  );

  controllers.forEach((filePath) => {
    const label = filePath.replace(path.extname(filePath), '').replace(/\//g, '.');

    addToRegistry(label, 'routePath', [path.join(controllersEntry, filePath)]);
  });

  return items;
}

export function getComponentNameFromURI(root: string, uri: string) {
  const fileName = uri.replace('file://', '').replace(root, '');
  const splitter = fileName.includes(path.sep + '-components' + path.sep) ? '/-components/' : '/components/';
  const maybeComponentName = fileName.split(path.sep).join('/').split(splitter)[1];

  if (!maybeComponentName) {
    return null;
  }

  return pureComponentName(maybeComponentName);
}
