import { join } from 'path';
import uniqueBy from '../utils/unique-by';
import { readFileSync } from 'fs';
import {
    CompletionItem,
    CompletionItemKind
} from 'vscode-languageserver';

// const debug = false;
// const fs = require('fs');
// const util = require('util');
// const log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});

// console.log = debug ? function(...args: any[]) {
//   const output = args.map((a: any) => {
//     return JSON.stringify(a);
//   }).join(' ');
//   log_file.write('----------------------------------------' + '\r\n');
//   log_file.write(util.format(output) + '\r\n');
//   log_file.write('----------------------------------------' + '\r\n');
// } : function() {};

import { extractComponentInformationFromMeta, processJSFile, processTemplate }  from 'ember-meta-explorer';

const walkSync = require('walk-sync');

export function templateContextLookup(root: string, currentFilePath: string, templateContent: string) {
    console.log('templateContextLookup', root, currentFilePath, templateContent);
    const nameParts = currentFilePath.split('/components/');
    if (nameParts.length !== 2) {
        return [];
    }
    const componentName = nameParts[1].split('.')[0];
    return componentsContextData(root, componentName, templateContent);
}

function componentsContextData(root: string, postfix: string, templateContent: string): CompletionItem[] {
    console.log('templateContextLookup', root, postfix, templateContent);
  const jsPaths = walkSync(join(root, 'app', 'components'), {
    directories: false,
    globs: [
      `**/${postfix}.js`,
      `**/**/${postfix}/component.js`,
      `**/${postfix}.ts`,
      `**/**/${postfix}/component.ts`
    ]
  });
  console.log('jsPaths', jsPaths);
  const infoItems = [].concat.apply([], jsPaths.map((filePath: string) => {
    const fileLocation = join(root, 'app', 'components', filePath);
    console.log('fileLocation', fileLocation);
    const fileContent = readFileSync(fileLocation, { encoding: 'utf8' });
    console.log('fileContent', fileContent);
    try {
        const jsMeta = processJSFile(fileContent, filePath);
        console.log('jsMeta', jsMeta);
        return jsMeta;
    } catch (e) {
        console.log('error', e);
        return null;
    }
  }));

  let templateInfo: any = null;
  try {
    templateInfo = processTemplate(templateContent);
  } catch (e) {
    console.log('templateError', e);
  }
  infoItems.push(templateInfo);
  console.log('infoItems', infoItems);

  const meta: any = infoItems.filter((item: any) => item !== null).reduce((result: any, it: any) => {
    console.log('it', it);
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
  console.log('meta', meta);
  let contextInfo: any = {};
  try {
   contextInfo = extractComponentInformationFromMeta(meta);
  } catch (e) {
    console.log('contextInforError', e);
  }
  console.log('contextInfo', contextInfo);
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
