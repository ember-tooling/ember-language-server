import { Server } from '.';
import { Connection, createConnection, BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageserver/browser';

// require.include('.foo.js');
// require.include("@babel/core");
// require.include("@babel/plugin-proposal-decorators");
// require.include("@babel/plugin-proposal-class-properties");
// require.include("@babel/plugin-proposal-object-rest-spread");
// require.include("@babel/plugin-proposal-optional-chaining");
// require.include("@babel/plugin-proposal-nullish-coalescing-operator");
// require.include("@babel/plugin-proposal-numeric-separator");
// require.include("@babel/plugin-proposal-logical-assignment-operators");
// require.include("@babel/plugin-proposal-private-methods");
// require.include("@babel/plugin-proposal-async-generator-functions");
// require.include("@babel/plugin-proposal-function-sent");
// require.include("@babel/plugin-proposal-do-expressions");
// Create a connection for the server. The connection defaults to Node's IPC as a transport, but
// also supports stdio via command line flag
const connection: Connection = createConnection(new BrowserMessageReader(self), new BrowserMessageWriter(self));

const server = new Server(connection, {
  type: 'worker',
  fs: 'async',
});

server.listen();
