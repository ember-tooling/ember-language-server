import * as cp from 'child_process';
import * as path from 'path';
import { URI } from 'vscode-uri';
import {
  startServer,
  initServer,
  reloadProjects,
  openFile,
  normalizeUri,
  fsProjectToJSON,
  normalizeCompletionRequest,
  createConnection,
  killServerProcess,
} from './test_helpers/integration-helpers';
import { MessageConnection } from 'vscode-jsonrpc/node';

import { CompletionRequest, Definition, DefinitionRequest } from 'vscode-languageserver-protocol/node';

describe('With `batman project` initialized on server', () => {
  let connection: MessageConnection;
  let serverProcess: cp.ChildProcess;

  beforeAll(async () => {
    serverProcess = startServer();
    connection = createConnection(serverProcess);

    serverProcess.on('error', (err) => {
      console.log(err);
    });
    // connection.trace(2, {log: console.log}, false);
    connection.listen();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    connection.dispose();
    await killServerProcess(serverProcess);
  });

  beforeEach(async () => {
    await initServer(connection, 'batman');
  });

  afterEach(async () => {
    await reloadProjects(connection, null);
  });

  describe('Completion request', () => {
    jest.setTimeout(15000);
    it('returns all angle-bracket in a element expression for in repo addons with batman syntax', async () => {
      const root = path.join(__dirname, 'fixtures', 'batman');
      const applicationTemplatePath = path.join(root, 'app', 'templates', 'batman-completion.hbs');
      const params = {
        textDocument: {
          uri: URI.file(applicationTemplatePath).toString(),
        },
        position: {
          line: 1,
          character: 2,
        },
      };

      openFile(connection, applicationTemplatePath);

      const response = await connection.sendRequest(CompletionRequest.method, params);

      expect(normalizeCompletionRequest(response, root)).toMatchSnapshot();
    });

    it('returns all angle-bracket components with same name from different namespaces', async () => {
      const root = path.join(__dirname, 'fixtures', 'batman');
      const applicationTemplatePath = path.join(root, 'app', 'templates', 'same-component-name.hbs');
      const params = {
        textDocument: {
          uri: URI.file(applicationTemplatePath).toString(),
        },
        position: {
          line: 0,
          character: 1,
        },
      };

      openFile(connection, applicationTemplatePath);

      const response = await connection.sendRequest(CompletionRequest.method, params);

      expect(normalizeCompletionRequest(response, root)).toMatchSnapshot();
    });
  });

  describe('Definition request', () => {
    it('return proper component location from batman syntax component name', async () => {
      const base = path.join(__dirname, 'fixtures', 'batman');

      fsProjectToJSON(base);
      const applicationTemplatePath = path.join(base, 'app', 'templates', 'batman-definition.hbs');
      const params = {
        textDocument: {
          uri: URI.file(applicationTemplatePath).toString(),
        },
        position: {
          line: 0,
          character: 2,
        },
      };

      openFile(connection, applicationTemplatePath);

      let response: Definition[] = await connection.sendRequest(DefinitionRequest.method, params);

      response = normalizeUri(response, base);

      expect(response).toMatchSnapshot();
    });
  });

  it('return proper import location from in-repo addon', async () => {
    const base = path.join(__dirname, 'fixtures', 'batman');
    const applicationTemplatePath = path.join(base, 'app', 'components', 'another-awesome-component.js');
    const params = {
      textDocument: {
        uri: URI.file(applicationTemplatePath).toString(),
      },
      position: {
        line: 0,
        character: 18,
      },
    };

    openFile(connection, applicationTemplatePath);

    let response: Definition[] = await connection.sendRequest(DefinitionRequest.method, params);

    response = normalizeUri(response, base);

    expect(response).toMatchSnapshot();
  });
});
