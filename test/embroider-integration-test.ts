import { createServer, ServerBucket, makeProject, createProject } from './test_helpers/public-integration-helpers';

describe('it has minimal embroider v2 packages support', function () {
  let instance!: ServerBucket;

  describe('package.json [ember-addon][app-js]: object', () => {
    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: false });
    });

    afterAll(async () => {
      await instance.destroy();
    });

    it('able to resolve components with classic structure', async () => {
      const projectStructure = makeProject(
        {
          app: {
            components: {
              'my-component.hbs': '',
            },
          },
        },
        {
          'basic-v2-addon': {
            'bundle/app/components': {
              'foo.hbs': '',
              'bar.hbs': '',
            },
            'package.json': JSON.stringify({
              name: 'basic-v2-addon',
              keywords: ['ember-addon'],
              'ember-addon': {
                version: 2,
                type: 'addon',
                main: 'addon-main.js',
                'app-js': {
                  './components/foo.hbs': './bundle/app/components/foo.hbs',
                  './components/bar.hbs': './bundle/app/components/bar.hbs',
                },
              },
            }),
          },
        }
      );

      const project = await createProject(projectStructure, instance.connection);

      expect(project.result.addonsMeta.length).toBe(1);
      expect(Object.keys(project.result.registry.component).length).toBe(3);
      await project.destroy();
    });

    it('able to resolve components inside node_modules addon dist folder', async () => {
      const projectStructure = makeProject(
        {
          app: {
            components: {
              'my-component.hbs': '',
            },
          },
        },
        {
          'basic-v2-addon': {
            'dist/app/components': {
              'foo.hbs': '',
              'bar.hbs': '',
            },
            'package.json': JSON.stringify({
              name: 'basic-v2-addon',
              keywords: ['ember-addon'],
              'ember-addon': {
                version: 2,
                type: 'addon',
                main: 'addon-main.js',
                'app-js': {
                  './components/foo.hbs': './dist/app/components/foo.hbs',
                  './components/bar.hbs': './dist/app/components/bar.hbs',
                },
              },
            }),
          },
        }
      );

      const project = await createProject(projectStructure, instance.connection);

      expect(project.result.addonsMeta.length).toBe(1);
      expect(Object.keys(project.result.registry.component).length).toBe(3);
      await project.destroy();
    });
  });

  describe('package.json [ember-addon][app-js]: string', () => {
    beforeAll(async () => {
      instance = await createServer({ asyncFsEnabled: false });
    });

    afterAll(async () => {
      await instance.destroy();
    });

    it('able to resolve components with classic structure', async () => {
      const projectStructure = makeProject(
        {
          app: {
            components: {
              'my-component.hbs': '',
            },
          },
        },
        {
          'basic-v2-addon': {
            'bundle/app/components': {
              'foo.hbs': '',
              'bar.hbs': '',
            },
            'package.json': JSON.stringify({
              name: 'basic-v2-addon',
              keywords: ['ember-addon'],
              'ember-addon': {
                version: 2,
                type: 'addon',
                main: 'addon-main.js',
                'app-js': './bundle/app',
              },
            }),
          },
        }
      );

      const project = await createProject(projectStructure, instance.connection);

      expect(project.result.addonsMeta.length).toBe(1);
      expect(Object.keys(project.result.registry.component).length).toBe(3);

      await project.destroy();
    });

    it('able to resolve components inside node_modules addon dist folder', async () => {
      const projectStructure = makeProject(
        {
          app: {
            components: {
              'my-component.hbs': '',
            },
          },
        },
        {
          'basic-v2-addon': {
            'dist/app/components': {
              'foo.hbs': '',
              'bar.hbs': '',
            },
            'package.json': JSON.stringify({
              name: 'basic-v2-addon',
              keywords: ['ember-addon'],
              'ember-addon': {
                version: 2,
                type: 'addon',
                main: 'addon-main.js',
                'app-js': './dist/app',
              },
            }),
          },
        }
      );

      const project = await createProject(projectStructure, instance.connection);

      expect(project.result.addonsMeta.length).toBe(1);
      expect(Object.keys(project.result.registry.component).length).toBe(3);

      await project.destroy();
    });
  });
});
