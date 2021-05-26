import { extractTokensFromTemplate, getTemplateBlocks } from '../../src/utils/template-tokens-collector';

function t(tpl: string) {
  return extractTokensFromTemplate(tpl);
}

function tok(tpl: string) {
  return getTemplateBlocks(tpl);
}

describe('TemplateTokensCollector', () => {
  it('extract tokens from inline angle components', () => {
    expect(t('<MyComponent />')).toEqual(['my-component']);
  });
  it('extract tokens from nested inline angle components', () => {
    expect(t('<MyComponent::Bar />')).toEqual(['my-component/bar']);
  });
  it('extract tokens from inline curly components', () => {
    expect(t('{{my-component}}')).toEqual(['my-component']);
  });
  it('extract tokens from nested inline curly components', () => {
    expect(t('{{my-component/bar}}')).toEqual(['my-component/bar']);
  });
  it('extract tokens from modifiers in html tags', () => {
    expect(t('<input {{autocomplete}} >')).toEqual(['autocomplete']);
  });
  it('extract tokens from modifiers in angle components', () => {
    expect(t('<MyComponent {{autocomplete}} />')).toEqual(['my-component', 'autocomplete']);
  });
  it('extract tokens from curly blocks', () => {
    expect(t('{{#my-component/foo}} {{/my-component/foo}}')).toEqual(['my-component/foo']);
  });
  it('extract tokens from angle blocks', () => {
    expect(t('<MyComponent::Foo></MyComponent::Foo>')).toEqual(['my-component/foo']);
  });
  it('extract tokens from helpers in attributes', () => {
    expect(t('<MyComponent::Foo @name={{format-name "boo"}}></MyComponent::Foo>')).toEqual(['my-component/foo', 'format-name']);
  });
  it('extract tokens from helpers composition in attributes', () => {
    expect(t('<MyComponent::Foo @name={{format-name (to-uppercase "boo")}}></MyComponent::Foo>')).toEqual(['my-component/foo', 'format-name', 'to-uppercase']);
  });
  it('extract tokens from helpers composition in params', () => {
    expect(t('{{#my-component/foo name=(format-name (to-uppercase "boo"))}} {{/my-component/foo}}')).toEqual([
      'my-component/foo',
      'format-name',
      'to-uppercase',
    ]);
  });
  it('skip local paths for angle blocks', () => {
    expect(t('<Foo as |Bar|><Bar /></Foo>')).toEqual(['foo']);
  });
  it('skip local paths for curly blocks', () => {
    expect(t('{{#foo-bar as |Bar|}}<Bar />{{/foo-bar}}')).toEqual(['foo-bar']);
  });
  it('skip external arguments', () => {
    expect(t('<@Foo />')).toEqual([]);
  });
  it('works for component helper in let block', () => {
    expect(t('{{#let (component "foo-bar") as |MyComponent|}}<MyComponent />{{/let}}')).toEqual(['foo-bar']);
  });
  it('works for component helper in let hash block', () => {
    expect(t('{{#let (hash foo=(component "foo-bar")) as |hashes|}}<hashes.foo />{{/let}}')).toEqual(['foo-bar']);
  });
  it('works for component helper inline', () => {
    expect(t('{{component "foo-bar"}}')).toEqual(['foo-bar']);
  });
  it('works for component helper in block', () => {
    expect(t('{{#component "foo-bar"}}{{/component}}')).toEqual(['foo-bar']);
  });
});

describe('getTemplateBlocks', () => {
  it('extract named blocks from template and skip built-ins [inverse]', () => {
    expect(tok('{{yield to="inverse"}}')).toEqual([]);
  });
  it('extract named blocks from template and skip built-ins [else]', () => {
    expect(tok('{{yield to="else"}}')).toEqual([]);
  });
  it('extract named blocks from complex template', () => {
    expect(tok('{{#if a}}{{yield to="body"}}{{else}}{{yield to="head"}}{{/if}}')).toEqual(['body', 'head']);
  });
  it('extract multiple named blocks template', () => {
    expect(tok('{{yield to="body"}}{{yield to="head"}}')).toEqual(['body', 'head']);
  });
  it('extract single block name if multiple used', () => {
    expect(tok('{{yield to="body"}}{{yield to="head"}}{{yield to="body"}}{{yield to="head"}}')).toEqual(['body', 'head']);
  });
});
