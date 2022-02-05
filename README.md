# Ember Language Server

[![Greenkeeper badge](https://badges.greenkeeper.io/lifeart/ember-language-server.svg)](https://greenkeeper.io/)

The Ember Language Server (ELS) implements the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for Ember.js projects. ELS enables editors to provide features like auto complete, goto definition and diagnostics. To get these features, you have to install the plugin for your editor.

## Features

All features currently only work in Ember CLI application that use the default classic structure, and are a rough first draft with a lot of room for improvements. Pods and addons are not supported yet.

- Autocompletion
  - `*.{js/ts}`: services, models, routes, transforms
  - `*.hbs`: components, route names, helpers, modifiers, local paths, arguments
  - Namespaces support (batman syntax)

- Template linting
  - works only if `ember-template-lint` dependency added into project.
  - [ember-template-lint](https://github.com/ember-template-lint/ember-template-lint) (`v2`, `v3`, `v4`) integration, including documentation links and auto fixes
  - template linting inside `.js` and `.ts` files (with `hbs` literal)
  - experimental linting inside `.gjs` and `.gts` files (with `<template>` tag)

- Definition providers for (enable features like "Go To Definition" or "Peek Definition"):
  - Components (in Templates)
  - Helpers (in Templates)
  - Modifiers (in Templates)
  - Models
  - Transforms
  - Component imports (from addons)
  - Namespace components (batman syntax)

- Route autocompletion in `link-to` and `<LinkTo>` components.
- Outlet jumping
- Workspaces support
- Supports Ignoring of LS initialization on unneeded projects by using `ignoredProjects` config option, if you need "exclude except" functionality, specify project name as `!my-project`.

## Editor Plugins

* VSCode: [Unstable Ember Language Server](https://github.com/lifeart/vscode-ember)
* Neo (Vim): [coc-ember](https://github.com/NullVoxPopuli/coc-ember), [native LSP integration](https://github.com/neovim/nvim-lspconfig/blob/master/CONFIG.md#ember)
* Emacs using [lsp-mode](https://github.com/emacs-lsp/lsp-mode)
* GitPod, Onivim, Coder, VSCodium, and Theia using [Open VSX](https://open-vsx.org/extension/lifeart/vscode-ember-unstable)

## Addons available for install

* [els-addon-glint](https://github.com/lifeart/els-addon-glint) - Glint integration addon.
* [els-a11y-addon](https://github.com/lifeart/els-a11y-addon) - Ember Language Server a11y addon.
* [els-addon-typed-templates](https://github.com/lifeart/els-addon-typed-templates) - Typed Templates for Ember.
* [els-addon-docs](https://github.com/lifeart/els-addon-docs) - Ember Language Server Addon Docs Completion Provider.
* [ember-fast-cli](https://github.com/lifeart/ember-fast-cli) - Addon for Ember-cli commands execution.
* [els-component-extraction-addon](https://github.com/lifeart/els-component-extraction-addon) - Component extraction addon.
* [els-intl-addon](https://github.com/lifeart/els-intl-addon) - Ember-Intl, Ember-i18n autocomplete.

## Addon notes:

- all addons could be added as dev-dependency for a project
- dev-dependency installation allow us to have independent versions of addons for different projects
- for global addon installation check LS settings in your editor (you have to specify path to addon root in LS config)
- you could [build](https://github.com/lifeart/ember-language-server/wiki/Addon-API) your project-sepecific addon

---

# Integration details

## Server entrypoints

`lib/start-server.js` - nodejs

`lib/start-worker-server.js` - worker
## Server options

```js
new Server({fs, type})
```


`fs` - available options: 
  * `sync` - LS should use nodejs.fs logic
  * `async` - LS should use client's fs provider

`type` - available options: 
  * `node` - supported addons & require logic
  * `worker` - addons and require logic not supported

---

### [Debugging](DEBUGGING.md)

---
### [Changelog](CHANGELOG.md)

---

## Licence

[MIT](LICENSE.md)
