import { Server } from '..';
import * as memoize from 'memoizee';
import * as path from 'path';
import ProjectRoots from '../project-roots';

export async function getAppRootFromConfig(server: Server) {
  try {
    return (await server.connection.workspace.getConfiguration('els.appRoot')) || Promise.resolve('');
  } catch (e) {
    return Promise.resolve('');
  }
}

export const mProjectRoot = memoize(getProjectParentRoot);

/**
 * Find the top level root of the project.
 */
export function getProjectParentRoot(projectRoots: ProjectRoots, root: string, appRoot: string) {
  if (appRoot) {
    const parts = root.split(path.sep);

    parts.pop();

    while (parts.length) {
      const parent: string = getProjectParentRoot(projectRoots, parts.join(path.sep), appRoot);
      const potentialParentPath = projectRoots.projectForPath(path.join('/', parent));

      if (potentialParentPath) {
        return potentialParentPath.root;
      } else {
        parts.pop();
      }
    }
  }

  return root;
}
