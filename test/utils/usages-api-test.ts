import { updateTemplateTokens, findRelatedFiles } from '../../src/utils/usages-api';
import { createTempDir } from 'broccoli-test-helper';
import * as path from 'path';
let dir = null;
beforeAll(async () => {
  dir = await createTempDir();
});
afterAll(async () => {
  await dir.dispose();
});
function createFile(name: string, content: string): string {
  dir.write({
    [name]: content,
  });

  return path.join(dir.path(), name);
}

describe('Usages API', () => {
  it('should extract component template tokens by giving path', () => {
    expect(findRelatedFiles('foo-bar').length).toBe(0);

    updateTemplateTokens('component', 'foo', createFile('foo.hbs', '<FooBar />'));

    expect(findRelatedFiles('foo-bar').length).toBe(1);

    updateTemplateTokens('component', 'foo', null);

    expect(findRelatedFiles('foo-bar').length).toBe(0);
  });
  it('should extract component template tokens by giving path for different kinds', () => {
    expect(findRelatedFiles('foo-bar').length).toBe(0);

    updateTemplateTokens('component', 'foo', createFile('foo.hbs', '<FooBar />'));
    updateTemplateTokens('routePath', 'boo', createFile('boo.hbs', '{{foo-bar}}'));

    expect(findRelatedFiles('foo-bar').length).toBe(2);

    updateTemplateTokens('component', 'foo', null);
    updateTemplateTokens('routePath', 'boo', null);

    expect(findRelatedFiles('foo-bar').length).toBe(0);
  });
});
