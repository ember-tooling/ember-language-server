## [1.7.1](https://github.com/lifeart/ember-language-server/compare/v1.7.0...v1.7.1) (2021-04-14)


### Bug Fixes

* update debounce implementation ([#250](https://github.com/lifeart/ember-language-server/issues/250)) ([4675e19](https://github.com/lifeart/ember-language-server/commit/4675e19fff57c5ac862c8ae50fb7c0bf7dc5f1fd))

# [1.7.0](https://github.com/lifeart/ember-language-server/compare/v1.6.0...v1.7.0) (2021-04-14)


### Features

* Improve linting speed & ability to disable default linting ([#244](https://github.com/lifeart/ember-language-server/issues/244)) ([472c0fe](https://github.com/lifeart/ember-language-server/commit/472c0fe86b4194dbb70bf0c5764d4e64bf3bb2a0))

# [1.6.0](https://github.com/lifeart/ember-language-server/compare/v1.5.0...v1.6.0) (2021-04-12)


### Features

* Support jump to definition from parent to child app and tests ([#234](https://github.com/lifeart/ember-language-server/issues/234)) ([24f33e5](https://github.com/lifeart/ember-language-server/commit/24f33e5b7bb2fa1b0c918af3e1ce0b2ca683f12f))

# [1.5.0](https://github.com/lifeart/ember-language-server/compare/v1.4.0...v1.5.0) (2021-04-11)


### Features

* ability to ignore LS initialization on unneeded projects ([#242](https://github.com/lifeart/ember-language-server/issues/242)) ([fc5acf4](https://github.com/lifeart/ember-language-server/commit/fc5acf436d8db679aa2790fec6426f9fdab3ee81))

# [1.4.0](https://github.com/lifeart/ember-language-server/compare/v1.3.0...v1.4.0) (2021-04-05)


### Features

* add has block params into builtin helper, extended in-repo-addons support ([#224](https://github.com/lifeart/ember-language-server/issues/224)) ([acd71a0](https://github.com/lifeart/ember-language-server/commit/acd71a00a9e264e0e261b43e1b4afb7d138423cc))

# [1.3.0](https://github.com/lifeart/ember-language-server/compare/v1.2.0...v1.3.0) (2021-04-01)


### Features

* add support for multinamespaced components ([#212](https://github.com/lifeart/ember-language-server/issues/212)) ([6b03c83](https://github.com/lifeart/ember-language-server/commit/6b03c83469da9cf4022e702dd55e7df9d5a9a1d8))

# [1.2.0](https://github.com/lifeart/ember-language-server/compare/v1.1.0...v1.2.0) (2021-04-01)


### Features

* Namespace components (batman syntax) ([2ea63d9](https://github.com/lifeart/ember-language-server/commit/2ea63d9adda05f82d0db129640fc5989add02607))

# [1.1.0](https://github.com/lifeart/ember-language-server/compare/v1.0.5...v1.1.0) (2021-02-02)


### Features

* template-lint documentation link support ([e9577b1](https://github.com/lifeart/ember-language-server/commit/e9577b1184213a9b4ae56b22e1cd61ac9b26140b))

## [1.0.5](https://github.com/lifeart/ember-language-server/compare/v1.0.4...v1.0.5) (2021-01-31)


### Bug Fixes

* improve typings ([3942add](https://github.com/lifeart/ember-language-server/commit/3942add6ecde57c83dc5401d05ad49821f4f2650))

## [1.0.4](https://github.com/lifeart/ember-language-server/compare/v1.0.3...v1.0.4) (2021-01-27)


### Bug Fixes

* json serializtion ([ee7e99e](https://github.com/lifeart/ember-language-server/commit/ee7e99e808ed9cc4e4099d7a4b38ada5e2963ccd))

## [1.0.3](https://github.com/lifeart/ember-language-server/compare/v1.0.2...v1.0.3) (2021-01-19)


### Bug Fixes

* **pencil:** improve component names token collector ([f485ad5](https://github.com/lifeart/ember-language-server/commit/f485ad58066fbf1ea041c4e70f3400f47d6c07e5))

# Changelog

## v0.2.1 (2018-12-10)

#### :bug: Bug Fix
* [#129](https://github.com/emberwatch/ember-language-server/pull/129) Fix "Go to Definition" for windows ([@HodofHod](https://github.com/HodofHod))

#### :memo: Documentation
* [#140](https://github.com/emberwatch/ember-language-server/pull/140) Add Changelog ([@Turbo87](https://github.com/Turbo87))

#### :house: Internal
* [#126](https://github.com/emberwatch/ember-language-server/pull/126) Update `fsevents` subdependency to v1.2.4 ([@Turbo87](https://github.com/Turbo87))
* [#125](https://github.com/emberwatch/ember-language-server/pull/125) yarn: Add `integrity` hashes ([@Turbo87](https://github.com/Turbo87))

#### Committers: 2
- Tobias Bieniek ([@Turbo87](https://github.com/Turbo87))
- [@HodofHod](https://github.com/HodofHod)


## v0.2.0 (2018-04-24)

#### :rocket: Enhancement
* [#111](https://github.com/emberwatch/ember-language-server/pull/111) Remove file index ([@t-sauer](https://github.com/t-sauer))
* [#104](https://github.com/emberwatch/ember-language-server/pull/104) Update all outdated dependencies ([@t-sauer](https://github.com/t-sauer))
* [#85](https://github.com/emberwatch/ember-language-server/pull/85) Dependencies upgrade ([@t-sauer](https://github.com/t-sauer))

#### :house: Internal
* [#113](https://github.com/emberwatch/ember-language-server/pull/113) Replace esprima with Babylon ([@t-sauer](https://github.com/t-sauer))
* [#110](https://github.com/emberwatch/ember-language-server/pull/110) Don't use the fileindex for completion request ([@t-sauer](https://github.com/t-sauer))
* [#109](https://github.com/emberwatch/ember-language-server/pull/109) Run tests on Node 7 and 8 ([@t-sauer](https://github.com/t-sauer))
* [#108](https://github.com/emberwatch/ember-language-server/pull/108) Added integration tests for all features ([@t-sauer](https://github.com/t-sauer))
* [#107](https://github.com/emberwatch/ember-language-server/pull/107) Migrate tests to use Jest ([@t-sauer](https://github.com/t-sauer))
* [#106](https://github.com/emberwatch/ember-language-server/pull/106) Basic integration testing ([@t-sauer](https://github.com/t-sauer))

#### Committers: 2
- Ricardo Mendes ([@locks](https://github.com/locks))
- Thomas Sauer ([@t-sauer](https://github.com/t-sauer))


## v0.1.1 (2017-11-15)

#### :rocket: Enhancement
* [#74](https://github.com/emberwatch/ember-language-server/pull/74) Upgraded dependencies ([@t-sauer](https://github.com/t-sauer))

#### :memo: Documentation
* [#79](https://github.com/emberwatch/ember-language-server/pull/79) mention the atom plugin in the README ([@caseywatts](https://github.com/caseywatts))

#### Committers: 3
- Casey Watts ([@caseywatts](https://github.com/caseywatts))
- Josa Gesell ([@josa42](https://github.com/josa42))
- Thomas Sauer ([@t-sauer](https://github.com/t-sauer))
