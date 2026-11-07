# Privacy policy

_Last updated: 7 November 2026_

Sage Pod is a podcast player for Android and iOS, published as free software
under the GNU GPL by its developer (contact: **faithsoul.feed@gmail.com**). This policy
covers the app as published on Google Play and built from this repository.

## The short version

- There is **no account**, no sign-up and no login to Sage Pod.
- There is **no analytics, no advertising and no tracking**. The app contains
  no analytics or advertising SDK.
- Your subscriptions, episodes, listening history, statistics, queue,
  downloads and settings are stored **only on your device**.
- The developer receives **none of your data**.

## What stays on your device

| Data | Where |
|---|---|
| Subscriptions, episodes, queue, favourites, listening history and statistics | A local SQLite database |
| Downloaded episodes | The app's private storage |
| Settings | The local database |
| Usernames and passwords for password-protected feeds | The system keystore (Android Keystore / iOS Keychain) via `expo-secure-store` |
| Backups you export (OPML, database) | Wherever you choose to save them |

Android's own backup ("Back up to Google Drive") may include the app's
database if you turned it on in your phone's settings. Feed passwords are
excluded from that backup. You control that setting, not the app.

## Network requests the app makes

Sage Pod talks to other servers only to do what you ask of it:

| Request | Sent to | What is sent |
|---|---|---|
| Refresh a podcast, download or stream an episode, load artwork and chapters | The podcast's own host (whoever publishes the feed) | A normal web request for that file: your IP address and the app's user agent (`SagePod/…`). For password-protected feeds, the username and password you entered, only to that feed's own host and never over plain HTTP after HTTPS. |
| Search for podcasts and browse charts in Discover | Apple's iTunes Search API (`itunes.apple.com`, `rss.applemarketingtools.com`) and fyyd (`api.fyyd.de`) | Your search words, your IP address |
| Check for app updates | Expo's update service (`u.expo.dev`) | The app version, platform, update channel and an anonymous random installation ID used to serve the right update |
| Open a website, funding link or show-notes link | That website, in your browser | Whatever your browser sends |

The podcast hosts, Apple, fyyd and Expo receive these requests directly and
handle them under their own privacy policies. Podcast hosts commonly log
downloads to count listeners; that is outside the app's control.

## Notifications

New-episode and download notifications are created on your device. The app
does not use a push-notification service.

## Children

Sage Pod is not directed at children and collects no personal information
from anyone.

## Your choices

Uninstalling the app deletes everything it stored. You can also reset
statistics, delete downloads and remove podcasts inside the app.

## Changes

Changes to this policy are made in this file, so its full history is public
in the repository.

## Contact

**faithsoul.feed@gmail.com**, or an issue at
<https://github.com/sagefromtheeast/Sage-Pod/issues>.
