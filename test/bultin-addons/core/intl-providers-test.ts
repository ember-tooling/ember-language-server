import { MessageConnection } from 'vscode-jsonrpc';
import { CompletionRequest, DefinitionRequest, HoverRequest } from 'vscode-languageserver-protocol';
import { createServer, ServerBucket, getResult, makeProject } from '../../test_helpers/public-integration-helpers';

const testCaseAsyncFsOptions = [false, true];
const translations = {
  'en-us.json': `{
    "rootFileTranslation": "text 1"
  }`,
  'pl-pl.json': `{
    "rootFileTranslation": "text 1 in polish"
  }`,
  'sub-folder': {
    'sub-sub-folder': {
      'en-us.json': `{
        "subsubFolderTranslation": {
          "subSubTranslation": "text 3",
          "anotherSubSubTranslation": "text 4"
        }
      }`,
    },
    'en-us.json': `{
      "subFolderTranslation": {
        "subTranslation": "text 2",
        "anotherTranslation": "another text"
      }
    }`,
  },
};

const translationsInvalid = {
  'en-us.json': `
    "rootFileTranslation": "text 1"
  }`,
};
const translationsYaml = {
  'en-us.yaml': `rootFileTranslation: text 1`,
  'sub-folder': {
    'en-us.yaml': `subFolderTranslation:
        subTranslation: text 2
        anotherTranslation: another text
      `,
  },
};

const translationsYamlYMLExtension = {
  'en-us.yml': `rootFileTranslation: text 1`,
  'sub-folder': {
    'en-us.yml': `subFolderTranslation:
        subTranslation: text 2
        anotherTranslation: another text
      `,
  },
};

const translationsYamlInvalid = {
  'en-us.yaml': `rootFileTranslation text 1`,
};

