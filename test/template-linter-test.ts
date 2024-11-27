import TemplateLinter from '../src/template-linter';
import { type Project, type Server } from '../src';
import { type TextDocument } from 'vscode-languageserver-textdocument';

function getLinterInstance(depName?: string, depVersion?: string): [TemplateLinter, Project] {
  const linter = new TemplateLinter({
    projectRoots: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      projectForUri(_url: string) {
        return {
          dependencyMap: new Map(depName ? [[depName, { package: { name: depName, version: depVersion } }]] : []),
        } as Project;
      },
    },
    options: {
      type: 'node',
    },
  } as Server);

  return [linter, linter['server'].projectRoots.projectForUri('') as Project];
}

describe('template-linter', function () {
  describe('sourcesForDocument', function () {
    it('supports empty template-lint version', function () {
      const [linter, project] = getLinterInstance();

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual([]);
    });
    it('supports incorrect template-lint version [foo-bar]', function () {
      const [linter, project] = getLinterInstance('ember-template-lint', 'foo-bar');

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual([doc.getText()]);
    });
    it('supports incorrect template-lint version [*]', function () {
      const [linter, project] = getLinterInstance('ember-template-lint', '*');

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual([doc.getText()]);
    });
    it('process gjs for template-lint v2 with', function () {
      const [linter, project] = getLinterInstance('ember-template-lint', '2.0.0');

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual(['                     1']);
    });
    it('process gjs for template-lint v3 with', function () {
      const [linter, project] = getLinterInstance('ember-template-lint', '3.3.1');

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual(['                     1']);
    });
    it('process gjs for template-lint v4 with', function () {
      const [linter, project] = getLinterInstance('ember-template-lint', '4.3.1');

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual(['                     1']);
    });
    it('skip gjs processing for template-lint v5', function () {
      const [linter, project] = getLinterInstance('ember-template-lint', '5.0.0');

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual([doc.getText()]);
    });
    it('skip gjs processing for template-lint v6', function () {
      const [linter, project] = getLinterInstance('ember-template-lint', '6.0.0');

      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter.getSourcesForDocument(doc, project)).toEqual([doc.getText()]);
    });
  });
});
