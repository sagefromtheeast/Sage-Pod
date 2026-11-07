# Making the repository public

The repository is ready to be public: it has a licence (GPL-3.0-or-later),
contributor and security policies, issue and PR templates, Dependabot and
CodeQL, and its history was swept for secrets (none found). These steps are
repository **settings**, so the owner does them on GitHub.

## Before flipping the switch

- [ ] Replace every `SUPPORT_EMAIL` placeholder (`PRIVACY.md`, `SECURITY.md`,
      `CODE_OF_CONDUCT.md`) and merge.
- [ ] Accept that history is public as it is: 5 early commits carry the
      owner's personal email address as author (decided 7 Nov 2026 not to
      rewrite history).
- [ ] Check the EAS project's secrets stay in EAS (Expo dashboard ›
      Environment variables); nothing in the repository depends on them.

## Make it public

Settings › General › Danger Zone › **Change visibility** › Public.

## Right after

Settings › **Code security**:

- [ ] Dependency graph: on.
- [ ] Dependabot alerts and Dependabot security updates: on.
- [ ] Secret scanning and **push protection**: on.
- [ ] Private vulnerability reporting: on (`SECURITY.md` points to it).
- [ ] Code scanning: the `CodeQL` workflow starts running by itself once the
      repository is public.

Settings › **Rules › Rulesets** › New branch ruleset for `main`:

- [ ] Restrict deletions; block force pushes.
- [ ] Require a pull request before merging (0 approvals is fine while you
      are the only maintainer), allow **merge commits** only (releases read
      each commit subject; squash would break that).
- [ ] Require status checks: `checks` (and `CodeQL` once it has run).
- [ ] Add the semantic-release bot as a bypass actor, or the release commit
      (`chore(release): x.y.z`) can't be pushed to `main`. If the ruleset
      blocks it, the release workflow needs a GitHub App or a fine-grained
      token with bypass rights instead of `GITHUB_TOKEN`.

Settings › **Actions › General**:

- [ ] Fork pull request workflows: require approval for first-time
      contributors.
- [ ] Workflow permissions: **Read repository contents** by default (each
      workflow already asks for what it needs).

Settings › General:

- [ ] Features: Issues on; Discussions optional.
- [ ] Pull requests: allow merge commits; untick squash and rebase merging.
- [ ] Add a description, the website (Play listing once live) and topics
      such as `podcast`, `react-native`, `expo`, `android`, `antennapod`.
