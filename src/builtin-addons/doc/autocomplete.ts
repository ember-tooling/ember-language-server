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
