import { Readable, Writable } from 'stream';
import { createMessageConnection, Disposable, Logger, MessageConnection } from 'vscode-jsonrpc';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import { asyncFSProvider, initServer, registerCommandExecutor, startServer, createConnection } from './integration-helpers';

export { getResult, makeProject, createProject } from './integration-helpers';

export function createPointer(tpl = '') {
  const findMe = '⚡';
  const parts = tpl.split('\n');
  const line = parts.findIndex((e) => e.includes(findMe));
  const character = parts[line].indexOf(findMe) - 1;

  return {
    content: tpl.replace(findMe, ''),
    position: {
      line,
      character,
    },
  };
}

export interface ServerBucket {
  connection: MessageConnection;
  destroy(): Promise<void>;
}

export async function createServer({ asyncFsEnabled } = { asyncFsEnabled: false }): Promise<ServerBucket> {
  const serverProcess = startServer(asyncFsEnabled);
  let asyncFSProviderInstance!: any;
  const disposables: Disposable[] = [];
  const connection = createConnection(serverProcess);

  connection.listen();

  if (asyncFsEnabled) {
    asyncFSProviderInstance = asyncFSProvider();
    disposables.push(await registerCommandExecutor(connection, asyncFSProviderInstance));
  }

  await initServer(connection, 'full-project');

  await new Promise((resolve) => setTimeout(resolve, 1000));

  return {
    connection,
    async destroy() {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      for (const item of disposables) {
        await item.dispose();
      }

      if (asyncFsEnabled) {
        asyncFSProviderInstance = null;
      }

      await connection.dispose();
      await serverProcess.kill();
    },
  };
}
