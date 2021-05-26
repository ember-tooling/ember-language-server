import * as path from 'path';
import { isStyleFile, isTemplatePath, isTestFile } from './layout-helpers';

export type MatchResultType =
  | 'helper'
  | 'util'
  | 'service'
  | 'route'
  | 'controller'
  | 'modifier'
  | 'template'
  | 'component'
  | 'model'
  | 'transform'
  | 'adapter'
  | 'serializer';
export type MatchResultScope = 'addon' | 'application';
export type MatchResultKind = 'test' | 'script' | 'template' | 'style';
export interface MatchResult {
  type: MatchResultType;
  name: string;
  scope: MatchResultScope;
  kind: MatchResultKind;
}

export class ClassicPathMatcher {
  constructor(private root: string = '') {}
  keys: {
    [key: string]: string[];
  } = {
    helper: ['/helpers/'],
    service: ['/services/'],
    modifier: ['/modifiers/'],
    controller: ['/controllers/'],
    route: ['/routes/', '!/components/'],
    template: ['/templates/', '!/templates/components/'],
    component: ['/components/'],
    model: ['/models/'],
    transform: ['/transforms/'],
    adapter: ['/adapters/'],
    serializer: ['/serializers/'],
    util: ['/utils/'],
  };
  ignores = ['/tmp/', '/dist/', '/.git/'];
  matchKey(key: string, str: string) {
    const isIgnored = this.ignores.find((el) => str.includes(el));

    if (isIgnored) {
      return false;
    }

    let matched = false;
    const keys = this.keys[key] as string[];

    for (let i = 0; i < keys.length; i++) {
      const searchStr = keys[i];

      if (searchStr.charAt(0) === '!') {
        matched = str.includes(searchStr.replace('!', '')) === false;
      } else {
        matched = str.includes(searchStr);
      }

      if (!matched) {
        return false;
      }
    }

    return matched;
  }
  rightPartFromFirstMatch(type: string, fileName: string, extName: string, str: string, strToMatch: string) {
    let fullName = str.slice(str.indexOf(strToMatch) + strToMatch.length, str.length).slice(0, -extName.length);

    if (type === 'component') {
      if (['component', 'template', 'index', 'index-test', 'component-test', 'styles', 'module'].includes(fileName)) {
        fullName = fullName.replace(`/${fileName}`, '');
      }

      if (fileName.endsWith('.module')) {
        fullName = fullName.replace(`.module`, '');
      }
    }

    if (str.includes('/tests/') && fullName.endsWith('-test')) {
      fullName = fullName.replace('-test', '');
    }

    if (fullName.startsWith('./')) {
      fullName = fullName.replace('./', '');
    }

    return fullName;
  }
  metaFromPath(rawAbsoluteAbsPath: string): MatchResult | null {
    const rawAbsPath = path.relative(this.root, path.resolve(rawAbsoluteAbsPath));
    const normalizedAbsPath = rawAbsPath.split(path.sep).join('/');

    // likely it's not a case for classic path matcher
    if (normalizedAbsPath.includes('__')) {
      return null;
    }

    const absPath = '/' + normalizedAbsPath;
    const isTest = isTestFile(absPath);
    const isTemplate = isTemplatePath(absPath);
    const isStyle = isStyleFile(absPath);
    const kind = isStyle ? 'style' : isTemplate ? 'template' : isTest ? 'test' : 'script';
    const isAddon = absPath.includes('/addon/');
    const isInRepoAddon = absPath.includes('/lib/') || absPath.includes('/engines/');
    const isExternalAddon = absPath.includes('/node_modules/');
    const isDummy = absPath.includes('/dummy');
    const scope = isDummy || isAddon || isInRepoAddon || isExternalAddon ? 'addon' : 'application';
    const extName = path.extname(absPath);
    const fileName = path.basename(absPath, extName);
    const results: [string, string][] = [];

    Object.keys(this.keys).forEach((propName: string) => {
      if (this.matchKey(propName, absPath)) {
        results.push([propName, this.rightPartFromFirstMatch(propName, fileName, extName, absPath, this.keys[propName][0])]);
      }
    });

    if (!results.length) {
      return null;
    }

    return {
      type: results[0][0] as MatchResultType,
      name: results[0][1],
      kind,
      scope,
    };
  }
}

export class PodMatcher extends ClassicPathMatcher {
  constructor(root: string, podPrefix: string | false = false) {
    super(root);

    if (podPrefix) {
      this.podPrefix = podPrefix;
    }
  }
  podPrefix = 'app/pods';
  keys = {
    helper: ['/helper.'],
    service: ['/service.'],
    modifier: ['/modifier.'],
    controller: ['/controller.'],
    route: ['/route.'],
    template: ['/template.'],
    component: ['/component.'],
    model: ['/model.'],
    transform: ['/transform.'],
    adapter: ['/adapter.'],
    serializer: ['/serializer.'],
    util: ['/utils/'],
  };
  rightPartFromFirstMatch(propName: string, fileName: string, extName: string, str: string, strToMatch: string) {
    if (propName === 'util') {
      return super.rightPartFromFirstMatch(propName, fileName, extName, str, strToMatch);
    }

    const indexAfterPodPrefix = str.indexOf(this.podPrefix) + this.podPrefix.length + 1;
    const indexBeforeExtName = 1 + extName.length + fileName.length;
    const componentFolderPath = 'components/';

    let fullName = str.slice(indexAfterPodPrefix, str.length).slice(0, -indexBeforeExtName);

    if (fullName.startsWith(componentFolderPath)) {
      fullName = fullName.replace(componentFolderPath, '');
    }

    if (fullName.startsWith('./')) {
      fullName = fullName.replace('./', '');
    }

    return fullName;
  }
}
