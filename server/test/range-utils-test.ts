import { Range, Position } from 'vscode-languageserver-types';

import { contains } from '../src/range-utils';

const expect = require('chai').expect;

describe.only('range-utils', function() {
  describe('contains()', function() {
    it('checks if range contains a position', function() {
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 0))).to.be.false;
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 1))).to.be.true;
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 2))).to.be.true;
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 3))).to.be.true;
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 4))).to.be.false;

      expect(contains(Range.create(2, 3, 4, 5), Position.create(1, 3))).to.be.false;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(2, 2))).to.be.false;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(2, 3))).to.be.true;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(2, 999))).to.be.true;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(3, 0))).to.be.true;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(3, 999))).to.be.true;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(4, 0))).to.be.true;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(4, 5))).to.be.true;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(4, 6))).to.be.false;
      expect(contains(Range.create(2, 3, 4, 5), Position.create(5, 0))).to.be.false;
    });
  });
});
