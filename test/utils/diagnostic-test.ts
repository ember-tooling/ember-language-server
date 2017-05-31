const { expect } = require('chai');

import { DiagnosticSeverity } from 'vscode-languageserver';
import { toDiagnostic } from '../../src/utils/diagnostic';

describe('diagnostic-utils', function() {
  describe('toDiagnostic()', function() {
    it('converts handlebars parser errors', function() {
      const { source, error } = require('./fixtures/dignostic/handlbars-parser-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic).to.have.deep.property('range.start.line', 1);
      expect(diagnostic).to.have.deep.property('range.start.character', 2);
      expect(diagnostic).to.have.deep.property('range.end.line', 1);
      expect(diagnostic).to.have.deep.property('range.end.character', 6);
      expect(diagnostic).to.have.property('severity', DiagnosticSeverity.Error);
      expect(diagnostic).to.have.property('message', 'Expecting \'ID\', \'STRING\', \'NUMBER\', \'BOOLEAN\', \'UNDEFINED\', \'NULL\', \'DATA\', got \'CLOSE\'');
      expect(diagnostic).to.have.property('source', 'glimmer-engine');
    });

    it('converts glimmer compiler errors', function() {
      const { source, error } = require('./fixtures/dignostic/glimmer-compiler-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic).to.have.deep.property('range.start.line', 1);
      expect(diagnostic).to.have.deep.property('range.start.character', 2);
      expect(diagnostic).to.have.deep.property('range.end.line', 1);
      expect(diagnostic).to.have.deep.property('range.end.character', 11);
      expect(diagnostic).to.have.property('severity', DiagnosticSeverity.Error);
      expect(diagnostic).to.have.property('message', 'Unclosed element `div`');
      expect(diagnostic).to.have.property('source', 'glimmer-engine');
    });

    it('converts unclosed element errors', function() {
      const { source, error } = require('./fixtures/dignostic/non-translated-error.json');

      const diagnostic = toDiagnostic(source, error);

      expect(diagnostic).to.have.deep.property('range.start.line', 1);
      expect(diagnostic).to.have.deep.property('range.start.character', 6);
      expect(diagnostic).to.have.deep.property('range.end.line', 1);
      expect(diagnostic).to.have.deep.property('range.end.character', 17);
      expect(diagnostic).to.have.property('severity', DiagnosticSeverity.Error);
      expect(diagnostic).to.have.property('message', 'Non-translated string used');
      expect(diagnostic).to.have.property('source', 'ember-template-lint');
    });
  });
});
