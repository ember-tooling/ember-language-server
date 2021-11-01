import { Readable, Writable } from 'stream';
import { createMessageConnection, Disposable, Logger, MessageConnection } from 'vscode-jsonrpc';
import { StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
import { asyncFSProvider, initServer, registerCommandExecutor, startServer } from './integration-helpers';

export { getResult, makeProject, createProject } from './integration-helpers';

export interface ServerBucket {
  connection: MessageConnection;
  destroy(): Promise<void>;
}

export async function createServer({ asyncFsEnabled } = { asyncFsEnabled: false }): Promise<ServerBucket> {
  const serverProcess = startServer(asyncFsEnabled);
  let asyncFSProviderInstance!: any;
  const disposables: Disposable[] = [];
  const connection = createMessageConnection(
    new StreamMessageReader(serverProcess.stdout as Readable),
    new StreamMessageWriter(serverProcess.stdin as Writable),
    <Logger>{
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
    }
  );

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
