import { expect } from 'chai';

import {
  emberBlockItems,
  emberMustacheItems,
  emberSubExpressionItems
} from '../src/completion-provider/ember-helpers';

describe('ember-helpers', function() {
  it('should provide all block helper', function() {
    expect(emberBlockItems).to.have.lengthOf(6);
  });

  it('should provide all non-block helper', function() {
    expect(emberMustacheItems).to.have.lengthOf(17);
  });

  it('should provide all subexpression helper', function() {
    expect(emberSubExpressionItems).to.have.lengthOf(11);
  });
});
