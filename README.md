# Ember Language Server

[![Greenkeeper badge](https://badges.greenkeeper.io/lifeart/ember-language-server.svg)](https://greenkeeper.io/)
[![Build Status](https://travis-ci.org/lifeart/ember-language-server.svg)](https://travis-ci.org/lifeart/ember-language-server)

The Ember Language Server (ELS) implements the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for Ember.js projects. ELS enables editors to provide features like auto complete, goto definition and diagnostics. To get these features, you have to install the plugin for your editor.

## Features

All features currently only work in Ember CLI application that use the default classic structure, and are a rough first draft with a lot of room for improvements. Pods and addons are not supported yet.

- Autocompletion
  - `*.{js/ts}`: services, models, routes, transforms
  - `*.hbs`: components, route names, helpers, modifiers, local paths
  - GlimmerNative components autocompletion support
 
- Definition providers for (enable features like "Go To Definition" or "Peek Definition"):
  - Components (in Templates)
  - Helpers (in Templates)
  - Modifiers (in Templates)
  - Models
  - Transforms
  - Component imports (from addons)

- Route autocompletion in `link-to`
- Diagnostics for ember-template-lint (if it is included in a project)

## Editor Plugins

* VSCode: [Unstable Ember Language Server](https://github.com/lifeart/vscode-ember)
* Neo (Vim): [coc-ember](https://github.com/NullVoxPopuli/coc-ember)
