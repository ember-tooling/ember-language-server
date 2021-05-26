import * as memoize from 'memoizee';
import * as walkSync from 'walk-sync';
import * as fs from 'fs';
import * as path from 'path';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { addToRegistry, normalizeMatchNaming } from './registry-api';
import { clean, coerce, valid } from 'semver';
import { BaseProject } from '../base-project';

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

export const isAddonRoot = memoize(isProjectAddonRoot, {
  length: 1,
  maxAge: 600000,
});

type UnknownConfig = Record<string, unknown>;
type StringConfig = Record<string, string>;

export interface PackageInfo {
  keywords?: string[];
  name?: string;
  'ember-language-server'?: UnknownConfig;
  peerDependencies?: StringConfig;
  devDependencies?: StringConfig;
  dependencies?: StringConfig;
  'ember-addon'?: {
    version?: number;
    paths?: string[];
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

/**
 * Returns true if file path starts with the given root path.
 * There are cases where the root path might be
 * 'foo/bar/biz' and 'foo/bar/biz-bar'. The startsWith/includes will always
 * return true for both these roots. Hence having a stricter check will help
 * @param rootPath root path
 * @param filePath file path
 * @returns boolean
 */
export function isRootStartingWithFilePath(rootPath: string, filePath: string) {
  if (!filePath.startsWith(rootPath)) {
    return false;
  }

  const filePathParts = normalizedPath(filePath).split('/');
  const rootParts = normalizedPath(rootPath).split('/');

  return rootParts.every((item: string, idx: number) => filePathParts[idx] === item);
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

export function cached(_proto: unknown, prop: string, desc: PropertyDescriptor) {
  const values = new WeakMap();

  return {
    get() {
      if (!values.has(this)) {
        values.set(this, {});
      }

      const objects = values.get(this);

      if (!(prop in objects)) {
        objects[prop] = desc.get?.call(this);
      }

      return objects[prop];
    },
  };
}

function getRecursiveInRepoAddonRoots(root: string, roots: string[]) {
  const packageData = getPackageJSON(root);
  const emberAddonPaths: string[] = (packageData['ember-addon'] && packageData['ember-addon'].paths) || [];

  if (roots.length) {
    if (!isEmberAddon(packageData)) {
      return [];
    }
  }

  const recursiveRoots: string[] = roots.slice(0);

  emberAddonPaths
    .map((relativePath) => path.normalize(path.join(root, relativePath)))
    .filter((packageRoot: string) => {
      return isProjectAddonRoot(packageRoot);
    })
    .forEach((validRoot: string) => {
      const packInfo = getPackageJSON(validRoot);

      // we don't need to go deeper if package itself not an ember-addon or els-extension
      if (!isEmberAddon(packInfo) && !hasEmberLanguageServerExtension(packInfo)) {
        return;
      }

      if (!recursiveRoots.includes(validRoot)) {
        recursiveRoots.push(validRoot);
        getRecursiveInRepoAddonRoots(validRoot, recursiveRoots).forEach((relatedRoot: string) => {
          if (!recursiveRoots.includes(relatedRoot)) {
            recursiveRoots.push(relatedRoot);
          }
        });
      }
    });

  return recursiveRoots.sort();
}

export function getProjectInRepoAddonsRoots(root: string) {
  const roots: string[] = [];

  if (isModuleUnificationApp(root)) {
    const prefix = 'packages';
    const addons = safeWalkSync(path.join(root, prefix), {
      directories: true,
      globs: ['**/package.json'],
    });

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
  } else {
    getRecursiveInRepoAddonRoots(root, []).forEach((resolvedRoot) => {
      if (!roots.includes(resolvedRoot)) {
        roots.push(resolvedRoot);
      }
    });
  }

  return roots;
}

export function listGlimmerXComponents(root: string): CompletionItem[] {
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

function hasDep(pack: PackageInfo, depName: string) {
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

export function getDepIfExists(pack: PackageInfo, depName: string): string | null {
  if (!hasDep(pack, depName)) {
    return null;
  }

  const version: string = pack?.dependencies?.[depName] ?? pack?.devDependencies?.[depName] ?? pack?.peerDependencies?.[depName] ?? '';

  const cleanVersion = clean(version);

  return valid(coerce(cleanVersion));
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

export function addonVersion(info: PackageInfo) {
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

export function isScriptPath(filePath: string) {
  if (isTestFile(filePath)) {
    return false;
  }

  return filePath.endsWith('.js') || filePath.endsWith('.ts');
}

export function normalizedPath(filePath: string) {
  if (filePath.includes('\\')) {
    return filePath.split('\\').join('/');
  } else {
    return filePath;
  }
}

export function isStyleFile(filePath: string) {
  const ext = ['css', 'less', 'scss'];

  return ext.includes(filePath.split('.').pop() as string);
}

export function isTestFile(filePath: string) {
  return normalizedPath(filePath).includes('/tests/');
}

export function hasAddonFolderInPath(name: string) {
  return name.includes(path.sep + 'addon' + path.sep) || name.includes(path.sep + 'addon-test-support' + path.sep);
}

export function getProjectAddonsInfo(root: string): void {
  const roots = ([] as string[])
    .concat(getProjectAddonsRoots(root), getProjectInRepoAddonsRoots(root))
    .filter((pathItem: unknown) => typeof pathItem === 'string');

  roots.forEach((packagePath: string) => {
    const info = getPackageJSON(packagePath);
    // log('info', info);
    const version = addonVersion(info);

    if (version === null) {
      return;
    }

    if (version === 1) {
      const localProject = new BaseProject(packagePath);

      listComponents(localProject);
      listRoutes(localProject);
      listHelpers(localProject);
      listModels(localProject);
      listTransforms(localProject);
      listServices(localProject);
      listModifiers(localProject);
    }
  });
}

export function listPodsComponents(project: BaseProject): void {
  const podModulePrefix = podModulePrefixForRoot(project.root);

  if (podModulePrefix === null) {
    return;
  }

  const entryPath = path.resolve(path.join(project.root, 'app', podModulePrefix, 'components'));

  const jsPaths = safeWalkSync(entryPath, {
    directories: false,
    globs: ['**/*.{js,ts,hbs,css,less,scss}'],
  });

  jsPaths.forEach((filePath: string) => {
    const data = project.matchPathToType(filePath);

    if (data?.type === 'component') {
      addToRegistry(data.name, data.type, [path.join(entryPath, filePath)]);
    }
  });
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

export function hasNamespaceSupport(root: string) {
  const pack = getPackageJSON(root);

  return hasDep(pack, 'ember-holy-futuristic-template-namespacing-batman');
}

export function listComponents(project: BaseProject): void {
  // log('listComponents');
  const root = path.resolve(project.root);
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
    const fsPath = path.join(addonComponents, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });
  addonTemplatesPaths.forEach((p) => {
    const fsPath = path.join(addonTemplates, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });

  const jsPaths = safeWalkSync(scriptEntry, {
    directories: false,
    globs: ['**/*.{js,ts,hbs,css,less,scss}'],
  });

  jsPaths.forEach((p) => {
    const fsPath = path.join(scriptEntry, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });

  const hbsPaths = safeWalkSync(templateEntry, {
    directories: false,
    globs: ['**/*.hbs'],
  });

  hbsPaths.forEach((p) => {
    const fsPath = path.join(templateEntry, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });
}

function findRegistryItemsForProject(project: BaseProject, prefix: string, globs: string[]): void {
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

export function findTestsForProject(project: BaseProject) {
  findRegistryItemsForProject(project, 'tests', ['**/*.{js,ts}']);
}

export function findAppItemsForProject(project: BaseProject) {
  findRegistryItemsForProject(project, 'app', ['**/*.{js,ts,css,less,sass,hbs}']);
}

export function findAddonItemsForProject(project: BaseProject) {
  findRegistryItemsForProject(project, 'addon', ['**/*.{js,ts,css,less,sass,hbs}']);
}

function listCollection(
  project: BaseProject,
  prefix: 'app' | 'addon',
  collectionName: 'transforms' | 'modifiers' | 'services' | 'models' | 'helpers',
  detail: 'transform' | 'service' | 'model' | 'helper' | 'modifier'
) {
  const entry = path.resolve(path.join(project.root, prefix, collectionName));
  const paths = safeWalkSync(entry, {
    directories: false,
    globs: ['**/*.{js,ts}'],
  });

  paths.forEach((filePath: string) => {
    const fsPath = path.join(entry, filePath);
    const data = project.matchPathToType(fsPath);

    if (data && data.type === detail) {
      addToRegistry(data.name, detail, [fsPath]);
    }
  });
}

export function listModifiers(project: BaseProject): void {
  return listCollection(project, 'app', 'modifiers', 'modifier');
}

export function listModels(project: BaseProject): void {
  return listCollection(project, 'app', 'models', 'model');
}

export function listServices(project: BaseProject): void {
  return listCollection(project, 'app', 'services', 'service');
}

export function listHelpers(project: BaseProject): void {
  return listCollection(project, 'app', 'helpers', 'helper');
}

export function listTransforms(project: BaseProject): void {
  return listCollection(project, 'app', 'transforms', 'transform');
}

export function listRoutes(project: BaseProject): void {
  const root = path.resolve(project.root);
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

  templatePaths.forEach((filePath) => {
    const label = filePath.replace(path.extname(filePath), '').replace(/\//g, '.');

    addToRegistry(label, 'routePath', [path.join(templateEntry, filePath)]);
  });

  paths.forEach((filePath) => {
    const label = filePath.replace(path.extname(filePath), '').replace(/\//g, '.');

    addToRegistry(label, 'routePath', [path.join(scriptEntry, filePath)]);

    return {
      kind: CompletionItemKind.File,
      label,
      detail: 'route',
    };
  });

  controllers.forEach((filePath) => {
    const label = filePath.replace(path.extname(filePath), '').replace(/\//g, '.');

    addToRegistry(label, 'routePath', [path.join(controllersEntry, filePath)]);
  });
}
