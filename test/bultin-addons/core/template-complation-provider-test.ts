import { filter } from 'fuzzaldrin';
import { generateNamespacedComponentsHashMap } from '../../../src/builtin-addons/core/template-completion-provider';

describe('filter util', function () {
  it('able to return some results if search term is empty', function () {
    expect(
      filter([{ label: '1' }, { label: '2' }], '', {
        key: 'label',
        maxResults: 1,
      })
    ).toEqual([{ label: '1' }]);
  });
  it('able to return some results if search term is space', function () {
    expect(
      filter([{ label: '1' }, { label: '2' }], ' ', {
        key: 'label',
        maxResults: 1,
      })
    ).toEqual([{ label: '1' }]);
  });
});

describe('generateNamespacedComponentsHashMap', function () {
  it('[Angle brackets] returns the expected namespaced map', function () {
    const mockAddonMetaArr = [
      { name: '@company/foo', version: 1, root: 'blah/bar/dummy/@company/foo' },
      { name: 'biz', version: 1, root: 'blah/baz/diz/biz' },
    ];

    const server: any = {
      getRegistry(root) {
        return { component: { foo: ['blah/baz/diz/biz/components/foo.js'] } };
      },
    };

    expect(generateNamespacedComponentsHashMap(mockAddonMetaArr, server, true)).toEqual({ Foo: ['Biz$Foo'] });
  });

  it('[Mustache] returns the expected namespaced map', function () {
    const mockAddonMetaArr = [
      { name: '@company/test', version: 1, root: 'blah/bar/dummy/@company/test' },
      { name: 'biz', version: 1, root: 'blah/baz/diz/biz' },
    ];

    const server: any = {
      getRegistry(root) {
        return { component: { foo: ['blah/bar/dummy/@company/test/components/foo.js'] } };
      },
    };

    expect(generateNamespacedComponentsHashMap(mockAddonMetaArr, server, false)).toEqual({ foo: ['test$foo'] });
  });
});
