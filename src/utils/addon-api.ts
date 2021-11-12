import { Location, TextDocumentIdentifier, Command, CodeActionParams, CodeAction, Position, CompletionItem, Hover } from 'vscode-languageserver/node';
import {
  getProjectAddonsRoots,
  getProjectInRepoAddonsRoots,
  PackageInfo,
  ADDON_CONFIG_KEY,
  hasEmberLanguageServerExtension,
  addonVersion,
  asyncGetPackageJSON,
  getRequireSupport,
} from './layout-helpers';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import { log, logInfo, logError, safeStringify } from './logger';
import Server from '../server';
import ASTPath from './../glimmer-utils';
import DAGMap from 'dag-map';

import { Project } from '../project';
interface BaseAPIParams {
  server: Server;
  textDocument: TextDocumentIdentifier;
  position: Position;
}
interface ExtendedAPIParams extends BaseAPIParams {
  focusPath: ASTPath;
  originalText?: string;
  type: 'script' | 'template';
}
export interface ReferenceFunctionParams extends BaseAPIParams {
  results: Location[];
}

export interface HoverFunctionParams extends ExtendedAPIParams {
  results: Hover[];
}
export interface CompletionFunctionParams extends ExtendedAPIParams {
  results: CompletionItem[];
}
export interface DefinitionFunctionParams extends ExtendedAPIParams {
  results: Location[];
}
export interface CodeActionFunctionParams extends CodeActionParams {
  results: (Command | CodeAction)[];
  document: TextDocument;
}

type ReferenceResolveFunction = (root: string, params: ReferenceFunctionParams) => Promise<Location[]>;

type HoverResolveFunction = (root: string, params: HoverFunctionParams) => Promise<Hover[]>;
type CompletionResolveFunction = (root: string, params: CompletionFunctionParams) => Promise<CompletionItem[]>;
type DefinitionResolveFunction = (root: string, params: DefinitionFunctionParams) => Promise<Location[]>;
type CodeActionResolveFunction = (root: string, params: CodeActionFunctionParams) => Promise<(Command | CodeAction)[] | undefined | null>;
type InitFunction = (server: Server, project: Project) => any;
export interface AddonAPI {
  onReference?: ReferenceResolveFunction;
  onComplete?: CompletionResolveFunction;
  onCodeAction?: CodeActionResolveFunction;
  onDefinition?: DefinitionResolveFunction;
  onInit?: InitFunction;
}

interface PublicAddonAPI {
  onHover?: HoverResolveFunction;
  onReference?: ReferenceResolveFunction;
  onComplete?: CompletionResolveFunction;
  onDefinition?: DefinitionResolveFunction;
  onCodeAction?: CodeActionResolveFunction;
  onInit?: InitFunction;
}

interface HandlerObject {
  handler: PublicAddonAPI;
  updateHandler: () => void;
  packageRoot: string;
  debug: boolean;
  packageJSON: PackageInfo;
  capabilities: NormalizedCapabilities;
}

export async function queryELSAddonsAPIChain(callbacks: any[], root: string, params: any): Promise<any[]> {
  let lastResult = params.results || [];

  for (const callback of callbacks) {
    try {
      const tempResult = await callback(root, Object.assign({}, params, { results: JSON.parse(safeStringify(lastResult)) }));

      // API must return array
      if (Array.isArray(tempResult)) {
        lastResult = tempResult;
      }
    } catch (e) {
      logError(e);
      log('ELSAddonsAPIError', callback, e.toString(), root, params);
    }
  }

  return lastResult;
}

export function isConstructor(obj: any) {
  return !!obj.prototype && !!obj.prototype.constructor.name;
}

function create<T>(model: new () => T): T {
  return new model();
}

let requireFunc: any = {
  resolve(a: string): any {
    return a;
  },
};

try {
  requireFunc =
    // @ts-expect-error @todo - fix webpack imports
    typeof __webpack_require__ === 'function'
      ? // @ts-expect-error @todo - fix webpack imports
        __non_webpack_require__
      : typeof require !== 'undefined'
      ? require
      : function () {
          // EOL
        };
} catch (e) {
  // expected error in worker
}

