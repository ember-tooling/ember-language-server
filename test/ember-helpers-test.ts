import {
  emberBlockItems,
  emberMustacheItems,
  emberSubExpressionItems
} from '../src/completion-provider/ember-helpers';

describe('ember-helpers', function() {
  it('should provide all block helper', function() {
    expect(emberBlockItems).toHaveLength(6);
  });

  it('should provide all non-block helper', function() {
    expect(emberMustacheItems).toHaveLength(17);
  });

  it('should provide all subexpression helper', function() {
    expect(emberSubExpressionItems).toHaveLength(11);
  });
});
