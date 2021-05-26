import { ClassicPathMatcher, PodMatcher } from '../../src/utils/path-matcher';

describe('PodMatcher', () => {
  const matcher = new PodMatcher('');

  function m(str: string) {
    return matcher.metaFromPath(str);
  }

  it('components', () => {
    expect(m('foo/bar/app/pods/foo/component.ts')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo/component.js')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo/component.hbs')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/pods/foo/component.css')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'style' });
  });
  it('routes', () => {
    expect(m('foo/bar/app/pods/foo/route.ts')).toEqual({ type: 'route', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo/index/route.ts')).toEqual({ type: 'route', name: 'foo/index', scope: 'application', kind: 'script' });
  });
  it('controllers', () => {
    expect(m('foo/bar/app/pods/foo/controller.ts')).toEqual({ type: 'controller', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo/index/controller.ts')).toEqual({ type: 'controller', name: 'foo/index', scope: 'application', kind: 'script' });
  });
  it('templates', () => {
    expect(m('foo/bar/app/pods/foo/index/template.hbs')).toEqual({ type: 'template', name: 'foo/index', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/pods/foo/template.hbs')).toEqual({ type: 'template', name: 'foo', scope: 'application', kind: 'template' });
  });
  it('helpers', () => {
    expect(m('foo/bar/app/pods/foo/helper.js')).toEqual({ type: 'helper', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/helper.js')).toEqual({ type: 'helper', name: 'foo-bar', scope: 'application', kind: 'script' });
  });
  it('modifiers', () => {
    expect(m('foo/bar/app/pods/foo/modifier.js')).toEqual({ type: 'modifier', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/modifier.js')).toEqual({ type: 'modifier', name: 'foo-bar', scope: 'application', kind: 'script' });
  });
  it('models', () => {
    expect(m('foo/bar/app/pods/foo/model.js')).toEqual({ type: 'model', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/model.js')).toEqual({ type: 'model', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/baz/model.js')).toEqual({ type: 'model', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('serializers', () => {
    expect(m('foo/bar/app/pods/foo/serializer.js')).toEqual({ type: 'serializer', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/baz/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('transforms', () => {
    expect(m('foo/bar/app/pods/foo/transform.js')).toEqual({ type: 'transform', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/transform.js')).toEqual({ type: 'transform', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/baz/transform.js')).toEqual({ type: 'transform', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('services', () => {
    expect(m('foo/bar/app/pods/foo/service.js')).toEqual({ type: 'service', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/service.js')).toEqual({ type: 'service', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pods/foo-bar/baz/service.js')).toEqual({ type: 'service', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('utils', () => {
    expect(m('foo/bar/app/pods/utils/baz-util.js')).toEqual({ type: 'util', name: 'baz-util', scope: 'application', kind: 'script' });
    expect(m('foo/bar/pods/tests/unit/utils/baz-util-test.js')).toEqual({ type: 'util', name: 'baz-util', scope: 'application', kind: 'test' });
    expect(m('foo/bar/pods/app/utils/fizz/baz-util.js')).toEqual({ type: 'util', name: 'fizz/baz-util', scope: 'application', kind: 'script' });
  });
  it('empty', () => {
    expect(m('foo/bar/app/components/foo/index.hbs')).toEqual(null);
    expect(m('foo/bar/app/routes/foo.ts')).toEqual(null);
    expect(m('foo/bar/app/helpers/foo.js')).toEqual(null);
  });
});

describe('PodMatcher :customPrefix', () => {
  const matcher = new PodMatcher('', 'app');

  function m(str: string) {
    return matcher.metaFromPath(str);
  }

  it('components', () => {
    expect(m('foo/bar/app/foo/component.ts')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo/component.js')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo/component.hbs')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/foo/component.css')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'style' });
    expect(m('repos/els-addon-typed-templates/app/components/my-component/component.ts')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'script',
    });
    expect(m('repos/els-addon-typed-templates/app/components/my-component/component.hbs')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'template',
    });
  });
  it('routes', () => {
    expect(m('foo/bar/app/foo/route.ts')).toEqual({ type: 'route', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo/index/route.ts')).toEqual({ type: 'route', name: 'foo/index', scope: 'application', kind: 'script' });
  });
  it('controllers', () => {
    expect(m('foo/bar/app/foo/controller.ts')).toEqual({ type: 'controller', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo/index/controller.ts')).toEqual({ type: 'controller', name: 'foo/index', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/pricing/controller.js')).toEqual({ type: 'controller', name: 'pricing', scope: 'application', kind: 'script' });
  });
  it('templates', () => {
    expect(m('foo/bar/app/pricing/template.hbs')).toEqual({ type: 'template', name: 'pricing', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/foo/index/template.hbs')).toEqual({ type: 'template', name: 'foo/index', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/foo/template.hbs')).toEqual({ type: 'template', name: 'foo', scope: 'application', kind: 'template' });
  });
  it('helpers', () => {
    expect(m('foo/bar/app/foo/helper.js')).toEqual({ type: 'helper', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/helper.js')).toEqual({ type: 'helper', name: 'foo-bar', scope: 'application', kind: 'script' });
  });
  it('modifiers', () => {
    expect(m('foo/bar/app/foo/modifier.js')).toEqual({ type: 'modifier', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/modifier.js')).toEqual({ type: 'modifier', name: 'foo-bar', scope: 'application', kind: 'script' });
  });
  it('models', () => {
    expect(m('foo/bar/app/foo/model.js')).toEqual({ type: 'model', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/model.js')).toEqual({ type: 'model', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/baz/model.js')).toEqual({ type: 'model', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('serializers', () => {
    expect(m('foo/bar/app/foo/serializer.js')).toEqual({ type: 'serializer', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/baz/serializer.js')).toEqual({ type: 'serializer', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('transforms', () => {
    expect(m('foo/bar/app/foo/transform.js')).toEqual({ type: 'transform', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/transform.js')).toEqual({ type: 'transform', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/baz/transform.js')).toEqual({ type: 'transform', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('services', () => {
    expect(m('foo/bar/app/foo/service.js')).toEqual({ type: 'service', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/service.js')).toEqual({ type: 'service', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/foo-bar/baz/service.js')).toEqual({ type: 'service', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('utils', () => {
    expect(m('foo/bar/app/utils/baz-util.js')).toEqual({ type: 'util', name: 'baz-util', scope: 'application', kind: 'script' });
    expect(m('foo/bar/tests/unit/utils/baz-util-test.js')).toEqual({ type: 'util', name: 'baz-util', scope: 'application', kind: 'test' });
    expect(m('foo/bar/app/utils/fizz/baz-util.js')).toEqual({ type: 'util', name: 'fizz/baz-util', scope: 'application', kind: 'script' });
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

  it('support in-repo addons', () => {
    expect(m('foo/bar/lib/my-addon/app/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/lib/my-addon/app/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/lib/my-addon/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/lib/my-addon/app/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo', scope: 'addon', kind: 'script' });
    expect(m('lib/my-addon/addon/utils/baz/foo-bar.js')).toEqual({ type: 'util', name: 'baz/foo-bar', scope: 'addon', kind: 'script' });
    expect(m('lib/my-addon/tests/unit/utils/baz/foo-bar-test.js')).toEqual({ type: 'util', name: 'baz/foo-bar', scope: 'addon', kind: 'test' });
  });
  it('support addons', () => {
    expect(m('foo/bar/addon/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/addon/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/addon/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/addon/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/addon/utils/foo/baz.ts')).toEqual({ type: 'util', name: 'foo/baz', scope: 'addon', kind: 'script' });
    expect(m('foo/bar/addon/tests/unit/utils/foo/baz-test.ts')).toEqual({ type: 'util', name: 'foo/baz', scope: 'addon', kind: 'test' });

    expect(m('foo/bar/app/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo', scope: 'application', kind: 'script' });
  });
  it('empty', () => {
    expect(m('foo/bar/app/pods/foo/modifier.js')).toEqual(null);
    expect(m('foo/bar/app/pods/foo/transform.js')).toEqual(null);
    expect(m('foo/bar/app/pods/foo/service.js')).toEqual(null);
    expect(m('app/styles/components/ui/meta-attribute__date-range__x-table-form/style.less')).toEqual(null);
  });
  it('ignores', () => {
    expect(m('foo/bar/tmp/app/components/foo/index.ts')).toEqual(null);
    expect(m('foo/bar/dist/app/components/foo/index.ts')).toEqual(null);
    expect(m('foo/bar/.git/app/components/foo/index.ts')).toEqual(null);
  });
  it('components', () => {
    expect(m('foo/bar/app/components/routes/foo/index.ts')).toEqual({ type: 'component', name: 'routes/foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/route/foo/index.ts')).toEqual({ type: 'component', name: 'route/foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/foo/index.ts')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/foo/index.js')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/foo/index.hbs')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/components/foo/component.js')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/foo/template.hbs')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'template' });
    expect(m('repos/emberclear/packages/frontend/app/components/app/off-canvas/index.hbs')).toEqual({
      type: 'component',
      name: 'app/off-canvas',
      scope: 'application',
      kind: 'template',
    });
    expect(m('frontend/app/components/app/sidebar/chats/channel-form/index.ts')).toEqual({
      type: 'component',
      name: 'app/sidebar/chats/channel-form',
      scope: 'application',
      kind: 'script',
    });
    expect(m('repos/brn/frontend/tests/integration/components/login-form/input/component-test.js')).toEqual({
      type: 'component',
      name: 'login-form/input',
      scope: 'application',
      kind: 'test',
    });
    expect(m('repos/brn/frontend/tests/integration/components/login-form/component-test.js')).toEqual({
      type: 'component',
      name: 'login-form',
      scope: 'application',
      kind: 'test',
    });

    expect(m('frontend/app/components/audio-player/styles.css')).toEqual({ type: 'component', name: 'audio-player', scope: 'application', kind: 'style' });
    expect(m('frontend/app/components/audio-player/styles.css')).toEqual({ type: 'component', name: 'audio-player', scope: 'application', kind: 'style' });
    expect(m('frontend/app/components/audio-player/styles.scss')).toEqual({ type: 'component', name: 'audio-player', scope: 'application', kind: 'style' });
    expect(m('frontend/app/components/audio-player/module.less')).toEqual({ type: 'component', name: 'audio-player', scope: 'application', kind: 'style' });

    expect(m('foo/bar/app/components/foo.js')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/components/foo.hbs')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/components/foo.module.less')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'style' });

    expect(m('foo/bar/app/templates/components/foo.hbs')).toEqual({
      type: 'component',
      name: 'foo',
      scope: 'application',
      kind: 'template',
    });
    expect(m('foo/bar/tests/integration/components/cart-widgget/item-test.js')).toEqual({
      type: 'component',
      name: 'cart-widgget/item',
      scope: 'application',
      kind: 'test',
    });
    expect(m('foo/bar/tests/integration/components/cart-widgget/index-test.js')).toEqual({
      type: 'component',
      name: 'cart-widgget',
      scope: 'application',
      kind: 'test',
    });

    expect(m('repos/els-addon-typed-templates/app/components/my-component/component.ts')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'script',
    });
    expect(m('repos/els-addon-typed-templates/app/components/my-component/template.hbs')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'template',
    });
    expect(m('repos/els-addon-typed-templates/app/components/my-component/index.ts')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'script',
    });
    expect(m('repos/els-addon-typed-templates/app/components/my-component/index.hbs')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'template',
    });
    expect(m('repos/els-addon-typed-templates/app/components/my-component.ts')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'script',
    });
    expect(m('repos/els-addon-typed-templates/app/components/my-component.hbs')).toEqual({
      type: 'component',
      name: 'my-component',
      scope: 'application',
      kind: 'template',
    });

    expect(m('repos/els-addon-typed-templates/tests/integration/components/exercise-stats/panel/component-test.js')).toEqual({
      type: 'component',
      name: 'exercise-stats/panel',
      scope: 'application',
      kind: 'test',
    });
  });
  it('routes', () => {
    expect(m('foo/bar/app/routes/foo/index.ts')).toEqual({ type: 'route', name: 'foo/index', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/routes/foo.ts')).toEqual({ type: 'route', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/tests/unit/routes/cart-widgget/index-test.js')).toEqual({
      type: 'route',
      name: 'cart-widgget/index',
      scope: 'application',
      kind: 'test',
    });
  });
  it('controllers', () => {
    expect(m('foo/bar/app/controllers/foo/index.ts')).toEqual({ type: 'controller', name: 'foo/index', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/controllers/foo.ts')).toEqual({ type: 'controller', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/tests/unit/controllers/cart-widgget/index-test.js')).toEqual({
      type: 'controller',
      name: 'cart-widgget/index',
      scope: 'application',
      kind: 'test',
    });
  });
  it('templates', () => {
    expect(m('foo/bar/app/templates/foo/index.hbs')).toEqual({ type: 'template', name: 'foo/index', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/templates/foo.hbs')).toEqual({ type: 'template', name: 'foo', scope: 'application', kind: 'template' });
    expect(m('foo/bar/app/templates/components/foo.hbs')).toEqual({ type: 'component', name: 'foo', scope: 'application', kind: 'template' });
  });
  it('helpers', () => {
    expect(m('foo/bar/app/helpers/foo.js')).toEqual({ type: 'helper', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/helpers/foo-bar.js')).toEqual({ type: 'helper', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/tests/integration/helpers/foo-bar-test.js')).toEqual({ type: 'helper', name: 'foo-bar', scope: 'application', kind: 'test' });
  });
  it('modifiers', () => {
    expect(m('foo/bar/app/modifiers/foo.js')).toEqual({ type: 'modifier', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/modifiers/foo-bar.js')).toEqual({ type: 'modifier', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/tests/integration/modifiers/foo-bar-test.js')).toEqual({ type: 'modifier', name: 'foo-bar', scope: 'application', kind: 'test' });
  });
  it('models', () => {
    expect(m('foo/bar/app/models/foo.js')).toEqual({ type: 'model', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/models/foo-bar.js')).toEqual({ type: 'model', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/models/foo-bar/baz.js')).toEqual({ type: 'model', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
    expect(m('foo/bar/tests/unit/models/foo-bar-test.js')).toEqual({ type: 'model', name: 'foo-bar', scope: 'application', kind: 'test' });
  });
  it('serializers', () => {
    expect(m('foo/bar/app/serializers/foo.js')).toEqual({ type: 'serializer', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/serializers/foo-bar.js')).toEqual({ type: 'serializer', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/serializers/foo-bar/baz.js')).toEqual({ type: 'serializer', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('transforms', () => {
    expect(m('foo/bar/app/transforms/foo.js')).toEqual({ type: 'transform', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/transforms/foo-bar.js')).toEqual({ type: 'transform', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/transforms/foo-bar/baz.js')).toEqual({ type: 'transform', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
  });
  it('services', () => {
    expect(m('foo/bar/app/services/foo.js')).toEqual({ type: 'service', name: 'foo', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/services/foo-bar.js')).toEqual({ type: 'service', name: 'foo-bar', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/services/foo-bar/baz.js')).toEqual({ type: 'service', name: 'foo-bar/baz', scope: 'application', kind: 'script' });
    expect(m('foo/bar/tests/unit/services/foo-bar-test.js')).toEqual({ type: 'service', name: 'foo-bar', scope: 'application', kind: 'test' });
  });

  it('utils', () => {
    expect(m('foo/bar/app/utils/baz-util.js')).toEqual({ type: 'util', name: 'baz-util', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/utils/fizz/baz-util.js')).toEqual({ type: 'util', name: 'fizz/baz-util', scope: 'application', kind: 'script' });
    expect(m('foo/bar/app/tests/unit/utils/fizz/baz-util.js')).toEqual({ type: 'util', name: 'fizz/baz-util', scope: 'application', kind: 'test' });
  });
});
