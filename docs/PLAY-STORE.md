# Publishing on Google Play

Everything Google Play asks for, ready to paste. Expo can build and upload
the app (`eas build`, `eas submit`), but the Play listing itself is created
in the Play Console by the account owner, and the **first** build must be
uploaded there by hand.

## What is in the repository

| Play Console field | File |
|---|---|
| Package name (permanent once uploaded) | `com.sagefromtheeast.sagepodplayer` (`android.package` in `app.json`) |
| App name (30 chars) | `fastlane/metadata/android/en-US/title.txt` |
| Short description (80) | `fastlane/metadata/android/en-US/short_description.txt` |
| Full description (4000) | `fastlane/metadata/android/en-US/full_description.txt` |
| App icon 512 × 512 | `fastlane/metadata/android/en-US/images/icon.png` |
| Feature graphic 1024 × 500 | `fastlane/metadata/android/en-US/images/featureGraphic.png` |
| Phone screenshots (8) | `fastlane/metadata/android/en-US/images/phoneScreenshots/` |
| 10-inch tablet screenshots (4) | `fastlane/metadata/android/en-US/images/tenInchScreenshots/` |
| Framed screenshots with captions (phone 8, tablet 4) | `store-assets/google-play/` (see [`store-assets/README.md`](../store-assets/README.md)) |
| Privacy policy | [`PRIVACY.md`](../PRIVACY.md) |

The layout is the one `fastlane supply` and F-Droid read. After a UI change,
regenerate the images from the screenshot harness:

```bash
npm run shots -- after
python3 tool/store_assets.py    # needs Pillow
```

## Before the first submission

1. **Support email**: faithsoul.feed@gmail.com (done; it is in `PRIVACY.md`,
   `SECURITY.md`, `CODE_OF_CONDUCT.md` and on the website).
2. **Privacy policy URL**: `https://sage-pod-site.vercel.app/privacy`. It is
   public even while the repository is private. Keep it in step with
   `PRIVACY.md` when either changes.
3. **Google Play developer account**: <https://play.google.com/console>
   (one-time US$25 fee, identity verification). Personal accounts created
   after November 2023 must run a **closed test with at least 12 testers for
   14 days** before they can publish to production.

## Create the app in Play Console

1. **Create app**: name "Sage Pod: Podcast Player", default language English
   (United States), App, Free.
2. **Main store listing**: paste the texts and upload the graphics above.
   Category: **Music & Audio**. Tags: Podcasts. Contact email: faithsoul.feed@gmail.com.
   Website: https://sage-pod-site.vercel.app
3. **App content** (Policy › App content):
   - **Privacy policy**: the privacy policy URL above.
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

5. **Foreground service permissions** (Policy › App content). Play asks
   for a short video of each one in use; a screen recording uploaded to
   YouTube as *unlisted* is enough.
   - `FOREGROUND_SERVICE_MEDIA_PLAYBACK` › **Media playback**: plays podcast
     episodes the user starts, with the lock-screen and notification
     controls, while the screen is off or another app is open. Video: start
     an episode, lock the phone, use the lock-screen controls.
   - `FOREGROUND_SERVICE_DATA_SYNC` › **Network processing › Other**:
     downloads podcast episodes the user taps Download on (or that
     auto-download fetches for subscribed shows) in the background, with a
     progress notification, so a download finishes when the user leaves the
     app. Video: tap Download on an episode, leave the app, show the
     progress notification finishing.
6. **Health apps**: Sage Pod has no health features. Play asks only because
   `expo-sensors` adds `ACTIVITY_RECOGNITION` for its step counter; Sage Pod
   uses the accelerometer alone (shake to extend the sleep timer), which
   needs no permission. From 0.25.2 the permission is blocked in `app.json`
   (`android.blockedPermissions`); once no active release carries it, the
   Health apps form is no longer required.

## Build and upload

1. **Production build** (Android App Bundle, signed with the upload key stored in EAS):
   `eas build --platform android --profile production`
   (or the Expo dashboard / MCP `build_run`). The version and versionCode come
   from the latest release (`tool/set_app_version.sh`), never from EAS.
2. **First upload, by hand** (done 7 Nov 2026, versionCode 2501): Play Console ›
   Testing › Internal testing › Create release › upload the `.aab`. Google
   holds the app signing key (Play App Signing); the key that signed the first
   upload became the **upload key**.

### Upload key

- Upload key certificate SHA-1: `CB:CF:CF:C7:51:53:20:55:BB:E9:F2:94:94:84:D9:D8:5F:33:AD:5D`
  (`CN=Sage Pod Upload, O=sagefromtheeast`, alias `upload`). The owner holds
  the keystore and password; a copy is in EAS (Credentials › Android ›
  `com.sagefromtheeast.sagepodplayer`). It is never in this repository.
- Every build uploaded to Play must carry that SHA-1. Check before uploading:
  `keytool -printcert -jarfile app.aab | grep SHA1`.
- Why not the keystore EAS generated: Play rejected the EAS-signed bundle as
  "invalid signature" from both a tablet and a laptop, although `jarsigner`
  verified it. That keystore's certificate had empty name fields
  (`CN=, OU=, O=, …`) and its signature files sat at the end of the archive.
  The same bundle, re-signed with `jarsigner` and a key with a real name, was
  accepted. 0.25.2 (versionCode 2502), built by EAS with that named key and
  EAS's usual file order, was accepted too, so the empty certificate name was
  the cause. If a future EAS-generated key is ever needed, check its
  certificate first.
- EAS can hold several Android keystores; the production build uses the
  default one. Before uploading a new build, compare its SHA-1 with the one
  above (a 0.25.2 build signed with a fresh EAS-generated key, SHA-1
  `35:3E:1D:E1:…:1F:34:C4`, had to be rebuilt).
- Lost key: Play Console › App integrity › App signing › Request upload key
  reset, with a new certificate (`.pem`).
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
