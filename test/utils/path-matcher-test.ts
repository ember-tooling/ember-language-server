import { ClassicPathMatcher, PodMatcher } from '../../src/utils/path-matcher';

describe('PodMatcher', () => {
  const matcher = new PodMatcher();
  function m(str: string) {
    return matcher.metaFromPath(str);
  }
  it('components', () => {
    expect(m('foo/bar/app/pods/foo/component.ts')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/pods/foo/component.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/pods/foo/component.hbs')).toEqual({ type: 'component', name: 'foo' });
  });
  it('routes', () => {
    expect(m('foo/bar/app/pods/foo/route.ts')).toEqual({ type: 'route', name: 'foo' });
    expect(m('foo/bar/app/pods/foo/index/route.ts')).toEqual({ type: 'route', name: 'foo/index' });
  });
  it('controllers', () => {
    expect(m('foo/bar/app/pods/foo/controller.ts')).toEqual({ type: 'controller', name: 'foo' });
    expect(m('foo/bar/app/pods/foo/index/controller.ts')).toEqual({ type: 'controller', name: 'foo/index' });
  });
  it('templates', () => {
    expect(m('foo/bar/app/pods/foo/index/template.hbs')).toEqual({ type: 'template', name: 'foo/index' });
    expect(m('foo/bar/app/pods/foo/template.hbs')).toEqual({ type: 'template', name: 'foo' });
  });
  it('helpers', () => {
    expect(m('foo/bar/app/pods/foo/helper.js')).toEqual({ type: 'helper', name: 'foo' });
    expect(m('foo/bar/app/pods/foo-bar/helper.js')).toEqual({ type: 'helper', name: 'foo-bar' });
  });
  it('modifiers', () => {
    expect(m('foo/bar/app/pods/foo/modifier.js')).toEqual({ type: 'modifier', name: 'foo' });
    expect(m('foo/bar/app/pods/foo-bar/modifier.js')).toEqual({ type: 'modifier', name: 'foo-bar' });
  });
  it('models', () => {
    expect(m('foo/bar/app/pods/foo/model.js')).toEqual({ type: 'model', name: 'foo' });
    expect(m('foo/bar/app/pods/foo-bar/model.js')).toEqual({ type: 'model', name: 'foo-bar' });
    expect(m('foo/bar/app/pods/foo-bar/baz/model.js')).toEqual({ type: 'model', name: 'foo-bar/baz' });
  });
  it('serializers', () => {
    expect(m('foo/bar/app/pods/foo/serializer.js')).toEqual({ type: 'serializer', name: 'foo' });
    expect(m('foo/bar/app/pods/foo-bar/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar' });
    expect(m('foo/bar/app/pods/foo-bar/baz/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar/baz' });
  });
  it('transforms', () => {
    expect(m('foo/bar/app/pods/foo/transform.js')).toEqual({ type: 'transform', name: 'foo' });
    expect(m('foo/bar/app/pods/foo-bar/transform.js')).toEqual({ type: 'transform', name: 'foo-bar' });
    expect(m('foo/bar/app/pods/foo-bar/baz/transform.js')).toEqual({ type: 'transform', name: 'foo-bar/baz' });
  });
  it('services', () => {
    expect(m('foo/bar/app/pods/foo/service.js')).toEqual({ type: 'service', name: 'foo' });
    expect(m('foo/bar/app/pods/foo-bar/service.js')).toEqual({ type: 'service', name: 'foo-bar' });
    expect(m('foo/bar/app/pods/foo-bar/baz/service.js')).toEqual({ type: 'service', name: 'foo-bar/baz' });
  });
  it('empty', () => {
    expect(m('foo/bar/app/components/foo/index.hbs')).toEqual(null);
    expect(m('foo/bar/app/routes/foo.ts')).toEqual(null);
    expect(m('foo/bar/app/helpers/foo.js')).toEqual(null);
  });
});

describe('PodMatcher :customPrefix', () => {
  const matcher = new PodMatcher('app');
  function m(str: string) {
    return matcher.metaFromPath(str);
  }
  it('components', () => {
    expect(m('foo/bar/app/foo/component.ts')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/foo/component.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/foo/component.hbs')).toEqual({ type: 'component', name: 'foo' });
  });
  it('routes', () => {
    expect(m('foo/bar/app/foo/route.ts')).toEqual({ type: 'route', name: 'foo' });
    expect(m('foo/bar/app/foo/index/route.ts')).toEqual({ type: 'route', name: 'foo/index' });
  });
  it('controllers', () => {
    expect(m('foo/bar/app/foo/controller.ts')).toEqual({ type: 'controller', name: 'foo' });
    expect(m('foo/bar/app/foo/index/controller.ts')).toEqual({ type: 'controller', name: 'foo/index' });
  });
  it('templates', () => {
    expect(m('foo/bar/app/foo/index/template.hbs')).toEqual({ type: 'template', name: 'foo/index' });
    expect(m('foo/bar/app/foo/template.hbs')).toEqual({ type: 'template', name: 'foo' });
  });
  it('helpers', () => {
    expect(m('foo/bar/app/foo/helper.js')).toEqual({ type: 'helper', name: 'foo' });
    expect(m('foo/bar/app/foo-bar/helper.js')).toEqual({ type: 'helper', name: 'foo-bar' });
  });
  it('modifiers', () => {
    expect(m('foo/bar/app/foo/modifier.js')).toEqual({ type: 'modifier', name: 'foo' });
    expect(m('foo/bar/app/foo-bar/modifier.js')).toEqual({ type: 'modifier', name: 'foo-bar' });
  });
  it('models', () => {
    expect(m('foo/bar/app/foo/model.js')).toEqual({ type: 'model', name: 'foo' });
    expect(m('foo/bar/app/foo-bar/model.js')).toEqual({ type: 'model', name: 'foo-bar' });
    expect(m('foo/bar/app/foo-bar/baz/model.js')).toEqual({ type: 'model', name: 'foo-bar/baz' });
  });
  it('serializers', () => {
    expect(m('foo/bar/app/foo/serializer.js')).toEqual({ type: 'serializer', name: 'foo' });
    expect(m('foo/bar/app/foo-bar/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar' });
    expect(m('foo/bar/app/foo-bar/baz/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar/baz' });
  });
  it('transforms', () => {
    expect(m('foo/bar/app/foo/transform.js')).toEqual({ type: 'transform', name: 'foo' });
    expect(m('foo/bar/app/foo-bar/transform.js')).toEqual({ type: 'transform', name: 'foo-bar' });
    expect(m('foo/bar/app/foo-bar/baz/transform.js')).toEqual({ type: 'transform', name: 'foo-bar/baz' });
  });
  it('services', () => {
    expect(m('foo/bar/app/foo/service.js')).toEqual({ type: 'service', name: 'foo' });
    expect(m('foo/bar/app/foo-bar/service.js')).toEqual({ type: 'service', name: 'foo-bar' });
    expect(m('foo/bar/app/foo-bar/baz/service.js')).toEqual({ type: 'service', name: 'foo-bar/baz' });
  });
  it('empty', () => {
    expect(m('foo/bar/app/components/foo/index.hbs')).toEqual(null);
    expect(m('foo/bar/app/routes/foo.ts')).toEqual(null);
    expect(m('foo/bar/app/helpers/foo.js')).toEqual(null);
  });
});
describe('ClassicPathMatcher', () => {
  const matcher = new ClassicPathMatcher();
  function m(str: string) {
    return matcher.metaFromPath(str);
  }
  it('empty', () => {
    expect(m('foo/bar/app/pods/foo/modifier.js')).toEqual(null);
    expect(m('foo/bar/app/pods/foo/transform.js')).toEqual(null);
    expect(m('foo/bar/app/pods/foo/service.js')).toEqual(null);
  });
  it('ignores', () => {
    expect(m('foo/bar/tmp/app/components/foo/index.ts')).toEqual(null);
    expect(m('foo/bar/dist/app/components/foo/index.ts')).toEqual(null);
    expect(m('foo/bar/.git/app/components/foo/index.ts')).toEqual(null);
  });
  it('components', () => {
    expect(m('foo/bar/app/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo' });
    expect(m('foo/bar/app/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo' });
    expect(m('foo/bar/app/components/foo/index.ts')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/index.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/index.hbs')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/component.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/template.hbs')).toEqual({ type: 'component', name: 'foo' });
    expect(m('repos/brn/frontend/tests/integration/components/login-form/input/component-test.js')).toEqual({ type: 'component', name: 'login-form/input' });
    expect(m('repos/brn/frontend/tests/integration/components/login-form/component-test.js')).toEqual({ type: 'component', name: 'login-form' });

    expect(m('frontend/app/components/audio-player/styles.css')).toEqual({ type: 'component', name: 'audio-player' });
    expect(m('frontend/app/components/audio-player/styles.scss')).toEqual({ type: 'component', name: 'audio-player' });
    expect(m('frontend/app/components/audio-player/styles.less')).toEqual({ type: 'component', name: 'audio-player' });

    expect(m('foo/bar/app/components/foo.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo.hbs')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/templates/components/foo.hbs')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/tests/integration/components/cart-widgget/item-test.js')).toEqual({ type: 'component', name: 'cart-widgget/item' });
    expect(m('foo/bar/tests/integration/components/cart-widgget/index-test.js')).toEqual({ type: 'component', name: 'cart-widgget' });
  });
  it('routes', () => {
    expect(m('foo/bar/app/routes/foo/index.ts')).toEqual({ type: 'route', name: 'foo/index' });
    expect(m('foo/bar/app/routes/foo.ts')).toEqual({ type: 'route', name: 'foo' });
    expect(m('foo/bar/tests/unit/routes/cart-widgget/index-test.js')).toEqual({ type: 'route', name: 'cart-widgget/index' });
  });
  it('controllers', () => {
    expect(m('foo/bar/app/controllers/foo/index.ts')).toEqual({ type: 'controller', name: 'foo/index' });
    expect(m('foo/bar/app/controllers/foo.ts')).toEqual({ type: 'controller', name: 'foo' });
    expect(m('foo/bar/tests/unit/controllers/cart-widgget/index-test.js')).toEqual({ type: 'controller', name: 'cart-widgget/index' });
  });
  it('templates', () => {
    expect(m('foo/bar/app/templates/foo/index.hbs')).toEqual({ type: 'template', name: 'foo/index' });
    expect(m('foo/bar/app/templates/foo.hbs')).toEqual({ type: 'template', name: 'foo' });
    expect(m('foo/bar/app/templates/components/foo.hbs')).toEqual({ type: 'component', name: 'foo' });
  });
  it('helpers', () => {
    expect(m('foo/bar/app/helpers/foo.js')).toEqual({ type: 'helper', name: 'foo' });
    expect(m('foo/bar/app/helpers/foo-bar.js')).toEqual({ type: 'helper', name: 'foo-bar' });
    expect(m('foo/bar/tests/integration/helpers/foo-bar-test.js')).toEqual({ type: 'helper', name: 'foo-bar' });
  });
  it('modifiers', () => {
    expect(m('foo/bar/app/modifiers/foo.js')).toEqual({ type: 'modifier', name: 'foo' });
    expect(m('foo/bar/app/modifiers/foo-bar.js')).toEqual({ type: 'modifier', name: 'foo-bar' });
    expect(m('foo/bar/tests/integration/modifiers/foo-bar-test.js')).toEqual({ type: 'modifier', name: 'foo-bar' });
  });
  it('models', () => {
    expect(m('foo/bar/app/models/foo.js')).toEqual({ type: 'model', name: 'foo' });
    expect(m('foo/bar/app/models/foo-bar.js')).toEqual({ type: 'model', name: 'foo-bar' });
    expect(m('foo/bar/app/models/foo-bar/baz.js')).toEqual({ type: 'model', name: 'foo-bar/baz' });
    expect(m('foo/bar/tests/unit/models/foo-bar-test.js')).toEqual({ type: 'model', name: 'foo-bar' });
  });
  it('serializers', () => {
    expect(m('foo/bar/app/serializers/foo.js')).toEqual({ type: 'serializer', name: 'foo' });
    expect(m('foo/bar/app/serializers/foo-bar.js')).toEqual({ type: 'serializer', name: 'foo-bar' });
    expect(m('foo/bar/app/serializers/foo-bar/baz.js')).toEqual({ type: 'serializer', name: 'foo-bar/baz' });
  });
  it('transforms', () => {
    expect(m('foo/bar/app/transforms/foo.js')).toEqual({ type: 'transform', name: 'foo' });
    expect(m('foo/bar/app/transforms/foo-bar.js')).toEqual({ type: 'transform', name: 'foo-bar' });
    expect(m('foo/bar/app/transforms/foo-bar/baz.js')).toEqual({ type: 'transform', name: 'foo-bar/baz' });
  });
  it('services', () => {
    expect(m('foo/bar/app/services/foo.js')).toEqual({ type: 'service', name: 'foo' });
    expect(m('foo/bar/app/services/foo-bar.js')).toEqual({ type: 'service', name: 'foo-bar' });
    expect(m('foo/bar/app/services/foo-bar/baz.js')).toEqual({ type: 'service', name: 'foo-bar/baz' });
    expect(m('foo/bar/tests/unit/services/foo-bar-test.js')).toEqual({ type: 'service', name: 'foo-bar' });
  });
});
