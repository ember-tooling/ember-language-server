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

const MAX_TEMPLATE_TOKENS_SIZE = 5000;
const TOKEN_CACHE_KEYS_BY_ACCESS: { kind: UsageType; name: string }[] = [];

function updateTokenCacheAccess(kind: UsageType, name: string) {
  const idx = TOKEN_CACHE_KEYS_BY_ACCESS.findIndex((e) => e.kind === kind && e.name === name);

  if (idx !== -1) {
    TOKEN_CACHE_KEYS_BY_ACCESS.splice(idx, 1);
  }

  TOKEN_CACHE_KEYS_BY_ACCESS.push({ kind, name });
}

function evictOldestTokensIfNeeded() {
  while (TOKEN_CACHE_KEYS_BY_ACCESS.length > MAX_TEMPLATE_TOKENS_SIZE) {
    const oldest = TOKEN_CACHE_KEYS_BY_ACCESS.shift();

    if (oldest) {
      delete TEMPLATE_TOKENS[oldest.kind][oldest.name];
    }
  }
}

const tokenQueue: [UsageType, string, string][] = [];

let extractionTimeout: NodeJS.Timeout | number = 0;
let isExtracting = false;

function scheduleTokensExtraction(kind: UsageType, normalizedName: string, file: string) {
  tokenQueue.push([kind, normalizedName, file]);

  clearTimeout(extractionTimeout);
  extractionTimeout = setTimeout(extractTokens, 100);
}

export async function waitForTokensToBeCollected() {
  // Wait for the debounce timeout to fire (100ms debounce + buffer)
  // This ensures that if files were just added to the queue, the extraction will start
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Then wait for the queue to drain and extraction to complete
  while (tokenQueue.length > 0 || isExtracting) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // One more small wait to ensure any async file reads have completed
  await new Promise((resolve) => setTimeout(resolve, 50));
}

export function getAllTemplateTokens(): ITemplateTokens {
  return TEMPLATE_TOKENS;
}

async function extractTokens() {
  // Guard against concurrent execution.
  // When scheduleTokensExtraction resets the debounce timer while extractTokens is
  // already running (during an async await point), the new timer fires and calls
  // extractTokens again. Without this guard, two concurrent calls would both read
  // tokenQueue[0], then both call tokenQueue.shift(), causing the second shift to
  // remove an unprocessed item from the queue.
  if (isExtracting) {
    return;
  }

  if (!tokenQueue.length) {
    return;
  }

  isExtracting = true;

  // Use a do-while to catch items added during the final yield
  do {
    while (tokenQueue.length > 0) {
      const item = tokenQueue[0];

      if (item === undefined) {
        logDebugInfo('extractTokens:item:undefined', tokenQueue);
        tokenQueue.shift();
        continue;
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
          updateTokenCacheAccess(kind, normalizedName);
          evictOldestTokensIfNeeded();
        } else if (typeof content === 'string') {
          TEMPLATE_TOKENS[kind][normalizedName] = {
            source: file,
            tokens: [],
            yieldScopes: {},
          };
          updateTokenCacheAccess(kind, normalizedName);
          evictOldestTokensIfNeeded();
        }
      } catch (e) {
        //
      }

      tokenQueue.shift();

      // Small delay between items to avoid blocking the event loop
      if (tokenQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
    }

    // Yield once more to catch any items pushed during the last iteration
    await new Promise((resolve) => setTimeout(resolve, 0));
  } while (tokenQueue.length > 0);

  isExtracting = false;
}

export function updateTemplateTokens(kind: UsageType, normalizedName: string, file: string | null) {
  if (file === null) {
    delete TEMPLATE_TOKENS[kind][normalizedName];

    return;
  }

  scheduleTokensExtraction(kind, normalizedName, file);
}
