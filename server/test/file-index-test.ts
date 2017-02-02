import * as path from 'path';
import FileIndex from '../src/file-index';
import { expect } from 'chai';
import {TemplateFileInfo} from '../src/file-info';

describe('FileIndex', function() {
  it('indexes all module types', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/all-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).to.have.lengthOf(14);
  });

  it('indexes nothing in empty project', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/no-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).to.have.length(0);
  });

  it('returns the correct modules for each type', async function() {
    let workspaceRoot = path.join(__dirname, 'fixtures/modules/all-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.byModuleType('adapter'), 'Adapter').to.have.lengthOf(1);
    expect(index.byModuleType('component'), 'Component').to.have.lengthOf(1);
    expect(index.byModuleType('controller'), 'Controller').to.have.lengthOf(1);
    expect(index.byModuleType('helper'), 'Helper').to.have.lengthOf(1);
    expect(index.byModuleType('initializer'), 'Initializer').to.have.lengthOf(1);
    expect(index.byModuleType('instance-initializer'), 'InstanceInitializer').to.have.lengthOf(1);
    expect(index.byModuleType('mixin'), 'Mixin').to.have.lengthOf(1);
    expect(index.byModuleType('model'), 'Model').to.have.lengthOf(1);
    expect(index.byModuleType('route'), 'Route').to.have.lengthOf(1);
    expect(index.byModuleType('serializer'), 'Serializer').to.have.lengthOf(1);
    expect(index.byModuleType('service'), 'Service').to.have.lengthOf(1);
    expect(index.byModuleType('transform'), 'Transform').to.have.lengthOf(1);

    expect(index.files.filter(it => it instanceof TemplateFileInfo)).to.have.lengthOf(2);
  });

  it('indexes modules in subdirectories', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/nested-modules');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).to.have.lengthOf(2);
  });

  it('indexes component templates separated from other templates', async function() {
    let workspaceRoot = path.join(__dirname, '/fixtures/modules/templates');

    const index = new FileIndex(workspaceRoot);
    await index.invalidate();

    expect(index.files).to.have.lengthOf(2);
    expect(index.files.filter(it => it instanceof TemplateFileInfo && it.forComponent)).to.have.lengthOf(1);
    expect(index.files.filter(it => it instanceof TemplateFileInfo && !it.forComponent)).to.have.lengthOf(1);
  });
});
