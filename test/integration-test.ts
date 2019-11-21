import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { createTempDir } from 'broccoli-test-helper';

import { createMessageConnection, MessageConnection, Logger, IPCMessageReader, IPCMessageWriter } from 'vscode-jsonrpc';
import {
  DidOpenTextDocumentNotification,
  InitializeRequest,
  CompletionRequest,
  DefinitionRequest,
  ExecuteCommandRequest,
  Definition,
  ReferencesRequest
} from 'vscode-languageserver-protocol';

function startServer() {
  const serverPath = './lib/start-server.js';

  return cp.fork(serverPath, [], {
    cwd: path.join(__dirname, '..')
  });
}

async function getResult(reqType, connection, files, fileToInspect, position) {
  const dir = await createTempDir();
  dir.write(files);
  const normalizedPath = path
    .normalize(dir.path())
    .split(':')
    .pop();
  const modelPath = path.join(normalizedPath, fileToInspect);

  const params = {
    textDocument: {
      uri: `file://${modelPath}`
    },
    position
  };
  await connection.sendRequest(ExecuteCommandRequest.type, ['els:registerProjectPath', normalizedPath]);
  openFile(connection, modelPath);
  let response = await connection.sendRequest(reqType, params);
  await dir.dispose();
  return normalizeUri(response, normalizedPath);
}

function openFile(connection: MessageConnection, filePath: string) {
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: `file://${filePath}`,
      text: fs.readFileSync(filePath, 'utf8')
    }
  });
}

function replaceDynamicUriPart(uri: string) {
  let dirname = __dirname;
  if (dirname.indexOf(':') === 1) {
    dirname = dirname.substr(2);
  }

  return uri
    .replace(dirname.replace(/\\/g, '/'), '/path-to-tests')
    .replace(dirname, '/path-to-tests')
    .replace(/\\/g, '/');
}

function replaceTempUriPart(uri: string, base: string) {
  return path
    .normalize(uri.replace('file://', ''))
    .replace(base, '')
    .split(path.sep)
    .join('/');
}

function normalizeUri(objects: Definition, base?: string) {
  if (!Array.isArray(objects)) {
    objects.uri = replaceDynamicUriPart(objects.uri);
    if (base) {
      objects.uri = replaceTempUriPart(objects.uri, base);
    }
    return objects;
  }

  return objects.map((object) => {
    if (object === null) {
      return object;
    }
    if (object.uri) {
      const { uri } = object;
      object.uri = replaceDynamicUriPart(uri);
      if (base) {
        object.uri = replaceTempUriPart(object.uri, base);
      }
    }

    return object;
  });
}

