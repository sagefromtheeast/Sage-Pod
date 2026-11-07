# Publishing on Google Play

Everything Google Play asks for, ready to paste. Expo can build and upload
the app (`eas build`, `eas submit`), but the Play listing itself is created
in the Play Console by the account owner, and the **first** build must be
uploaded there by hand.

## What is in the repository

| Play Console field | File |
|---|---|
| App name (30 chars) | `fastlane/metadata/android/en-US/title.txt` |
| Short description (80) | `fastlane/metadata/android/en-US/short_description.txt` |
| Full description (4000) | `fastlane/metadata/android/en-US/full_description.txt` |
| App icon 512 × 512 | `fastlane/metadata/android/en-US/images/icon.png` |
| Feature graphic 1024 × 500 | `fastlane/metadata/android/en-US/images/featureGraphic.png` |
| Phone screenshots (8) | `fastlane/metadata/android/en-US/images/phoneScreenshots/` |
| 10-inch tablet screenshots (4) | `fastlane/metadata/android/en-US/images/tenInchScreenshots/` |
| Privacy policy | [`PRIVACY.md`](../PRIVACY.md) |

The layout is the one `fastlane supply` and F-Droid read. After a UI change,
regenerate the images from the screenshot harness:

```bash
npm run shots -- after
python3 tool/store_assets.py    # needs Pillow
```

## Before the first submission

1. **Fill in the support email.** Replace every `SUPPORT_EMAIL` in
   `PRIVACY.md`, `SECURITY.md` and `CODE_OF_CONDUCT.md` with a real address,
   and merge.
2. **Make the repository public** (see [`GOING-PUBLIC.md`](GOING-PUBLIC.md)),
   so the privacy policy has a public URL:
   `https://github.com/sagefromtheeast/Sage-Pod/blob/main/PRIVACY.md`.
3. **Google Play developer account**: <https://play.google.com/console>
   (one-time US$25 fee, identity verification). Personal accounts created
   after November 2023 must run a **closed test with at least 12 testers for
   14 days** before they can publish to production.

## Create the app in Play Console

1. **Create app**: name "Sage Pod: Podcast Player", default language English
   (United States), App, Free.
2. **Main store listing**: paste the texts and upload the graphics above.
   Category: **Music & Audio**. Tags: Podcasts. Contact email: your support
   address. Website: the GitHub repository.
3. **App content** (Policy › App content):
   - **Privacy policy**: the `PRIVACY.md` URL above.
   - **Ads**: No, the app contains no ads.
   - **App access**: All functionality is available without special access
     (no login).
   - **Content rating**: questionnaire category *Reference, News, or
     Educational*, or *All other app types*. Answer **No** to violence,
     sexuality, language, controlled substances and gambling. **User
     interaction / user-generated content: No** (the app shows third-party
     podcast feeds the user subscribes to, but has no social features, chat,
     or sharing between users). Expected result: PEGI 3 / Everyone.
   - **Target audience**: 13 and over (pick only adult/teen age groups so
     the Families policy does not apply).
   - **News app**: No.
   - **Data safety**: see below.
   - **Government app / Financial features / Health**: No.
4. **Data safety** (answers based on [`PRIVACY.md`](../PRIVACY.md)):
   - Does your app collect or share any of the required user data types?
     **No.**
   - Is all of the user data collected by your app encrypted in transit? Not
     applicable when nothing is collected. Note that podcast feeds and media
     can be plain HTTP; that is traffic to the podcast's own host, at the
     user's request, and not data the developer collects.
   - Do you provide a way for users to request that their data is deleted?
     Not applicable: nothing is held off the device. Uninstalling deletes it.

   Google's definitions count data as "collected" only when it is sent off
   the device to the developer or a third party. Search terms sent to Apple's
   and fyyd's search APIs are user-initiated requests to a service the user
   is visibly using; review Google's current wording before submitting, and
   if in doubt declare "App activity › Other actions: search history",
   *shared*, *not collected by you*, *processed ephemerally*. **[VERIFY at
   submission time]**

## Build and upload

1. **Production build** (Android App Bundle, signed with the EAS-managed key):
   `eas build --platform android --profile production`
   (or the Expo dashboard / MCP `build_run`). The version and versionCode come
   from the latest release (`tool/set_app_version.sh`), never from EAS.
2. **First upload, by hand**: Play Console › Testing › Internal testing ›
   Create release › upload the `.aab` from the build page. Accept **Play App
   Signing** (Google holds the app signing key; EAS's key becomes the upload
   key).
3. **Later uploads with EAS Submit**:
   - In Google Cloud, create a service account with access to the Play
     Developer API, and invite it in Play Console › Users and permissions
     with release rights.
   - Upload its JSON key to EAS (`eas credentials` › Android › Google Service
     Account Key). **Never commit the key.**
   - `eas submit --platform android --profile production --latest` uploads
     to the **internal** track as a **draft** (`eas.json`). Promote it in
     Play Console after testing.

## Over-the-air updates for Play users

Production builds use the `production` update channel. The "Publish OTA
update" workflow publishes only to `preview`, so store users get changes
only through new store builds until a production update job is added
deliberately (that would ship JavaScript to store users without Play review
of each change).
