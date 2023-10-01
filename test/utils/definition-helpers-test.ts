import { getFirstTextPosition } from '../../src/utils/definition-helpers';

describe('definition-helpers', function () {
  describe('getFirstTextPosition()', function () {
    it('return correct position for different text files', function () {
      expect(getFirstTextPosition(['', ' fooBar ', ''].join('\n'), 'foo')).toEqual([0, 0]);
      expect(getFirstTextPosition(['', ' ffooBar ', ''].join('\n'), 'foo')).toEqual([0, 0]);
      expect(getFirstTextPosition(['', ' foo() ', ''].join('\n'), 'foo')).toEqual([1, 1]);
      expect(getFirstTextPosition(['', ' foo ', ''].join('\n'), 'foo')).toEqual([1, 1]);
    });
  });
});
