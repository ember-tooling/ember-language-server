import { addToRegistry, getRegistryForRoot, normalizeMatchNaming, removeFromRegistry } from '../../src/utils/registry-api';
import { findRelatedFiles, waitForTokensToBeCollected } from '../../src/utils/usages-api';
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

const knownRegistryKeys = ['transform', 'helper', 'component', 'routePath', 'model', 'service', 'modifier'];

describe('addToRegistry - it able to add different kinds to registry', () => {
  const files = [];

  it('able to add different file types to same kind', async () => {
    const file1 = createFile('foo-bar.hbs', '<div><Boo /></div>');
    const file2 = createFile('foo-bar.js', '');
    const file3 = createFile('foo-bar.css', '');

    files.push(file1, file2, file3);
    addToRegistry('foo-bar', 'component', files);
    expect(getRegistryForRoot(path.resolve(dir.path()))['component']['foo-bar'].length).toBe(3);
    await waitForTokensToBeCollected();
    expect(findRelatedFiles('boo').length).toBe(1);
  });
  it('able to remove items from registry', () => {
    expect(getRegistryForRoot(path.resolve(dir.path()))['component']['foo-bar'].length).toBe(3);
    expect(findRelatedFiles('boo').length).toBe(1);
    removeFromRegistry('foo-bar', 'component', [files[0]]);
    expect(getRegistryForRoot(path.resolve(dir.path()))['component']['foo-bar'].length).toBe(2);
    expect(findRelatedFiles('boo').length).toBe(0);
    removeFromRegistry('foo-bar', 'component', [files[1]]);
    expect(getRegistryForRoot(path.resolve(dir.path()))['component']['foo-bar'].length).toBe(1);
    removeFromRegistry('foo-bar', 'component', [files[2]]);
    expect(getRegistryForRoot(path.resolve(dir.path()))['component']['foo-bar']).toBe(undefined);
  });
  it('skip addition for unknown keys', () => {
    knownRegistryKeys.forEach((key) => {
      const fakeKey = `${key}-fake`;
      const file = createFile(`${fakeKey}.js`, '');

      addToRegistry('foo-bar', fakeKey as any, [file]);
      expect(getRegistryForRoot(path.resolve(dir.path()))[fakeKey]).toBe(undefined);
    });
  });
});

describe('normalizeMatchNaming - must normalize naming from mater to registry format', () => {
  it('normalize special keys', () => {
    expect(normalizeMatchNaming({ type: 'route', name: 'foo/bar' })).toEqual({
      type: 'routePath',
      name: 'foo.bar',
    });
    expect(normalizeMatchNaming({ type: 'controller', name: 'foo/bar' })).toEqual({
      type: 'routePath',
      name: 'foo.bar',
    });
    expect(normalizeMatchNaming({ type: 'template', name: 'foo/bar' })).toEqual({
      type: 'routePath',
      name: 'foo.bar',
    });
  });
  it('skip normalization for other keys', () => {
    const name = 'foo-bar';

    knownRegistryKeys.forEach((keyName) => {
      expect(normalizeMatchNaming({ name, type: keyName as any })).toEqual({
        name,
        type: keyName,
      });
    });
  });
});
