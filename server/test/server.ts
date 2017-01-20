import { findProjectRoots } from "../src/server";

const expect = require('chai').expect;

describe('findProjectRoots()', function () {
  it('finds nested projects', function () {
    let workspaceRoot = `${__dirname}/fixtures/nested-projects`;
    return findProjectRoots(workspaceRoot).then(projectRoots => {
      expect(projectRoots).to.deep.equal([
        `${workspaceRoot}/b`,
        `${workspaceRoot}/a/b/c`,
      ]);
    });
  });
});
