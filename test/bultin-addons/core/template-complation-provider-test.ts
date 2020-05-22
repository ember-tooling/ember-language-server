import { filter } from 'fuzzaldrin';

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
