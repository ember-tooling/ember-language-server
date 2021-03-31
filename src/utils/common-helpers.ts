import { Server } from '..';

export async function getAppRootFromConfig(server: Server) {
  try {
    return (await server.connection.workspace.getConfiguration('els.appRoot')) || Promise.resolve('');
  } catch (e) {
    return Promise.resolve('');
  }
}
