import { normalizeToFs, flattenFsProject } from './integration-helpers';

describe('normalizeToFs', () => {
  it('support existing cases', () => {
    const files = {
      foo: {
        bar: {
          'baz.js': '1',
        },
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeToFs(files as any)).toStrictEqual(JSON.parse(JSON.stringify(files)));
  });
  it('support new case', () => {
    const expectedObj = {
      foo: {
        bar: {
          'baz.js': '1',
        },
      },
    };
    const files = {
      'foo/bar/baz.js': '1',
    };

    expect(normalizeToFs(files)).toStrictEqual(expectedObj);
  });
  it('support partial case', () => {
    const expectedObj = {
      foo: {
        bar: {
          'baz.js': '1',
        },
      },
    };
    const files = {
      foo: {
        'bar/baz.js': '1',
      },
    };

    expect(normalizeToFs(files)).toStrictEqual(expectedObj);
  });

  it('support corner case', () => {
    const files = {
      'full-project/app/components': {
        'foo.hbs': '',
        'bar.hbs': '',
      },
      'full-project/package.json': '',
    };

    const expectedObj = {
      'full-project': {
        'package.json': '',
        app: {
          components: {
            'foo.hbs': '',
            'bar.hbs': '',
          },
        },
      },
    };

    expect(normalizeToFs(files)).toStrictEqual(expectedObj);
  });
});

describe('flattenFsProject', () => {
  it('works as expected', () => {
    const input = {
      a: {
        b: {
          c: 'd',
          e: 'f',
        },
      },
    };

    const output = {
      'a/b/c': 'd',
      'a/b/e': 'f',
    };

    expect(flattenFsProject(input)).toStrictEqual(output);
  });
});
