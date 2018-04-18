import * as path from 'path';
import FileIndex from '../src/file-index';
import {TemplateFileInfo} from '../src/file-info';

describe('FileIndex', function() {
  it('indexes all module types', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/all-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).toHaveLength(14);
  });

  it('indexes nothing in empty project', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/no-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).toHaveLength(0);
  });

  it('returns the correct modules for each type', async function() {
    let workspaceRoot = path.join(__dirname, 'fixtures/modules/all-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.byModuleType('adapter')).toHaveLength(1);
    expect(index.byModuleType('component')).toHaveLength(1);
    expect(index.byModuleType('controller')).toHaveLength(1);
    expect(index.byModuleType('helper')).toHaveLength(1);
    expect(index.byModuleType('initializer')).toHaveLength(1);
    expect(index.byModuleType('instance-initializer')).toHaveLength(1);
    expect(index.byModuleType('mixin')).toHaveLength(1);
    expect(index.byModuleType('model')).toHaveLength(1);
    expect(index.byModuleType('route')).toHaveLength(1);
    expect(index.byModuleType('serializer')).toHaveLength(1);
    expect(index.byModuleType('service')).toHaveLength(1);
    expect(index.byModuleType('transform')).toHaveLength(1);

    expect(index.files.filter(it => it instanceof TemplateFileInfo)).toHaveLength(2);
  });

  it('indexes modules in subdirectories', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/nested-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).toHaveLength(2);
  });

  it('indexes component templates separated from other templates', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/templates');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).toHaveLength(2);
    expect(index.files.filter(it => it instanceof TemplateFileInfo && it.forComponent)).toHaveLength(1);
    expect(index.files.filter(it => it instanceof TemplateFileInfo && !it.forComponent)).toHaveLength(1);
  });
});
