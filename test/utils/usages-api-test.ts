import { updateTemplateTokens, closestParentRoutePath, findRelatedFiles, waitForTokensToBeCollected } from '../../src/utils/usages-api';
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
  it('should return closest upper path', () => {
    expect(closestParentRoutePath('foo/bar')).toBe('foo');
    expect(closestParentRoutePath('foo-loading')).toBe('foo');
    expect(closestParentRoutePath('foo-error')).toBe('foo');
    expect(closestParentRoutePath('foo/bar/baz')).toBe('foo/bar');
  });
  it('should extract component template tokens by giving path', async () => {
    expect(findRelatedFiles('foo-bar').length).toBe(0);

    updateTemplateTokens('component', 'foo', createFile('foo.hbs', '<FooBar />'));

    await waitForTokensToBeCollected();

    expect(findRelatedFiles('foo-bar').length).toBe(1);

    updateTemplateTokens('component', 'foo', null);

    expect(findRelatedFiles('foo-bar').length).toBe(0);
  });
  it('should extract component template tokens by giving path for different kinds', async () => {
    expect(findRelatedFiles('foo-bar').length).toBe(0);

    updateTemplateTokens('component', 'foo', createFile('foo.hbs', '<FooBar />'));
    updateTemplateTokens('routePath', 'boo', createFile('boo.hbs', '{{foo-bar}}'));

    await waitForTokensToBeCollected();

    expect(findRelatedFiles('foo-bar').length).toBe(2);

    updateTemplateTokens('component', 'foo', null);
    updateTemplateTokens('routePath', 'boo', null);

    expect(findRelatedFiles('foo-bar').length).toBe(0);
  });
  it('should return usages for closest routes (upper)', async () => {
    expect(findRelatedFiles('foo/bar/baz', 'template').length).toBe(0);
    updateTemplateTokens('routePath', 'foo.bar', createFile('bar.hbs', ''));
    await waitForTokensToBeCollected();
    expect(findRelatedFiles('foo/bar/baz', 'template').length).toBe(1);
    updateTemplateTokens('routePath', 'foo.bar', null);
  });
  it('should return usages for closest available routes (upper)', async () => {
    expect(findRelatedFiles('foo/bar/baz', 'template').length).toBe(0);
    updateTemplateTokens('routePath', 'foo', createFile('bar.hbs', ''));
    await waitForTokensToBeCollected();
    expect(findRelatedFiles('foo/bar/baz', 'template').length).toBe(1);
    updateTemplateTokens('routePath', 'foo', null);
  });
  it('should return usages for closest available routes, in index case', async () => {
    expect(findRelatedFiles('index', 'template').length).toBe(0);
    updateTemplateTokens('routePath', 'application', createFile('bar.hbs', ''));
    await waitForTokensToBeCollected();
    expect(findRelatedFiles('index', 'template').length).toBe(1);
    updateTemplateTokens('routePath', 'application', null);
  });
  it('should return usages for closest available routes, in loading case', async () => {
    expect(findRelatedFiles('index-loading', 'template').length).toBe(0);
    updateTemplateTokens('routePath', 'index', createFile('bar.hbs', ''));
    await waitForTokensToBeCollected();
    expect(findRelatedFiles('index-loading', 'template').length).toBe(1);
    updateTemplateTokens('routePath', 'index', null);
  });
  it('should return usages for closest available routes, in error case', async () => {
    expect(findRelatedFiles('index-error', 'template').length).toBe(0);
    updateTemplateTokens('routePath', 'index', createFile('bar.hbs', ''));
    await waitForTokensToBeCollected();
    expect(findRelatedFiles('index-error', 'template').length).toBe(1);
    updateTemplateTokens('routePath', 'index', null);
  });
  it('should return root template for case if no parents by path', async () => {
    expect(findRelatedFiles('groups-loading', 'template').length).toBe(0);
    updateTemplateTokens('routePath', 'application', createFile('bar.hbs', ''));
    await waitForTokensToBeCollected();
    expect(findRelatedFiles('groups-loading', 'template').length).toBe(1);
    updateTemplateTokens('routePath', 'application', null);
  });
});
