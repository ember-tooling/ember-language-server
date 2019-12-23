import * as path from 'path';
export class ClassicPathMatcher {
  keys: {
    [key: string]: string[];
  } = {
    helper: ['/helpers/'],
    service: ['/services/'],
    modifier: ['/modifiers/'],
    controller: ['/controllers/'],
    route: ['/routes/'],
    template: ['/templates/', '!/templates/components/'],
    component: ['/components/'],
    model: ['/models/'],
    transform: ['/transforms/'],
    adapter: ['/adapters/'],
    serializer: ['/serializers/']
  };
  matchKey(key: string, str: string) {
    let matched = false;
    const keys = this.keys[key] as string[];
    for (let i = 0; i < keys.length; i++) {
      let searchStr = keys[i];
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
    const fullName = str.slice(str.indexOf(strToMatch) + strToMatch.length, str.length).slice(0, -extName.length);
    if (type === 'component') {
      if (['component', 'template', 'index'].includes(fileName)) {
        return fullName.replace(`/${fileName}`, '');
      }
    }
    return fullName;
  }
  metaFromPath(rawAbsPath: string) {
    let absPath = rawAbsPath.split(path.sep).join('/');
    const extName = path.extname(absPath);
    const fileName = path.basename(absPath, extName);
    const results: [string, string][] = [];
    Object.keys(this.keys).forEach((propName) => {
      if (this.matchKey(propName, absPath)) {
        results.push([propName, this.rightPartFromFirstMatch(propName, fileName, extName, absPath, this.keys[propName][0])]);
      }
    });
    if (!results.length) {
      return null;
    }
    return {
      type: results[0][0],
      name: results[0][1]
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
    serializer: ['/serializer.']
  };
  rightPartFromFirstMatch(_: string, fileName: string, extName: string, str: string) {
    const fullName = str.slice(str.indexOf(this.podPrefix) + this.podPrefix.length + 1, str.length).slice(0, -(1 + extName.length + fileName.length));
    return fullName;
  }
}
