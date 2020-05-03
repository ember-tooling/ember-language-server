import { addToRegistry, getRegistryForRoot, removeFromRegistry } from '../../src/utils/registry-api';
import { findRelatedFiles } from '../../src/utils/usages-api';
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
    [name]: content
  });
  return path.join(dir.path(), name);
}

describe('addToRegistry - it able to add different kinds to registry', () => {
  let files = [];
  it('able to add different file types to same kind', () => {
    const file1 = createFile('foo-bar.hbs', '<div><Boo /></div>');
    const file2 = createFile('foo-bar.js', '');
    const file3 = createFile('foo-bar.css', '');
    files.push(file1, file2, file3);
    addToRegistry('foo-bar', 'component', files);
    expect(getRegistryForRoot(path.resolve(dir.path()))['component']['foo-bar'].length).toBe(3);
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
});
