import { Location, TextDocumentIdentifier, Command, CodeActionParams, CodeAction, Position, CompletionItem } from 'vscode-languageserver/node';
import {
  getProjectAddonsRoots,
  getPackageJSON,
  getProjectInRepoAddonsRoots,
  PackageInfo,
  ADDON_CONFIG_KEY,
  hasEmberLanguageServerExtension,
} from './layout-helpers';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';
import { log, logInfo, logError } from './logger';
import Server from '../server';
import ASTPath from './../glimmer-utils';
import DAGMap from 'dag-map';
import CoreScriptDefinitionProvider from './../builtin-addons/core/script-definition-provider';
import CoreTemplateDefinitionProvider from './../builtin-addons/core/template-definition-provider';
import ScriptCompletionProvider from './../builtin-addons/core/script-completion-provider';
import TemplateCompletionProvider from './../builtin-addons/core/template-completion-provider';
import { Project } from '../project-roots';

import TemplateLintFixesCodeAction from '../builtin-addons/core/code-actions/template-lint-fixes';
import TemplateLintCommentsCodeAction from '../builtin-addons/core/code-actions/template-lint-comments';
import TypedTemplatesCodeAction from '../builtin-addons/core/code-actions/typed-template-comments';

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
      const tempResult = await callback(root, Object.assign({}, params, { results: JSON.parse(JSON.stringify(lastResult)) }));

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

export function initBuiltinProviders(): ProjectProviders {
  const scriptDefinition = new CoreScriptDefinitionProvider();
  const templateDefinition = new CoreTemplateDefinitionProvider();
  const scriptCompletion = new ScriptCompletionProvider();
  const templateCompletion = new TemplateCompletionProvider();

  const templateLintFixesCodeAction = new TemplateLintFixesCodeAction();
  const templateLintCommentsCodeAction = new TemplateLintCommentsCodeAction();
  const typedTemplatesCodeAction = new TypedTemplatesCodeAction();

  return {
    definitionProviders: [scriptDefinition.onDefinition.bind(scriptDefinition), templateDefinition.onDefinition.bind(templateDefinition)],
    referencesProviders: [],
    codeActionProviders: [
      templateLintFixesCodeAction.onCodeAction.bind(templateLintFixesCodeAction),
      templateLintCommentsCodeAction.onCodeAction.bind(templateLintCommentsCodeAction),
      typedTemplatesCodeAction.onCodeAction.bind(typedTemplatesCodeAction),
    ],
    initFunctions: [
      templateLintFixesCodeAction.onInit.bind(templateLintFixesCodeAction),
      templateLintCommentsCodeAction.onInit.bind(templateLintCommentsCodeAction),
      typedTemplatesCodeAction.onInit.bind(typedTemplatesCodeAction),
      templateCompletion.initRegistry.bind(templateCompletion),
      scriptCompletion.initRegistry.bind(scriptCompletion),
    ],
    info: [],
    completionProviders: [scriptCompletion.onComplete.bind(scriptCompletion), templateCompletion.onComplete.bind(templateCompletion)],
  };
}

export function isConstructor(obj: any) {
  return !!obj.prototype && !!obj.prototype.constructor.name;
}

function create<T>(model: new () => T): T {
  return new model();
}

function requireUncached(module: string) {
  delete require.cache[require.resolve(module)];
  let result = {};

  try {
    result = require(module);

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

      return instanceResult;
    }
  } catch (e) {
    logError(e);
  }

  return result;
}

export function collectProjectProviders(root: string, addons: string[]): ProjectProviders {
  const roots = addons
    .concat([root])
    .concat(getProjectAddonsRoots(root), getProjectInRepoAddonsRoots(root))
    .filter((pathItem) => typeof pathItem === 'string');
  const dagMap: DAGMap<HandlerObject> = new DAGMap();

  roots.forEach((packagePath: string) => {
    const info = getPackageJSON(packagePath);

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
  });

  const result: {
    definitionProviders: DefinitionResolveFunction[];
    referencesProviders: ReferenceResolveFunction[];
    completionProviders: CompletionResolveFunction[];
    codeActionProviders: CodeActionResolveFunction[];
    initFunctions: InitFunction[];
    info: string[];
  } = {
    definitionProviders: [],
    referencesProviders: [],
    completionProviders: [],
    codeActionProviders: [],
    initFunctions: [],
    info: [],
  };

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

export interface ProjectProviders {
  definitionProviders: DefinitionResolveFunction[];
  referencesProviders: ReferenceResolveFunction[];
  completionProviders: CompletionResolveFunction[];
  codeActionProviders: CodeActionResolveFunction[];
  initFunctions: InitFunction[];
  info: string[];
}

interface ExtensionCapabilities {
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
  definitionProvider: true | false;
  referencesProvider: true | false;
  completionProvider: true | false;
  codeActionProvider: true | false;
}

function normalizeCapabilities(raw: ExtensionCapabilities): NormalizedCapabilities {
  return {
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
