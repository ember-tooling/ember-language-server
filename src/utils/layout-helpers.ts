import * as memoize from 'memoizee';
import * as path from 'path';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';
import { addToRegistry, normalizeMatchNaming } from './registry-api';
import { clean, coerce, valid } from 'semver';
import { BaseProject } from '../base-project';
import { fsProvider } from '../fs-provider';
import walkAsync from './walk-async';

// const GLOBAL_REGISTRY = ['primitive-name'][['relatedFiles']];

export const ADDON_CONFIG_KEY = 'ember-language-server';

export async function asyncFilter<T>(arr: T[], predicate: (value: unknown) => Promise<boolean | undefined>): Promise<T[]> {
  const results = await Promise.all(arr.map((e) => predicate(e)));

  return arr.filter((_v, index) => results[index]) as T[];
}

export function normalizeRoutePath(name: string) {
  return name.split('/').join('.');
}

export function hasEmberLanguageServerExtension(info: PackageInfo) {
  return info[ADDON_CONFIG_KEY] !== undefined;
}

export const podModulePrefixForRoot = memoize(getPodModulePrefix, {
  length: 1,
  maxAge: 60000,
});
export const mGetProjectAddonsInfo = memoize(getProjectAddonsInfo, {
  length: 1,
  maxAge: 600000,
}); // 1 second

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

let _supportSyncFS = true;
let _requireSupport = true;

export function setSyncFSSupport(value: boolean) {
  _supportSyncFS = value;
}

export function getSyncFSSupport() {
  return _supportSyncFS;
}

export function setRequireSupport(value: boolean) {
  _requireSupport = value;
}

export function getRequireSupport() {
  return _requireSupport;
}

export async function safeWalkAsync(filePath: string | false, opts: any) {
  if (!filePath) {
    return [];
  }

  if (!(await fsProvider().exists(filePath))) {
    return [];
  }

  return await walkAsync(filePath, { ...opts, fs: fsProvider() });
}

export function getPodModulePrefix(root: string): string | null {
  let podModulePrefix = '';

  // logDebugInfo('listPodsComponents');
  try {
    if (!getRequireSupport()) {
      return null;
    }

    // @ts-expect-error @todo - fix webpack imports
    const requireFunc = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appConfig = requireFunc(path.join(root, 'config', 'environment.js'));

    // logDebugInfo('appConfig', appConfig);
    podModulePrefix = appConfig('development').podModulePrefix || '';

    if (podModulePrefix.includes('/')) {
      podModulePrefix = podModulePrefix.split('/').pop() as string;
    }
  } catch (e) {
    // logDebugInfo('catch', e);
    return null;
  }

  if (!podModulePrefix) {
    return null;
  }

  return podModulePrefix.trim().length > 0 ? podModulePrefix : null;
}

