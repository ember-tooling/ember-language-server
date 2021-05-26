export type Initializer = () => void;

export interface Config {
  addons?: string[];
  ignoredProjects?: string[];
  useBuiltinLinting?: boolean;
  collectTemplateTokens?: boolean;
}
