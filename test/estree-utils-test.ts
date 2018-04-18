import { Position as LSPosition } from 'vscode-languageserver';

import {
  newPosition,
  comparePositions,
  newLocation,
  containsPosition,
  toPosition,
  toLSPosition,
  toLSRange,
} from '../src/estree-utils';

describe('estree-utils', function() {
  describe('newPosition()', function() {
    it('creates a new Position instances', function() {
      let position = newPosition(42, 17);
      expect(position).toHaveProperty('line', 42);
      expect(position).toHaveProperty('column', 17);
    });
  });

  describe('comparePositions()', function() {
    it('compares two Position instances', function() {
      expect(comparePositions(newPosition(0, 0), newPosition(1, 1))).toEqual(-1);
      expect(comparePositions(newPosition(1, 0), newPosition(1, 1))).toEqual(-1);
      expect(comparePositions(newPosition(1, 1), newPosition(1, 1))).toEqual(0);
      expect(comparePositions(newPosition(1, 1), newPosition(1, 0))).toEqual(1);
      expect(comparePositions(newPosition(1, 1), newPosition(0, 0))).toEqual(1);
    });
  });

  describe('toPosition()', function() {
    it('converts languageserver Position to estree Position', function() {
      let position = toPosition(LSPosition.create(41, 17));
      expect(position).toHaveProperty('line', 42);
      expect(position).toHaveProperty('column', 17);
    });
  });

  describe('toLSPosition()', function() {
    it('converts estree Position to languageserver Position', function() {
      let position = toLSPosition(newPosition(42, 17));
      expect(position).toHaveProperty('line', 41);
      expect(position).toHaveProperty('character', 17);
    });
  });

  describe('toLSRange()', function() {
    it('converts estree SourceLocation to languageserver Range', function() {
      let { start, end } = toLSRange(newLocation(42, 17, 43, 10));
      expect(start).toHaveProperty('line', 41);
      expect(start).toHaveProperty('character', 17);
      expect(end).toHaveProperty('line', 42);
      expect(end).toHaveProperty('character', 10);
    });
  });

  describe('contains()', function() {
    it('checks if range contains a position', function() {
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 0))).toBeFalsy();
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 1))).toBeTruthy();
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 2))).toBeTruthy();
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 3))).toBeTruthy();
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 4))).toBeFalsy();

      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(1, 3))).toBeFalsy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(2, 2))).toBeFalsy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(2, 3))).toBeTruthy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(2, 999))).toBeTruthy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(3, 0))).toBeTruthy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(3, 999))).toBeTruthy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(4, 0))).toBeTruthy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(4, 5))).toBeTruthy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(4, 6))).toBeFalsy();
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(5, 0))).toBeFalsy();
    });
  });
});
