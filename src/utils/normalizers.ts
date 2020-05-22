import { kebabCase } from 'lodash';

// https://github.com/ember-codemods/ember-angle-brackets-codemod/blob/master/transforms/angle-brackets/transform.js#L40
export function normalizeToAngleBracketComponent(name: string) {
  const SIMPLE_DASHERIZE_REGEXP = /[a-z]|\/|-/g;
  const ALPHA = /[A-Za-z0-9]/;

  if (name.includes('.')) {
    return name;
  }

  return name.replace(SIMPLE_DASHERIZE_REGEXP, (char, index) => {
    if (char === '/') {
      return '::';
    }

    if (index === 0 || !ALPHA.test(name[index - 1])) {
      return char.toUpperCase();
    }

    // Remove all occurrences of '-'s from the name that aren't starting with `-`
    return char === '-' ? '' : char.toLowerCase();
  });
}

// https://github.com/rwjblue/ember-angle-bracket-invocation-polyfill/blob/master/lib/ast-transform.js#L33
export function normalizeToClassicComponent(name: string) {
  const ALPHA = /[A-Za-z]/;

  return name
    .replace(/[A-Z]/g, (char, index) => {
      if (index === 0 || !ALPHA.test(name[index - 1])) {
        return char.toLowerCase();
      }

      return `-${char.toLowerCase()}`;
    })
    .replace(/::/g, '/');
}

export function normalizeServiceName(name: string) {
  return name
    .split('/')
    .map((el) => kebabCase(el))
    .join('/');
}