describe('integration', function() {
  let connection: MessageConnection;
  let serverProcess: cp.ChildProcess;

  beforeAll(() => {
    serverProcess = startServer();
    connection = createMessageConnection(new IPCMessageReader(serverProcess), new IPCMessageWriter(serverProcess), <Logger>{
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
      }
    });

    connection.listen();
  });

  afterAll(() => {
    connection.dispose();
    serverProcess.kill();
  });

  describe('Initialize request', () => {
    it('returns an initialize request', async () => {
      const params = {
        rootUri: `file://${path.join(__dirname, 'fixtures', 'full-project')}`,
        capabilities: {}
      };

      const response = await connection.sendRequest(InitializeRequest.type, params);

      expect(response).toMatchSnapshot();
    });
  });

  describe('Completion request', () => {
    it('returns all components and helpers when requesting completion items in a handlebars expression', async () => {
      const applicationTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'application.hbs');
      const params = {
        textDocument: {
          uri: `file://${applicationTemplatePath}`
        },
        position: {
          line: 1,
          character: 2
        }
      };

      openFile(connection, applicationTemplatePath);

      const response = await connection.sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });

    it('returns all angle-bracket in a element expression', async () => {
      const applicationTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'angle-completion.hbs');
      const params = {
        textDocument: {
          uri: `file://${applicationTemplatePath}`
        },
        position: {
          line: 1,
          character: 2
        }
      };

      openFile(connection, applicationTemplatePath);

      const response = await connection.sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });

    it('returns all routes when requesting completion items in an inline link-to', async () => {
      const templatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${templatePath}`
        },
        position: {
          line: 2,
          character: 23
        }
      };

      openFile(connection, templatePath);

      const response = await connection.sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });

    it('returns all routes when requesting completion items in a block link-to', async () => {
      const templatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${templatePath}`
        },
        position: {
          line: 3,
          character: 12
        }
      };

      openFile(connection, templatePath);

      const response = await connection.sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });
  });

  describe('Definition request', () => {
    it('returns the definition information for a component in a template', async () => {
      const definitionTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${definitionTemplatePath}`
        },
        position: {
          line: 0,
          character: 4
        }
      };

      openFile(connection, definitionTemplatePath);

      let response = await connection.sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a helper in a template', async () => {
      const definitionTemplatePath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'templates', 'definition.hbs');
      const params = {
        textDocument: {
          uri: `file://${definitionTemplatePath}`
        },
        position: {
          line: 1,
          character: 4
        }
      };

      openFile(connection, definitionTemplatePath);

      let response = await connection.sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a hasMany relationship', async () => {
      const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-a.js');
      const params = {
        textDocument: {
          uri: `file://${modelPath}`
        },
        position: {
          line: 4,
          character: 27
        }
      };

      openFile(connection, modelPath);

      let response = await connection.sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a belongsTo relationship', async () => {
      const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-b.js');
      const params = {
        textDocument: {
          uri: `file://${modelPath}`
        },
        position: {
          line: 4,
          character: 27
        }
      };

      openFile(connection, modelPath);

      let response = await connection.sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });

    it('returns the definition information for a transform', async () => {
      const modelPath = path.join(__dirname, 'fixtures', 'full-project', 'app', 'models', 'model-a.js');
      const params = {
        textDocument: {
          uri: `file://${modelPath}`
        },
        position: {
          line: 6,
          character: 27
        }
      };

      openFile(connection, modelPath);

      let response = await connection.sendRequest(DefinitionRequest.type, params);

      response = normalizeUri(response);
      expect(response).toMatchSnapshot();
    });
  });

  describe('Go to definition works for all supported cases', () => {
    it('to to route defintion from LinkTo component', async () => {
      const result = await getResult(
        DefinitionRequest.type,
        connection,
        {
          app: {
            templates: {
              foo: {
                bar: {
                  'baz.hbs': ''
                }
              }
            },
            components: {
              'hello.hbs': '<LinkTo @route="foo.bar.baz" />'
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 17 }
      );

      expect(result).toMatchSnapshot();
    });

    it('go to local template-only component', async () => {
      const result = await getResult(
        DefinitionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '<Darling />',
              'darling.hbs': ''
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 2 }
      );

      expect(result).toMatchSnapshot();
    });
    it('go to local template-only component in module', async () => {
      const result = await getResult(
        DefinitionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '<Darling />',
              darling: {
                'index.hbs': ''
              }
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 2 }
      );

      expect(result).toMatchSnapshot();
    });
    it('go to local template-only component in pod-like', async () => {
      const result = await getResult(
        DefinitionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '<Darling />',
              darling: {
                'template.hbs': ''
              }
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 2 }
      );

      expect(result).toMatchSnapshot();
    });
    it('go to local template-only component in templates dir', async () => {
      const result = await getResult(
        DefinitionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '<Darling />'
            },
            templates: {
              components: {
                'darling.hbs': ''
              }
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 2 }
      );

      expect(result).toMatchSnapshot();
    });
    it('go to component from typescripted inline template', async () => {
      const result = await getResult(
        DefinitionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.ts': 'hbs`<Darling />`'
            },
            templates: {
              components: {
                'darling.hbs': ''
              }
            }
          }
        },
        'app/components/hello.ts',
        { line: 0, character: 6 }
      );

      expect(result).toMatchSnapshot();
    });
  });

  describe('GlimmerX', () => {
    it('able to provide list of locally defined components', async () => {
      const result = await getResult(
        CompletionRequest.type,
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
            'Bus.hbs': ''
          },
          'package.json': JSON.stringify({ dependencies: { '@glimmerx/core': true } })
        },
        'App.js',
        { line: 0, character: 20 }
      );
      expect(result).toMatchSnapshot();
    });
  });

  describe('GlimmerNative', () => {
    it('able to provide glimmer-native component', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '<'
            }
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
                        'component.js': ''
                      },
                      Button: {
                        'template.js': ''
                      }
                    }
                  }
                }
              },
              'package.json': JSON.stringify({
                name: 'glimmer-native',
                main: 'dist/index.js'
              })
            }
          }
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
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'foo.hbs': '<MyBar @doo="12" @ />',
              'my-bar.hbs': '{{@name}} {{@name.boo}} {{@doo}} {{@picture}} {{#each @foo as |bar|}}{{/each}}'
            }
          }
        },
        'app/components/foo.hbs',
        { line: 0, character: 18 }
      );
      expect(result).toMatchSnapshot();
    });
  });

  describe('Able to provide API:Completion', () => {
    it('support dummy addon completion:template', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          node_modules: {
            provider: {
              lib: {
                'langserver.js':
                  'module.exports.onComplete = function(root, { type }) { if (type !== "template") { return null }; return [{label: "this.name"}]; }'
              },
              'package.json': JSON.stringify({
                name: 'provider',
                'ember-language-server': {
                  entry: './lib/langserver',
                  capabilities: {
                    completionProvider: true
                  }
                }
              })
            }
          },
          'package.json': JSON.stringify({
            dependencies: {
              provider: '*'
            }
          }),
          app: {
            components: {
              hello: {
                'index.hbs': '{{this.n}}'
              }
            }
          }
        },
        'app/components/hello/index.hbs',
        { line: 0, character: 8 }
      );
      expect(result).toMatchSnapshot();
    });
    it('support dummy addon completion:script', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          node_modules: {
            provider: {
              lib: {
                'langserver.js': 'module.exports.onComplete = function(root, { type }) { if (type !== "script") { return null }; return [{label: "name"}]; }'
              },
              'package.json': JSON.stringify({
                name: 'provider',
                'ember-language-server': {
                  entry: './lib/langserver',
                  capabilities: {
                    completionProvider: true
                  }
                }
              })
            }
          },
          'package.json': JSON.stringify({
            dependencies: {
              provider: '*'
            }
          }),
          app: {
            components: {
              hello: {
                'index.js': 'var a = "na"'
              }
            }
          }
        },
        'app/components/hello/index.js',
        { line: 0, character: 11 }
      );
      expect(result).toMatchSnapshot();
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
          completionProvider: true
        }
      };

      function makePackage(name, addonConfig) {
        let pack = {
          name,
          'ember-language-server': config
        };

        if (addonConfig) {
          pack['ember-addon'] = addonConfig;
        }
        return JSON.stringify(pack);
      }

      function makeAddon(name, addonConfig = undefined) {
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
            `
          },
          'package.json': makePackage(name, addonConfig)
        };
      }

      const addon1 = makeAddon(addon1Name);
      const addon2 = makeAddon(addon2Name, { before: addon3Name });
      const addon3 = makeAddon(addon3Name, { after: addon4Name });
      const addon4 = makeAddon(addon4Name, { after: addon1Name });

      const fileStructure = {
        node_modules: {
          addon1,
          addon2,
          addon3,
          addon4
        },
        'package.json': JSON.stringify({
          dependencies: {
            [addon1Name]: '*',
            [addon2Name]: '*',
            [addon3Name]: '*',
            [addon4Name]: '*'
          }
        }),
        app: {
          components: {
            dory: {
              'index.hbs': '{{this.a}}'
            }
          }
        }
      };

      const result = await getResult(CompletionRequest.type, connection, fileStructure, 'app/components/dory/index.hbs', { line: 0, character: 8 });
      expect(result).toMatchSnapshot();
    });
  });

  describe('Able to provide API:Definition', () => {
    it('support dummy addon definition:template', async () => {
      const result = await getResult(
        DefinitionRequest.type,
        connection,
        {
          node_modules: {
            provider: {
              lib: {
                'langserver.js': `
                  module.exports.onDefinition = function(root) { 
                    let filePath = require("path").join(__dirname, "./../../../app/components/hello/index.hbs");
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
                      "uri": "file://" + filePath.split(':').pop()
                    } ];
                  }
                `
              },
              'package.json': JSON.stringify({
                name: 'provider',
                'ember-language-server': {
                  entry: './lib/langserver',
                  capabilities: {
                    definitionProvider: true
                  }
                }
              })
            }
          },
          'package.json': JSON.stringify({
            dependencies: {
              provider: '*'
            }
          }),
          app: {
            components: {
              hello: {
                'index.hbs': '{{this}}'
              }
            }
          }
        },
        'app/components/hello/index.hbs',
        { line: 0, character: 3 }
      );
      expect(result).toMatchSnapshot();
    });

    it('support dummy addon definition:script', async () => {
      const result = await getResult(
        DefinitionRequest.type,
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
                      "uri": "file://" + filePath.split(':').pop()
                    } ]; 
                  }
                `
              },
              'package.json': JSON.stringify({
                name: 'provider',
                'ember-language-server': {
                  entry: './lib/langserver',
                  capabilities: {
                    definitionProvider: true
                  }
                }
              })
            }
          },
          'package.json': JSON.stringify({
            dependencies: {
              provider: '*'
            }
          }),
          app: {
            components: {
              hello: {
                'index.js': 'var n = "foo";'
              }
            }
          }
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
                    return [ { uri: 'file://' + filePath.split(':').pop(), range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } } ];
                  }
                `
              },
              'package.json': JSON.stringify({
                name: 'provider',
                'ember-language-server': {
                  entry: './lib/langserver',
                  capabilities: {
                    referencesProvider: true
                  }
                }
              })
            }
          },
          'package.json': JSON.stringify({
            dependencies: {
              provider: '*'
            }
          }),
          app: {
            components: {
              hello: {
                'index.hbs': '{{this}}'
              }
            }
          }
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
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              hello: {
                'index.js': 'export default class Foo extends Bar { firstName = "a"; lastName = "b"; }',
                'index.hbs': '{{this.}}'
              }
            }
          }
        },
        'app/components/hello/index.hbs',
        { line: 0, character: 7 }
      );
      expect(result).toMatchSnapshot();
    });

    it('support collocated components in mustache arguments', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              hello: {
                'index.js': 'export default class Foo extends Bar { firstName = "a"; lastName = "b"; }',
                'index.hbs': '{{foo this.}}'
              }
            }
          }
        },
        'app/components/hello/index.hbs',
        { line: 0, character: 11 }
      );
      expect(result).toMatchSnapshot();
    });

    it('support collocated components in node attributes', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              hello: {
                'index.js': 'export default class Foo extends Bar { firstName = "a"; lastName = "b"; }',
                'index.hbs': '<div prop={{this.}}>'
              }
            }
          }
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
        CompletionRequest.type,
        connection,
        {
          app: {
            templates: {
              foo: {
                bar: {
                  'baz.hbs': ''
                }
              }
            },
            components: {
              'hello.hbs': '<LinkTo @route="" />'
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 16 }
      );
      expect(result).toMatchSnapshot();
    });
  });

  describe('Autocomplete works for broken templates', () => {
    it('autocomplete information for component #1 {{', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '\n{{',
              'darling.hbs': ''
            }
          }
        },
        'app/components/hello.hbs',
        { line: 1, character: 2 }
      );

      expect(result.filter(({ kind }) => kind === 7)).toMatchSnapshot();
    });

    it('autocomplete information for component #2 <', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '\n<',
              'darling.hbs': ''
            }
          }
        },
        'app/components/hello.hbs',
        { line: 1, character: 1 }
      );

      expect(result.filter(({ kind }) => kind === 7)).toMatchSnapshot();
    });

    it('autocomplete information for component #3 {{#', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '\n{{#',
              'darling.hbs': ''
            }
          }
        },
        'app/components/hello.hbs',
        { line: 1, character: 3 }
      );

      expect(result).toMatchSnapshot();
    });

    it('autocomplete information for modifier #4 <Foo {{', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '<Foo {{'
            },
            modifiers: {
              'boo.js': ''
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 7 }
      );

      expect(result).toMatchSnapshot();
    });

    it('autocomplete information for helper #5 {{name (', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '{{name ('
            },
            helpers: {
              'boo.js': ''
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 8 }
      );

      expect(result.filter(({ kind }) => kind === 3)).toMatchSnapshot();
    });

    it('autocomplete information for helper #6 {{name (foo (', async () => {
      const result = await getResult(
        CompletionRequest.type,
        connection,
        {
          app: {
            components: {
              'hello.hbs': '{{name (foo ('
            },
            helpers: {
              'boo.js': ''
            }
          }
        },
        'app/components/hello.hbs',
        { line: 0, character: 13 }
      );

      expect(result.filter(({ kind }) => kind === 3)).toMatchSnapshot();
    });
  });
});
