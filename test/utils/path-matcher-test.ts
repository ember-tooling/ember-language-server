import { ClassicPathMatcher } from '../../src/utils/path-matcher';

describe('ClassicPathMatcher', () => {
  const matcher = new ClassicPathMatcher();
  function m(str: string) {
    return matcher.metaFromPath(str);
  }
  it('components', () => {
    expect(m('foo/bar/app/components/foo/index.ts')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/index.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/index.hbs')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/component.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo/template.hbs')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo.js')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/components/foo.hbs')).toEqual({ type: 'component', name: 'foo' });
    expect(m('foo/bar/app/templates/components/foo.hbs')).toEqual({ type: 'component', name: 'foo' });
  });
  it('routes', () => {
    expect(m('foo/bar/app/routes/foo/index.ts')).toEqual({ type: 'route', name: 'foo/index' });
    expect(m('foo/bar/app/routes/foo.ts')).toEqual({ type: 'route', name: 'foo' });
  });
  it('controllers', () => {
    expect(m('foo/bar/app/controllers/foo/index.ts')).toEqual({ type: 'controller', name: 'foo/index' });
    expect(m('foo/bar/app/controllers/foo.ts')).toEqual({ type: 'controller', name: 'foo' });
  });
  it('templates', () => {
    expect(m('foo/bar/app/templates/foo/index.hbs')).toEqual({ type: 'template', name: 'foo/index' });
    expect(m('foo/bar/app/templates/foo.hbs')).toEqual({ type: 'template', name: 'foo' });
    expect(m('foo/bar/app/templates/components/foo.hbs')).toEqual(null);
  });
  it('helpers', () => {
    expect(m('foo/bar/app/helpers/foo.js')).toEqual({ type: 'helper', name: 'foo' });
    expect(m('foo/bar/app/helpers/foo-bar.js')).toEqual({ type: 'helper', name: 'foo-bar' });
  });
  it('modifiers', () => {
    expect(m('foo/bar/app/modifiers/foo.js')).toEqual({ type: 'modifier', name: 'foo' });
    expect(m('foo/bar/app/modifiers/foo-bar.js')).toEqual({ type: 'modifier', name: 'foo-bar' });
  });
  it('models', () => {
    expect(m('foo/bar/app/models/foo.js')).toEqual({ type: 'model', name: 'foo' });
    expect(m('foo/bar/app/models/foo-bar.js')).toEqual({ type: 'model', name: 'foo-bar' });
    expect(m('foo/bar/app/models/foo-bar/baz.js')).toEqual({ type: 'model', name: 'foo-bar/baz' });
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
  });
});
