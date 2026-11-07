# Store screenshots

Device-framed screenshots with a caption, ready to upload. Made by
`tool/store_mockups.py` from screens captured at store resolution:

```bash
SHOTS_SCALE=2.5 npm run shots -- store
python3 tool/store_mockups.py      # needs Pillow
```

| Folder | Size | Where it goes |
|---|---|---|
| `google-play/phone/` | 1080 × 1920 | Play Console › Main store listing › Phone screenshots |
| `google-play/tablet/` | 2560 × 1600 | 7-inch and 10-inch tablet screenshots |
| `app-store/iphone/` | 1290 × 2796 | App Store Connect › iPhone 6.9" display |
| `app-store/ipad/` | 2064 × 2752 | App Store Connect › iPad 13" display |

Upload them in file-name order: the first two or three are the ones people
see in search results.

The device frames are generic (drawn by the script, not a maker's design),
and every screen is the real app with the screenshot harness's demo data.
The captions use the website's copy; edit `PHONE` and `TABLET` in the script
to change them.

The plain, unframed screenshots in `fastlane/metadata/android/en-US/images/`
stay as they are; use one set or the other on Play, not both.