export async function resolvePackageRoot(root: string, addonName: string, packagesFolder = 'node_modules'): Promise<string | false> {
  const roots = root.split(path.sep);

  while (roots.length) {
    const prefix = roots.join(path.sep);
    const maybePath = path.join(prefix, packagesFolder, addonName);
    const linkedPath = path.join(prefix, addonName);

    if (await fsProvider().exists(path.join(maybePath, 'package.json'))) {
      return maybePath;
    } else if (await fsProvider().exists(path.join(linkedPath, 'package.json'))) {
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

export function isFileBelongsToRoots(roots: string[], filePath: string) {
  return roots.some((root) => isRootStartingWithFilePath(root, filePath));
}

async function isProjectAddonRoot(root: string) {
  const pack = await asyncGetPackageJSON(root);
  const hasIndexJs = await fsProvider().exists(path.join(root, 'index.js'));

  return isEmberAddon(pack) && hasIndexJs;
}

export async function isELSAddonRoot(root: string) {
  const pack = await asyncGetPackageJSON(root);

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

async function getRecursiveInRepoAddonRoots(root: string, roots: string[]) {
  const packageData = await asyncGetPackageJSON(root);
  const emberAddonPaths: string[] = (packageData['ember-addon'] && packageData['ember-addon'].paths) || [];

  if (roots.length) {
    if (!isEmberAddon(packageData)) {
      return [];
    }
  }

  const recursiveRoots: string[] = roots.slice(0);

  const normalizedPaths = emberAddonPaths.map((relativePath) => path.normalize(path.join(root, relativePath)));

  const validPaths = await asyncFilter(normalizedPaths, isProjectAddonRoot);

  for (const validRoot of validPaths) {
    const packInfo = await asyncGetPackageJSON(validRoot);

    // we don't need to go deeper if package itself not an ember-addon or els-extension
    if (!isEmberAddon(packInfo) && !hasEmberLanguageServerExtension(packInfo)) {
      continue;
    }

    if (!recursiveRoots.includes(validRoot)) {
      recursiveRoots.push(validRoot);
      const items = await getRecursiveInRepoAddonRoots(validRoot, recursiveRoots);

      items.forEach((relatedRoot: string) => {
        if (!recursiveRoots.includes(relatedRoot)) {
          recursiveRoots.push(relatedRoot);
        }
      });
    }
  }

  return recursiveRoots.sort();
}

export async function getProjectInRepoAddonsRoots(root: string): Promise<string[]> {
  const roots: string[] = await getRecursiveInRepoAddonRoots(root, []);

  return Array.from(new Set(roots));
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

export async function isGlimmerXProject(root: string) {
  const pack = await asyncGetPackageJSON(root);

  return hasDep(pack, '@glimmerx/core') || hasDep(pack, 'glimmer-lite-core');
}

export async function getProjectAddonsRoots(root: string, resolvedItems: string[] = [], packageFolderName = 'node_modules') {
  const pack = await asyncGetPackageJSON(root);

  if (resolvedItems.length) {
    if (!isEmberAddon(pack)) {
      return [];
    }
  }

  const items = resolvedItems.length
    ? [...Object.keys(pack.dependencies || {}), ...Object.keys(pack.peerDependencies || {})]
    : [...Object.keys(pack.dependencies || {}), ...Object.keys(pack.peerDependencies || {}), ...Object.keys(pack.devDependencies || {})];
  // logDebugInfo('items', items);

  const rawRoots = await Promise.all(
    items.map(async (item: string) => {
      return await resolvePackageRoot(root, item, packageFolderName);
    })
  );

  const roots = rawRoots.filter((p: string | boolean) => {
    return p !== false;
  }) as string[];

  const recursiveRoots: string[] = resolvedItems.slice(0);

  const packages = await Promise.all(roots.map((root) => asyncGetPackageJSON(root)));

  for (const rootItem of roots) {
    const packInfo = packages[roots.indexOf(rootItem)];

    // we don't need to go deeper if package itself not an ember-addon or els-extension
    if (!isEmberAddon(packInfo) && !hasEmberLanguageServerExtension(packInfo)) {
      continue;
    }

    if (!recursiveRoots.includes(rootItem)) {
      recursiveRoots.push(rootItem);
      const addonRoots = await getProjectAddonsRoots(rootItem, recursiveRoots, packageFolderName);

      addonRoots.forEach((item: string) => {
        if (!recursiveRoots.includes(item)) {
          recursiveRoots.push(item);
        }
      });
    }
  }

  return recursiveRoots;
}

export async function asyncGetPackageJSON(file: string): Promise<PackageInfo> {
  const content = await asyncGetJSON(path.join(file, 'package.json'));

  return content;
}

export async function asyncGetJSON(filePath: string): Promise<PackageInfo> {
  try {
    const content = await fsProvider().readFile(filePath);

    if (content === null) {
      return {};
    }

    const result = JSON.parse(content);

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

export async function getProjectAddonsInfo(root: string): Promise<void> {
  const [projectAddonsRoots, projectInRepoAddonsRoots] = await Promise.all([getProjectAddonsRoots(root), getProjectInRepoAddonsRoots(root)]);
  const roots = ([] as string[]).concat(projectAddonsRoots, projectInRepoAddonsRoots).filter((pathItem: unknown) => typeof pathItem === 'string');

  for (const packagePath of roots) {
    const info = await asyncGetPackageJSON(packagePath);
    // logDebugInfo('info', info);
    const version = addonVersion(info);

    if (version === null) {
      continue;
    }

    if (version === 1) {
      const localProject = new BaseProject(packagePath);

      await Promise.all([
        listComponents(localProject),
        listRoutes(localProject),
        listHelpers(localProject),
        listModels(localProject),
        listTransforms(localProject),
        listServices(localProject),
        listModifiers(localProject),
      ]);
    }
  }
}

export async function listPodsComponents(project: BaseProject): Promise<void> {
  const podModulePrefix = podModulePrefixForRoot(project.root);

  if (podModulePrefix === null) {
    return;
  }

  const entryPath = path.resolve(path.join(project.root, 'app', podModulePrefix, 'components'));

  const jsPaths = await safeWalkAsync(entryPath, {
    directories: false,
    globs: ['**/*.js', '**/*.ts', '**/*.hbs', '**/*.css', '**/*.less', '**/*.scss'],
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

export async function hasNamespaceSupport(root: string) {
  const pack = await asyncGetPackageJSON(root);

  return hasDep(pack, 'ember-holy-futuristic-template-namespacing-batman');
}

export async function listComponents(project: BaseProject): Promise<void> {
  // logDebugInfo('listComponents');
  const root = path.resolve(project.root);
  const scriptEntry = path.join(root, 'app', 'components');
  const templateEntry = path.join(root, 'app', 'templates', 'components');
  const addonComponents = path.join(root, 'addon', 'components');
  const addonTemplates = path.join(root, 'addon', 'templates', 'components');

  const [addonComponentsPaths, addonTemplatesPaths, jsPaths, hbsPaths] = await Promise.all([
    safeWalkAsync(addonComponents, {
      directories: false,
      globs: ['**/*.js', '**/*.ts', '**/*.hbs'],
    }),
    safeWalkAsync(addonTemplates, {
      directories: false,
      globs: ['**/*.js', '**/*.ts', '**/*.hbs'],
    }),
    safeWalkAsync(scriptEntry, {
      directories: false,
      globs: ['**/*.js', '**/*.ts', '**/*.hbs', '**/*.css', '**/*.less', '**/*.scss'],
    }),
    safeWalkAsync(templateEntry, {
      directories: false,
      globs: ['**/*.hbs'],
    }),
  ]);

  addonComponentsPaths.forEach((p: string) => {
    const fsPath = path.join(addonComponents, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });
  addonTemplatesPaths.forEach((p: string) => {
    const fsPath = path.join(addonTemplates, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });

  jsPaths.forEach((p: string) => {
    const fsPath = path.join(scriptEntry, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });

  hbsPaths.forEach((p: string) => {
    const fsPath = path.join(templateEntry, p);
    const name = project.matchPathToType(fsPath)?.name;

    if (name) {
      addToRegistry(name, 'component', [fsPath]);
    }
  });
}

async function findRegistryItemsForProject(project: BaseProject, prefix: string, globs: string[]): Promise<void> {
  const entry = path.resolve(path.join(project.root, prefix));
  const paths = await safeWalkAsync(entry, {
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

export async function findTestsForProject(project: BaseProject) {
  await findRegistryItemsForProject(project, 'tests', ['**/*.js', '**/*.ts']);
}

export async function findAppItemsForProject(project: BaseProject) {
  await findRegistryItemsForProject(project, 'app', ['**/*.js', '**/*.ts', '**/*.css', '**/*.less', '**/*.sass', '**/*.hbs']);
}

export async function findAddonItemsForProject(project: BaseProject) {
  await findRegistryItemsForProject(project, 'addon', ['**/*.js', '**/*.ts', '**/*.css', '**/*.less', '**/*.sass', '**/*.hbs']);
}

async function listCollection(
  project: BaseProject,
  prefix: 'app' | 'addon',
  collectionName: 'transforms' | 'modifiers' | 'services' | 'models' | 'helpers',
  detail: 'transform' | 'service' | 'model' | 'helper' | 'modifier'
) {
  const entry = path.resolve(path.join(project.root, prefix, collectionName));
  const paths = await safeWalkAsync(entry, {
    directories: false,
    globs: ['**/*.js', '**/*.ts'],
  });

  paths.forEach((filePath: string) => {
    const fsPath = path.join(entry, filePath);
    const data = project.matchPathToType(fsPath);

    if (data && data.type === detail) {
      addToRegistry(data.name, detail, [fsPath]);
    }
  });
}

export async function listModifiers(project: BaseProject): Promise<void> {
  return listCollection(project, 'app', 'modifiers', 'modifier');
}

export async function listModels(project: BaseProject): Promise<void> {
  return listCollection(project, 'app', 'models', 'model');
}

export async function listServices(project: BaseProject): Promise<void> {
  return listCollection(project, 'app', 'services', 'service');
}

export async function listHelpers(project: BaseProject): Promise<void> {
  return listCollection(project, 'app', 'helpers', 'helper');
}

export async function listTransforms(project: BaseProject): Promise<void> {
  return listCollection(project, 'app', 'transforms', 'transform');
}

export async function listRoutes(project: BaseProject): Promise<void> {
  const root = path.resolve(project.root);
  const scriptEntry = path.join(root, 'app', 'routes');
  const templateEntry = path.join(root, 'app', 'templates');
  const controllersEntry = path.join(root, 'app', 'controllers');
  const paths = await safeWalkAsync(scriptEntry, {
    directories: false,
    globs: ['**/*.js', '**/*.ts'],
  });

  const templatePaths = (
    await safeWalkAsync(templateEntry, {
      directories: false,
      globs: ['**/*.hbs'],
    })
  ).filter((name: string) => {
    const skipEndings = ['-loading', '-error', '/loading', '/error'];

    return !name.startsWith('components/') && skipEndings.filter((ending: string) => name.endsWith(ending + '.hbs')).length === 0;
  });

  const controllers = await safeWalkAsync(controllersEntry, {
    directories: false,
    globs: ['**/*.js', '**/*.ts'],
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
