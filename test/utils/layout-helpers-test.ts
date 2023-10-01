import {
  getPodModulePrefix,
  safeWalkAsync,
  resolvePackageRoot,
  asyncGetPackageJSON,
  listPodsComponents,
  listComponents,
  listHelpers,
  listRoutes,
  getProjectInRepoAddonsRoots,
  getProjectAddonsRoots,
  isRootStartingWithFilePath,
} from '../../src/utils/layout-helpers';
import * as path from 'path';

import { initFileStructure } from './../test_helpers/integration-helpers';
import { getRegistryForRoot } from '../../src/utils/registry-api';
import { BaseProject } from '../../src/base-project';

describe('definition-helpers', function () {
  describe('getPodModulePrefix()', function () {
    it('return pod relative pod prefix for projects with podModulePrefix in environment.js', function () {
      expect(getPodModulePrefix(path.join(__dirname, './../fixtures/pod-project'))).toEqual('pods');
    });
    it('return null for projects without podModulePrefix in environment.js', function () {
      expect(getPodModulePrefix(path.join(__dirname, './../fixtures/full-project'))).toEqual(null);
    });
  });

  describe('safeWalkAsync()', function () {
    it('return empty array if entry path does not exists', async function () {
      expect(await safeWalkAsync(path.join(__dirname, './../fixtures/-non-existing-path'), {})).toEqual([]);
    });
  });

  describe('resolvePackageRoot()', function () {
    it('return package root folder', async function () {
      const resultOne = await resolvePackageRoot(__dirname, 'lodash');

      expect(resultOne).toContain(path.sep + 'lodash');

      const resultTwo = await resolvePackageRoot(__dirname, 'memoizee');

      expect(resultTwo).toContain(path.sep + 'memoizee');
    });
  });

  describe('asyncGetPackageJSON()', function () {
    it('return package json object', async function () {
      expect((await asyncGetPackageJSON(path.join(__dirname, './../fixtures/full-project'))).name).toEqual('full-project');
    });
  });

  describe('listPodsComponents()', function () {
    it('return expected list of components for pods project', async function () {
      const root = path.join(__dirname, './../fixtures/pod-project');

      const project = new BaseProject(root);

      await listPodsComponents(project);

      const keys = Object.keys(getRegistryForRoot(root).component);

      const hasAllComponentsInRegistry = ['foo-bar-js', 'foo-bar-ts'].every((el) => {
        return keys.includes(el);
      });

      expect(hasAllComponentsInRegistry).toEqual(true);
    });
  });

  describe('listComponents()', function () {
    it('return expected list of components for classic project', async function () {
      const root = path.join(__dirname, './../fixtures/full-project');

      await listComponents(new BaseProject(root));

      const keys = Object.keys(getRegistryForRoot(root).component);

      const hasAllComponentsInRegistry = ['another-awesome-component', 'my-awesome-component', 'another-awesome-component', 'nested/nested-component'].every(
        (el) => {
          return keys.includes(el);
        }
      );

      expect(hasAllComponentsInRegistry).toBe(true);
    });
  });

  describe('listHelpers()', function () {
    it('return expected list of helpers for classic project', async function () {
      const root = path.join(__dirname, './../fixtures/full-project');

      let keys = Object.keys(getRegistryForRoot(root).helper);

      expect(keys.includes('some-helper')).toBe(false);

      await listHelpers(new BaseProject(root));

      keys = Object.keys(getRegistryForRoot(root).helper);

      expect(keys.includes('some-helper')).toBe(true);
    });
  });

  describe('listRoutes()', function () {
    it('return expected list of routes for classic project', async function () {
      const root = path.join(__dirname, './../fixtures/full-project');

      await listRoutes(new BaseProject(root));

      const keys = Object.keys(getRegistryForRoot(root).routePath);

      const hasAllRoutesInRegistry = [
        'angle-completion',
        'application',
        'definition',
        'inrepo-addon-completion',
        'test-route',
        'nested.nested-route',
        'test-route',
      ].every((el) => {
        return keys.includes(el);
      });

      expect(hasAllRoutesInRegistry).toBe(true);
    });
  });

  describe('getProjectInRepoAddonsRoots()', function () {
    it('must discover in-repo addons for classic structure', async function () {
      const root = path.join(__dirname, './../fixtures/project-with-in-repo-addons');
      const items = await getProjectInRepoAddonsRoots(root);

      expect(items.length).toEqual(2);
    });
  });

  describe('getProjectAddonsRoots()', function () {
    it('must resolve all related to project addons', async function () {
      const root = path.join(__dirname, './../fixtures/full-project');
      const items = await getProjectAddonsRoots(root, [], 'hope_modules');

      expect(items.length).toEqual(2);
    });
  });

  describe('yarn workspaces support', function () {
    it('should work for simple case', async function () {
      const info = await initFileStructure({
        node_modules: {
          '@skylight': {
            anvil: {
              'package.json': JSON.stringify({
                name: '@skylight/anvil',
                keywords: ['ember-addon'],
                'ember-addon': {
                  configPath: 'tests/dummy/config',
                },
              }),
              'index.js': '',
            },
          },
        },
        packages: {
          touchstone: {
            'package.json': JSON.stringify({
              name: 'touchstone',
              devDependencies: {
                '@skylight/anvil': '*',
              },
            }),
          },
        },
      });

      const items = await getProjectAddonsRoots(path.join(info.path, 'packages', 'touchstone'));

      expect(items.length).toEqual(1);
      expect(items[0].split(path.sep).join('/').split('node_modules/')[1]).toEqual('@skylight/anvil');

      await info.destroy();
    });
  });

  describe('isRootStartingWithFilePath', function () {
    it('should return true if the root path exactly matches the file path', function () {
      const rootPath = 'foo/bar/biz';
      const filePath = 'foo/bar/biz/lib/boo.js';
      const doesStartWithRootPath = isRootStartingWithFilePath(rootPath, filePath);

      expect(doesStartWithRootPath).toBe(true);
    });

    it('should return false if the root path partially matches the file path', function () {
      const rootPath = 'foo/bar/biz';
      const filePath = 'foo/bar/biz-blah/lib/boo.js';
      const doesStartWithRootPath = isRootStartingWithFilePath(rootPath, filePath);

      expect(doesStartWithRootPath).toBe(false);
    });

    it('should return false if the root path partially matches the file path', function () {
      const rootPath = 'foo/bar/biz';
      const filePath = 'random-path/foo/bar/biz-blah/lib/boo.js';
      const doesStartWithRootPath = isRootStartingWithFilePath(rootPath, filePath);

      expect(doesStartWithRootPath).toBe(false);
    });

    it('[Windows] should return false if the root path partially matches the file path', function () {
      const rootPath = 'c:\\my-folder\\my';
      const filePath = `c:\\my-folder\\my-path\\my-file.ts`;
      const doesStartWithRootPath = isRootStartingWithFilePath(rootPath, filePath);

      expect(doesStartWithRootPath).toBe(false);
    });
  });
});
