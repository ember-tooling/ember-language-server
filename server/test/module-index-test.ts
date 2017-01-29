import ModuleIndex, { ModuleType } from '../src/module-index';

import { expect } from 'chai';

describe('module-index', function() {
  it('indexes all module types', async function() {
    let workspaceRoot = `${__dirname}/fixtures/modules/all-modules`;

    const index = new ModuleIndex(workspaceRoot);
    await index.indexModules();

    expect(index.getModules()).to.have.lengthOf(14);
  });

  it('indexes nothing in empty project', async function() {
    let workspaceRoot = `${__dirname}/fixtures/modules/no-modules`;

    const index = new ModuleIndex(workspaceRoot);
    await index.indexModules();

    expect(index.getModules()).to.have.length(0);
  });

  it('returns the correct modules for each type', async function() {
    let workspaceRoot = `${__dirname}/fixtures/modules/all-modules`;

    const index = new ModuleIndex(workspaceRoot);
    await index.indexModules();

    expect(index.getModules(ModuleType.Adapter), 'Adapter').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Component), 'Component').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.ComponentTemplate), 'ComponentTemplate').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Controller), 'Controller').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Helper), 'Helper').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Initializer), 'Initializer').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.InstanceInitializer), 'InstanceInitializer').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Mixin), 'Mixin').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Model), 'Model').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Route), 'Route').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Serializer), 'Serializer').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Service), 'Service').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Template), 'Template').to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Transform), 'Transform').to.have.lengthOf(1);

  });

  it('indexes modules in subdirectories', async function() {
    let workspaceRoot = `${__dirname}/fixtures/modules/nested-modules`;

    const index = new ModuleIndex(workspaceRoot);
    await index.indexModules();

    expect(index.getModules()).to.have.lengthOf(2);
  });

  it('indexes component templates separated from other templates', async function() {
    let workspaceRoot = `${__dirname}/fixtures/modules/templates`;

    const index = new ModuleIndex(workspaceRoot);
    let modules = await index.indexModules();

    expect(modules).to.have.lengthOf(2);
    expect(index.getModules(ModuleType.ComponentTemplate)).to.have.lengthOf(1);
    expect(index.getModules(ModuleType.Template)).to.have.lengthOf(1);
  });
});
