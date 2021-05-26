# [1.17.0](https://github.com/lifeart/ember-language-server/compare/v1.16.0...v1.17.0) (2021-05-26)


### Features

* add laziness into registry fields ([#284](https://github.com/lifeart/ember-language-server/issues/284)) ([9267328](https://github.com/lifeart/ember-language-server/commit/926732843a098ee84f5eb919b72af82a25f8fbab))

# [1.16.0](https://github.com/lifeart/ember-language-server/compare/v1.15.0...v1.16.0) (2021-05-26)


### Features

* Simplify registry getters (perf improvements) ([#282](https://github.com/lifeart/ember-language-server/issues/282)) ([a24a7c2](https://github.com/lifeart/ember-language-server/commit/a24a7c2460a58eaf322d8feb135de2fbe46206f6))

# [1.15.0](https://github.com/lifeart/ember-language-server/compare/v1.14.0...v1.15.0) (2021-05-25)


### Features

* addons lookup for top-level registry ([#279](https://github.com/lifeart/ember-language-server/issues/279)) ([988f88b](https://github.com/lifeart/ember-language-server/commit/988f88b5304ebc4587d7d55e9c2b2adb8bd67896))

# [1.14.0](https://github.com/lifeart/ember-language-server/compare/v1.13.0...v1.14.0) (2021-05-25)


### Features

* completely skip ignored project initialization ([#274](https://github.com/lifeart/ember-language-server/issues/274)) ([723a762](https://github.com/lifeart/ember-language-server/commit/723a762dc007820d4934dcb810edda71eec0d3ad))

# [1.13.0](https://github.com/lifeart/ember-language-server/compare/v1.12.0...v1.13.0) (2021-05-23)


### Features

* remove pure component name lookup prior to path matcher ([#270](https://github.com/lifeart/ember-language-server/issues/270)) ([5ca77fc](https://github.com/lifeart/ember-language-server/commit/5ca77fcf2b89e8132dccdf8f26c48e57f12fd21e))

# [1.12.0](https://github.com/lifeart/ember-language-server/compare/v1.11.0...v1.12.0) (2021-05-23)


### Features

* registry based template definition logic ([#267](https://github.com/lifeart/ember-language-server/issues/267)) ([fa21a74](https://github.com/lifeart/ember-language-server/commit/fa21a7418f29a19bbda5860d6eb4b78b875874b3))

# [1.11.0](https://github.com/lifeart/ember-language-server/compare/v1.10.0...v1.11.0) (2021-05-22)


### Features

* Performance improvement. Delay template tokenization on startup ([#263](https://github.com/lifeart/ember-language-server/issues/263)) ([26515a7](https://github.com/lifeart/ember-language-server/commit/26515a7278b74aeb92650b90636d42ecc967354c))

# [1.10.0](https://github.com/lifeart/ember-language-server/compare/v1.9.0...v1.10.0) (2021-04-18)


### Features

* Support `workspace/didChangeConfiguration` event ([#254](https://github.com/lifeart/ember-language-server/issues/254)) ([05d97cb](https://github.com/lifeart/ember-language-server/commit/05d97cb291f840f7d92b6c08f7deb79e33bee218))

# [1.9.0](https://github.com/lifeart/ember-language-server/compare/v1.8.0...v1.9.0) (2021-04-15)


### Features

* ember-template-lint severity converter (support different severity kinds) ([be3e923](https://github.com/lifeart/ember-language-server/commit/be3e9235b5385c8c89d53861df684fc12f87ad0b))

# [1.8.0](https://github.com/lifeart/ember-language-server/compare/v1.7.1...v1.8.0) (2021-04-15)


### Features

* improve template-completion caching ([#248](https://github.com/lifeart/ember-language-server/issues/248)) ([afb2d8d](https://github.com/lifeart/ember-language-server/commit/afb2d8de6086fe3f3f93dac363fb66e79f7784f7))

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
