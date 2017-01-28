import { findProjectRoots } from '../src/project-roots';

import { expect } from 'chai';

describe('findProjectRoots()', function() {
  it('finds nested projects', async function() {
    let workspaceRoot = `${__dirname}/fixtures/nested-projects`;
    let projectRoots = await findProjectRoots(workspaceRoot);

    expect(projectRoots).to.deep.equal([
      `${workspaceRoot}/b`,
      `${workspaceRoot}/a/b/c`,
    ]);
  });
});
