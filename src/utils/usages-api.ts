import { extractTokensFromTemplate } from './template-tokens-collector';
import * as fs from 'fs';

export interface TemplateTokenMeta {
  source: string;
  tokens: string[];
}

const TEMPLATE_TOKENS: {
  component: {
    [key: string]: TemplateTokenMeta;
  };
  routePath: {
    [key: string]: TemplateTokenMeta;
  };
} = {
  component: {},
  routePath: {},
};

export type UsageType = 'component' | 'routePath';

export interface Usage {
  name: string;
  path: string;
  type: UsageType;
  usages: Usage[];
}

export function findRelatedFiles(token: string): Usage[] {
  const results: Usage[] = [];

  Object.keys(TEMPLATE_TOKENS).forEach((kindName) => {
    const components = TEMPLATE_TOKENS[kindName as UsageType];

    Object.keys(components).forEach((normalizedComponentName: string) => {
      if (components[normalizedComponentName].tokens.includes(token)) {
        results.push({
          name: normalizedComponentName,
          path: components[normalizedComponentName].source,
          type: kindName as UsageType,
          usages: [],
        });
      }
    });
  });

  return results;
}

export function updateTemplateTokens(kind: UsageType, normalizedName: string, file: string | null) {
  if (file === null) {
    delete TEMPLATE_TOKENS[kind][normalizedName];

    return;
  }

  try {
    const tokens = extractTokensFromTemplate(fs.readFileSync(file, 'utf8'));

    TEMPLATE_TOKENS[kind][normalizedName] = {
      source: file,
      tokens,
    };
  } catch (e) {
    //
  }
}
