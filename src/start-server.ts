import { Server } from '.';
import { IPCMessageReader, IPCMessageWriter, StreamMessageWriter, StreamMessageReader, createConnection, Connection } from 'vscode-languageserver/node';

// Create a connection for the server. The connection defaults to Node's IPC as a transport, but
// also supports stdio via command line flag
const connection: Connection = process.argv.includes('--stdio')
  ? createConnection(new StreamMessageReader(process.stdin), new StreamMessageWriter(process.stdout))
  : createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

const server = new Server(connection);

server.listen();
