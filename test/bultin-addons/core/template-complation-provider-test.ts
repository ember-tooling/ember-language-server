import { filter } from 'fuzzaldrin';
import Server from '../../../src/server';
import { generateNamespacedComponentsHashMap } from '../../../src/builtin-addons/core/template-completion-provider';
import { AddonMeta } from '../../../src/utils/addon-api';

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
    const mockAddonMetaArr: AddonMeta[] = [
      { name: '@company/foo', version: 1, root: 'blah/bar/dummy/@company/foo' },
      { name: 'biz', version: 1, root: 'blah/baz/diz/biz' },
    ];

    const server = {
      getRegistry() {
        return { component: { foo: ['blah/baz/diz/biz/components/foo.js'] } };
      },
    };

    expect(generateNamespacedComponentsHashMap(mockAddonMetaArr, (server as unknown) as Server, true)).toEqual({ Foo: ['Biz$Foo'] });
  });

  it('[Mustache] returns the expected namespaced map', function () {
    const mockAddonMetaArr: AddonMeta[] = [
      { name: '@company/test', version: 1, root: 'blah/bar/dummy/@company/test' },
      { name: 'biz', version: 1, root: 'blah/baz/diz/biz' },
    ];

    const server = {
      getRegistry() {
        return { component: { foo: ['blah/bar/dummy/@company/test/components/foo.js'] } };
      },
    };

    expect(generateNamespacedComponentsHashMap(mockAddonMetaArr, (server as unknown) as Server, false)).toEqual({ foo: ['test$foo'] });
  });
});
