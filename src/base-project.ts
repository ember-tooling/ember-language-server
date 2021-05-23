import { getPodModulePrefix } from './utils/layout-helpers';
import { ClassicPathMatcher, PodMatcher } from './utils/path-matcher';

export class BaseProject {
  private classicMatcher!: ClassicPathMatcher;
  private podMatcher!: PodMatcher;
  podModulePrefix = '';
  constructor(public readonly root: string) {
    const maybePrefix = getPodModulePrefix(root);

    if (maybePrefix) {
      this.podModulePrefix = 'app/' + maybePrefix;
    } else {
      this.podModulePrefix = 'app';
    }

    this.classicMatcher = new ClassicPathMatcher(this.root);
    this.podMatcher = new PodMatcher(this.root, this.podModulePrefix);
  }
  matchPathToType(filePath: string) {
    return this.classicMatcher.metaFromPath(filePath) || this.podMatcher.metaFromPath(filePath);
  }
}