function requireUncached(module: string) {
  if (!getRequireSupport()) {
    return {
      onInit() {
        throw new Error('Unable to use require in worker environment');
      },
    };
  }

  delete require.cache[requireFunc.resolve(module)];
  let result = {};

  try {
    result = requireFunc(module);

    if (isConstructor(result)) {
      const instance: PublicAddonAPI = create(result as any);
      const instanceResult: PublicAddonAPI = {};

      if (typeof instance.onInit === 'function') {
        instanceResult.onInit = instance.onInit.bind(instance);
      }

      if (typeof instance.onCodeAction === 'function') {
        instanceResult.onCodeAction = instance.onCodeAction.bind(instance);
      }

      if (typeof instance.onComplete === 'function') {
        instanceResult.onComplete = instance.onComplete.bind(instance);
      }

      if (typeof instance.onDefinition === 'function') {
        instanceResult.onDefinition = instance.onDefinition.bind(instance);
      }

      if (typeof instance.onReference === 'function') {
        instanceResult.onReference = instance.onReference.bind(instance);
      }

      if (typeof instance.onHover === 'function') {
        instanceResult.onHover = instance.onHover.bind(instance);
      }

      return instanceResult;
    }
  } catch (e) {
    logError(e);

    return {
      onInit() {
        const err = e.toString();

        throw new Error('Unable to require els-addon by path: ' + module + ', reason: ' + err);
      },
    };
  }

  return result;
}

export async function collectProjectProviders(root: string, addons: string[]): Promise<ProjectProviders> {
  const [projectAddonsRoots, projectInRepoAddonsRoots] = await Promise.all([getProjectAddonsRoots(root), getProjectInRepoAddonsRoots(root)]);
  const roots = addons
    .concat([root])
    .concat(projectAddonsRoots, projectInRepoAddonsRoots)
    .filter((pathItem) => typeof pathItem === 'string');
  const dagMap: DAGMap<HandlerObject> = new DAGMap();

  const addonsMeta: AddonMeta[] = [];

  for (const packagePath of roots) {
    const info = await asyncGetPackageJSON(packagePath);

    if (info.name) {
      addonsMeta.push({
        name: info.name,
        root: packagePath,
        version: addonVersion(info),
      });
    }

    if (hasEmberLanguageServerExtension(info)) {
      const handlerPath = languageServerHandler(info);
      const addonInfo = info['ember-addon'] || {};
      const addon: HandlerObject = {
        handler: requireUncached(path.join(packagePath, handlerPath)),
        updateHandler() {
          this.handler = requireUncached(path.join(packagePath, handlerPath));
        },
        packageRoot: packagePath,
        packageJSON: info,
        debug: isDebugModeEnabled(info),
        capabilities: normalizeCapabilities(extensionCapabilities(info)),
      };

      dagMap.add(info.name || packagePath, addon, addonInfo.before, addonInfo.after);
    }
  }

  const result: {
    definitionProviders: DefinitionResolveFunction[];
    referencesProviders: ReferenceResolveFunction[];
    completionProviders: CompletionResolveFunction[];
    codeActionProviders: CodeActionResolveFunction[];
    hoverProviders: HoverResolveFunction[];
    initFunctions: InitFunction[];
    info: string[];
    addonsMeta: AddonMeta[];
  } = emptyProjectProviders({
    addonsMeta,
  });
  // onReference, onComplete, onDefinition

  dagMap.each((_, handlerObject) => {
    if (handlerObject === undefined) {
      return;
    }

    // let's reload files in case of debug mode for each request
    if (handlerObject.debug) {
      result.info.push('addon-in-debug-mode: ' + _);
      logInfo(`els-addon-api: debug mode enabled for ${handlerObject.packageRoot}, for all requests resolvers will be reloaded.`);
      result.completionProviders.push(function (root: string, params: CompletionFunctionParams) {
        handlerObject.updateHandler();

        if (typeof handlerObject.handler.onComplete === 'function') {
          return handlerObject.handler.onComplete(root, params);
        } else {
          return params.results;
        }
      } as CompletionResolveFunction);
      result.referencesProviders.push(function (root: string, params: ReferenceFunctionParams) {
        handlerObject.updateHandler();

        if (typeof handlerObject.handler.onReference === 'function') {
          return handlerObject.handler.onReference(root, params);
        } else {
          return params.results;
        }
      } as ReferenceResolveFunction);
      result.hoverProviders.push(function (root: string, params: HoverFunctionParams) {
        handlerObject.updateHandler();

        if (typeof handlerObject.handler.onHover === 'function') {
          return handlerObject.handler.onHover(root, params);
        } else {
          return params.results;
        }
      } as HoverResolveFunction);
      result.definitionProviders.push(function (root: string, params: DefinitionFunctionParams) {
        handlerObject.updateHandler();

        if (typeof handlerObject.handler.onDefinition === 'function') {
          return handlerObject.handler.onDefinition(root, params);
        } else {
          return params.results;
        }
      } as DefinitionResolveFunction);
      result.initFunctions.push(function (server: Server, project: Project) {
        handlerObject.updateHandler();

        if (typeof handlerObject.handler.onInit === 'function') {
          return handlerObject.handler.onInit(server, project);
        } else {
          return;
        }
      } as InitFunction);
      result.codeActionProviders.push(function (root: string, params: CodeActionFunctionParams) {
        handlerObject.updateHandler();

        if (typeof handlerObject.handler.onCodeAction === 'function') {
          return handlerObject.handler.onCodeAction(root, params);
        } else {
          return;
        }
      } as CodeActionResolveFunction);
    } else {
      result.info.push('addon: ' + _);

      if (handlerObject.capabilities.completionProvider && typeof handlerObject.handler.onComplete === 'function') {
        result.completionProviders.push(handlerObject.handler.onComplete);
      }

      if (handlerObject.capabilities.referencesProvider && typeof handlerObject.handler.onReference === 'function') {
        result.referencesProviders.push(handlerObject.handler.onReference);
      }

      if (handlerObject.capabilities.hoverProvider && typeof handlerObject.handler.onHover === 'function') {
        result.hoverProviders.push(handlerObject.handler.onHover);
      }

      if (handlerObject.capabilities.definitionProvider && typeof handlerObject.handler.onDefinition === 'function') {
        result.definitionProviders.push(handlerObject.handler.onDefinition);
      }

      if (handlerObject.capabilities.codeActionProvider && typeof handlerObject.handler.onCodeAction === 'function') {
        result.codeActionProviders.push(handlerObject.handler.onCodeAction);
      }

      if (typeof handlerObject.handler.onInit === 'function') {
        result.initFunctions.push(handlerObject.handler.onInit);
      }
    }
  });

  return result;
}

