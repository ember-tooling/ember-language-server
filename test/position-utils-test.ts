import { Position } from 'vscode-languageserver';

import { compare } from '../src/position-utils';

import { expect } from 'chai';

describe('position-utils', function() {
  describe('compare()', function() {
    it('compares two Position instances', function() {
      expect(compare(Position.create(0, 0), Position.create(1, 1))).to.equal(-1);
      expect(compare(Position.create(1, 0), Position.create(1, 1))).to.equal(-1);
      expect(compare(Position.create(1, 1), Position.create(1, 1))).to.equal(0);
      expect(compare(Position.create(1, 1), Position.create(1, 0))).to.equal(1);
      expect(compare(Position.create(1, 1), Position.create(0, 0))).to.equal(1);
    });
  });
});
