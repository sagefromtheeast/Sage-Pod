# Contributing to Sage Pod

Thanks for helping. Sage Pod is a local-first podcast player aiming at
[AntennaPod](https://github.com/AntennaPod/AntennaPod) parity in a React
Native + Expo app. Bug reports, feature ideas, docs and code are all welcome.

## Before you start

- **Bugs and ideas:** open an issue with the matching template. For a bug,
  include the app version (Settings › About), your device and Android/iOS
  version, and the feed address if a particular podcast triggers it.
- **Security problems:** see [`SECURITY.md`](SECURITY.md). Don't open a public
  issue.
- **Bigger changes:** open an issue first so we can agree on the approach.
  Settled decisions live in [`docs/DECISIONS.md`](docs/DECISIONS.md), and the
  roadmap in [`TASKS.md`](TASKS.md) and
  [`docs/PARITY-PLAN.md`](docs/PARITY-PLAN.md).

## Setting up

Node 22+ is required.

```bash
npm install
npm start                    # Metro, for Expo Go or a development build
npx expo prebuild --clean    # native projects, for a development build
npx expo run:android         # or run:ios
```

Playback, downloads in the background, the widget and notifications need a
development build; most screens work in Expo Go.

## Code conventions

[`AGENTS.md`](AGENTS.md) is the short version for humans and AI agents alike:

- Imports use the `@/` alias for `src/`.
- Database access goes through a repository in `src/db/`, never raw SQL in a
  screen. Screens re-render from SQLite change events via `useQuery`.
- Colours, spacing and type come from `src/ui/theme.ts`. No hard-coded colours
  in screens.
- Logic worth testing goes in a pure module with a `node:test` suite in a
  `__tests__` folder next to it.
- Format new files with Prettier:
  `npx prettier --single-quote --print-width 120 --trailing-comma es5 --write <files>`.

## Commits drive releases

Releases are cut automatically from commit messages, so each commit subject
follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: …` a new feature (minor release)
- `fix: …` or `perf: …` a bug fix (patch release)
- `feat!: …` or a `BREAKING CHANGE:` footer (major release)
- `docs`, `chore`, `ci`, `refactor`, `test`, `style`, `build`: no release

Pull requests are merged with a merge commit, so every commit subject reaches
`main`; the PR title doesn't need a prefix. Never edit version numbers by hand.

## Checks before a pull request

```bash
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform android
```

If you change a screen, add before and after screenshots
([`shots-tool/README.md`](shots-tool/README.md)):

```bash
npm run shots -- before      # on main
npm run shots -- after       # on your branch
npm run shots:diff
```

## Licence

Sage Pod is licensed under the GNU GPL, version 3 or later. By submitting a
contribution you agree that it is licensed under the same terms.
