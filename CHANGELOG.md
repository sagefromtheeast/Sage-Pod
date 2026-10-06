## [0.3.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.2.0...v0.3.0) (2026-10-06)

### 🚀 New Features

* **home:** stable Surprise Me shuffle and tablet-aware layouts ([7c4e860](https://github.com/sagefromtheeast/Sage-Pod/commit/7c4e860134de859d50a63617aef9368e34797cea))

### 🐛 Bug Fixes

* resolve expo-doctor failures for standalone builds ([835bb6c](https://github.com/sagefromtheeast/Sage-Pod/commit/835bb6c0999a10bf0d8f0cb0348dc5dda1ed895b))

### 📦 Build & Dependencies

* switch android/ios scripts to dev-build (expo run) workflow ([5e6dc41](https://github.com/sagefromtheeast/Sage-Pod/commit/5e6dc41f6a4aaceb4f464ac0b0e1f3237f01a440))

### 🔧 Maintenance

* add EAS build config and dev-client for device testing ([58334be](https://github.com/sagefromtheeast/Sage-Pod/commit/58334be511e45eb23182d9267dba59a014064c74))
* link app to EAS project (owner + projectId) ([01325d2](https://github.com/sagefromtheeast/Sage-Pod/commit/01325d2cbbdb90d7eff78d0cb9dbaf2d94a5f4c8))

## [0.2.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.1.0...v0.2.0) (2026-09-05)

### 🚀 New Features

* **branding:** add Sage the Owl app icon and platform assets ([c3c1aad](https://github.com/sagefromtheeast/Sage-Pod/commit/c3c1aad72c5ce926c805e0efdfbb0aea4ed65bc3)), closes [#0E1512](https://github.com/sagefromtheeast/Sage-Pod/issues/0E1512)
* **downloads:** implement captive portal check, stale reconciliation, storage cap, and queue auto-download ([57aa31a](https://github.com/sagefromtheeast/Sage-Pod/commit/57aa31ac1cf1b4565371d72f5fb0c23f2114c974))
* **filter-sort:** add AntennaPod-style filtering, batch queue sorting, storage sorting, and auto-download rules ([d033c2a](https://github.com/sagefromtheeast/Sage-Pod/commit/d033c2ace49d53f331e2d1514cbe644ccca89045))
* implement advanced AntennaPod features ([516d9e2](https://github.com/sagefromtheeast/Sage-Pod/commit/516d9e216a9f942ea9605093f3d37a3e28987954))
* OPML import, queue swipe actions, smart resume, basic auth ([131cd04](https://github.com/sagefromtheeast/Sage-Pod/commit/131cd045a6031cd8467e51fdb9a8e150edd13992))
* **player:** enhance lock screen metadata handling for Expo Go compatibility ([baf17c9](https://github.com/sagefromtheeast/Sage-Pod/commit/baf17c922ac3c997e7ada679f5b0a5dc127f7025))
* **skills:** add skills-lock.json with initial skill definitions and computed hashes ([992db87](https://github.com/sagefromtheeast/Sage-Pod/commit/992db8742fe4f3551b861b52dc013252c31a619e))
* **ui:** implement AntennaPod-style inbox triage and modular home dashboard ([4287c8f](https://github.com/sagefromtheeast/Sage-Pod/commit/4287c8fc0f0934496ceda407af0c7bb77fd00750))
* **ui:** implement liquid glass navigation and scrubbable controls ([a9f5c5e](https://github.com/sagefromtheeast/Sage-Pod/commit/a9f5c5e86b4d02155b3156449229f598bc2ebd53))
* **ux:** implement design roadmap from AntennaPod research ([fba7830](https://github.com/sagefromtheeast/Sage-Pod/commit/fba7830838f4ffd2d05da83f061e170946da784b)), closes [#000](https://github.com/sagefromtheeast/Sage-Pod/issues/000)

### 🐛 Bug Fixes

* **downloads:** ensure useDownloadProgress hook is called unconditionally ([bdb5a94](https://github.com/sagefromtheeast/Sage-Pod/commit/bdb5a94d661f1790e11768de16386ddc80831f48))
* **downloads:** resolve network gating, User-Agent, and task recovery ([28b6872](https://github.com/sagefromtheeast/Sage-Pod/commit/28b68729327cd37a368011174094841cffac2a1c))
* **theme:** broadcast theme preference changes across app via ThemeProvider context ([39f8110](https://github.com/sagefromtheeast/Sage-Pod/commit/39f811064cf458c1ec0853dd3d93498458b4a0ce))
* **ui:** add forward skip button to MiniPlayer ([75b5b55](https://github.com/sagefromtheeast/Sage-Pod/commit/75b5b55ebef44f36a9a861bb42e55614d2bc8ca1))
* **ui:** safely resolve Android blurMethod when blurTarget is absent ([1e3f746](https://github.com/sagefromtheeast/Sage-Pod/commit/1e3f74641f2ffd5dd69431f2f21f4b9d33cc623d))

### 📚 Documentation

* **readme:** dev-focused rewrite with badges; drop release section ([d31e92e](https://github.com/sagefromtheeast/Sage-Pod/commit/d31e92eb8c22c9614e86e541e538b2ff864ea741))

### 🤖 CI/CD

* automate versioning and releases from commit messages ([5b50480](https://github.com/sagefromtheeast/Sage-Pod/commit/5b5048018f3b24367db15ae0c6aeb14e55af7a26))
* **release:** pin conventionalcommits preset to v8 for notes generation ([244a560](https://github.com/sagefromtheeast/Sage-Pod/commit/244a5603f5eb92b8509f78c1153503320499e154)), closes [#2](https://github.com/sagefromtheeast/Sage-Pod/issues/2)
* **release:** run the release workflow on Node 22 ([f46c2f2](https://github.com/sagefromtheeast/Sage-Pod/commit/f46c2f26138f25f6f7d648a4ca684658477db829))
