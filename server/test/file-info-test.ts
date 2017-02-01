import * as path from 'path';

import {
  AcceptanceTestFileInfo, FileInfo, MainFileInfo, ModuleFileInfo, ModuleTestFileInfo,
  TemplateFileInfo
} from '../src/file-info';

const { expect } = require('chai');

const moduleTypes = [
  'adapter',
  'component',
  'controller',
  'helper',
  'initializer',
  'instance-initializer',
  'mixin',
  'model',
  'route',
  'serializer',
  'service',
  'transform'
];

describe('FileInfo', function() {
  describe('from()', function() {
    it('returns undefined for unknown files', function() {
      expect(FileInfo.from('foo/bar.txt')).to.be.undefined;
    });

    test('app/app.js', MainFileInfo, { name: 'app' });
    test('app/resolver.js', MainFileInfo, { name: 'resolver' });
    test('app/router.js', MainFileInfo, { name: 'router' });

    moduleTypes.forEach(type => {
      test(`app/${type}s/foo.js`, ModuleFileInfo, {
        type,
        name: 'foo',
        slashName: 'foo',
      });
    });

    moduleTypes.forEach(type => {
      test(`tests/integration/${type}s/foo.js`, ModuleTestFileInfo, {
        type: 'integration',
        subjectType: type,
        name: 'foo',
        slashName: 'foo',
      });
    });

    moduleTypes.forEach(type => {
      test(`tests/unit/${type}s/foo.js`, ModuleTestFileInfo, {
        type: 'unit',
        subjectType: type,
        name: 'foo',
        slashName: 'foo',
      });
    });

    test('app/components/foo/x-bar.js', ModuleFileInfo, {
      type: 'component',
      name: 'foo.x-bar',
      slashName: 'foo/x-bar',
    });

    test('tests/integration/components/foo/x-bar.js', ModuleTestFileInfo, {
      type: 'integration',
      subjectType: 'component',
      name: 'foo.x-bar',
      slashName: 'foo/x-bar',
    });

    test('app/templates/foo.hbs', TemplateFileInfo, {
      forComponent: false,
      name: 'foo',
      slashName: 'foo',
    });

    test('app/templates/components/foo/x-bar.hbs', TemplateFileInfo, {
      forComponent: true,
      name: 'foo.x-bar',
      slashName: 'foo/x-bar',
    });

    test('tests/acceptance/foo/bar.js', AcceptanceTestFileInfo, {
      name: 'foo.bar',
      slashName: 'foo/bar',
    });

    function test(relativePath: string, type: any, expected: any) {
      let description: string;
      relativePath = path.normalize(relativePath);
      if (!expected.name) {
        description = `${relativePath} -> ${type.name}`;
      } else if (!expected.type) {
        description = `${relativePath} -> ${expected.name}`;
      } else if (type === ModuleTestFileInfo) {
        description = `${relativePath} -> ${expected.type} test for ${expected.subjectType}:${expected.name}`;
      } else {
        description = `${relativePath} -> ${expected.type}:${expected.name}`;
      }

      it(description, function() {
        expected.relativePath = relativePath;

        let result = FileInfo.from(relativePath);
        expect(result).to.be.an.instanceof(type);
        expect(result).to.deep.equal(expected);
      });
    }
  });
});
