import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { createMessageConnection, MessageConnection, Logger, IPCMessageReader, IPCMessageWriter } from 'vscode-jsonrpc';
import {
  DidOpenTextDocumentNotification,
  InitializeRequest,
  CompletionRequest
} from 'vscode-languageserver-protocol';

function startServer() {
  const serverPath = './lib/start-server.js';

  return cp.fork(serverPath, [], {
    cwd: path.join(__dirname, '..')
  });
}

function openFile(connection: MessageConnection, filePath: string) {
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: `file://${filePath}`,
      text: fs.readFileSync(filePath, 'utf8')
    }
  });
}

describe('integration', function() {
  let connection: MessageConnection;
  let serverProcess: cp.ChildProcess;

  beforeAll(() => {
    serverProcess = startServer();
    connection = createMessageConnection(
      new IPCMessageReader(serverProcess),
      new IPCMessageWriter(serverProcess),
      <Logger>{
        error(msg) { console.log('error', msg); },
        log(msg) { console.log('log', msg); },
        info(msg) { console.log('info', msg); },
        warn(msg) { console.log('warn', msg); },
      }
    );

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

      const response = await connection
        .sendRequest(CompletionRequest.type, params);

      expect(response).toMatchSnapshot();
    });
  });
});
