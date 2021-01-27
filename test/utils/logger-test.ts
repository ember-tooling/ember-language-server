import { safeStringify } from '../../src/utils/logger';

describe('safeStringify', () => {
  function stringify(obj: unknown) {
    return JSON.stringify(JSON.parse(safeStringify(obj)));
  }

  function assertStringified(value) {
    expect(stringify(value)).toEqual(JSON.stringify(value));
  }

  it('able to stringify strings', () => {
    const value = 'foo';

    assertStringified(value);
  });

  it('able to stringify arrays', () => {
    const value = [1, 2, 3];

    assertStringified(value);
  });

  it('able to stringify objects', () => {
    const value = { a: 1, b: 2 };

    assertStringified(value);
  });

  it('able to stringify recursive objects', () => {
    const obj = {
      a: 1,
      b: undefined,
    };

    obj.b = obj;
    const objB = {
      a: 1,
    };

    expect(safeStringify(obj)).toEqual(safeStringify(objB));
  });
});
