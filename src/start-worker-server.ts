import { Server } from '.';
import { Connection, createConnection, BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageserver/browser';

// Create a connection for the server. The connection defaults to Node's IPC as a transport, but
// also supports stdio via command line flag
const connection: Connection = createConnection(new BrowserMessageReader(self), new BrowserMessageWriter(self));

const server = new Server(connection, {
  type: 'worker',
  fs: 'async',
});

server.listen();
