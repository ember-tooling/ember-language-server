import { extractTokensFromTemplate } from './template-tokens-collector';
import * as fs from 'fs';
import { MatchResultType } from './path-matcher';

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

export function closestParentRoutePath(name: string): string | null {
  const lastIndexOfDot = name.lastIndexOf('/');

  if (name.endsWith('-loading') || name.endsWith('-error')) {
    return name.slice(0, name.lastIndexOf('-'));
  }

  if (lastIndexOfDot === undefined || lastIndexOfDot < 0) {
    return null;
  }

  return name.slice(0, lastIndexOfDot);
}

export function findRelatedFiles(token: string, tokenType: MatchResultType = 'component'): Usage[] {
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

  if (tokenType === 'template') {
    const routeTemplates = TEMPLATE_TOKENS.routePath;
    let parent: string | null = token;

    do {
      parent = closestParentRoutePath(parent);

      if (parent !== null) {
        const normalizedParentName = parent.split('/').join('.');

        if (routeTemplates[normalizedParentName]) {
          results.push({
            name: normalizedParentName,
            path: routeTemplates[normalizedParentName].source,
            type: 'routePath',
            usages: [],
          });
          break;
        }
      } else {
        break;
      }
    } while (parent);

    if (results.length === 0 && token !== 'application') {
      if (routeTemplates['application']) {
        results.push({
          name: 'application',
          path: routeTemplates['application'].source,
          type: 'routePath',
          usages: [],
        });
      }
    }
  }

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
