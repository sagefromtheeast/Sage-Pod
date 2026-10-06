## [0.8.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.7.0...v0.8.0) (2026-10-06)

### 🚀 New Features

* **home:** AntennaPod's configurable Home sections and a search of your library ([f6a9d4a](https://github.com/sagefromtheeast/Sage-Pod/commit/f6a9d4aaca83ba5810d5dc85eaf46258f5fb09ef))

### 🐛 Bug Fixes

* **home:** leave queued episodes out of In progress before limiting, not after ([bc6a1be](https://github.com/sagefromtheeast/Sage-Pod/commit/bc6a1be975dc87a3340425e0606e48df94b6d866))

### ♻️ Refactoring

* **tabs:** set Home and Inbox header options through expo-router/js-tabs ([3d61901](https://github.com/sagefromtheeast/Sage-Pod/commit/3d619018265898c1dc6688ef8668f2c11e05a96d))

### 📚 Documentation

* mark Phase 7 done, record D-014, and note that PRs merge with a merge commit ([f2115e2](https://github.com/sagefromtheeast/Sage-Pod/commit/f2115e22e1ba418bd7cf569de00eebca0a2e41a5))

### ✅ Tests

* **shots:** Home menu, Configure home screen and library search ([42f49e4](https://github.com/sagefromtheeast/Sage-Pod/commit/42f49e4f48120944faa35b147436e92ecf865627))

## [0.7.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.6.0...v0.7.0) (2026-10-06)

### 🚀 New Features

* **inbox:** AntennaPod's swipes with undo, search, sort, remove all, multi-select and paging ([8ae7c65](https://github.com/sagefromtheeast/Sage-Pod/commit/8ae7c652e53caa17fa2fd25d53fe0ba226f46df3))

### 📚 Documentation

* mark Phase 6 done; index D-012 and D-013; harness tips for swipes ([3799a44](https://github.com/sagefromtheeast/Sage-Pod/commit/3799a4486a5289aa43f03d0e5189ad9849b07355))

### ✅ Tests

* **shots:** inbox menu, sort, selection and a real touch swipe; keep a picture of failing routes ([30cb57f](https://github.com/sagefromtheeast/Sage-Pod/commit/30cb57fae15210be3f04acdbaaea227d05994911))

## [0.6.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.5.0...v0.6.0) (2026-10-06)

### 🚀 New Features

* **queue:** drag to reorder, sort and keep sorted, lock, search and an enqueue location setting ([314abd2](https://github.com/sagefromtheeast/Sage-Pod/commit/314abd2d8496aafc97fe43f5dce6028b813ce619))

### 🐛 Bug Fixes

* **player:** continue with the episode after the finished one, not the head of the queue ([31bcbb8](https://github.com/sagefromtheeast/Sage-Pod/commit/31bcbb8294c4a98b72fe0c6c55d2322653397cd6))
* **queue:** keep a multi-selection's order when adding it to the front or after the current episode ([6e1ffcb](https://github.com/sagefromtheeast/Sage-Pod/commit/6e1ffcb43cf8ce27aa0f146d1f3915d40130d3f7))

### 📚 Documentation

* mark Phase 5 done and record the queue decisions (D-013) ([b03dc36](https://github.com/sagefromtheeast/Sage-Pod/commit/b03dc36e1278309724120b9e79bd5e1c5a0e0a98))

### ✅ Tests

* **shots:** capture the queue menu, sort sheet, selection and search, and drive a real drag ([844bce6](https://github.com/sagefromtheeast/Sage-Pod/commit/844bce6583664b925362b902cc29d0959cfead95))

## [0.5.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.4.0...v0.5.0) (2026-10-06)

### 🚀 New Features

* **player:** rebuild Now Playing with a speed sheet, chapter controls and a chapter-aware seek bar ([f4b61e6](https://github.com/sagefromtheeast/Sage-Pod/commit/f4b61e6409127babcd2803348e1b24d4fad38201))
* **player:** sleep timer for a number of episodes, with extend, fade-out and shake to reset ([d612e0d](https://github.com/sagefromtheeast/Sage-Pod/commit/d612e0db422d1e1eadba569bea3d180bc23582bc))
* **ui:** show the mini player on podcast, episode and list screens ([b44a971](https://github.com/sagefromtheeast/Sage-Pod/commit/b44a97156791e6962c00dbb82f76eb5df3ee0154))

### 📚 Documentation

* mark Phase 4 done and record the Now Playing decisions (D-012) ([a119ee2](https://github.com/sagefromtheeast/Sage-Pod/commit/a119ee209bd531db3d85443431851af734d943be))

### ✅ Tests

* **shots:** seed chapters and capture the player's speed, sleep and chapters sheets ([0deec7b](https://github.com/sagefromtheeast/Sage-Pod/commit/0deec7b97581f0b2cfe6bc7a1b2ec56f4ca5e5bc))

## [0.4.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.3.1...v0.4.0) (2026-10-06)

### 🚀 New Features

* **actions:** typed episode actions and row-button rules from AntennaPod ([fc5ec1d](https://github.com/sagefromtheeast/Sage-Pod/commit/fc5ec1dcd48754159f2b82a9021a1fb10d1e65e6))
* **db:** undo-able episode and queue writes, shared queue membership ([901a66c](https://github.com/sagefromtheeast/Sage-Pod/commit/901a66c6a2260fb3d02298a51f8d3d5d3475a893))
* **episodes:** long-press menu, smart row button and status markers ([e0c866b](https://github.com/sagefromtheeast/Sage-Pod/commit/e0c866b3eba3900ce32c39e8ffc3085a01e33e8f))
* **feed:** multi-select and a real overflow menu on the podcast page ([df92b61](https://github.com/sagefromtheeast/Sage-Pod/commit/df92b61c6702a899e9709ebe9bb860b32031924c))
* **ui:** action sheet, undo toast, overflow menu and multi-select bar ([2ab5a03](https://github.com/sagefromtheeast/Sage-Pod/commit/2ab5a0353d9a45d22d6aa3284e3045884355cc53))

### 🐛 Bug Fixes

* **actions:** act only on applicable episodes; batch writes; exact undo ([b85294f](https://github.com/sagefromtheeast/Sage-Pod/commit/b85294fa93c7255f4b9a41ead21c34770abbaab3))
* **actions:** undo restores only what changed; delete re-reads state ([9f6acc8](https://github.com/sagefromtheeast/Sage-Pod/commit/9f6acc87644379e953454703d9b8a21c9cfa4aaa))
* **selection:** stop a render loop when a list is still loading ([09a87e3](https://github.com/sagefromtheeast/Sage-Pod/commit/09a87e38f5ddbfb8a0b2c08757c9db2cc245b9fb))
* **ui:** sheet actions after dismissal, live streaming setting, selection exit ([4a2da52](https://github.com/sagefromtheeast/Sage-Pod/commit/4a2da52ea2a3d0ef183d41bc8c5e0e0483a55396))

### ♻️ Refactoring

* **ui:** one createStore helper for app-wide state ([8415b03](https://github.com/sagefromtheeast/Sage-Pod/commit/8415b0352c7078f76b70fbade43ada2dbe7773fa))

### 📚 Documentation

* record merge delegation, streaming default and end-of-parity build ([bd7e9ab](https://github.com/sagefromtheeast/Sage-Pod/commit/bd7e9ab4256d17651bb080bea98240e8b8f1c574))

### 📦 Build & Dependencies

* **shots:** interaction shots and page errors on render failure ([7dcba9c](https://github.com/sagefromtheeast/Sage-Pod/commit/7dcba9cdc4b842d4ba703a691b57c921001347db))

### 🤖 CI/CD

* run typecheck, tests, expo-doctor and an Android bundle on every PR ([72279c1](https://github.com/sagefromtheeast/Sage-Pod/commit/72279c157dc392c85b37c282249893134c5d1dbc))

## [0.3.1](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.3.0...v0.3.1) (2026-10-06)

### 🐛 Bug Fixes

* **feed-settings:** drop the skip-intro "Global" option that meant Off ([b678b7a](https://github.com/sagefromtheeast/Sage-Pod/commit/b678b7a7ed0318cd4192cb4be7a112fab88e0888))
* **feed:** page through long podcasts and load older feed pages ([6b0eda2](https://github.com/sagefromtheeast/Sage-Pod/commit/6b0eda2bb6083df2f1c2667c5d39fc81b20d2872))
* **feed:** reset paging on filter or sort change; no footer while loading ([26337bd](https://github.com/sagefromtheeast/Sage-Pod/commit/26337bdfba6e472dff2186a925b325cc176e475e))
* **player:** apply per-podcast speed and skip-intro to queue playback ([95484fb](https://github.com/sagefromtheeast/Sage-Pod/commit/95484fb3c0b78e676cf2ea8414a57060c5b6d43f))
* **player:** make the sleep timer follow playback, not the wall clock ([75dae30](https://github.com/sagefromtheeast/Sage-Pod/commit/75dae30b3a1ac462031c79c812458a0a8032332a))
* **player:** rewind on every resume, scaled by how long it was paused ([ff41a7e](https://github.com/sagefromtheeast/Sage-Pod/commit/ff41a7e437d99715187192005ee713368e4390c2))
* **player:** rewind only on real resumes, including lock-screen ones ([01f580b](https://github.com/sagefromtheeast/Sage-Pod/commit/01f580bdfae4d77bcc2bf65157b431d065f10844))
* **queue:** take an episode out of the inbox whenever it is queued ([40a0350](https://github.com/sagefromtheeast/Sage-Pod/commit/40a0350f76c6dcddde7e03a06edfc87293ea29ad))

### ♻️ Refactoring

* **db:** one inbox-dismiss rule, used by every enqueue path ([c6323e3](https://github.com/sagefromtheeast/Sage-Pod/commit/c6323e3d7738bbf28d9a21f76984085858c52b1d))

### 📚 Documentation

* add lead-developer handover, decision log, parity plan and TASKS ([9fd8560](https://github.com/sagefromtheeast/Sage-Pod/commit/9fd856036b08044a5ed7ee6c99d2a7dd202fc729))
* merge phase PRs with a merge commit so their fix/feat commits release ([ff626dd](https://github.com/sagefromtheeast/Sage-Pod/commit/ff626dd64bbc3e9081b3e7d6f02a6dbe0eee2662))
* record the web-shim scope decision and tick the inbox clean-up ([8dea72e](https://github.com/sagefromtheeast/Sage-Pod/commit/8dea72e71fa7452fc1a42f524d38547a654d6007))

### 📦 Build & Dependencies

* add a web screenshot harness for before/after comparisons ([0ddb762](https://github.com/sagefromtheeast/Sage-Pod/commit/0ddb7625005b44ea578009e303a1c5469fe1d29c))
* keep web-only screenshot packages in devDependencies ([e199e69](https://github.com/sagefromtheeast/Sage-Pod/commit/e199e69ec1a9b4fce7753487ab2a8cb77846b503))
* **shots:** fail on page errors; diff the union of before and after ([9247ebf](https://github.com/sagefromtheeast/Sage-Pod/commit/9247ebf8212207cfcc1771cbda7f91676b9388f4))

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
