import TemplateLintFixesCodeAction from '../builtin-addons/core/code-actions/template-lint-fixes';
import TemplateLintCommentsCodeAction from '../builtin-addons/core/code-actions/template-lint-comments';
import TypedTemplatesCodeAction from '../builtin-addons/core/code-actions/typed-template-comments';
import CoreScriptDefinitionProvider from './../builtin-addons/core/script-definition-provider';
import CoreTemplateDefinitionProvider from './../builtin-addons/core/template-definition-provider';
import ScriptCompletionProvider from './../builtin-addons/core/script-completion-provider';
import TemplateCompletionProvider from './../builtin-addons/core/template-completion-provider';
import IntlCompletionProvider from '../builtin-addons/core/intl-completion-provider';
import { AddonMeta, ProjectProviders } from './addon-api';
import { logInfo } from './logger';
import IntlDefinitionProvider from '../builtin-addons/core/intl-definition-provider';
import IntlHoverProvider from '../builtin-addons/core/intl-hover-provider';

export function initBuiltinProviders(addonsMeta: AddonMeta[]): ProjectProviders {
  const scriptDefinition = new CoreScriptDefinitionProvider();
  const templateDefinition = new CoreTemplateDefinitionProvider();
  const scriptCompletion = new ScriptCompletionProvider();
  const templateCompletion = new TemplateCompletionProvider();

  const templateLintFixesCodeAction = new TemplateLintFixesCodeAction();
  const templateLintCommentsCodeAction = new TemplateLintCommentsCodeAction();
  const typedTemplatesCodeAction = new TypedTemplatesCodeAction();
  const intlDefinition = new IntlDefinitionProvider();
  const intlHover = new IntlHoverProvider();

  const definitionProviders = [
    scriptDefinition.onDefinition.bind(scriptDefinition),
    templateDefinition.onDefinition.bind(templateDefinition),
    intlDefinition.onDefinition.bind(intlDefinition),
  ];
  const referencesProviders: any[] = [];
  const codeActionProviders = [
    templateLintFixesCodeAction.onCodeAction.bind(templateLintFixesCodeAction),
    templateLintCommentsCodeAction.onCodeAction.bind(templateLintCommentsCodeAction),
    typedTemplatesCodeAction.onCodeAction.bind(typedTemplatesCodeAction),
  ];
  const initFunctions = [
    templateLintFixesCodeAction.onInit.bind(templateLintFixesCodeAction),
    templateLintCommentsCodeAction.onInit.bind(templateLintCommentsCodeAction),
    typedTemplatesCodeAction.onInit.bind(typedTemplatesCodeAction),
    templateCompletion.initRegistry.bind(templateCompletion),
    scriptCompletion.initRegistry.bind(scriptCompletion),
    templateDefinition.onInit.bind(templateDefinition),
    scriptDefinition.onInit.bind(scriptDefinition),
    intlDefinition.onInit.bind(intlDefinition),
    intlHover.onInit.bind(intlHover),
  ];
  const completionProviders = [scriptCompletion.onComplete.bind(scriptCompletion), templateCompletion.onComplete.bind(templateCompletion)];
  const hoverProviders = [intlHover.onHover.bind(intlHover)];

  if (!addonsMeta.find((addon) => addon.name == 'els-intl-addon')) {
    const intlCompletion = new IntlCompletionProvider();

    initFunctions.push(intlCompletion.onInit.bind(intlCompletion));
    completionProviders.push(intlCompletion.onComplete.bind(intlCompletion));
  } else {
    logInfo('Detected project installed `els-intl-addon`, builtin intl addon will be disabled');
  }

  return {
    definitionProviders,
    referencesProviders,
    codeActionProviders,
    hoverProviders,
    initFunctions,
    info: [],
    addonsMeta: [],
    completionProviders,
  };
}
