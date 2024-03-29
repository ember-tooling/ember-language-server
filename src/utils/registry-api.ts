import { updateTemplateTokens, UsageType } from './usages-api';
import { isRootStartingWithFilePath, isTemplatePath, normalizeRoutePath } from './layout-helpers';
import { MatchResult } from './path-matcher';
import * as path from 'path';
import { logDebugInfo } from './logger';

type GLOBAL_REGISTRY_ITEM = Map<string, Set<string>>;
export type REGISTRY_KIND = 'transform' | 'helper' | 'component' | 'routePath' | 'model' | 'service' | 'modifier';

export function getGlobalRegistry() {
  return GLOBAL_REGISTRY;
}

let _templateTokensCollectionEnabled = true;

export function disableTemplateTokensCollection() {
  logDebugInfo('disable:TemplateTokensCollection');
  _templateTokensCollectionEnabled = false;
}

export function enableTemplateTokensCollection() {
  logDebugInfo('enable:TemplateTokensCollection');
  _templateTokensCollectionEnabled = true;
}

export function canCollectTemplateTokens() {
  return _templateTokensCollectionEnabled;
}

const GLOBAL_REGISTRY: {
  transform: GLOBAL_REGISTRY_ITEM;
  helper: GLOBAL_REGISTRY_ITEM;
  component: GLOBAL_REGISTRY_ITEM;
  routePath: GLOBAL_REGISTRY_ITEM;
  model: GLOBAL_REGISTRY_ITEM;
  service: GLOBAL_REGISTRY_ITEM;
  modifier: GLOBAL_REGISTRY_ITEM;
} = {
  transform: new Map(),
  helper: new Map(),
  component: new Map(),
  routePath: new Map(),
  model: new Map(),
  service: new Map(),
  modifier: new Map(),
};

export interface NormalizedRegistryItem {
  type: REGISTRY_KIND;
  name: string;
}

export function normalizeMatchNaming(item: MatchResult): NormalizedRegistryItem {
  if (['template', 'controller', 'route'].includes(item.type)) {
    return {
      type: 'routePath',
      name: normalizeRoutePath(item.name),
    };
  }

  return item as NormalizedRegistryItem;
}

export function removeFromRegistry(normalizedName: string, kind: REGISTRY_KIND, files: string[]) {
  if (!(kind in GLOBAL_REGISTRY)) {
    return;
  }

  if (!GLOBAL_REGISTRY[kind].has(normalizedName)) {
    return;
  }

  if (GLOBAL_REGISTRY[kind].has(normalizedName)) {
    const regItem = GLOBAL_REGISTRY[kind].get(normalizedName);

    if (regItem) {
      files.forEach((file) => {
        regItem.delete(file);

        if (isTemplatePath(file) && canCollectTemplateTokens()) {
          updateTemplateTokens(kind as UsageType, normalizedName, null);
        }
      });

      if (regItem.size === 0) {
        GLOBAL_REGISTRY[kind].delete(normalizedName);
      }
    }
  }
}

export type IRegistry = {
  [key in REGISTRY_KIND]: {
    [key: string]: string[];
  };
};

export function getRegistryForRoots(rawRoots: string[]) {
  return _getRegistryForRoots(rawRoots);
}

function _getRegistryForRoots(rawRoots: string[]) {
  const roots = rawRoots.map((rawRoot) => path.resolve(rawRoot));
  const lowRoot = roots.map((root) => root.toLowerCase());
  const registryForRoot: IRegistry = {
    transform: {},
    helper: {},
    component: {},
    routePath: {},
    model: {},
    service: {},
    modifier: {},
  };

  const registry = getGlobalRegistry();

  Object.keys(registry).forEach((key: REGISTRY_KIND) => {
    registryForRoot[key] = {};
    const data: Record<string, string[]> = {};
    let hasData = false;

    Object.defineProperty(registryForRoot, key, {
      enumerable: true,
      get() {
        if (hasData === false) {
          for (const [itemName, paths] of registry[key].entries()) {
            const items: string[] = [];

            paths.forEach((normalizedPath) => {
              const kindPath = normalizedPath.toLowerCase();

              if (
                lowRoot.some((lowRoot) => {
                  return isRootStartingWithFilePath(lowRoot, kindPath);
                })
              ) {
                items.push(normalizedPath);
              }
            });

            if (items.length) {
              data[itemName] = items;
            }
          }

          hasData = true;
        }

        return data;
      },
    });
  });

  return registryForRoot;
}

export function getRegistryForRoot(rawRoot: string): IRegistry {
  return _getRegistryForRoots([rawRoot]);
}

export function existsInRegistry(name: string, kind: REGISTRY_KIND, file: string) {
  const regItem = GLOBAL_REGISTRY[kind];

  if (!regItem) {
    return false;
  }

  if (!regItem.has(name)) {
    return false;
  }

  return regItem.get(name)?.has(path.resolve(file));
}

export function addToRegistry(normalizedName: string, kind: REGISTRY_KIND, files: string[]) {
  if (!(kind in GLOBAL_REGISTRY)) {
    return;
  }

  if (!GLOBAL_REGISTRY[kind].has(normalizedName)) {
    GLOBAL_REGISTRY[kind].set(normalizedName, new Set());
  }

  if (GLOBAL_REGISTRY[kind].has(normalizedName)) {
    const regItem = GLOBAL_REGISTRY[kind].get(normalizedName);

    if (regItem) {
      files.forEach((rawFile) => {
        const file = path.resolve(rawFile);

        regItem.add(file);

        if (canCollectTemplateTokens() && (kind === 'component' || kind === 'routePath') && isTemplatePath(file)) {
          updateTemplateTokens(kind, normalizedName, file);
        }
      });
    }
  }
}
