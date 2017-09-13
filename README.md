# Ember Language Server

[![Greenkeeper badge](https://badges.greenkeeper.io/emberwatch/ember-language-server.svg)](https://greenkeeper.io/)
[![Build Status](https://travis-ci.org/emberwatch/ember-language-server.svg?branch=master)](https://travis-ci.org/emberwatch/ember-language-server)
[![Build status](https://ci.appveyor.com/api/projects/status/g87tn9717ww6s9n7?svg=true)](https://ci.appveyor.com/project/t-sauer/ember-language-server)

The Ember Language Server (ELS) implements the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for Ember.js projects. ELS enables editors to provide features like auto complete, goto definition and diagnostics. To get these features, you have to install the plugin for your editor.

## Features

All features currently only work in Ember CLI application that use the default classic structure, and are a rough first draft with a lot of room for improvements. Pods and addons are not supported yet.

- Component and helper autocompletion for inline and sub expressions
- Definition providers for (enable features like "Go To Definition" or "Peek Definition"):
  - Components (in Templates)
  - Helpers (in Templates)
  - Models
  - Transforms
- Route autocompletion in `link-to`
- Diagnostics for ember-template-lint (if it is included in a project)

## Editor Plugins

* VSCode: [vscode-ember](https://github.com/emberwatch/vscode-ember)
* Atom: [atom-languageserver-ember](https://github.com/josa42/atom-languageserver-ember)
