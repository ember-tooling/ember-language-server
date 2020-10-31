import { normalizeToAngleBracketComponent, normalizeToNamedBlockName, normalizeToClassicComponent, normalizeServiceName } from '../../src/utils/normalizers';

describe('normalizeServiceName', () => {
  it('able to convert service to path', () => {
    expect(normalizeServiceName('foo')).toEqual('foo');
    expect(normalizeServiceName('Foo')).toEqual('foo');
    expect(normalizeServiceName('FooBar')).toEqual('foo-bar');
    expect(normalizeServiceName('FooBar/Baz')).toEqual('foo-bar/baz');
    expect(normalizeServiceName('FooBar/BazBoo')).toEqual('foo-bar/baz-boo');
  });
});

describe('normalizeToClassicComponent', () => {
  it('able to convert angle name to path', () => {
    expect(normalizeToClassicComponent('Foo')).toEqual('foo');
    expect(normalizeToClassicComponent('FooBar')).toEqual('foo-bar');
    expect(normalizeToClassicComponent('FooBar/Baz')).toEqual('foo-bar/baz');
    expect(normalizeToClassicComponent('FooBar/BazBoo')).toEqual('foo-bar/baz-boo');
    expect(normalizeToClassicComponent('Tables::I18nModelsTable')).toEqual('tables/i18n-models-table');
  });
  it('able to convert path name to path', () => {
    expect(normalizeToClassicComponent('foo')).toEqual('foo');
    expect(normalizeToClassicComponent('foo-bar')).toEqual('foo-bar');
    expect(normalizeToClassicComponent('foo-bar/baz')).toEqual('foo-bar/baz');
    expect(normalizeToClassicComponent('foo-bar/baz-boo')).toEqual('foo-bar/baz-boo');
    expect(normalizeToClassicComponent('tables/i18n-models-table')).toEqual('tables/i18n-models-table');
  });
});

describe('normalizeToNamedBlockName', () => {
  it('able to convert dasherized blocks to camel-case', () => {
    expect(normalizeToNamedBlockName('foo')).toEqual('foo');
    expect(normalizeToNamedBlockName('foo-bar')).toEqual('fooBar');
    expect(normalizeToNamedBlockName('fooBar')).toEqual('fooBar');
  });
});

describe('normalizeToAngleBracketComponent', () => {
  it('able to convert path to angle brackets', () => {
    expect(normalizeToAngleBracketComponent('-foo')).toEqual('-Foo');
    expect(normalizeToAngleBracketComponent('foo-')).toEqual('Foo');
    expect(normalizeToAngleBracketComponent('foo')).toEqual('Foo');
    expect(normalizeToAngleBracketComponent('foo/bar')).toEqual('Foo::Bar');
    expect(normalizeToAngleBracketComponent('foo/bar-baz')).toEqual('Foo::BarBaz');
    expect(normalizeToAngleBracketComponent('foo-bar')).toEqual('FooBar');
    expect(normalizeToAngleBracketComponent('foo-bar/baz')).toEqual('FooBar::Baz');
    expect(normalizeToAngleBracketComponent('foo-bar/baz-boo')).toEqual('FooBar::BazBoo');
    expect(normalizeToAngleBracketComponent('tables/i18n-models-table')).toEqual('Tables::I18nModelsTable');
  });
  it('able to convert angle brackets to angle brackets', () => {
    expect(normalizeToAngleBracketComponent('Foo')).toEqual('Foo');
    expect(normalizeToAngleBracketComponent('FooBar')).toEqual('FooBar');
    expect(normalizeToAngleBracketComponent('FooBar::Baz')).toEqual('FooBar::Baz');
    expect(normalizeToAngleBracketComponent('Foo::BarBaz')).toEqual('Foo::BarBaz');
    expect(normalizeToAngleBracketComponent('Foo::Bar')).toEqual('Foo::Bar');
    expect(normalizeToAngleBracketComponent('FooBar::BazBoo')).toEqual('FooBar::BazBoo');
    expect(normalizeToAngleBracketComponent('Tables::I18nModelsTable')).toEqual('Tables::I18nModelsTable');
  });
});
