import { join } from 'path';
import uniqueBy from '../utils/unique-by';
import { readFileSync, existsSync } from 'fs';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';

import {
  isModuleUnificationApp,
  safeWalkSync,
  podModulePrefixForRoot,
  pureComponentName
} from '../utils/layout-helpers';

import { log } from '../utils/logger';

import {
  extractComponentInformationFromMeta,
  processJSFile,
  processTemplate
} from 'ember-meta-explorer';

export function templateContextLookup(
  root: string,
  currentFilePath: string,
  templateContent: string
) {
  log('templateContextLookup', root, currentFilePath, templateContent);
  const nameParts = currentFilePath.split('/components/');
  if (nameParts.length !== 2) {
    return [];
  }
  let componentName = pureComponentName(nameParts[1].split('.')[0]);
  return componentsContextData(root, componentName, templateContent);
}

function getComponentsScriptsFolder(root: string) {
  if (isModuleUnificationApp(root)) {
    return join(root, 'src', 'ui', 'components');
  } else {
    return join(root, 'app', 'components');
  }
}

function getComponentFileLocationPath(root: string, filePath: string) {
  if (isModuleUnificationApp(root)) {
    return join(root, 'src', 'ui', 'components', filePath);
  } else {
    return join(root, 'app', 'components', filePath);
  }
}

function getPoddedComponentsScriptsFolder(root: string) {
  let prefix = podModulePrefixForRoot(root);
  if (prefix) {
    return join(root, 'app', prefix, 'components');
  } else {
    return false;
  }
}

function getPoddedComponentsFileLocationPath(root: string, filePath: string) {
  let prefix = podModulePrefixForRoot(root);
  if (prefix) {
    return join(root, 'app', prefix, 'components', filePath);
  } else {
    return false;
  }
}

function componentsContextData(
  root: string,
  postfix: string,
  templateContent: string
): CompletionItem[] {
  log('templateContextLookup', root, postfix, templateContent);
  const jsPaths = safeWalkSync(getComponentsScriptsFolder(root), {
    directories: false,
    globs: [
      `**/${postfix}.{js,ts}`,
      `**/**/${postfix}/component.{js,ts}`
    ]
  });

  const jsPodsPaths = safeWalkSync(getPoddedComponentsScriptsFolder(root), {
    directories: false,
    globs: [`**/**/${postfix}/component.{js,ts}`]
  });

  log('jsPaths', jsPaths);
  const infoItems = [].concat.apply(
    [],
    [...jsPodsPaths, ...jsPaths]
      .filter((fileName: string) => {
        return !!fileName;
      })
      .map((filePath: string) => {
        const fileLocation = getComponentFileLocationPath(root, filePath);
        const podFileLocation = getPoddedComponentsFileLocationPath(
          root,
          filePath
        );
        log('fileLocation', fileLocation);
        let fileContent = '';
        if (existsSync(fileLocation)) {
          fileContent = readFileSync(fileLocation, { encoding: 'utf8' });
        } else if (podFileLocation && existsSync(podFileLocation)) {
          fileContent = readFileSync(podFileLocation, { encoding: 'utf8' });
        } else {
          return null;
        }
        log('fileContent', fileContent);
        try {
          const jsMeta = processJSFile(fileContent, filePath);
          log('jsMeta', jsMeta);
          return jsMeta;
        } catch (e) {
          log('error', e);
          return null;
        }
      })
  );

  let templateInfo: any = null;
  try {
    templateInfo = processTemplate(templateContent);
  } catch (e) {
    log('templateError', e);
  }
  infoItems.push(templateInfo);
  log('infoItems', infoItems);

  const meta: any = infoItems
    .filter((item: any) => item !== null)
    .reduce((result: any, it: any) => {
      log('it', it);
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
  log('meta', meta);
  let contextInfo: any = {};
  try {
    contextInfo = extractComponentInformationFromMeta(meta);
  } catch (e) {
    log('contextInforError', e);
  }
  log('contextInfo', contextInfo);
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
      detail: propName
    });
  });
  contextInfo.jsComputeds.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Property,
      label: localizeName(name),
      detail: 'ComputedProperty: ' + propName
    });
  });
  contextInfo.jsFunc.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Function,
      label: localizeName(name),
      detail: 'Function: ' + propName
    });
  });
  contextInfo.hbsProps.forEach((propName: string) => {
    const [name]: any = propName.split(' ');
    items.push({
      kind: CompletionItemKind.Function,
      label: name,
      detail: 'Template Property: ' + propName
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
