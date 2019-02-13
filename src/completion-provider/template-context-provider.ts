import { join } from 'path';
import uniqueBy from '../utils/unique-by';
import { readFileSync } from 'fs';
import {
    CompletionItem,
    CompletionItemKind
} from 'vscode-languageserver';
import { processJSFile } from 'ember-component-info/utils/js-utils';
import { processTemplate } from 'ember-component-info/utils/hbs-utils';
import { extractComponentInformationFromMeta }  from 'ember-component-info/utils/informator';

interface IComponentMetaInformationAPI {
  actions: string[];
  tagName: string;
  attributeBindings: string[];
  mergedProperties: string[];
  classNameBindings: string[];
  concatenatedProperties: string[];
  positionalParams: string[];
  classNames: string[];
}
interface IComponentMetaInformation {
  name: string;
  jsProps: string[];
  jsComputeds: string[];
  jsFunc: string[];
  jsImports: string[];
  hbsComponents: string[];
  hbsProps: string[];
  hbsHelpers: string[];
  api: IComponentMetaInformationAPI;
}

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
      globs: [`**/${postfix}.js`, `**/**/${postfix}/component.js`]
    });

    const infoItems = [].concat.apply([], jsPaths.map((filePath: string) => {
      const fileContent = readFileSync(filePath, { encoding: 'utf8' });
      const jsMeta = processJSFile(fileContent, filePath);
      return jsMeta;
    }));

    infoItems.push(processTemplate(templateContent));

    const meta: any = infoItems.reduce((result: any, it: any) => {
      Object.keys(it.meta).forEach(name => {
        if (name in result) {
          result[name] = result[name].concat(it.meta[name]);
        } else {
          result[name] = it.meta[name];
        }
      });
      return result;
    }, {});

    const items: any = [];
    const contextInfo: IComponentMetaInformation = extractComponentInformationFromMeta(meta);
    contextInfo.jsProps.forEach((propName: string) => {
      const [name]: any = propName.split(' ');
      items.push({
        kind: CompletionItemKind.Property,
        label: 'this.' + name,
        detail: propName,
      });
    });
    contextInfo.jsComputeds.forEach((propName: string) => {
      const [name]: any = propName.split(' ');
      items.push({
        kind: CompletionItemKind.Property,
        label: 'this.' + name,
        detail: 'ComputedProperty: ' + propName,
      });
    });
    contextInfo.jsFunc.forEach((propName: string) => {
      const [name]: any = propName.split(' ');
      items.push({
        kind: CompletionItemKind.Function,
        label: 'this.' + name,
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
    // @todo actions
    return uniqueBy(items, 'label');
  }