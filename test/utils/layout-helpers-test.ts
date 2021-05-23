import {
  isMuApp,
  getPodModulePrefix,
  safeWalkSync,
  resolvePackageRoot,
  getPackageJSON,
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
  describe('isMuApp()', function () {
    it('return true for paths, containing "src/ui"', function () {
      expect(isMuApp(path.join(__dirname, './../fixtures/mu-project'))).toEqual(true);
    });
    it('return false for paths, without "src/ui"', function () {
      expect(isMuApp(path.join(__dirname, './../fixtures/full-project'))).toEqual(false);
    });
  });

  describe('getPodModulePrefix()', function () {
    it('return pod relative pod prefix for projects with podModulePrefix in evironment.js', function () {
      expect(getPodModulePrefix(path.join(__dirname, './../fixtures/pod-project'))).toEqual('pods');
    });
    it('return null for projects without podModulePrefix in evironment.js', function () {
      expect(getPodModulePrefix(path.join(__dirname, './../fixtures/full-project'))).toEqual(null);
    });
  });

  describe('safeWalkSync()', function () {
    it('return empty array if entry path does not exists', function () {
      expect(safeWalkSync(path.join(__dirname, './../fixtures/-non-existing-path'), {})).toEqual([]);
    });
  });

  describe('resolvePackageRoot()', function () {
    it('return package root folder', function () {
      expect(resolvePackageRoot(__dirname, 'lodash')).toContain(path.sep + 'lodash');
      expect(resolvePackageRoot(__dirname, 'memoizee')).toContain(path.sep + 'memoizee');
    });
  });

  describe('getPackageJSON()', function () {
    it('return package json object', function () {
      expect(getPackageJSON(path.join(__dirname, './../fixtures/full-project')).name).toEqual('full-project');
    });
  });

  describe('listPodsComponents()', function () {
    it('return expected list of components for pods project', function () {
      const root = path.join(__dirname, './../fixtures/pod-project');

      const project = new BaseProject(root);

      listPodsComponents(project);

      const keys = Object.keys(getRegistryForRoot(root).component);

      const hasAllComponentsInRegistry = ['foo-bar-js', 'foo-bar-ts'].every((el) => {
        return keys.includes(el);
      });

      expect(hasAllComponentsInRegistry).toEqual(true);
    });
  });

  describe('listComponents()', function () {
    it('return expected list of components for classic project', function () {
      const root = path.join(__dirname, './../fixtures/full-project');

      listComponents(new BaseProject(root));

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
    it('return expected list of helpers for classic project', function () {
      const root = path.join(__dirname, './../fixtures/full-project');

      let keys = Object.keys(getRegistryForRoot(root).helper);

      expect(keys.includes('some-helper')).toBe(false);

      listHelpers(new BaseProject(root));

      keys = Object.keys(getRegistryForRoot(root).helper);

      expect(keys.includes('some-helper')).toBe(true);
    });
  });

  describe('listRoutes()', function () {
    it('return expected list of routes for classic project', function () {
      const root = path.join(__dirname, './../fixtures/full-project');

      listRoutes(new BaseProject(root));

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
    it('must discover in-repo addons for classic structure', function () {
      const root = path.join(__dirname, './../fixtures/project-with-in-repo-addons');
      const items = getProjectInRepoAddonsRoots(root);

      expect(items.length).toEqual(2);
    });
    it('must discover in-repo addons for MU structure', function () {
      const root = path.join(__dirname, './../fixtures/mu-project-with-in-repo-addons');
      const items = getProjectInRepoAddonsRoots(root);

      expect(items.length).toEqual(1);
    });
  });

  describe('getProjectAddonsRoots()', function () {
    it('must resolve all related to project addons', function () {
      const root = path.join(__dirname, './../fixtures/full-project');
      const items = getProjectAddonsRoots(root, [], 'hope_modules');

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

      const items = getProjectAddonsRoots(path.join(info.path, 'packages', 'touchstone'));

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
