# Security policy

## Supported versions

Only the latest release (the newest tag on `main`, and the newest build on
Google Play) gets security fixes.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: on this repository's **Security** tab,
choose **Report a vulnerability**. If that isn't available, email
**faithsoul.feed@gmail.com** with "Sage Pod security" in the subject.

Please include:

- what an attacker could do, and what they need (a malicious feed, a link, a
  network position, physical access…)
- steps or a sample feed that reproduce it
- the app version (Settings › About) and your device

You will get a reply within a week. Fixes ship as a normal release, and you are
credited in the release notes unless you prefer not to be.

## What is in scope

Sage Pod reads content from servers it does not control: podcast feeds,
episode files, artwork, chapter files and links in show notes. Problems in how
it handles that content are in scope, for example:

- a feed, chapter file or show note that crashes the app, runs script, or reads
  or writes files outside the app's storage
- feed passwords leaking: logged, sent to another host, or sent over plain HTTP
- a link (`itpc://`, `podcast://`, `sagepod://`…) that does more than open a
  screen
- a backup file that does more than restore the app's own data

Out of scope: the security of podcast hosts themselves, the content of
podcasts, and attacks that need a rooted or jailbroken device.

## Design notes

- Feed passwords live in the system keystore (`expo-secure-store`) and are sent
  only to the feed's own host, never after a redirect to another host or from
  HTTPS to HTTP.
- Plain HTTP is allowed (`usesCleartextTraffic`) because many podcast feeds and
  media files are still served over it. HTTPS is used whenever a feed offers it.
- Show notes are rendered as text and links, never in a web view.
- The app has no server and no account, so there is no user data held
  anywhere else to breach.
