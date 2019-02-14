import { join } from 'path';
import uniqueBy from '../utils/unique-by';
import { readFileSync } from 'fs';
import {
    CompletionItem,
    CompletionItemKind
} from 'vscode-languageserver';

import { extractComponentInformationFromMeta, processJSFile, processTemplate }  from 'ember-meta-explorer';

const walkSync = require('walk-sync');

export function templateContextLookup(root: string, currentFilePath: string, templateContent: string) {
    const nameParts = currentFilePath.split('/components/');
    if (nameParts.length !== 2) {
        return [];
    }
    const componentName = nameParts[1].split('.')[0];
    return componentsContextData(root, componentName, templateContent);
}

function componentsContextData(root: string, postfix: string, templateContent: string): CompletionItem[] {
  const jsPaths = walkSync(join(root, 'app', 'components'), {
    directories: false,
    globs: [
      `**/${postfix}.js`,
      `**/**/${postfix}/component.js`,
      `**/${postfix}.ts`,
      `**/**/${postfix}/component.ts`
    ]
  });

  const infoItems = [].concat.apply([], jsPaths.map((filePath: string) => {
    const fileContent = readFileSync(join(root, 'app', 'components', filePath), { encoding: 'utf8' });
    const jsMeta = processJSFile(fileContent, filePath);
    return jsMeta;
  }));

  infoItems.push(processTemplate(templateContent));
  const meta: any = infoItems.reduce((result: any, it: any) => {
    Object.keys(it).forEach(name => {
      if (name in result) {
        result[name] = result[name].concat(it[name]);
      } else {
        result[name] = it[name].slice(0);
      }
    });
    return result;
  }, {});
  const items: any = [];
  const contextInfo = extractComponentInformationFromMeta(meta);

  function localizeName(name: string) {
    if (name.startsWith('this.')) {
      return name;
    } else if (name.startsWith('@')) {
      return name;
    } else {
      return 'this.' + name;
    }
  }

  contextInfo.jsProps.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Property,
      label: localizeName(name),
      detail: propName,
    });
  });
  contextInfo.jsComputeds.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Property,
      label: localizeName(name),
      detail: 'ComputedProperty: ' + propName,
    });
  });
  contextInfo.jsFunc.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Function,
      label: localizeName(name),
      detail: 'Function: ' + propName,
    });
  });
  contextInfo.hbsProps.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Function,
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
  return uniqueBy(items, 'label');
}
