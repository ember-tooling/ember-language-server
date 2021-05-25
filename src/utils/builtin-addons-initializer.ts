import TemplateLintFixesCodeAction from '../builtin-addons/core/code-actions/template-lint-fixes';
import TemplateLintCommentsCodeAction from '../builtin-addons/core/code-actions/template-lint-comments';
import TypedTemplatesCodeAction from '../builtin-addons/core/code-actions/typed-template-comments';
import CoreScriptDefinitionProvider from './../builtin-addons/core/script-definition-provider';
import CoreTemplateDefinitionProvider from './../builtin-addons/core/template-definition-provider';
import ScriptCompletionProvider from './../builtin-addons/core/script-completion-provider';
import TemplateCompletionProvider from './../builtin-addons/core/template-completion-provider';
import { ProjectProviders } from './addon-api';

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
      templateDefinition.onInit.bind(templateDefinition),
      scriptDefinition.onInit.bind(scriptDefinition),
    ],
    info: [],
    addonsMeta: [],
    completionProviders: [scriptCompletion.onComplete.bind(scriptCompletion), templateCompletion.onComplete.bind(templateCompletion)],
  };
}
