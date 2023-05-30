import { CompletionItemKind } from 'vscode-languageserver';
import type { CompletionItem } from 'vscode-languageserver';
import { logDebugInfo, logError } from '../../utils/logger';
import { extractComponentInformationFromMeta, IComponentMetaInformation, IJsMeta, processJSFile, processTemplate } from 'ember-meta-explorer';
// @ts-expect-error esmodule
import * as uniqBy from 'lodash/uniqBy';
import FSProvider from '../../fs-provider';
import { asyncFilter } from '../../utils/layout-helpers';
import HandlebarsFixer from '../../ai/handlebars-fixer';

function localizeName(name: string) {
  if (name.startsWith('this.')) {
    return name;
  } else if (name.startsWith('@')) {
    return name;
  } else {
    return 'this.' + name;
  }
}

export async function componentsContextData(fs: FSProvider, maybeScripts: string[], templateContent: string): Promise<CompletionItem[]> {
  const existingScripts = await asyncFilter(maybeScripts, fs.exists);
  const hasAddonScript = existingScripts.find((el) => el.includes('addon'));
  const infoItems: IJsMeta[] = [];

  if (existingScripts.length) {
    try {
      const filePath = hasAddonScript ? hasAddonScript : (existingScripts.pop() as string);
      const fileContent = await fs.readFile(filePath);

      if (fileContent !== null) {
        const jsMeta = processJSFile(fileContent, filePath);

        logDebugInfo('jsMeta', jsMeta);
        infoItems.push(jsMeta);
      }
    } catch (e) {
      logError(e);
    }
  }

  try {
    let templateInfo: unknown = null;

    templateInfo = processTemplate(templateContent);
    infoItems.push(templateInfo as IJsMeta);
  } catch (e) {
    try {
      let templateInfo: unknown = null;
      const fixer = new HandlebarsFixer();

      logError(new Error('fixing template') as any);

      const fixedContent = await fixer.fix(templateContent);

      logError(new Error('fixed template') as any);

      templateInfo = processTemplate(fixedContent);
      infoItems.push(templateInfo as IJsMeta);
    } catch (e) {
      logError(e);
    }
  }

  logDebugInfo('infoItems', infoItems);

  const meta: Record<string, string[]> = infoItems
    .filter((item: IJsMeta) => item !== null)
    .reduce((result: Record<string, string[]>, it: IJsMeta) => {
      Object.keys(it).forEach((name: keyof IJsMeta) => {
        if (name in result) {
          result[name] = result[name].concat(it[name]);
        } else {
          result[name] = it[name].slice(0);
        }
      });

      return result;
    }, {});
  const items: CompletionItem[] = [];

  logDebugInfo('meta', meta);
  let contextInfo: IComponentMetaInformation = {} as IComponentMetaInformation;

  try {
    contextInfo = extractComponentInformationFromMeta(meta);
  } catch (e) {
    logError(e);
  }

  logDebugInfo('contextInfo', contextInfo);
  contextInfo.jsProps.forEach((propName: string) => {
    const [name]: string[] = propName.split(' ');

    items.push({
      kind: CompletionItemKind.Property,
      label: localizeName(name),
      detail: propName,
    });
  });
  contextInfo.jsComputeds.forEach((propName: string) => {
    const [name]: string[] = propName.split(' ');

    items.push({
      kind: CompletionItemKind.Property,
      label: localizeName(name),
      detail: 'ComputedProperty: ' + propName,
    });
  });
  contextInfo.jsFunc.forEach((propName: string) => {
    const [name]: string[] = propName.split(' ');

    items.push({
      kind: CompletionItemKind.Function,
      label: localizeName(name),
      detail: 'Function: ' + propName,
    });
  });
  contextInfo.hbsProps.forEach((propName: string) => {
    const [name]: string[] = propName.split(' ');

    items.push({
      kind: CompletionItemKind.Property,
      label: name,
      detail: 'Template Property: ' + propName,
    });
  });

  // contextInfo.api.actions.forEach((propName: string) => {
  //   const [name]: any = propName.split(' ');
  //   items.push({
  //     kind: CompletionItemKind.Event,
  //     label: name,
  //     detail: 'Component Action: ' + propName,
  //   });
  // });
  // @todo actions
  return uniqBy(items, 'label');
}
