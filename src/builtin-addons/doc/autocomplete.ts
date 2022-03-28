const attributes: {
  [key: string]: {
    documentation: string;
  };
} = {
  '...attributes': {
    documentation: `
        In general, you should place ...attributes after any attributes you specify to give people using your component an opportunity to override your attribute. 
        If ...attributes appears after an attribute, it overrides that attribute. 
        If it appears before an attribute, it does not.
        Place ...attributes before your attributes only if you want to disallow tags from overriding your attributes.
        This is likely to be unusual.
        In addition, the class attribute is special, and will be merged with any existing classes on the element rather than overwriting them.
        This allows you to progressively add CSS classes to your components, and makes them more flexible overall.
        `,
  },
};

const builtins: {
  [key: string]: {
    arguments: {
      [key: string]: {
        documentation: string;
        values: { value: string; documentation: string }[];
      };
    };
  };
} = {
  each: {
    arguments: {
      key: {
        documentation: `
            The \`key\` option is used to tell Ember how to determine if the items in the
            array being iterated over with \`{{#each}}\` has changed between renders. By
            default the item's object identity is used.
        `,
        values: [
          {
            value: '@identity',
            documentation: 'The index of the item in the array.',
          },
          {
            value: '@index',
            documentation: 'The item in the array itself.',
          },
        ],
      },
    },
  },
};

export function valuesForBuiltinComponentArgument(componentName: string, argumentName: string) {
  const component = builtins[componentName];

  if (!component) {
    return [];
  }

  const argument = component.arguments[argumentName];

  if (!argument) {
    return [];
  }

  return argument.values.map((e) => {
    return {
      label: e.value,
      documentation: normalizeNewlines(e.documentation),
    };
  });
}

export function argumentsForBuiltinComponent(componentName: string) {
  if (builtins[componentName] && builtins[componentName].arguments) {
    return Object.keys(builtins[componentName].arguments).map((key) => {
      return {
        label: key,
        documentation: normalizeNewlines(builtins[componentName].arguments[key].documentation ?? ''),
      };
    });
  }

  return [];
}

function normalizeNewlines(text: string) {
  return text
    .split('\n')
    .map((e) => e.trim())
    .join('\n');
}

export function docForAttribute(name: string) {
  if (name in attributes) {
    if (attributes[name].documentation) {
      return normalizeNewlines(attributes[name].documentation);
    }
  }

  return '';
}
