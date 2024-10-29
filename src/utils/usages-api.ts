import { extractTokensFromTemplate } from './template-tokens-collector';
import { MatchResultType } from './path-matcher';
import { fsProvider } from '../fs-provider';
import { logDebugInfo } from './logger';
import { preprocess } from '@glimmer/syntax';
import { extractYieldMetadata, TemplateYieldContext } from './yield-context-extractor';

export interface TemplateTokenMeta {
  source: string;
  tokens: string[];
  yieldScopes?: TemplateYieldContext;
}

export type ITemplateTokens = {
  component: {
    [key: string]: TemplateTokenMeta;
  };
  routePath: {
    [key: string]: TemplateTokenMeta;
  };
};

const TEMPLATE_TOKENS: ITemplateTokens = {
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

const tokenQueue: [UsageType, string, string][] = [];

let extractionTimeout: NodeJS.Timeout | number;

function scheduleTokensExtraction(kind: UsageType, normalizedName: string, file: string) {
  tokenQueue.push([kind, normalizedName, file]);

  clearTimeout(extractionTimeout);
  extractionTimeout = setTimeout(extractTokens, 100);
}

export async function waitForTokensToBeCollected() {
  while (tokenQueue.length) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export function getAllTemplateTokens(): ITemplateTokens {
  return TEMPLATE_TOKENS;
}

async function extractTokens() {
  if (!tokenQueue.length) {
    return;
  }

  const item = tokenQueue[0];

  if (item === undefined) {
    logDebugInfo('extractTokens:item:undefined', tokenQueue);

    return;
  }

  const [kind, normalizedName, file]: [UsageType, string, string] = item;

  try {
    const content = await fsProvider().readFile(file);

    if (content !== null && content.trim().length > 0) {
      const ast = preprocess(content);

      const tokens = extractTokensFromTemplate(ast);
      let yieldMeta = {};

      if (kind === 'component' && content.includes('{{yield')) {
        try {
          yieldMeta = extractYieldMetadata(ast);
        } catch (e) {
          yieldMeta = {};
        }
      }

      TEMPLATE_TOKENS[kind][normalizedName] = {
        source: file,
        tokens,
        yieldScopes: yieldMeta,
      };
    } else if (typeof content === 'string') {
      TEMPLATE_TOKENS[kind][normalizedName] = {
        source: file,
        tokens: [],
        yieldScopes: {},
      };
    }
  } catch (e) {
    //
  } finally {
    tokenQueue.shift();
    setTimeout(extractTokens, 16);
  }
}

export function updateTemplateTokens(kind: UsageType, normalizedName: string, file: string | null) {
  if (file === null) {
    delete TEMPLATE_TOKENS[kind][normalizedName];

    return;
  }

  scheduleTokensExtraction(kind, normalizedName, file);
}
