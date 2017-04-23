const { expect } = require('chai');

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
      expect(position).to.have.property('line', 42);
      expect(position).to.have.property('column', 17);
    });
  });

  describe('comparePositions()', function() {
    it('compares two Position instances', function() {
      expect(comparePositions(newPosition(0, 0), newPosition(1, 1))).to.equal(-1);
      expect(comparePositions(newPosition(1, 0), newPosition(1, 1))).to.equal(-1);
      expect(comparePositions(newPosition(1, 1), newPosition(1, 1))).to.equal(0);
      expect(comparePositions(newPosition(1, 1), newPosition(1, 0))).to.equal(1);
      expect(comparePositions(newPosition(1, 1), newPosition(0, 0))).to.equal(1);
    });
  });

  describe('toPosition()', function() {
    it('converts languageserver Position to estree Position', function() {
      let position = toPosition(LSPosition.create(41, 17));
      expect(position).to.have.property('line', 42);
      expect(position).to.have.property('column', 17);
    });
  });

  describe('toLSPosition()', function() {
    it('converts estree Position to languageserver Position', function() {
      let position = toLSPosition(newPosition(42, 17));
      expect(position).to.have.property('line', 41);
      expect(position).to.have.property('character', 17);
    });
  });

  describe('toLSRange()', function() {
    it('converts estree SourceLocation to languageserver Range', function() {
      let { start, end } = toLSRange(newLocation(42, 17, 43, 10));
      expect(start).to.have.property('line', 41);
      expect(start).to.have.property('character', 17);
      expect(end).to.have.property('line', 42);
      expect(end).to.have.property('character', 10);
    });
  });

  describe('contains()', function() {
    it('checks if range contains a position', function() {
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 0))).to.be.false;
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 1))).to.be.true;
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 2))).to.be.true;
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 3))).to.be.true;
      expect(containsPosition(newLocation(42, 1, 42, 3), newPosition(42, 4))).to.be.false;

      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(1, 3))).to.be.false;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(2, 2))).to.be.false;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(2, 3))).to.be.true;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(2, 999))).to.be.true;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(3, 0))).to.be.true;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(3, 999))).to.be.true;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(4, 0))).to.be.true;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(4, 5))).to.be.true;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(4, 6))).to.be.false;
      expect(containsPosition(newLocation(2, 3, 4, 5), newPosition(5, 0))).to.be.false;
    });
  });
});
