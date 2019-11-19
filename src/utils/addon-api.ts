import { Definition } from 'vscode-languageserver';
import { getProjectAddonsRoots, getPackageJSON, getProjectInRepoAddonsRoots } from './layout-helpers';
import * as path from 'path';
import { log } from './logger';

interface HandlerObject {
  handler: {
    onReference: undefined | Promise<any[] | null>;
    onComplete: undefined | Promise<any[] | null>;
    onDefinition: undefined | Promise<Definition | null>;
    onResolve: undefined | Promise<any[] | null>;
  };
  packageRoot: string;
  packageJSON: any;
  capabilities: NormalizedCapabilities;
}

export async function queryELSAddonsAPI(callbacks: any[], root: string, params: any): Promise<any[]> {
  const results: any[] = [];
  const addonResults = await Promise.all(
    callbacks.map(async (fn) => {
      try {
        const result = await fn(root, params);
        return result;
      } catch (e) {
        log('cllELSAddonsAPI', e.toString(), root, params);
        return [];
      }
    })
  );

  addonResults.forEach((result) => {
    if (Array.isArray(result)) {
      result.forEach((item) => {
        if (item) {
          results.push(item);
        }
      });
    }
  });
  return results;
}

export function collectProjectProviders(root: string): ProjectProviders {
  const roots = [].concat(getProjectAddonsRoots(root) as any, getProjectInRepoAddonsRoots(root) as any).filter((pathItem: any) => typeof pathItem === 'string');
  const meta: HandlerObject[] = [];
  roots.forEach((packagePath: string) => {
    const info = getPackageJSON(packagePath);
    if (hasEmberLanguageServerExtension(info)) {
      const handlerPath = languageServerHandler(info);
      meta.push({
        handler: require(path.join(packagePath, handlerPath)),
        packageRoot: packagePath,
        packageJSON: info,
        capabilities: normalizeCapabilities(extensionCapabilities(info))
      });
    }
  });

  const result = {
    definitionProviders: [],
    referencesProviders: [],
    completionProviders: [],
    resolveProviders: []
  };

  // onReference, onComplete, onDefinition, onResolve

  meta.forEach((handlerObject) => {
    if (handlerObject.capabilities.completionProvider && typeof handlerObject.handler.onComplete === 'function') {
      result.completionProviders.push(handlerObject.handler.onComplete);
    }
    if (handlerObject.capabilities.referencesProvider && typeof handlerObject.handler.onReference === 'function') {
      result.referencesProviders.push(handlerObject.handler.onReference);
    }
    if (handlerObject.capabilities.definitionProvider && typeof handlerObject.handler.onDefinition === 'function') {
      result.definitionProviders.push(handlerObject.handler.onDefinition);
    }
    if (handlerObject.capabilities.resolveProvider && typeof handlerObject.handler.onResolve === 'function') {
      result.resolveProviders.push(handlerObject.handler.onResolve);
    }
  });

  return result;
}

type ThenableHandler = (arg0: string, arg1: any) => Promise<any[]>;

export interface ProjectProviders {
  definitionProviders: ThenableHandler[];
  referencesProviders: ThenableHandler[];
  completionProviders: ThenableHandler[];
  resolveProviders: ThenableHandler[];
}

interface ExtensionCapabilities {
  definitionProvider: undefined | true | false;
  referencesProvider:
    | true
    | undefined
    | {
        components: true | false;
      };
  completionProvider:
    | undefined
    | {
        resolveProvider: true | false;
      };
}

interface NormalizedCapabilities {
  definitionProvider: true | false;
  referencesProvider: true | false;
  completionProvider: true | false;
  resolveProvider: true | false;
}

function normalizeCapabilities(raw: ExtensionCapabilities): NormalizedCapabilities {
  return {
    definitionProvider: raw.definitionProvider === true,
    referencesProvider: raw.referencesProvider === true || (typeof raw.referencesProvider === 'object' && raw.referencesProvider.components === true),
    completionProvider: typeof raw.completionProvider === 'object' || raw.completionProvider === true,
    resolveProvider: typeof raw.completionProvider === 'object' && raw.completionProvider.resolveProvider === true
  };
}

export function extensionCapabilities(info: any): ExtensionCapabilities {
  return info['ember-language-server'].capabilities;
}
export function languageServerHandler(info: any): string {
  return info['ember-language-server'].entry;
}
export function hasEmberLanguageServerExtension(info: any) {
  return 'ember-language-server' in info;
}