export type AddonMeta = { root: string; name: string; version: null | 1 | 2 };
export type DependencyMeta = { name: string; version: string };

export function emptyProjectProviders(providers?: Partial<ProjectProviders>): ProjectProviders {
  return {
    definitionProviders: providers?.definitionProviders ?? [],
    hoverProviders: providers?.hoverProviders ?? [],
    referencesProviders: providers?.referencesProviders ?? [],
    completionProviders: providers?.completionProviders ?? [],
    codeActionProviders: providers?.codeActionProviders ?? [],
    initFunctions: providers?.initFunctions ?? [],
    info: providers?.info ?? [],
    addonsMeta: providers?.addonsMeta ?? [],
  };
}

export interface ProjectProviders {
  hoverProviders: HoverResolveFunction[];
  definitionProviders: DefinitionResolveFunction[];
  referencesProviders: ReferenceResolveFunction[];
  completionProviders: CompletionResolveFunction[];
  codeActionProviders: CodeActionResolveFunction[];
  initFunctions: InitFunction[];
  info: string[];
  addonsMeta: AddonMeta[];
}

export interface ExtensionCapabilities {
  hoverProvider: undefined | true | false;
  definitionProvider: undefined | true | false;
  codeActionProvider: undefined | true | false;
  referencesProvider:
    | true
    | undefined
    | {
        components: true | false;
      };
  completionProvider: true | undefined;
}

interface NormalizedCapabilities {
  hoverProvider: true | false;
  definitionProvider: true | false;
  referencesProvider: true | false;
  completionProvider: true | false;
  codeActionProvider: true | false;
}

function normalizeCapabilities(raw: ExtensionCapabilities): NormalizedCapabilities {
  return {
    hoverProvider: raw.hoverProvider === true,
    definitionProvider: raw.definitionProvider === true,
    codeActionProvider: raw.codeActionProvider === true,
    referencesProvider: raw.referencesProvider === true || (typeof raw.referencesProvider === 'object' && raw.referencesProvider.components === true),
    completionProvider: typeof raw.completionProvider === 'object' || raw.completionProvider === true,
  };
}

export function extensionCapabilities(info: any): ExtensionCapabilities {
  return info[ADDON_CONFIG_KEY].capabilities || {};
}

export function languageServerHandler(info: any): string {
  return info[ADDON_CONFIG_KEY].entry;
}

export function isDebugModeEnabled(info: any): boolean {
  return info[ADDON_CONFIG_KEY].debug === true;
}
