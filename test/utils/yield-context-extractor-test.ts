import { extractYieldMetadata } from '../../src/utils/yield-context-extractor';
import { preprocess } from '@glimmer/syntax';

function extract(tpl: string) {
  return extractYieldMetadata(preprocess(tpl));
}

describe('Yeld Metadata API', () => {
  it('should handle default yield with hash', () => {
    expect(
      extract(`
        {{yield (hash Foo=(component "foo-bar"))}}
      `)
    ).toEqual({ 'default:0:Foo': ['component', 'foo-bar'] });
  });
  it('should handle default yield modifier with hash', () => {
    expect(
      extract(`
        {{yield (hash Foo=(modifier "foo-bar"))}}
      `)
    ).toEqual({ 'default:0:Foo': ['modifier', 'foo-bar'] });
  });
  it('should handle default yield helper with hash', () => {
    expect(
      extract(`
        {{yield (hash Foo=(helper "foo-bar"))}}
      `)
    ).toEqual({ 'default:0:Foo': ['helper', 'foo-bar'] });
  });
  it('should handle named yield with hash', () => {
    expect(
      extract(`
        {{yield (hash Foo=(component "foo-bar")) to="body"}}
      `)
    ).toEqual({ 'body:0:Foo': ['component', 'foo-bar'] });
  });
  it('should handle named yield with hash and if condition', () => {
    expect(
      extract(`
        {{yield (hash Foo=(component (if @a "foo-bar" "foo-baz"))) to="body"}}
      `)
    ).toEqual({ 'body:0:Foo': ['component', ['foo-bar', 'foo-baz']] });
  });
  it('should handle named yield with hash and or condition', () => {
    expect(
      extract(`
        {{yield (hash Foo=(component (or @a "foo-bar" "foo-baz"))) to="body"}}
      `)
    ).toEqual({ 'body:0:Foo': ['component', ['foo-bar', 'foo-baz']] });
  });
  it('should handle named yield with hash and and condition', () => {
    expect(
      extract(`
        {{yield (hash Foo=(component (and @a "foo-bar" "foo-baz"))) to="body"}}
      `)
    ).toEqual({ 'body:0:Foo': ['component', ['foo-bar', 'foo-baz']] });
  });
  it('should handle named yield with hash and unless condition', () => {
    expect(
      extract(`
        {{yield (hash Foo=(component (unless @a "foo-bar" "foo-baz"))) to="body"}}
      `)
    ).toEqual({ 'body:0:Foo': ['component', ['foo-bar', 'foo-baz']] });
  });
  it('should handle default yield with hash, having few concat keys', () => {
    expect(
      extract(`
        {{yield (hash
            Foo=(component "foo-bar")
            Bar=(component "bar-baz")
            Baz=(component "baz-boo")
        )}}
      `)
    ).toEqual({
      'default:0:Foo': ['component', 'foo-bar'],
      'default:0:Bar': ['component', 'bar-baz'],
      'default:0:Baz': ['component', 'baz-boo'],
    });
  });
  it('should handle default yield without hash', () => {
    expect(
      extract(`
        {{yield (component "foo-bar")}}
      `)
    ).toEqual({ 'default:0:': ['component', 'foo-bar'] });
  });
  it('should handle default yield without hash and multiple positions', () => {
    expect(
      extract(`
        {{yield (component "foo-bar") (component "foo-baz")}}
      `)
    ).toEqual({ 'default:0:': ['component', 'foo-bar'], 'default:1:': ['component', 'foo-baz'] });
  });
  it('should handle default yeld with single positional hash argument with component property', () => {
    expect(extract(`{{yield (hash Foo=(component "my-component"))}}`)).toEqual({ 'default:0:Foo': ['component', 'my-component'] });
  });
});
