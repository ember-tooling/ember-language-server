import { filter } from 'fuzzaldrin';
import { toAngleBrackedName } from '../../../src/builtin-addons/core/template-completion-provider';

describe('toAngleBrackedName', function() {
  it('able to convert components path to angle-bracket notation', function() {
    expect(toAngleBrackedName('foo')).toEqual('Foo');
    expect(toAngleBrackedName('foo/bar')).toEqual('Foo::Bar');
    expect(toAngleBrackedName('foo/bar-baz')).toEqual('Foo::BarBaz');
  });
});

describe('filter util', function() {
  it('able to return some results if search term is empty', function() {
    expect(
      filter([{ label: '1' }, { label: '2' }], '', {
        key: 'label',
        maxResults: 1
      })
    ).toEqual([{ label: '1' }]);
  });
  it('able to return some results if search term is space', function() {
    expect(
      filter([{ label: '1' }, { label: '2' }], ' ', {
        key: 'label',
        maxResults: 1
      })
    ).toEqual([{ label: '1' }]);
  });
});
