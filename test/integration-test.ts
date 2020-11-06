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
} from './test_helpers/integration-helpers';
import { createMessageConnection, MessageConnection, Logger, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc';

import { CompletionRequest, DefinitionRequest, DocumentSymbolRequest, ExecuteCommandRequest, ReferencesRequest } from 'vscode-languageserver-protocol';

describe('integration', function () {
  let connection: MessageConnection;
  let serverProcess: cp.ChildProcess;

  beforeAll(async () => {
    serverProcess = startServer();
    connection = createMessageConnection(new StreamMessageReader(serverProcess.stdout), new StreamMessageWriter(serverProcess.stdin), <Logger>{
      error(msg) {
        console.log('error', msg);
      },
      log(msg) {
        console.log('log', msg);
      },
      info(msg) {
        console.log('info', msg);
      },
      warn(msg) {
        console.log('warn', msg);
      },
    });
    // connection.trace(2, {log: console.log}, false);
    connection.listen();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(() => {
    connection.dispose();
    serverProcess.kill();
  });

  describe('Initialize request', () => {
    it('returns an initialize request', async () => {
      jest.setTimeout(15000);
      const response = await initServer(connection);

      expect(response).toMatchSnapshot();
    });
  });

  describe('Go to definition works for all supported cases', () => {
    it('to to route defintion from LinkTo component', async () => {
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
              'hello.ts': 'hbs`<Darling />`',
            },
            templates: {
              components: {
                'darling.hbs': '',
              },
            },
          },
        },
        'app/components/hello.ts',
        { line: 0, character: 6 }
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
              'hello.ts': 'hbs`<Darling />`',
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
        { line: 0, character: 6 }
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
      const result: string[] = await connection.sendRequest((ExecuteCommandRequest.type as unknown) as string, {
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

      const result: { path: string; meta: UnknownResult }[] = await connection.sendRequest((ExecuteCommandRequest.type as unknown) as string, {
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
  });

  describe('GlimmerX', () => {
    it('able to provide list of locally defined components', async () => {
      const result = await getResult(
        CompletionRequest.method,
        connection,
        {
          'Button.ts': '',
          'Button-test.ts': '',
          'App.js': 'export default hbs`<`',
          Components: {
            'Table.js': '',
            'Border.ts': '',
            'Border.test.ts': '',
            'Ball.jsx': '',
            'Bus.hbs': '',
          },
          'package.json': JSON.stringify({ dependencies: { '@glimmerx/core': true } }),
        },
        'App.js',
        { line: 0, character: 20 }
      );

      expect(result).toMatchSnapshot();
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

  describe('GlimmerNative', () => {
    it('able to provide glimmer-native component', async () => {
      const result = await getResult(
        CompletionRequest.method,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '<',
            },
          },
          'package.json': JSON.stringify({ dependencies: { 'glimmer-native': true } }),
          node_modules: {
            'glimmer-native': {
              dist: {
                'index.js': 'module.exports = () => {};',
                src: {
                  glimmer: {
                    'native-components': {
                      ListView: {
                        'component.js': '',
                      },
                      Button: {
                        'template.js': '',
                      },
                    },
                  },
                },
              },
              'package.json': JSON.stringify({
                name: 'glimmer-native',
                main: 'dist/index.js',
              }),
            },
          },
        },
        'app/components/hello.hbs',
        { line: 0, character: 1 }
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

  describe('Able to provide autocomplete information for local scoped params', () => {
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
                'langserver.js': 'module.exports.onComplete = function(root, { type }) { if (type !== "script") { return null }; return [{label: "name"}]; }',
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
            dependencies: {
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

  it('autocomplete works for angle component slots', async () => {
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

  it('autocomplete works for multiple angle component slots', async () => {
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
