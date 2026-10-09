## [0.21.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.20.0...v0.21.0) (2026-10-09)

### 🚀 New Features

* **player:** chapters stored in MP3 and M4A files ([64e2305](https://github.com/sagefromtheeast/Sage-Pod/commit/64e2305a9d1d296e8504cfa442dd8e11b03288c6))

### 🐛 Bug Fixes

* **player:** read only title-sized MP4 chapter samples ([1a3cf6b](https://github.com/sagefromtheeast/Sage-Pod/commit/1a3cf6b96e1f09804aabad478f859321455c40e9))

### 📚 Documentation

* Phase 18b decision (D-027), tasks and handover ([c758373](https://github.com/sagefromtheeast/Sage-Pod/commit/c758373ec11fe9ddbcacb42259c6eebc81c7017c))

## [0.20.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.19.0...v0.20.0) (2026-10-09)

### 🚀 New Features

* **player:** Quick Settings tile to play and pause ([4f28ea2](https://github.com/sagefromtheeast/Sage-Pod/commit/4f28ea26574fb1e39a9eb746660da0dd162be3ce))
* **widget:** Android home-screen player widget ([c7813d1](https://github.com/sagefromtheeast/Sage-Pod/commit/c7813d138a6525da01fb808f208aeaf06ead7f59))

### 🐛 Bug Fixes

* **player:** let media controllers connect to the playback service ([361808d](https://github.com/sagefromtheeast/Sage-Pod/commit/361808d17e7008bffd5e5d9c2801a158d974c7aa))
* register the widget and background tasks from the app entry ([ea0e015](https://github.com/sagefromtheeast/Sage-Pod/commit/ea0e0158dc04337dfd236cf29d35e8a590fd0c37))
* **widget:** fit the controls in a one-row widget ([6b062dd](https://github.com/sagefromtheeast/Sage-Pod/commit/6b062ddc9225f7b035598c34e2f64023b20bfebe))

### 📚 Documentation

* Phase 18a decision (D-026), tasks and handover ([938078b](https://github.com/sagefromtheeast/Sage-Pod/commit/938078bd8d2ec7a344cecf496c7bf2ad44c5822f))

### 📦 Build & Dependencies

* drop Gradle outputs from the expo-audio patch ([3de9a19](https://github.com/sagefromtheeast/Sage-Pod/commit/3de9a19d4bbec4de12ae7d991d91567eaccc49c5))

## [0.19.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.18.0...v0.19.0) (2026-10-09)

### 🚀 New Features

* **player:** lock-screen skip amounts and Next, skip silence, volume boost ([433b7ac](https://github.com/sagefromtheeast/Sage-Pod/commit/433b7acb594fe66067fa0f12851e2d10419c4612))

### 🐛 Bug Fixes

* **player:** bind the volume boost to the player's own audio session ([dcda4be](https://github.com/sagefromtheeast/Sage-Pod/commit/dcda4beff1f318855e0fc678272cdc9e46fb8768))

### 📚 Documentation

* Phase 17b decision (D-025), tasks and handover ([00d2301](https://github.com/sagefromtheeast/Sage-Pod/commit/00d2301dcf3e582b2787372858778b4bb2439fea))

### 📦 Build & Dependencies

* patch expo-audio and build it from source ([530aa4f](https://github.com/sagefromtheeast/Sage-Pod/commit/530aa4fc7dc75935bb7ba708d965a09432954fc2))

## [0.18.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.17.0...v0.18.0) (2026-10-09)

### 🚀 New Features

* **background:** background refresh and automatic backup every 3 days keeping 5 ([65d9f71](https://github.com/sagefromtheeast/Sage-Pod/commit/65d9f7187dc966a40583bb60c5bfa37cfae5a0b2))
* **downloads:** automatic downloads only while charging ([69bbb35](https://github.com/sagefromtheeast/Sage-Pod/commit/69bbb35dbc61c17411a26077d0a7f7b247542e72))
* **episode:** share a downloaded episode's audio file ([aa986d2](https://github.com/sagefromtheeast/Sage-Pod/commit/aa986d2d4206bb85f8d3126befb578126ec36ef3))
* **feeds:** username and password for protected feeds, kept in secure storage ([384792f](https://github.com/sagefromtheeast/Sage-Pod/commit/384792f32a2fe966130be246b70c7d1de6583ec1))
* **links:** open itpc, pcast, feed and podcast links in Add podcast ([4e63955](https://github.com/sagefromtheeast/Sage-Pod/commit/4e639558d3e6f73720b5a72ddfdde684dbf48f43))
* **notify:** new-episode, refresh-error and download-error notifications ([682dd73](https://github.com/sagefromtheeast/Sage-Pod/commit/682dd7335a9cf903167cf66adedb61903ab6cae5))

### 🐛 Bug Fixes

* **downloads:** retry automatic downloads held back for Wi-Fi or charging ([f791b73](https://github.com/sagefromtheeast/Sage-Pod/commit/f791b73f55e591a0842a5517b88a82ef2e8a54d3))
* **feeds:** send a typed login only to the host that asked for it ([7551f2b](https://github.com/sagefromtheeast/Sage-Pod/commit/7551f2bd9b2b238949e60ca235ed62213775a1d1))

### 📚 Documentation

* Phase 17a decisions (D-024), tasks and handover ([1d7d309](https://github.com/sagefromtheeast/Sage-Pod/commit/1d7d3091f0fbd710339cfce655b6db51e70fa451))

### ✅ Tests

* **shots:** notifications, charging and podcast login screens ([f2e8eb7](https://github.com/sagefromtheeast/Sage-Pod/commit/f2e8eb777a9c729e2bf15bcbf75b51349e8c5df8))

### 📦 Build & Dependencies

* **deps:** add Expo notifications, background task, sharing, secure store and battery ([4b5dca3](https://github.com/sagefromtheeast/Sage-Pod/commit/4b5dca301bd68bc480a90a69283ca235cfa72bea))

## [0.17.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.16.0...v0.17.0) (2026-10-09)

### 🚀 New Features

* **backup:** database export and restore through SQLite's backup API ([360e54e](https://github.com/sagefromtheeast/Sage-Pod/commit/360e54e55862305c7ac9a258666d731dae15cfdd))
* **backup:** export file names, HTML exports and the backup check ([cbbe13c](https://github.com/sagefromtheeast/Sage-Pod/commit/cbbe13cacf1d50530075293cc5bb743fda687fee))
* **settings:** database backup and restore, OPML, HTML and favourites exports ([623cf51](https://github.com/sagefromtheeast/Sage-Pod/commit/623cf5127f15b8e338e0618b6f29b5aeb1216cc0))

### 🐛 Bug Fixes

* **backup:** check and migrate a backup before it replaces anything ([83c704d](https://github.com/sagefromtheeast/Sage-Pod/commit/83c704dab5513082249d195cadfc94ad9f75ddc0))
* **backup:** replace the same day's export on iOS instead of failing ([1081286](https://github.com/sagefromtheeast/Sage-Pod/commit/1081286f4c65f711168bdec0935e78e14c7fba2b))

### 📚 Documentation

* record Phase 16 backup decisions (D-023) and progress ([6981681](https://github.com/sagefromtheeast/Sage-Pod/commit/6981681c814bda6178c3aa96a3a19304612e710e))

## [0.16.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.15.0...v0.16.0) (2026-10-09)

### 🚀 New Features

* **feed:** show the guessed release schedule on the podcast info page ([03da09b](https://github.com/sagefromtheeast/Sage-Pod/commit/03da09bed4858ae8215efc0fa34105c074463a55))
* **stats:** statistics grouping, release schedule guess and queries ([2d85a87](https://github.com/sagefromtheeast/Sage-Pod/commit/2d85a87dd0e13469993316ea2588f1c1a80be446))
* **stats:** Subscriptions, Years and Downloads tabs with charts ([802d984](https://github.com/sagefromtheeast/Sage-Pod/commit/802d984ced4832d05d781e244da477238863fcc5))

### 🐛 Bug Fixes

* **stats:** keep history on reset and count by local day ([d02f1e9](https://github.com/sagefromtheeast/Sage-Pod/commit/d02f1e9f79a35a08fcfbecb93d60cee962f25593))

### ♻️ Refactoring

* **ui:** share one Chip between the podcast page and Statistics ([e2fd6b4](https://github.com/sagefromtheeast/Sage-Pod/commit/e2fd6b43d24c6ef0b4ea066db729ea7890c5f58a))

### 📚 Documentation

* record Phase 15 statistics decisions (D-022) and progress ([7eeda14](https://github.com/sagefromtheeast/Sage-Pod/commit/7eeda14ed11fd449227814fac27d639f4cb92bd1))
* update D-022 after review ([51ad730](https://github.com/sagefromtheeast/Sage-Pod/commit/51ad730a0e25bc260d0ba64a39d737980bb861fb))

## [0.15.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.14.0...v0.15.0) (2026-10-09)

### 🚀 New Features

* **lists:** swipe actions follow Settings, and Episodes and Downloads swipe too ([65790cd](https://github.com/sagefromtheeast/Sage-Pod/commit/65790cd3df90d7d1be96677570a7569377ba6b93))
* **settings:** playback, download and display rules for the settings screens ([9dd6179](https://github.com/sagefromtheeast/Sage-Pod/commit/9dd6179e08aeba64655d88bdb1874aa56c63d27c))
* **settings:** split Settings into AntennaPod's pages ([96099bd](https://github.com/sagefromtheeast/Sage-Pod/commit/96099bd72b245d88df3ac8d00abdb34b85ba997e))

### 🐛 Bug Fixes

* **downloads:** every delete honours "Delete removes from queue"; keep undated plays ([bc2cf4c](https://github.com/sagefromtheeast/Sage-Pod/commit/bc2cf4c6084c511f37605085a743e94d2bfe7568))
* **lists:** a toggle swipe shows what it will do; steadier queue rows ([d189c18](https://github.com/sagefromtheeast/Sage-Pod/commit/d189c18fdabdbf743433e42065f66464be507583))
* **player:** smart mark only on stop, keep the reset position, ask before any stream ([92d026a](https://github.com/sagefromtheeast/Sage-Pod/commit/92d026aef0f0e5a771901b0770ba759ebb2d132c))
* **settings:** a close button on the first Settings page ([8652837](https://github.com/sagefromtheeast/Sage-Pod/commit/86528373f62c0ae5e9c587bd453f7e5ef38a1ef9))
* **settings:** reset in one write and leave the playing speed alone ([9ad76f3](https://github.com/sagefromtheeast/Sage-Pod/commit/9ad76f317362d94dcfdd00a91c38fd6bbc0d5722))

### 📚 Documentation

* mark Phase 14 done and record D-021 ([fb8a91f](https://github.com/sagefromtheeast/Sage-Pod/commit/fb8a91f529277cffa7d5a178827b0a8749abc315))

### ✅ Tests

* **shots:** settings pages and the swipe choice sheet ([ebef9b4](https://github.com/sagefromtheeast/Sage-Pod/commit/ebef9b46add38c3aebdc47cd6c186e5aca56659a))

## [0.14.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.13.0...v0.14.0) (2026-10-09)

### 🚀 New Features

* **downloads:** a download log kept across restarts, and manual downloads ask before using mobile data ([225e1ac](https://github.com/sagefromtheeast/Sage-Pod/commit/225e1acc84b4a64bec0fc1762ee0f6c3d6ef0507))
* **downloads:** a Downloads screen with downloads in progress, saved sort, search, delete played and the download log ([2413a60](https://github.com/sagefromtheeast/Sage-Pod/commit/2413a6081c3507b70cc9c2fd80cb2f6a3c812091))

### 🐛 Bug Fixes

* **downloads:** failed downloads can be dismissed, the log sheet is one sheet, and offline failures are logged ([e7c281a](https://github.com/sagefromtheeast/Sage-Pod/commit/e7c281a1da50f8c4fa892ea23a11164c653949a1))

### 📚 Documentation

* mark Phase 13 done and record D-020 ([527337b](https://github.com/sagefromtheeast/Sage-Pod/commit/527337b88ed91bb78631779a5bdc7d0f33798f3b))

### ✅ Tests

* **shots:** Downloads, its search, the download log and a failed entry ([eb39fda](https://github.com/sagefromtheeast/Sage-Pod/commit/eb39fdab02239dc7da485801ac25312c06979482))

## [0.13.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.12.0...v0.13.0) (2026-10-09)

### 🚀 New Features

* **library:** display options, saved sort and filter, tags, archive, error badges, multi-select and an Episodes screen ([b9960b8](https://github.com/sagefromtheeast/Sage-Pod/commit/b9960b8fba37126b4102da51f27b31bc1d797dd9))

### 🐛 Bug Fixes

* **library:** selection stays on screen, archived podcasts stay out of the Inbox, and bulk changes are one write ([a2495be](https://github.com/sagefromtheeast/Sage-Pod/commit/a2495beb8d82ad0b5f528ea2fa89972ed4fcbeb0))

### ♻️ Refactoring

* **library:** library counts, archive state, tag operations and an all-episodes query ([1fdf06c](https://github.com/sagefromtheeast/Sage-Pod/commit/1fdf06c1758d1a107bf10376fc13403619249775))

### 📚 Documentation

* mark Phase 12 done and record D-019 ([d258951](https://github.com/sagefromtheeast/Sage-Pod/commit/d258951bf7b19179e0e9e1ede53c48235d83b96f))
* review with /code-review when the Codex bot is out of quota ([2d65aed](https://github.com/sagefromtheeast/Sage-Pod/commit/2d65aed7949fa5f1f3b54b2eb464624deb3c4c63))

### ✅ Tests

* **shots:** Library display, tag, select, archive, archived podcast and Episodes screens ([32a0506](https://github.com/sagefromtheeast/Sage-Pod/commit/32a0506fb5a072fa985150b2590071d6966ba285))

## [0.12.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.11.0...v0.12.0) (2026-10-09)

### 🚀 New Features

* **discover:** fyyd search, chart country, subscribed marks, feed autodiscovery and OPML file import ([0fe47cf](https://github.com/sagefromtheeast/Sage-Pod/commit/0fe47cfd34a39a246a11beb1709c51fcae23e8cd))
* **search:** search online, multi-select and 300 results in library search, search from Library and Downloads ([a302763](https://github.com/sagefromtheeast/Sage-Pod/commit/a302763b0b5aca1940d9a1202a0bd7ccae4314a8))

### 🐛 Bug Fixes

* **discover:** a repeated "Search online" re-applies its words, and an OPML import finished elsewhere ends with a toast ([b71f222](https://github.com/sagefromtheeast/Sage-Pod/commit/b71f222b6bd3bedb94e0c4c701eec3afa0ef731a))

### 📚 Documentation

* mark Phase 11 done and record D-018 ([e9e9ba4](https://github.com/sagefromtheeast/Sage-Pod/commit/e9e9ba4c28467c64838e1a5d82911d44f1d7af51))

### ✅ Tests

* **shots:** Discover search and country, search select, add by URL, OPML checklist ([e479d3a](https://github.com/sagefromtheeast/Sage-Pod/commit/e479d3ac843943927970112fa28292cd61857d7f))

## [0.11.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.10.0...v0.11.0) (2026-10-09)

### 🚀 New Features

* **podcast-settings:** rename, tags, skip ending, volume reduction, new-episode action, auto-download and auto-delete per podcast ([7e06901](https://github.com/sagefromtheeast/Sage-Pod/commit/7e069015ee25e62f3c1253131c9104c3d4d7ee31))

### 🐛 Bug Fixes

* **podcast-settings:** settings changed mid-episode apply now, and auto-download looks past the newest episodes ([97cf47c](https://github.com/sagefromtheeast/Sage-Pod/commit/97cf47cf35c68f91f58df709ce1ffd16f707e9f3))

### 📚 Documentation

* mark Phase 10 done and record D-017 ([64a1068](https://github.com/sagefromtheeast/Sage-Pod/commit/64a10683bfd355f363a5e886b054c5d982b75263))

### ✅ Tests

* **shots:** podcast settings, top and automation ([ffe683d](https://github.com/sagefromtheeast/Sage-Pod/commit/ffe683d3999f332441924433fb418eae57f69a8c))

## [0.10.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.9.0...v0.10.0) (2026-10-06)

### 🚀 New Features

* **podcast:** preview before subscribing, a real podcast menu, saved filter and sort, search, banners and an info page ([506a98f](https://github.com/sagefromtheeast/Sage-Pod/commit/506a98f431e61917270a8c24ac866188f1f49dbd))

### 🐛 Bug Fixes

* **podcast:** subscribing a preview always succeeds, and refreshing a preview never fills the Inbox ([ab8268b](https://github.com/sagefromtheeast/Sage-Pod/commit/ab8268be4d7e01b624c1ae1a6b4ee2e922fd4b9a))

### 📚 Documentation

* mark Phase 9 done and record D-016 (preview retention) ([3b1caa4](https://github.com/sagefromtheeast/Sage-Pod/commit/3b1caa4ac412708845a7addc4477b2d2ec9277a5))

### ✅ Tests

* **shots:** podcast filter, applied filter, info page, refresh-failed banner and preview ([12651c3](https://github.com/sagefromtheeast/Sage-Pod/commit/12651c3026981ae64f34b313cb97afab9250146f))

### 📦 Build & Dependencies

* **deps:** take Expo SDK 57's latest patch releases ([2e9f778](https://github.com/sagefromtheeast/Sage-Pod/commit/2e9f7783e3443a7bdce0cf22def5f8d831d0d8de))

## [0.9.0](https://github.com/sagefromtheeast/Sage-Pod/compare/v0.8.0...v0.9.0) (2026-10-06)

### 🚀 New Features

* **episode:** menu, inline show-note links, smarter timestamps, copy titles and swipe between episodes ([d087845](https://github.com/sagefromtheeast/Sage-Pod/commit/d08784597de171beb464a985632226f8f16403cf))

### 🐛 Bug Fixes

* **episode:** keep brackets that belong to links, stay on the same page after rotating, and allow reset for replayed episodes ([e561c4d](https://github.com/sagefromtheeast/Sage-Pod/commit/e561c4d04eaa535690e734719df13cc59b6bbe61))

### 📚 Documentation

* mark Phase 8 done and record D-015 (episode pager) ([73478f6](https://github.com/sagefromtheeast/Sage-Pod/commit/73478f6f826b9dcff1b017ba7f36486e31958d36))

### ✅ Tests

* **shots:** episode menu and a real swipe to the next episode ([155ca91](https://github.com/sagefromtheeast/Sage-Pod/commit/155ca910f6d8d88e620c6bed640b150b45be5659))

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
