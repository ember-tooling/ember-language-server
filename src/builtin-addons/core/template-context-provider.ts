import * as fs from 'fs';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

import { log } from '../../utils/logger';

import { extractComponentInformationFromMeta, IComponentMetaInformation, IJsMeta, processJSFile, processTemplate } from 'ember-meta-explorer';

import { uniqBy } from 'lodash';

function localizeName(name: string) {
  if (name.startsWith('this.')) {
    return name;
  } else if (name.startsWith('@')) {
    return name;
  } else {
    return 'this.' + name;
  }
}

export function componentsContextData(maybeScripts: string[], templateContent: string): CompletionItem[] {
  const existingScripts = maybeScripts.filter(fs.existsSync);
  const hasAddonScript = existingScripts.find((el) => el.includes('addon'));
  const infoItems: IJsMeta[] = [];

  if (existingScripts.length) {
    try {
      const filePath = hasAddonScript ? hasAddonScript : (existingScripts.pop() as string);
      const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
      const jsMeta = processJSFile(fileContent, filePath);

      log('jsMeta', jsMeta);
      infoItems.push(jsMeta);
    } catch (e) {
      log('template-context-lookup-error', e.toString());
    }
  }

  try {
    let templateInfo: unknown = null;

    templateInfo = processTemplate(templateContent);
    infoItems.push(templateInfo as IJsMeta);
  } catch (e) {
    log('templateError', e);
  }

  log('infoItems', infoItems);

  const meta: Record<string, string[]> = infoItems
    .filter((item: IJsMeta) => item !== null)
    .reduce((result: Record<string, string[]>, it: IJsMeta) => {
      log('it', it);
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

  log('meta', meta);
  let contextInfo: IComponentMetaInformation = {} as IComponentMetaInformation;

  try {
    contextInfo = extractComponentInformationFromMeta(meta);
  } catch (e) {
    log('contextInforError', e);
  }

  log('contextInfo', contextInfo);
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
