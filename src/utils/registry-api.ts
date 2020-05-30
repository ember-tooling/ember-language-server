import { updateTemplateTokens, UsageType } from './usages-api';
import { normalizeRoutePath } from './layout-helpers';
import { MatchResult } from './path-matcher';
import * as path from 'path';

type GLOBAL_REGISTRY_ITEM = Map<string, Set<string>>;
export type REGISTRY_KIND = 'transform' | 'helper' | 'component' | 'routePath' | 'model' | 'service' | 'modifier';

export function getGlobalRegistry() {
  return GLOBAL_REGISTRY;
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

        if (file.endsWith('.hbs')) {
          updateTemplateTokens(kind as UsageType, normalizedName, null);
        }
      });

      if (regItem.size === 0) {
        GLOBAL_REGISTRY[kind].delete(normalizedName);
      }
    }
  }
}

export function getRegistryForRoot(rawRoot: string) {
  const root = path.resolve(rawRoot);
  const lowRoot = root.toLowerCase();
  const registryForRoot: {
    [key in REGISTRY_KIND]: {
      [key: string]: string[];
    };
  } = {
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

    for (const [itemName, paths] of registry[key].entries()) {
      const items: string[] = [];

      paths.forEach((normalizedPath) => {
        if (normalizedPath.toLowerCase().startsWith(lowRoot)) {
          items.push(normalizedPath);
        }
      });

      if (items.length) {
        registryForRoot[key][itemName] = items;
      }
    }
  });

  return registryForRoot;
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

        if ((kind === 'component' || kind === 'routePath') && file.endsWith('.hbs')) {
          updateTemplateTokens(kind, normalizedName, file);
        }
      });
    }
  }
}
