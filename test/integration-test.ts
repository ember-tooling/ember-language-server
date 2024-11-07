import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import {
  startServer,
  initServer,
  getResult,
  reloadProjects,
  makeAddonPackage,
  makeProject,
  createProject,
  normalizeRegistry,
  normalizePath,
  Registry,
  UnknownResult,
  setServerConfig,
  asyncFSProvider,
  registerCommandExecutor,
  createConnection,
} from './test_helpers/integration-helpers';
import { MessageConnection } from 'vscode-jsonrpc/node';

import {
  CompletionRequest,
  DefinitionRequest,
  DocumentSymbolRequest,
  ExecuteCommandRequest,
  ReferencesRequest,
  Disposable,
  HoverRequest,
} from 'vscode-languageserver-protocol/node';
import { ITemplateTokens } from '../src/utils/usages-api';

describe('integration', function () {
  const testCaseAsyncFsOptions = [false, true];

  for (const asyncFsEnabled of testCaseAsyncFsOptions) {
    describe(`async fs enabled: ${asyncFsEnabled.toString()}`, function () {
      let connection: MessageConnection;
      let serverProcess: cp.ChildProcess;
      let asyncFSProviderInstance!: any;
      const disposables: Disposable[] = [];

      beforeAll(async () => {
        serverProcess = startServer(asyncFsEnabled);
        connection = createConnection(serverProcess);
        // connection.trace(2, {log: console.log}, false);
        connection.listen();

        if (asyncFsEnabled) {
          asyncFSProviderInstance = asyncFSProvider();
          disposables.push(await registerCommandExecutor(connection, asyncFSProviderInstance));
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      });

      afterAll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        for (const item of disposables) {
          await item.dispose();
        }

        if (asyncFsEnabled) {
          asyncFSProviderInstance = null;
        }

        await connection.dispose();
        await serverProcess.kill();
      });

      describe('Initialize request', () => {
        jest.setTimeout(15000);
        it('returns an initialize request', async () => {
          const response = await initServer(connection, 'full-project');

          expect(response.serverInfo.version.split('.').length).toEqual(3);
          delete response.serverInfo.version;
          expect(response).toMatchSnapshot();
        });
      });

      describe('Go to definition works for all supported cases', () => {
        it('go to route definition from LinkTo component', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                templates: {
                  foo: {
                    bar: {
                      'baz.hbs': '',
                    },
                  },
                },
                components: {
                  'hello.hbs': '<LinkTo @route="foo.bar.baz" />',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 17 }
          );

          expect(result).toMatchSnapshot();
        });

        it('to children route from application outlet', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                templates: {
                  'foo.hbs': '',
                  'application.hbs': '{{outlet}}',
                },
              },
            },
            'app/templates/application.hbs',
            { line: 0, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });

        it('to children route from meaningful outlet', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                templates: {
                  'foo.hbs': '{{outlet}}',
                  foo: {
                    'bar.hbs': '',
                    'baz.hbs': '',
                    boo: {
                      'bax.hbs': '',
                    },
                  },
                },
              },
            },
            'app/templates/foo.hbs',
            { line: 0, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });

        it('go to local template-only component', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<Darling />',
                  'darling.hbs': '',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 2 }
          );

          expect(result).toMatchSnapshot();
        });
        it('go to definition from app to in repo addon', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.js': 'import Bar from "biz/components/bar"',
                  darling: {
                    'index.js': '',
                  },
                },
              },
              lib: {
                biz: {
                  addon: {
                    components: {
                      'bar.js': '',
                    },
                  },
                  'package.json': JSON.stringify({
                    name: 'biz',
                    keywords: ['ember-addon'],
                    dependencies: {},
                  }),
                  'index.js': `/* eslint-env node */
                  'use strict';

                  module.exports = {
                    name: 'biz',

                    isDevelopingAddon() {
                      return true;
                    }
                  };`,
                },
              },
              'package.json': JSON.stringify({
                name: 'some-project',
                'ember-addon': {
                  paths: ['lib/biz'],
                },
              }),
            },
            'app/components/hello.js',
            { line: 0, character: 8 }
          );

          expect(result).toMatchSnapshot();
        });
        it('go to definition from app to nested utils location of in repo addon', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.js': 'import Bar from "biz/utils/boo/blah/zoo/bar"',
                  darling: {
                    'index.js': '',
                  },
                },
              },
              lib: {
                biz: {
                  addon: {
                    utils: {
                      boo: {
                        blah: {
                          zoo: {
                            'bar.js': '',
                          },
                        },
                      },
                    },
                  },
                  'package.json': JSON.stringify({
                    name: 'biz',
                    keywords: ['ember-addon'],
                    dependencies: {},
                  }),
                  'index.js': `/* eslint-env node */
                  'use strict';

                  module.exports = {
                    name: 'biz',

                    isDevelopingAddon() {
                      return true;
                    }
                  };`,
                },
              },
              'package.json': JSON.stringify({
                name: 'some-different-project',
                'ember-addon': {
                  paths: ['lib/biz'],
                },
              }),
            },
            'app/components/hello.js',
            { line: 0, character: 8 }
          );

          expect(result).toMatchSnapshot();
        });
        it('go to local template-only component in module', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<Darling />',
                  darling: {
                    'index.hbs': '',
                  },
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 2 }
          );

          expect(result).toMatchSnapshot();
        });
        it('go to local template-only component in pod-like', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<Darling />',
                  darling: {
                    'template.hbs': '',
                  },
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 2 }
          );

          expect(result).toMatchSnapshot();
        });
        it('go to local template-only component in templates dir', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<Darling />',
                },
                templates: {
                  components: {
                    'darling.hbs': '',
                  },
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 2 }
          );

          expect(result).toMatchSnapshot();
        });
        it('go to component from typescripted inline template', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.ts': 'import hbs from "htmlbars-inline-precompile";\nhbs`<Darling />`',
                },
                templates: {
                  components: {
                    'darling.hbs': '',
                  },
                },
              },
            },
            'app/components/hello.ts',
            { line: 1, character: 6 }
          );

          expect(result).toMatchSnapshot();
        });

        it('go to definition from script template working if we have test for component', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.ts': 'import hbs from "htmlbars-inline-precompile";\nhbs`<Darling />`',
                  'darling.ts': '',
                },
              },
              tests: {
                integration: {
                  components: {
                    darling: {
                      'component-test.js': '',
                    },
                  },
                },
              },
            },
            'app/components/hello.ts',
            { line: 1, character: 6 }
          );

          expect(result).toMatchSnapshot();
        });
        it('go to definition from handlebars template working if we have test for component', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<Darling />',
                  'darling.ts': '',
                },
              },
              tests: {
                integration: {
                  components: {
                    darling: {
                      'component-test.js': '',
                    },
                  },
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 4 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Diffent commands', () => {
        it('handle "els.getRelatedFiles" command', async () => {
          const project = await createProject(
            {
              app: {
                components: {
                  hello: {
                    'template.hbs': '',
                    'component.js': '',
                  },
                },
              },
              tests: {
                integration: {
                  components: {
                    'hello-test.js': '',
                  },
                },
              },
            },
            connection
          );

          // wait for async registry initialization;
          const result: string[] = await connection.sendRequest(ExecuteCommandRequest.type as unknown as string, {
            command: 'els.getRelatedFiles',
            arguments: [path.join(project.normalizedPath, 'app', 'components', 'hello', 'template.hbs')],
          });

          expect(normalizeRegistry(project.normalizedPath, project.result.registry as Registry)).toMatchSnapshot();

          expect(result.map((el) => normalizePath(path.relative(project.normalizedPath, el)))).toMatchSnapshot();

          await project.destroy();
        });
        it('handle "els.getRelatedFiles" command with meta flag', async () => {
          const project = await createProject(
            {
              app: {
                components: {
                  hello: {
                    'index.hbs': '',
                    'index.js': '',
                  },
                },
              },
              tests: {
                integration: {
                  components: {
                    'hello-test.js': '',
                  },
                },
              },
            },
            connection
          );

          const result: { path: string; meta: UnknownResult }[] = await connection.sendRequest(ExecuteCommandRequest.type as unknown as string, {
            command: 'els.getRelatedFiles',
            arguments: [path.join(project.normalizedPath, 'app', 'components', 'hello', 'index.hbs'), { includeMeta: true }],
          });

          expect(normalizeRegistry(project.normalizedPath, project.result.registry as Registry)).toMatchSnapshot();

          expect(
            result.map((el) => {
              return {
                path: normalizePath(path.relative(project.normalizedPath, el.path)),
                meta: el.meta,
              };
            })
          ).toMatchSnapshot();

          await project.destroy();
        });

        it('handle "els.getProjectRegistry" command', async () => {
          const project = await createProject(
            {
              'package.json': JSON.stringify({
                name: 'my-project',
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '',
                    'index.js': '',
                  },
                },
              },
              tests: {
                integration: {
                  components: {
                    'hello-test.js': '',
                  },
                },
              },
            },
            connection
          );

          const result: { registry: Registry; projectName: string } = await connection.sendRequest(ExecuteCommandRequest.type as unknown as string, {
            command: 'els.getProjectRegistry',
            arguments: [project.normalizedPath],
          });

          expect(normalizeRegistry(project.normalizedPath, result.registry)).toMatchSnapshot();

          expect(result.projectName).toBe('my-project');

          await project.destroy();
        });

        it('handle "els.getLegacyTemplateTokens" command', async () => {
          const project = await createProject(
            {
              'package.json': JSON.stringify({
                name: 'my-project',
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{component "foo"}} <MyComponent /> <Another::My::Component />',
                    'index.js': '',
                  },
                },
              },
              tests: {
                integration: {
                  components: {
                    'hello-test.js': '',
                  },
                },
              },
            },
            connection
          );

          expect(project.result.initIssues.length).toEqual(0);
          expect(project.result.name).toEqual('my-project');
          expect(project.result.registry.component.hello.length).toEqual(3);

          if (asyncFsEnabled) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // @to-do - figure out fails
          }

          const data: { tokens: ITemplateTokens } = await connection.sendRequest(ExecuteCommandRequest.type as unknown as string, {
            command: 'els.getLegacyTemplateTokens',
            arguments: [project.normalizedPath],
          });

          const result = data.tokens;

          Object.keys(result).forEach((kind) => {
            Object.keys(result[kind]).forEach((item) => {
              result[kind][item].source = normalizePath(path.relative(project.normalizedPath, result[kind][item].source));
            });
          });

          expect(result).toMatchSnapshot();

          await project.destroy();
        });
      });

      describe('DocumentSymbolProvider', () => {
        it('able to provide symbols for script document', async () => {
          const result = await getResult(
            DocumentSymbolRequest.type,
            connection,
            {
              app: {
                components: {
                  'hello.js': 'export default class Foo {}',
                },
              },
            },
            'app/components/hello.js',
            { line: 0, character: 1 }
          );

          expect(result).toMatchSnapshot();
        });
        it('able to provide symbols for template document', async () => {
          const result = await getResult(
            DocumentSymbolRequest.type,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '{{this.foo}}',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 1 }
          );

          expect(result).toMatchSnapshot();
        });
        it('stable if ast broken in script document', async () => {
          const result = await getResult(
            DocumentSymbolRequest.type,
            connection,
            {
              app: {
                components: {
                  'hello.js': 'export default class Foo {',
                },
              },
            },
            'app/components/hello.js',
            { line: 0, character: 1 }
          );

          expect(result).toMatchSnapshot();
        });
        it('stable if ast broken in template document', async () => {
          const result = await getResult(
            DocumentSymbolRequest.type,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '{{',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 1 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to provide autocomplete information for on modifier argument', () => {
        it('provide correct autocomplete values for div element', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<div {{on ""}}></div>',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 11 }
          );

          expect(result).toMatchSnapshot();
        });
        it('provide correct autocomplete values for RandomComponent element', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<Rnd {{on ""}}></Rnd>',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 11 }
          );

          expect(result).toMatchSnapshot();
        });
        it('provide correct autocomplete values for button element', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<select {{on ""}}></select>',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 14 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to provide autocomplete information for angle component arguments names', () => {
        it('support template-only collocated components arguments extraction', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': '<MyBar @doo="12" @ />',
                  'my-bar.hbs': '{{@name}} {{@name.boo}} {{@doo}} {{@picture}} {{#each @foo as |bar|}}{{/each}}',
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 18 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to provide autocomplete information for element attributes', () => {
        it('support ...attributes autocomplete', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': '<input ./>',
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 8 }
          );

          expect(result).toMatchSnapshot();
        });
        it('does not complete attributes twice', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': '<input ...attributes .>',
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 22 }
          );

          expect(result.response.length).toBe(0);
        });
      });

      describe('Able to provide autocomplete information for each attributes', () => {
        it('autocomplete key argument', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': ['{{#each k="" }}', '{{/each}}'].join('\n'),
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 9 }
          );

          expect(result.response).toMatchSnapshot();
        });

        it('autocomplete key argument values', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': ['{{#each key="" }}', '{{/each}}'].join('\n'),
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 13 }
          );

          expect(result.response).toMatchSnapshot();
        });
      });

      describe('Special helpers autocomplete', () => {
        it('autocomplete helpers in subExpression', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                'helpers/my-helper.js': '',
                components: {
                  'foo.hbs': '{{yield (helper "")}}',
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 17 }
          );

          expect(result.response).toMatchSnapshot();
        });
        it('autocomplete modifier in subExpression', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': '{{yield (modifier "")}}',
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 19 }
          );

          expect(result.response).toMatchSnapshot();
        });
        it('autocomplete component in subExpression', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': '{{yield (component "")}}',
                },
              },
            },
            'app/components/foo.hbs',
            { line: 0, character: 20 }
          );

          expect(result.response).toMatchSnapshot();
        });
      });

      describe('Able to provide autocomplete information for local scoped params', () => {
        it('support named slots context autocomplete', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'my-component.hbs': `{{yield (hash Foo=(component "my-component") Bar=(component "super-puper")) to="body"}}`,
                  'foo.hbs': ['<MyComponent>', '<:body as |b|>', '<b', '</:body>', '</MyComponent>'].join('\n'),
                },
              },
              $meta: {
                waitForTemplateTokensToBeCollected: true,
              },
            },
            'app/components/foo.hbs',
            { line: 2, character: 2 }
          );

          expect(
            result.response
              .map((e) => e.label)
              .sort()
              .join(',')
          ).toBe('b,b.Bar,b.Foo');
        });
        it('support tag blocks and yielded context', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'my-component.hbs': `{{yield (hash Foo=(component "my-component") Bar=(component "super-puper"))}}`,
                  'foo.hbs': ['<MyComponent as |bar|>', '{{b}}', '</MyComponent>'].join('\n'),
                },
              },
              $meta: {
                waitForTemplateTokensToBeCollected: true,
              },
            },
            'app/components/foo.hbs',
            { line: 1, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });
        it('support tag blocks and yielded capital context path', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'my-component.hbs': `{{yield (hash Moo=(component (or @foo "bar")) Foo=(component "my-component") baz=(helper "uppercase") editor=(modifier "my-modifier"))}}`,
                  'foo.hbs': ['<MyComponent as |Bar|>', '<Ba', '</MyComponent>'].join('\n'),
                },
              },
              $meta: {
                waitForTemplateTokensToBeCollected: true,
              },
            },
            'app/components/foo.hbs',
            { line: 1, character: 3 }
          );

          expect(result.response.length).toBe(5);
        });
        it('support tag blocks and yielded lowercase context path', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'my-component.hbs': `{{yield (hash Moo=(component (or @foo "bar")) Foo=(component "my-component") baz=(helper "uppercase") editor=(modifier "my-modifier"))}}`,
                  'foo.hbs': ['<MyComponent as |bar|>', '<ba', '</MyComponent>'].join('\n'),
                },
              },
              $meta: {
                waitForTemplateTokensToBeCollected: true,
              },
            },
            'app/components/foo.hbs',
            { line: 1, character: 3 }
          );

          expect(result.response.length).toBe(5);
        });
        it('support tag blocks', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': ['<MyComponent as |bar|>', '{{b}}', '</MyComponent>'].join('\n'),
                },
              },
            },
            'app/components/foo.hbs',
            { line: 1, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });
        it('support mustache blocks', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': ['{{#my-component as |bar|}}', '{{b}}', '{{/my-component}}'].join('\n'),
                },
              },
            },
            'app/components/foo.hbs',
            { line: 1, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });
        it('support component name autocomplete from block params', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'foo.hbs': ['{{#my-component as |bar|}}', '<MyComponent as |boo|>', '<b />', '</MyComponent>', '{{/my-component}}'].join('\n'),
                },
              },
            },
            'app/components/foo.hbs',
            { line: 2, character: 1 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to load API from project itself', () => {
        it('project custom completion:template', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              'package.json': JSON.stringify({
                name: 'default-name',
                'ember-language-server': {
                  entry: './lib/langserver',
                  capabilities: {
                    completionProvider: true,
                  },
                },
              }),
              lib: {
                'langserver.js':
                  'module.exports.onComplete = function(root, { type }) { if (type !== "template") { return null }; return [{label: "this.name"}]; }',
              },
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{this.n}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 8 }
          );

          expect(result).toMatchSnapshot();
        });
      });
      describe('Able to provide API:Completion', () => {
        it('support dummy addon completion:template', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js':
                      'module.exports.onComplete = function(root, { type }) { if (type !== "template") { return null }; return [{label: "this.name"}]; }',
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        completionProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 't1',
                dependencies: {
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{this.n}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 8 }
          );

          expect(result).toMatchSnapshot();
        });
        it('support dummy addon completion:script', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js':
                      'module.exports.onComplete = function(root, { type }) { if (type !== "script") { return null }; return [{label: "name"}]; }',
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        completionProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 'fake',
                dependencies: {
                  name: 'lake',
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.js': 'var a = "na"',
                  },
                },
              },
            },
            'app/components/hello/index.js',
            { line: 0, character: 11 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('API:Destructors', () => {
        it('support init functions without destructors', async () => {
          const addonName = 'addon1';
          const addonFiles = {
            'index.js': `
              const fs = require('fs');
              const path = require('path');
              module.exports.onInit = function(server, project) {
                const p = path.join(project.root, 'node_modules', '${addonName}');
                let name = 'tag';
                if (fs.existsSync(path.join(p, name))) {
                  name = name + '1';
                }
                fs.writeFileSync(path.join(p, name),'','utf8');
              }
            `,
            'package.json': makeAddonPackage(addonName, {
              entry: './index',
            }),
          };
          const project = makeProject(
            {
              app: {
                components: {
                  'hello.hbs': '',
                },
              },
            },
            {
              [addonName]: addonFiles,
            }
          );
          const { destroy, normalizedPath } = await createProject(project, connection);

          const addonPath = path.join(normalizedPath, 'node_modules', addonName);

          expect(fs.existsSync(path.join(addonPath, 'tag'))).toBe(true);
          expect(fs.existsSync(path.join(addonPath, 'tag1'))).toBe(false);

          const reloadResult = await reloadProjects(connection, normalizedPath);

          expect(reloadResult.msg).toBe('Project reloaded');
          expect(reloadResult.path).toBe(normalizedPath);
          expect(fs.existsSync(path.join(addonPath, 'tag'))).toBe(true);
          expect(fs.existsSync(path.join(addonPath, 'tag1'))).toBe(true);
          await destroy();
        });

        it('support init functions with destructors', async () => {
          const addonName = 'addon1';
          const addonFiles = {
            'index.js': `
              const fs = require('fs');
              const path = require('path');
              module.exports.onInit = function(server, project) {
                const p = path.join(project.root, 'node_modules', '${addonName}');
                let name = 'tag';
                if (fs.existsSync(path.join(p, name))) {
                  name = name + '1';
                }
                fs.writeFileSync(path.join(p, name),'','utf8');
                return () => {
                  fs.writeFileSync(path.join(p, name+'-removed'),'','utf8');
                }
              }
            `,
            'package.json': makeAddonPackage(addonName, {
              entry: './index',
            }),
          };
          const project = makeProject(
            {
              app: {
                components: {
                  'hello.hbs': '',
                },
              },
            },
            {
              [addonName]: addonFiles,
            }
          );
          const { destroy, normalizedPath } = await createProject(project, connection);

          const addonPath = path.join(normalizedPath, 'node_modules', addonName);

          expect(fs.existsSync(path.join(addonPath, 'tag'))).toBe(true);
          expect(fs.existsSync(path.join(addonPath, 'tag1'))).toBe(false);
          expect(fs.existsSync(path.join(addonPath, 'tag-removed'))).toBe(false);
          expect(fs.existsSync(path.join(addonPath, 'tag1-removed'))).toBe(false);

          const reloadResult = await reloadProjects(connection, normalizedPath);

          expect(reloadResult.msg).toBe('Project reloaded');
          expect(reloadResult.path).toBe(normalizedPath);
          expect(fs.existsSync(path.join(addonPath, 'tag'))).toBe(true);
          expect(fs.existsSync(path.join(addonPath, 'tag-removed'))).toBe(true);
          expect(fs.existsSync(path.join(addonPath, 'tag1'))).toBe(true);
          expect(fs.existsSync(path.join(addonPath, 'tag1-removed'))).toBe(false);
          await destroy();
        });
      });

      describe('API:Chain', () => {
        it('support addon ordering', async () => {
          const addon1Name = 'addon1';
          const addon2Name = 'addon2';
          const addon3Name = 'addon3';
          const addon4Name = 'addon4';

          const config = {
            entry: './lib/langserver',
            capabilities: {
              completionProvider: true,
            },
          };

          function makeAddon(name, config, addonConfig = undefined) {
            return {
              lib: {
                'langserver.js': `
                function onComplete(root, { type, results }) {
                  if (type !== "template") { return results; };
                  results.forEach((item)=>{
                    item.label = item.label + '_' + "${name}" + '_';
                  });
                  return results;
                };
                module.exports.onComplete = onComplete;
                `,
              },
              'package.json': makeAddonPackage(name, config, addonConfig),
            };
          }

          const addon1 = makeAddon(addon1Name, config);
          const addon2 = makeAddon(addon2Name, config, { before: addon3Name });
          const addon3 = makeAddon(addon3Name, config, { after: addon4Name });
          const addon4 = makeAddon(addon4Name, config, { after: addon1Name });

          const project = makeProject(
            {
              app: {
                components: {
                  dory: {
                    'index.hbs': '{{this.a}}',
                  },
                },
              },
            },
            {
              [addon1Name]: addon1,
              [addon2Name]: addon2,
              [addon3Name]: addon3,
              [addon4Name]: addon4,
            }
          );

          const result = await getResult(CompletionRequest.method, connection, project, 'app/components/dory/index.hbs', { line: 0, character: 8 });

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to use classes for API', () => {
        it('support dummy class-based addon definition:template', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js': `
                      module.exports = class Boo { onDefinition(root) {
                        let path = require("path");
                        let filePath = path.resolve(path.normalize(path.join(__dirname, "./../../../app/components/hello/index.hbs")));
                        return [ {
                          "range": {
                            "end": {
                              "character": 0,
                              "line": 0,
                            },
                            "start": {
                              "character": 0,
                              "line": 0,
                            }
                          },
                          "uri": filePath
                        } ];
                      }}
                    `,
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        definitionProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 'pork',
                dependencies: {
                  name: 'park',
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{this}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });

        it('support dummy class-based addon definition:template with correctly binded context', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js': `
                    module.exports = class Boo {
                      end() {
                        return {
                          character: 0,
                          line: 0,
                        };
                      }
                      start() {
                        return {
                          character: 0,
                          line: 0,
                        };
                      }
                      onDefinition(root) {
                        let path = require("path");
                        let filePath = path.resolve(
                          path.normalize(
                            path.join(__dirname, "./../../../app/components/hello/index.hbs")
                          )
                        );
                        return [
                          {
                            range: {
                              end: this.end(),
                              start: this.start(),
                            },
                            uri: filePath,
                          },
                        ];
                      }
                    };

                    `,
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        definitionProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 'white',
                dependencies: {
                  name: 'dark',
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{this}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });
      });
      describe('Able to provide API:Definition', () => {
        it('support dummy addon definition:template', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js': `
                      module.exports.onDefinition = function(root) {
                        let path = require("path");
                        let filePath = path.resolve(path.normalize(path.join(__dirname, "./../../../app/components/hello/index.hbs")));
                        return [ {
                          "range": {
                            "end": {
                              "character": 0,
                              "line": 0,
                            },
                            "start": {
                              "character": 0,
                              "line": 0,
                            }
                          },
                          "uri": filePath
                        } ];
                      }
                    `,
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        definitionProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 'shark',
                dependencies: {
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{this}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });

        it('support dummy addon definition:script', async () => {
          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js': `
                      module.exports.onDefinition = function(root) {
                        let filePath = require("path").join(__dirname, "./../../../app/components/hello/index.js");
                        return [ {
                          "range": {
                            "end": {
                              "character": 0,
                              "line": 0,
                            },
                            "start": {
                              "character": 0,
                              "line": 0,
                            }
                          },
                          "uri": filePath
                        } ];
                      }
                    `,
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        definitionProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 'pork',
                dependencies: {
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.js': 'var n = "foo";',
                  },
                },
              },
            },
            'app/components/hello/index.js',
            { line: 0, character: 10 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to provide API:Reference', () => {
        it('support dummy addon reference:template', async () => {
          const result = await getResult(
            ReferencesRequest.type,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js': `
                      module.exports.onReference = function(root) {
                        let filePath = require("path").join(__dirname, "./../../../app/components/hello/index.hbs");
                        return [ { uri: filePath, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } } ];
                      }
                    `,
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        referencesProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 'dog',
                dependencies: {
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{this}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to provide API:Hover', () => {
        it('support dummy addon hover:template', async () => {
          const result = await getResult(
            HoverRequest.type,
            connection,
            {
              node_modules: {
                provider: {
                  lib: {
                    'langserver.js': `
                      module.exports.onHover = function(root) {
                        return [ { contents: "foo", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } } ];
                      }
                    `,
                  },
                  'package.json': JSON.stringify({
                    name: 'provider',
                    'ember-language-server': {
                      entry: './lib/langserver',
                      capabilities: {
                        hoverProvider: true,
                      },
                    },
                  }),
                },
              },
              'package.json': JSON.stringify({
                name: 'cat',
                dependencies: {
                  provider: '*',
                },
              }),
              app: {
                components: {
                  hello: {
                    'index.hbs': '{{this}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Able to provide autocomplete information for local context access', () => {
        it('support collocated components', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  hello: {
                    'index.js': 'export default class Foo extends Bar { firstName = "a"; lastName = "b"; }',
                    'index.hbs': '{{this.}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 7 }
          );

          expect(result).toMatchSnapshot();
        });

        it('support child project addon calling parent project addon', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              'full-project': {
                app: {
                  templates: {
                    'hello.hbs': '',
                  },
                },
                lib: {
                  biz: {
                    addon: {
                      templates: {
                        components: {
                          'bar.hbs': '<Fo',
                        },
                      },
                    },
                    'package.json': JSON.stringify({
                      name: 'biz',
                      keywords: ['ember-addon'],
                      dependencies: {},
                      'ember-addon': {
                        paths: ['../../../lib/foo'],
                      },
                    }),
                    'index.js': `/* eslint-env node */
                    'use strict';

                    module.exports = {
                      name: 'biz',

                      isDevelopingAddon() {
                        return true;
                      }
                    };`,
                  },
                },
                'package.json': JSON.stringify({
                  name: 'zoo',
                  dependencies: { 'ember-holy-futuristic-template-namespacing-batman': '^1.0.2' },
                  'ember-addon': {
                    paths: ['lib/biz'],
                  },
                }),
              },
              lib: {
                foo: {
                  addon: {
                    templates: {
                      components: {
                        'bar.hbs': '',
                      },
                    },
                  },
                  app: {
                    components: {
                      'bar.js': 'Class Foo{}',
                    },
                  },
                  'package.json': JSON.stringify({
                    name: 'foo',
                    keywords: ['ember-addon'],
                    dependencies: {},
                  }),
                  'index.js': `/* eslint-env node */
                  'use strict';

                  module.exports = {
                    name: 'foo',

                    isDevelopingAddon() {
                      return true;
                    }
                  };`,
                },
              },
              'package.json': JSON.stringify({
                name: 'boss',
                dependencies: { 'ember-holy-futuristic-template-namespacing-batman': '^1.0.2' },
              }),
            },
            'full-project/lib/biz/addon/templates/components/bar.hbs',
            { line: 0, character: 2 },
            'full-project'
          );

          expect(result).toMatchSnapshot();
        });

        it('support collocated components in mustache arguments', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  hello: {
                    'index.js': 'export default class Foo extends Bar { firstName = "a"; lastName = "b"; }',
                    'index.hbs': '{{foo this.}}',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 11 }
          );

          expect(result).toMatchSnapshot();
        });

        it('support collocated components in node attributes', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  hello: {
                    'index.js': 'export default class Foo extends Bar { firstName = "a"; lastName = "b"; }',
                    'index.hbs': '<div prop={{this.}}>',
                  },
                },
              },
            },
            'app/components/hello/index.hbs',
            { line: 0, character: 17 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Autocomplete works in LinkTo components for @route argument', () => {
        it('able to autocomplete basic routes', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                templates: {
                  foo: {
                    bar: {
                      'baz.hbs': '',
                    },
                  },
                },
                components: {
                  'hello.hbs': '<LinkTo @route="" />',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 16 }
          );

          expect(result).toMatchSnapshot();
        });
      });

      it('autocomplete works for angle component yielded blocks', async () => {
        const result = await getResult(
          CompletionRequest.method,
          connection,
          {
            app: {
              components: {
                'hello.hbs': '<Darling><:</Darling>',
                'darling.hbs': '{{yield to="main"}}',
              },
            },
          },
          'app/components/hello.hbs',
          { line: 0, character: 11 }
        );

        expect(result.response).toMatchSnapshot();
      });

      it('autocomplete works for multiple angle component yielded blocks', async () => {
        const result = await getResult(
          CompletionRequest.method,
          connection,
          {
            app: {
              components: {
                'hello.hbs': '<Darling><:</Darling>',
                'darling.hbs': '{{yield to="main"}}{{yield to="footer"}}<div>{{yield to="body"}}</div>',
              },
            },
          },
          'app/components/hello.hbs',
          { line: 0, character: 11 }
        );

        expect(result.response).toMatchSnapshot();
      });

      it('autocomplete includes yielded blocks in angle component completions', async () => {
        const result = await getResult(
          CompletionRequest.method,
          connection,
          {
            app: {
              components: {
                'hello.hbs': '<Darling><</Darling>',
                'world.hbs': 'Hello World',
                'darling.hbs': '{{yield to="main"}}',
              },
            },
          },
          'app/components/hello.hbs',
          { line: 0, character: 10 }
        );

        expect(result.response).toMatchSnapshot();
      });

      describe('Project class resolution, based on fs path and file structure', () => {
        it('able to resolve main project if top-level addon is registered', async () => {
          const files = {
            'full-project/app/components': {
              'foo.hbs': '',
              'bar.hbs': '',
            },
            'full-project/package.json': JSON.stringify({
              name: 'full-project',
              'ember-addon': {
                paths: ['../lib'],
              },
            }),
            lib: {
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
              'index.js': '',
              'addon/components/item.hbs': '<',
            },
          };

          const result = await getResult(
            CompletionRequest.method,
            connection,
            files,
            'lib/addon/components/item.hbs',
            { line: 0, character: 1 },
            'full-project'
          );

          expect(result.response.length).toBe(3);
        });

        it('without ignoring main project returns one only top level result', async () => {
          const files = {
            'child-project/app/components': {
              'foo.hbs': '',
              'bar.hbs': '',
            },
            'child-project/package.json': JSON.stringify({
              name: 'child-project',
              'ember-addon': {
                paths: ['../lib'],
              },
            }),
            lib: {
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
              'index.js': '',
              'addon/components/item.hbs': '<',
            },
            'package.json': JSON.stringify({
              name: 'parent-project',
              'ember-addon': {
                paths: ['lib'],
              },
            }),
          };

          let result = await getResult(CompletionRequest.method, connection, files, 'lib/addon/components/item.hbs', { line: 0, character: 1 }, [
            'lib',
            'child-project',
          ]);

          expect(result).toMatchSnapshot();
          expect(result.length).toBe(2);
          expect(result[0].response.length).toBe(1);
          expect(result[1].response.length).toBe(1);

          result = await getResult(CompletionRequest.method, connection, files, 'lib/addon/components/item.hbs', { line: 0, character: 1 }, ['child-project']);

          expect(result[0].response.length).toBe(3);
        });

        it('able to ignore main project in favor of child project', async () => {
          const files = {
            'child-project/app/components': {
              'foo.hbs': '',
              'bar.hbs': '',
            },
            'child-project/package.json': JSON.stringify({
              name: 'child-project',
              'ember-addon': {
                paths: ['../lib'],
              },
            }),
            lib: {
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
              'index.js': '',
              'addon/components/item.hbs': '<',
            },
            'package.json': JSON.stringify({
              name: 'parent-project',
            }),
          };

          await setServerConfig(connection, { local: { addons: [], ignoredProjects: ['parent-project'] } });

          const result = await getResult(CompletionRequest.method, connection, files, 'lib/addon/components/item.hbs', { line: 0, character: 1 }, [
            '',
            'child-project',
          ]);

          expect(result.length).toBe(2);
          expect(result[0].response.length).toBe(3);

          await setServerConfig(connection);
        });

        it('reverse ignore working as expected', async () => {
          const files = {
            'first-project': {
              'app/components': {
                'foo.hbs': '<',
                'bar.hbs': '',
              },
              'package.json': JSON.stringify({
                name: 'first-project',
                'ember-addon': {
                  paths: ['../lib'],
                },
              }),
            },
            'second-project': {
              'app/components/baz.hbs': '<',
              'package.json': JSON.stringify({
                name: 'second-project',
                'ember-addon': {
                  paths: ['../lib'],
                },
              }),
            },
            lib: {
              'package.json': JSON.stringify({
                name: 'my-addon',
                keywords: ['ember-addon'],
              }),
              'index.js': '',
              'addon/components/item.hbs': '<',
            },
          };

          await setServerConfig(connection, { local: { addons: [], ignoredProjects: ['!first-project'] } });
          const projects = ['first-project', 'second-project'];
          const pos = { line: 0, character: 1 };

          let result = await getResult(CompletionRequest.method, connection, files, 'first-project/app/components/foo.hbs', pos, projects);

          expect(result[0].response.length).toBe(3);

          result = await getResult(CompletionRequest.method, connection, files, 'lib/addon/components/item.hbs', pos, projects);

          expect(result[0].response.length).toBe(3);

          result = await getResult(CompletionRequest.method, connection, files, 'second-project/app/components/baz.hbs', pos, projects);

          expect(result[0].response.length).toBe(0);

          await setServerConfig(connection, { local: { addons: [], ignoredProjects: ['!second-project'] } });

          result = await getResult(CompletionRequest.method, connection, files, 'first-project/app/components/foo.hbs', pos, projects);

          expect(result[0].response.length).toBe(0);

          result = await getResult(CompletionRequest.method, connection, files, 'lib/addon/components/item.hbs', pos, projects);

          expect(result[0].response.length).toBe(2);

          result = await getResult(CompletionRequest.method, connection, files, 'second-project/app/components/baz.hbs', pos, projects);

          expect(result[0].response.length).toBe(2);

          await setServerConfig(connection, { local: { addons: [], ignoredProjects: ['!second-project', '!first-project'] } });

          result = await getResult(CompletionRequest.method, connection, files, 'first-project/app/components/foo.hbs', pos, projects);

          expect(result[0].response.length).toBe(3);

          result = await getResult(CompletionRequest.method, connection, files, 'second-project/app/components/baz.hbs', pos, projects);

          expect(result[0].response.length).toBe(2);

          await setServerConfig(connection, { local: { addons: [], ignoredProjects: ['second-project', 'first-project'] } });

          result = await getResult(CompletionRequest.method, connection, files, 'first-project/app/components/foo.hbs', pos, projects);

          expect(result[0].response.length).toBe(0);

          result = await getResult(CompletionRequest.method, connection, files, 'lib/addon/components/item.hbs', pos, projects);

          expect(result[0].response.length).toBe(0);

          result = await getResult(CompletionRequest.method, connection, files, 'second-project/app/components/baz.hbs', pos, projects);

          expect(result[0].response.length).toBe(0);

          await setServerConfig(connection);
        });

        it('support parent project addon calling child project', async () => {
          await setServerConfig(connection);

          const result = await getResult(
            DefinitionRequest.method,
            connection,
            {
              'full-project': {
                'app/templates/hello.hbs': '',
                'tests/helpers/blah.js': '',
                lib: {
                  biz: {
                    'addon/components/bar.js': '',
                    'package.json': JSON.stringify({
                      name: 'biz',
                      keywords: ['ember-addon'],
                      dependencies: {},
                      'ember-addon': {
                        paths: ['../../../lib/foo'],
                      },
                    }),
                    'index.js': '',
                  },
                },
                'package.json': JSON.stringify({
                  name: 'full-project',
                  dependencies: { 'ember-holy-futuristic-template-namespacing-batman': '^1.0.2' },
                  'ember-addon': {
                    paths: ['lib/biz'],
                  },
                }),
              },
              lib: {
                foo: {
                  addon: {
                    'components/bar.js': 'import Blah from "full-project/tests/helpers/blah"',
                  },
                  'package.json': JSON.stringify({
                    name: 'foo',
                    keywords: ['ember-addon'],
                    dependencies: {},
                  }),
                  'index.js': '',
                },
              },
            },
            'lib/foo/addon/components/bar.js',
            { line: 0, character: 8 },
            'full-project'
          );

          expect(result).toMatchSnapshot();
        });
      });

      describe('Autocomplete works for broken templates', () => {
        it('autocomplete information for component #1 {{', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '\n{{',
                  'darling.hbs': '',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 1, character: 2 }
          );

          expect(result.response.filter(({ kind }) => kind === 7)).toMatchSnapshot();
          expect(result.registry).toMatchSnapshot();
        });

        it('autocomplete information for component #2 <', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '\n<',
                  'darling.hbs': '',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 1, character: 1 }
          );

          expect(result.response.filter(({ kind }) => kind === 7)).toMatchSnapshot();
          expect(result.registry).toMatchSnapshot();
        });

        it('autocomplete information for component #3 {{#', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '\n{{#',
                  'darling.hbs': '',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 1, character: 3 }
          );

          expect(result).toMatchSnapshot();
        });

        it('autocomplete information for modifier #4 <Foo {{', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '<Foo {{',
                },
                modifiers: {
                  'boo.js': '',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 7 }
          );

          expect(result).toMatchSnapshot();
        });

        it('autocomplete information for helper #5 {{name (', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '{{name (',
                },
                helpers: {
                  'boo.js': '',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 8 }
          );

          expect(result.response.filter(({ kind }) => kind === 3)).toMatchSnapshot();
          expect(result.registry).toMatchSnapshot();
        });

        it('autocomplete information for helper #6 {{name (foo (', async () => {
          const result = await getResult(
            CompletionRequest.method,
            connection,
            {
              app: {
                components: {
                  'hello.hbs': '{{name (foo (',
                },
                helpers: {
                  'boo.js': '',
                },
              },
            },
            'app/components/hello.hbs',
            { line: 0, character: 13 }
          );

          expect(result.response.filter(({ kind }) => kind === 3)).toMatchSnapshot();
          expect(result.registry).toMatchSnapshot();
        });
      });
    });
  }
});