for (const asyncFsEnabled of testCaseAsyncFsOptions) {
  describe(`Intl - async fs enabled: ${asyncFsEnabled.toString()}`, function () {
    let instance!: ServerBucket;
    let connection!: MessageConnection;

    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: asyncFsEnabled });
      connection = instance.connection;
    });

    afterAll(async () => {
      await instance.destroy();
    });

    describe('empty autocomplete', () => {
      it('should not autocomplete if no data', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '',
                  },
                },
                translations,
              },
              'app/components/test.hbs',
              { line: 0, character: 0 }
            )
          ).response
        ).toEqual([]);
      });

      it('should not autocomplete if `els-intl-addon` installed', async () => {
        const files = makeProject(
          {
            app: {
              components: {
                'test.hbs': '{{t "rootFileTransla" }}',
              },
            },
            translations,
          },
          {
            'els-intl-addon': {
              'package.json': JSON.stringify({
                name: 'els-intl-addon',
                'ember-language-server': {
                  capabilities: {
                    completionProvider: true,
                  },
                },
              }),
            },
          }
        );

        expect((await getResult(CompletionRequest.method, connection, files, 'app/components/test.hbs', { line: 0, character: 19 })).response).toEqual([]);
      });

      it('should not autocomplete if invalid json file', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "rootFileTransla" }}',
                  },
                },
                translations: translationsInvalid,
              },
              'app/components/test.hbs',
              { line: 0, character: 12 }
            )
          ).response
        ).toEqual([]);
      });

      it('should not autocomplete if invalid yaml file', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "rootFileTransla" }}',
                  },
                },
                translations: translationsYamlInvalid,
              },
              'app/components/test.hbs',
              { line: 0, character: 12 }
            )
          ).response
        ).toEqual([]);
      });
    });

    describe('provide completion', () => {
      it('should autocomplete root translation in handlebars', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "rootFileTransla" }}',
                  },
                },
                translations,
              },
              'app/components/test.hbs',
              { line: 0, character: 19 }
            )
          ).response
        ).toEqual([
          {
            documentation: 'en-us : text 1\npl-pl : text 1 in polish',
            kind: 12,
            label: 'rootFileTranslation',
            textEdit: {
              newText: 'rootFileTranslation',
              range: {
                end: {
                  character: 5,
                  line: 0,
                },
                start: {
                  character: 5,
                  line: 0,
                },
              },
            },
          },
        ]);
      });

      it('should respect placeholder position in handlebars', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "rootFileTransla" }}',
                  },
                },
                translations,
              },
              'app/components/test.hbs',
              { line: 0, character: 12 }
            )
          ).response
        ).toEqual([
          {
            documentation: 'en-us : text 1\npl-pl : text 1 in polish',
            kind: 12,
            label: 'rootFileTranslation',
            textEdit: {
              newText: 'rootFileTranslation',
              range: {
                end: {
                  character: 5,
                  line: 0,
                },
                start: {
                  character: 5,
                  line: 0,
                },
              },
            },
          },
        ]);
      });

      describe('With ember-intl config', () => {
        describe('#wrapTranslationsWithNamespace is true', () => {
          it('should autocomplete sub folder translation in handlebars', async () => {
            expect(
              (
                await getResult(
                  CompletionRequest.method,
                  connection,
                  {
                    app: {
                      components: {
                        'test.hbs': `{{t "subFolderTranslat" }}`,
                      },
                    },
                    config: {
                      'ember-intl.js': `module.exports = function() { return { wrapTranslationsWithNamespace: true } }`,
                    },
                    translations,
                  },
                  'app/components/test.hbs',
                  { line: 0, character: 12 }
                )
              ).response
            ).toEqual([
              {
                documentation: 'en-us : text 2',
                kind: 12,
                label: 'sub-folder.subFolderTranslation.subTranslation',
                textEdit: {
                  newText: 'sub-folder.subFolderTranslation.subTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : another text',
                kind: 12,
                label: 'sub-folder.subFolderTranslation.anotherTranslation',
                textEdit: {
                  newText: 'sub-folder.subFolderTranslation.anotherTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 3',
                kind: 12,
                label: 'sub-folder.sub-sub-folder.subsubFolderTranslation.subSubTranslation',
                textEdit: {
                  newText: 'sub-folder.sub-sub-folder.subsubFolderTranslation.subSubTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 4',
                kind: 12,
                label: 'sub-folder.sub-sub-folder.subsubFolderTranslation.anotherSubSubTranslation',
                textEdit: {
                  newText: 'sub-folder.sub-sub-folder.subsubFolderTranslation.anotherSubSubTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
            ]);
          });

          it('should autocomplete when the translation is in the root file in handlebars', async () => {
            expect(
              (
                await getResult(
                  CompletionRequest.method,
                  connection,
                  {
                    app: {
                      components: {
                        'test.hbs': `{{t "admin." }}`,
                      },
                    },
                    config: {
                      'ember-intl.js': `module.exports = function() { return { wrapTranslationsWithNamespace: true } }`,
                    },
                    translations: {
                      'en.yml': `admin:
  foo: Bar`,
                    },
                  },
                  'app/components/test.hbs',
                  { line: 0, character: 12 }
                )
              ).response
            ).toEqual([
              {
                documentation: 'en : Bar',
                kind: 12,
                label: 'admin.foo',
                textEdit: {
                  newText: 'admin.foo',
                  range: {
                    end: {
                      character: 7,
                      line: 0,
                    },
                    start: {
                      character: 7,
                      line: 0,
                    },
                  },
                },
              },
            ]);
          });

          it('should autocomplete in JS files when in the end of expression', async () => {
            expect(
              (
                await getResult(
                  CompletionRequest.method,
                  connection,
                  {
                    app: {
                      components: {
                        'test.js': 'export default class Foo extends Bar { text = this.intl.t("subFolderTranslation.another"); }',
                      },
                    },
                    config: {
                      'ember-intl.js': `module.exports = function() { return { wrapTranslationsWithNamespace: true } }`,
                    },
                    translations,
                  },
                  'app/components/test.js',
                  { line: 0, character: 86 }
                )
              ).response
            ).toEqual([
              {
                documentation: 'en-us : another text',
                kind: 12,
                label: 'sub-folder.subFolderTranslation.anotherTranslation',
                textEdit: {
                  newText: 'sub-folder.subFolderTranslation.anotherTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 4',
                kind: 12,
                label: 'sub-folder.sub-sub-folder.subsubFolderTranslation.anotherSubSubTranslation',
                textEdit: {
                  newText: 'sub-folder.sub-sub-folder.subsubFolderTranslation.anotherSubSubTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
            ]);
          });

          it('should autocomplete sub folder translation in JS', async () => {
            expect(
              (
                await getResult(
                  CompletionRequest.method,
                  connection,
                  {
                    app: {
                      components: {
                        'test.js': `export default class Foo extends Bar { text = this.intl.t("subFolderTranslation."); }`,
                      },
                    },
                    config: {
                      'ember-intl.js': `module.exports = function() { return { wrapTranslationsWithNamespace: true } }`,
                    },
                    translations,
                  },
                  'app/components/test.js',
                  { line: 0, character: 64 }
                )
              ).response
            ).toEqual([
              {
                documentation: 'en-us : text 2',
                kind: 12,
                label: 'sub-folder.subFolderTranslation.subTranslation',
                textEdit: {
                  newText: 'sub-folder.subFolderTranslation.subTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : another text',
                kind: 12,
                label: 'sub-folder.subFolderTranslation.anotherTranslation',
                textEdit: {
                  newText: 'sub-folder.subFolderTranslation.anotherTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 3',
                kind: 12,
                label: 'sub-folder.sub-sub-folder.subsubFolderTranslation.subSubTranslation',
                textEdit: {
                  newText: 'sub-folder.sub-sub-folder.subsubFolderTranslation.subSubTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 4',
                kind: 12,
                label: 'sub-folder.sub-sub-folder.subsubFolderTranslation.anotherSubSubTranslation',
                textEdit: {
                  newText: 'sub-folder.sub-sub-folder.subsubFolderTranslation.anotherSubSubTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
            ]);
          });
        });

        describe('#wrapTranslationsWithNamespace is not set', () => {
          it('should not autocomplete sub folder translation in handlebars', async () => {
            expect(
              (
                await getResult(
                  CompletionRequest.method,
                  connection,
                  {
                    app: {
                      components: {
                        'test.hbs': `{{t "subFolderTranslat" }}`,
                      },
                    },
                    config: {
                      'ember-intl.js': `module.exports = function() { }`,
                    },
                    translations,
                  },
                  'app/components/test.hbs',
                  { line: 0, character: 12 }
                )
              ).response
            ).toEqual([
              {
                documentation: 'en-us : text 2',
                kind: 12,
                label: 'subFolderTranslation.subTranslation',
                textEdit: {
                  newText: 'subFolderTranslation.subTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : another text',
                kind: 12,
                label: 'subFolderTranslation.anotherTranslation',
                textEdit: {
                  newText: 'subFolderTranslation.anotherTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 3',
                kind: 12,
                label: 'subsubFolderTranslation.subSubTranslation',
                textEdit: {
                  newText: 'subsubFolderTranslation.subSubTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 4',
                kind: 12,
                label: 'subsubFolderTranslation.anotherSubSubTranslation',
                textEdit: {
                  newText: 'subsubFolderTranslation.anotherSubSubTranslation',
                  range: {
                    end: {
                      character: 5,
                      line: 0,
                    },
                    start: {
                      character: 5,
                      line: 0,
                    },
                  },
                },
              },
            ]);
          });

          it('should autocomplete in JS files when in the end of expression', async () => {
            expect(
              (
                await getResult(
                  CompletionRequest.method,
                  connection,
                  {
                    app: {
                      components: {
                        'test.js': 'export default class Foo extends Bar { text = this.intl.t("subFolderTranslation.another"); }',
                      },
                    },
                    config: {
                      'ember-intl.js': `module.exports = function() { return {}; }`,
                    },
                    translations,
                  },
                  'app/components/test.js',
                  { line: 0, character: 86 }
                )
              ).response
            ).toEqual([
              {
                documentation: 'en-us : another text',
                kind: 12,
                label: 'subFolderTranslation.anotherTranslation',
                textEdit: {
                  newText: 'subFolderTranslation.anotherTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 4',
                kind: 12,
                label: 'subsubFolderTranslation.anotherSubSubTranslation',
                textEdit: {
                  newText: 'subsubFolderTranslation.anotherSubSubTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
            ]);
          });

          it('should autocomplete sub folder translation in JS', async () => {
            expect(
              (
                await getResult(
                  CompletionRequest.method,
                  connection,
                  {
                    app: {
                      components: {
                        'test.js': `export default class Foo extends Bar { text = this.intl.t("subFolderTranslation."); }`,
                      },
                    },
                    config: {
                      'ember-intl.js': `module.exports = function() { return {}; }`,
                    },
                    translations,
                  },
                  'app/components/test.js',
                  { line: 0, character: 64 }
                )
              ).response
            ).toEqual([
              {
                documentation: 'en-us : text 2',
                kind: 12,
                label: 'subFolderTranslation.subTranslation',
                textEdit: {
                  newText: 'subFolderTranslation.subTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : another text',
                kind: 12,
                label: 'subFolderTranslation.anotherTranslation',
                textEdit: {
                  newText: 'subFolderTranslation.anotherTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 3',
                kind: 12,
                label: 'subsubFolderTranslation.subSubTranslation',
                textEdit: {
                  newText: 'subsubFolderTranslation.subSubTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
              {
                documentation: 'en-us : text 4',
                kind: 12,
                label: 'subsubFolderTranslation.anotherSubSubTranslation',
                textEdit: {
                  newText: 'subsubFolderTranslation.anotherSubSubTranslation',
                  range: {
                    end: {
                      character: 59,
                      line: 0,
                    },
                    start: {
                      character: 59,
                      line: 0,
                    },
                  },
                },
              },
            ]);
          });
        });
      });

      it('should autocomplete translation base on translation text', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': `{{t "polish" }}`,
                  },
                },
                translations,
              },
              'app/components/test.hbs',
              { line: 0, character: 8 }
            )
          ).response
        ).toEqual([
          {
            documentation: 'en-us : text 1\npl-pl : text 1 in polish',
            filterText: 'text 1 in polish pl-pl',
            kind: 12,
            label: 'text 1 in polish',
            textEdit: {
              newText: 'rootFileTranslation',

              range: {
                end: {
                  character: 5,
                  line: 0,
                },
                start: {
                  character: 5,
                  line: 0,
                },
              },
            },
          },
        ]);
      });
    });

    describe('YAML - .yaml file extensions', () => {
      describe('provide completion', () => {
        it('should autocomplete root translation in handlebars', async () => {
          expect(
            (
              await getResult(
                CompletionRequest.method,
                connection,
                {
                  app: {
                    components: {
                      'test.hbs': '{{t "rootFileTransla"}}',
                    },
                  },
                  translations: translationsYaml,
                },
                'app/components/test.hbs',
                { line: 0, character: 20 }
              )
            ).response
          ).toEqual([
            {
              documentation: 'en-us : text 1',
              kind: 12,
              label: 'rootFileTranslation',
              textEdit: {
                newText: 'rootFileTranslation',
                range: {
                  end: {
                    character: 5,
                    line: 0,
                  },
                  start: {
                    character: 5,
                    line: 0,
                  },
                },
              },
            },
          ]);
        });
      });

      it('should autocomplete sub folder translation in handlebars', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "subFolderTranslat"}}',
                  },
                },
                translations: translationsYaml,
              },
              'app/components/test.hbs',
              { line: 0, character: 22 }
            )
          ).response
        ).toEqual([
          {
            documentation: 'en-us : text 2',
            kind: 12,
            label: 'subFolderTranslation.subTranslation',
            textEdit: {
              newText: 'subFolderTranslation.subTranslation',
              range: {
                end: {
                  character: 5,
                  line: 0,
                },
                start: {
                  character: 5,
                  line: 0,
                },
              },
            },
          },
          {
            documentation: 'en-us : another text',
            kind: 12,
            label: 'subFolderTranslation.anotherTranslation',
            textEdit: {
              newText: 'subFolderTranslation.anotherTranslation',
              range: {
                end: {
                  character: 5,
                  line: 0,
                },
                start: {
                  character: 5,
                  line: 0,
                },
              },
            },
          },
        ]);
      });

      describe('provide definition', () => {
        it('should provide translation definition in handlebars', async () => {
          expect(
            (
              (await getResult(
                DefinitionRequest.method,
                connection,
                {
                  app: {
                    components: {
                      'test.hbs': '{{t "subFolderTranslation.subTranslation" }}',
                    },
                  },
                  translations: translationsYaml,
                },
                'app/components/test.hbs',
                { line: 0, character: 32 }
              )) as any
            ).response
          ).toEqual([
            {
              uri: '/translations/sub-folder/en-us.yaml',
              range: {
                start: { line: 1, character: 8 },
                end: { line: 1, character: 30 },
              },
            },
          ]);
        });

        it('should provide translation definition in js', async () => {
          expect(
            (
              (await getResult(
                DefinitionRequest.method,
                connection,
                {
                  app: {
                    components: {
                      'test.js': 'export default class Foo extends Bar { text = this.intl.t("subFolderTranslation.anotherTranslation"); }',
                    },
                  },
                  translations: translationsYaml,
                },
                'app/components/test.js',
                { line: 0, character: 86 }
              )) as any
            ).response
          ).toEqual([
            {
              uri: '/translations/sub-folder/en-us.yaml',
              range: {
                start: { line: 2, character: 8 },
                end: { line: 2, character: 40 },
              },
            },
          ]);
        });
      });
    });

    describe('YAML - .yml file extensions', () => {
      describe('provide completion', () => {
        it('should autocomplete root translation in handlebars', async () => {
          expect(
            (
              await getResult(
                CompletionRequest.method,
                connection,
                {
                  app: {
                    components: {
                      'test.hbs': '{{t "rootFileTransla"}}',
                    },
                  },
                  translations: translationsYamlYMLExtension,
                },
                'app/components/test.hbs',
                { line: 0, character: 20 }
              )
            ).response
          ).toEqual([
            {
              documentation: 'en-us : text 1',
              kind: 12,
              label: 'rootFileTranslation',
              textEdit: {
                newText: 'rootFileTranslation',
                range: {
                  end: {
                    character: 5,
                    line: 0,
                  },
                  start: {
                    character: 5,
                    line: 0,
                  },
                },
              },
            },
          ]);
        });
      });

      it('should autocomplete sub folder translation in handlebars', async () => {
        expect(
          (
            await getResult(
              CompletionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "subFolderTranslat"}}',
                  },
                },
                translations: translationsYamlYMLExtension,
              },
              'app/components/test.hbs',
              { line: 0, character: 22 }
            )
          ).response
        ).toEqual([
          {
            documentation: 'en-us : text 2',
            kind: 12,
            label: 'subFolderTranslation.subTranslation',
            textEdit: {
              newText: 'subFolderTranslation.subTranslation',
              range: {
                end: {
                  character: 5,
                  line: 0,
                },
                start: {
                  character: 5,
                  line: 0,
                },
              },
            },
          },
          {
            documentation: 'en-us : another text',
            kind: 12,
            label: 'subFolderTranslation.anotherTranslation',
            textEdit: {
              newText: 'subFolderTranslation.anotherTranslation',
              range: {
                end: {
                  character: 5,
                  line: 0,
                },
                start: {
                  character: 5,
                  line: 0,
                },
              },
            },
          },
        ]);
      });

      describe('provide definition', () => {
        it('should provide translation definition in handlebars', async () => {
          expect(
            (
              (await getResult(
                DefinitionRequest.method,
                connection,
                {
                  app: {
                    components: {
                      'test.hbs': '{{t "subFolderTranslation.subTranslation" }}',
                    },
                  },
                  translations: translationsYamlYMLExtension,
                },
                'app/components/test.hbs',
                { line: 0, character: 32 }
              )) as any
            ).response
          ).toEqual([
            {
              uri: '/translations/sub-folder/en-us.yml',
              range: {
                start: { line: 1, character: 8 },
                end: { line: 1, character: 30 },
              },
            },
          ]);
        });

        it('should provide translation definition in js', async () => {
          expect(
            (
              (await getResult(
                DefinitionRequest.method,
                connection,
                {
                  app: {
                    components: {
                      'test.js': 'export default class Foo extends Bar { text = this.intl.t("subFolderTranslation.anotherTranslation"); }',
                    },
                  },
                  translations: translationsYamlYMLExtension,
                },
                'app/components/test.js',
                { line: 0, character: 86 }
              )) as any
            ).response
          ).toEqual([
            {
              uri: '/translations/sub-folder/en-us.yml',
              range: {
                start: { line: 2, character: 8 },
                end: { line: 2, character: 40 },
              },
            },
          ]);
        });
      });
    });

    describe('provide definition', () => {
      it('should provide translation definition in handlebars', async () => {
        expect(
          (
            (await getResult(
              DefinitionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "subFolderTranslation.subTranslation" }}',
                  },
                },
                translations,
              },
              'app/components/test.hbs',
              { line: 0, character: 32 }
            )) as any
          ).response
        ).toEqual([
          {
            uri: '/translations/sub-folder/en-us.json',
            range: {
              start: { line: 2, character: 8 },
              end: { line: 2, character: 34 },
            },
          },
        ]);
      });

      it('should provide translation definition in js', async () => {
        expect(
          (
            (await getResult(
              DefinitionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.js': 'export default class Foo extends Bar { text = this.intl.t("subFolderTranslation.anotherTranslation"); }',
                  },
                },
                translations,
              },
              'app/components/test.js',
              { line: 0, character: 86 }
            )) as any
          ).response
        ).toEqual([
          {
            uri: '/translations/sub-folder/en-us.json',
            range: {
              start: { line: 3, character: 8 },
              end: { line: 3, character: 44 },
            },
          },
        ]);
      });

      it('should provide translation definitions from multiple files', async () => {
        expect(
          (
            (await getResult(
              DefinitionRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.js': 'export default class Foo extends Bar { text = this.intl.t("rootFileTranslation"); }',
                  },
                },
                translations,
              },
              'app/components/test.js',
              { line: 0, character: 70 }
            )) as any
          ).response
        ).toEqual([
          {
            uri: '/translations/en-us.json',
            range: {
              start: { line: 1, character: 4 },
              end: { line: 1, character: 35 },
            },
          },
          {
            uri: '/translations/pl-pl.json',
            range: {
              start: { line: 1, character: 4 },
              end: { line: 1, character: 45 },
            },
          },
        ]);
      });
    });

    describe('provide hover', () => {
      it('should provide translation hover in handlebars', async () => {
        expect(
          (
            (await getResult(
              HoverRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.hbs': '{{t "rootFileTranslation" }}',
                  },
                },
                translations,
              },
              'app/components/test.hbs',
              { line: 0, character: 20 }
            )) as any
          ).response
        ).toEqual({
          contents: {
            kind: 'plaintext',
            value: 'en-us : text 1\npl-pl : text 1 in polish',
          },

          range: {
            start: { line: 0, character: 4 },
            end: { line: 0, character: 25 },
          },
        });
      });

      it('should provide translation hover in js', async () => {
        expect(
          (
            (await getResult(
              HoverRequest.method,
              connection,
              {
                app: {
                  components: {
                    'test.js': 'export default class Foo extends Bar { text = this.intl.t("rootFileTranslation"); }',
                  },
                },
                translations,
              },
              'app/components/test.js',
              { line: 0, character: 70 }
            )) as any
          ).response
        ).toEqual({
          contents: {
            kind: 'plaintext',
            value: 'en-us : text 1\npl-pl : text 1 in polish',
          },

          range: {
            start: { line: 0, character: 58 },
            end: { line: 0, character: 79 },
          },
        });
      });
    });
  });
}
