import * as semver from 'semver';

import TemplateLinter from '../src/template-linter';
import { type Server } from '../src';
import { TextDocument } from 'vscode-languageserver-textdocument';

describe('template-linter', function () {
  describe('sourcesForDocument', function () {
    const linter = new TemplateLinter({
      options: {
        type: 'node',
      },
    } as Server);

    it('supports empty template-lint version', function () {
      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      expect(linter['sourcesForDocument'](doc, null)).toEqual(['let a = 12;<template>1</template>']);
    });
    it('process gjs for template-lint v4 with ~', function () {
      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      console.log(semver.parse('~4.3.1')); // should be counted as 4.3.1
      expect(linter['sourcesForDocument'](doc, semver.parse('~4.3.1'))).toEqual(['<template>1</template>']);
    });
    it('process gjs for template-lint v4 with ^', function () {
      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      console.log(semver.parse('^4.3.1')); // should be counted as 4.3.1
      expect(linter['sourcesForDocument'](doc, semver.parse('^4.3.1'))).toEqual(['<template>1</template>']);
    });
    it('process gjs for template-lint v4 with strict dependency', function () {
      const doc: TextDocument = {
        uri: 'test.gjs',
        getText() {
          return 'let a = 12;<template>1</template>';
        },
      } as TextDocument;

      console.log(semver.parse('4.3.1')); // should be counted as 4.3.1
      expect(linter['sourcesForDocument'](doc, semver.parse('4.3.1'))).toEqual(['                     1']);
    });
  });
});
