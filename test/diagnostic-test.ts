const { expect } = require('chai');

import { DiagnosticSeverity } from 'vscode-languageserver';
import { toDiagnostic } from '../src/utils/diagnostic';

describe('diagnostic-utils', function() {
  describe('toDiagnostic()', function() {
    it('converts handlebars parser errors', function() {
      const { source, error } = require('./fixtures/dignostic/handlbars-parser-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic.range.start.line).to.equal(1);
      expect(diagnostic.range.start.character).to.equal(2);
      expect(diagnostic.range.end.line).to.equal(1);
      expect(diagnostic.range.end.character).to.equal(6);
      expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostic.message).to.equal('Expecting \'ID\', \'STRING\', \'NUMBER\', \'BOOLEAN\', \'UNDEFINED\', \'NULL\', \'DATA\', got \'CLOSE\'');
      expect(diagnostic.source).to.equal('glimmer-engine');
    });

    it('converts glimmer compiler errors', function() {
      const { source, error } = require('./fixtures/dignostic/glimmer-compiler-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic.range.start.line).to.equal(1);
      expect(diagnostic.range.start.character).to.equal(2);
      expect(diagnostic.range.end.line).to.equal(1);
      expect(diagnostic.range.end.character).to.equal(11);
      expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostic.message).to.equal('Unclosed element `div`');
      expect(diagnostic.source).to.equal('glimmer-engine');
    });

    it('converts unclosed element errors', function() {
      const { source, error } = require('./fixtures/dignostic/non-translated-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic.range.start.line).to.equal(1);
      expect(diagnostic.range.start.character).to.equal(6);
      expect(diagnostic.range.end.line).to.equal(1);
      expect(diagnostic.range.end.character).to.equal(17);
      expect(diagnostic.severity).to.equal(DiagnosticSeverity.Error);
      expect(diagnostic.message).to.equal('Non-translated string used');
      expect(diagnostic.source).to.equal('ember-template-lint');
    });
  });
});
