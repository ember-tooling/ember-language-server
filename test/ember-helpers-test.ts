import { emberBlockItems, emberMustacheItems, emberSubExpressionItems, emberModifierItems } from '../src/builtin-addons/core/ember-helpers';

describe('ember-helpers', function() {
  it('should provide all block helper', function() {
    expect(emberBlockItems).toHaveLength(8);
  });

  it('should provide all non-block helper', function() {
    expect(emberMustacheItems).toHaveLength(19);
  });

  it('should provide all subexpression helper', function() {
    expect(emberSubExpressionItems).toHaveLength(13);
  });

  it('should provide all element-modifiers', function() {
    expect(emberModifierItems).toHaveLength(1);
  });
});
