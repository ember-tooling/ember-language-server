# Ember Language Server

[![Greenkeeper badge](https://badges.greenkeeper.io/lifeart/ember-language-server.svg)](https://greenkeeper.io/)

The Ember Language Server (ELS) implements the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for Ember.js projects. ELS enables editors to provide features like auto complete, goto definition and diagnostics. To get these features, you have to install the plugin for your editor.

## Features

All features currently only work in Ember CLI application that use the default classic structure, and are a rough first draft with a lot of room for improvements. Pods and addons are not supported yet.

- Autocompletion
  - `*.{js/ts}`: services, models, routes, transforms
  - `*.hbs`: components, route names, helpers, modifiers, local paths
  - GlimmerNative components autocompletion support
  - Namespaces support (batman syntax)

- Definition providers for (enable features like "Go To Definition" or "Peek Definition"):
  - Components (in Templates)
  - Helpers (in Templates)
  - Modifiers (in Templates)
  - Models
  - Transforms
  - Component imports (from addons)
  - Namespace components (batman syntax)

- Route autocompletion in `link-to` and `<LinkTo>` components.
- Diagnostics for `ember-template-lint` (if it is included in a project)
- `ember-template-lint` template fixes support (if exists).
- Workspaces support
- Supports Ignoring of LS initialization on unneeded projects by using `ignoredProjects` config option

## Editor Plugins

* VSCode: [Unstable Ember Language Server](https://github.com/lifeart/vscode-ember)
* Neo (Vim): [coc-ember](https://github.com/NullVoxPopuli/coc-ember)

## Addons

* [els-addon-glint](https://github.com/lifeart/els-addon-glint) - Glint integration addon.
* [els-a11y-addon](https://github.com/lifeart/els-a11y-addon) - Ember Language Server a11y addon.
* [els-addon-typed-templates](https://github.com/lifeart/els-addon-typed-templates) - Typed Templates for Ember.
* [els-addon-docs](https://github.com/lifeart/els-addon-docs) - Ember Language Server Addon Docs Completion Provider.
* [ember-fast-cli](https://github.com/lifeart/ember-fast-cli) - Addon for Ember-cli commands execution.
* [els-component-extraction-addon](https://github.com/lifeart/els-component-extraction-addon) - Component extraction addon.
* [els-intl-addon](https://github.com/lifeart/els-intl-addon) - Ember-Intl, Ember-i18n autocomplete.
