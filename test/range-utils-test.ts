import { Range, Position } from 'vscode-languageserver';

import { contains } from '../src/range-utils';

describe('range-utils', function() {
  describe('contains()', function() {
    it('checks if range contains a position', function() {
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 0))).toBeFalsy();
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 1))).toBeTruthy();
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 2))).toBeTruthy();
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 3))).toBeTruthy();
      expect(contains(Range.create(42, 1, 42, 3), Position.create(42, 4))).toBeFalsy();

      expect(contains(Range.create(2, 3, 4, 5), Position.create(1, 3))).toBeFalsy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(2, 2))).toBeFalsy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(2, 3))).toBeTruthy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(2, 999))).toBeTruthy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(3, 0))).toBeTruthy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(3, 999))).toBeTruthy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(4, 0))).toBeTruthy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(4, 5))).toBeTruthy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(4, 6))).toBeFalsy();
      expect(contains(Range.create(2, 3, 4, 5), Position.create(5, 0))).toBeFalsy();
    });
  });
});
