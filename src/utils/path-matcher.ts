import * as path from 'path';

export type MatchResultType =
  | 'helper'
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

    return fullName;
  }
  metaFromPath(rawAbsPath: string): MatchResult | null {
    const absPath = rawAbsPath.split(path.sep).join('/');
    const isTest = absPath.includes('/tests/');
    const isTemplate = absPath.endsWith('.hbs');
    const isStyle = absPath.endsWith('.css') || absPath.endsWith('.less') || absPath.endsWith('.scss');
    const kind = isStyle ? 'style' : isTemplate ? 'template' : isTest ? 'test' : 'script';
    const isAddon = absPath.includes('/addon/');
    const isInRepoAddon = absPath.includes('/lib/');
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
  constructor(podPrefix: string | false = false) {
    super();
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
  };
  rightPartFromFirstMatch(_: string, fileName: string, extName: string, str: string) {
    const fullName = str.slice(str.indexOf(this.podPrefix) + this.podPrefix.length + 1, str.length).slice(0, -(1 + extName.length + fileName.length));

    return fullName;
  }
}
