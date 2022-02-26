export type Initializer = () => void;

export interface Config {
  addons?: string[];
  ignoredProjects?: string[];
  useBuiltinLinting?: boolean;
  useBuiltinFoldingRangeProvider?: boolean;
  collectTemplateTokens?: boolean;
}
