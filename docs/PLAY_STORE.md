# Publishing GPS Camera on Google Play

## 1. Before the first upload

- [ ] **Back up the upload key.** Copy `android/app/release.keystore` and `android/keystore.properties`
      to a password manager or encrypted drive, off this machine. Both are git-ignored on purpose.
- [ ] **Package name.** `com.gpslocationcamera` (in `android/app/build.gradle`) is permanent once uploaded.
      Change it now if you want something tied to you, e.g. `com.somdevsheel.gpscamera`.
- [ ] **Privacy policy URL.** Replace `CONTACT_EMAIL` in `docs/privacy-policy.html`, push, then enable
      GitHub Pages (repo Settings → Pages → Deploy from branch → `main` / `/docs`). The URL will be
      `https://somdevsheel.github.io/gps-camera/privacy-policy.html`. The repo must be public for free Pages.
- [ ] **Build the bundle:** `cd android && ./gradlew bundleRelease`
      → `android/app/build/outputs/bundle/release/app-release.aab`. Play needs the `.aab`, not the `.apk`.
- [ ] **Raise `versionCode`** in `android/app/build.gradle` before every later upload.

## 2. Play Console setup

1. Create a developer account at https://play.google.com/console (one-time US$25, identity verification).
2. **Create app** → name "GPS Camera", app, free.
3. **Play App Signing**: accept the default (Google holds the app signing key). Your
   `release.keystore` becomes the *upload key*; if it is ever lost, Google can reset it.
4. Fill in **App content** (answers below), **Store listing**, then upload the `.aab` to
   **Testing → Closed testing**.

### New personal accounts: 12 testers for 14 days

Personal accounts created after 13 Nov 2023 must run a **closed test with at least 12 testers opted in
continuously for 14 days** before **Production** can be requested from the Dashboard.
Add testers by email list or Google Group, share the opt-in link, and keep them installed for the full 14 days.

## 3. Store listing (draft)

**App name** (≤30): `GPS Camera: Location Stamp`

**Short description** (≤80):
`Stamp photos with GPS coordinates, address, date and time. No account needed.`

**Full description** (≤4000):

```
GPS Camera adds a clear, readable stamp to every photo: coordinates, street address, date, time,
altitude, accuracy and compass direction. Built for site surveys, field work, inspections,
deliveries and travel records.

WHAT'S ON THE STAMP
• Latitude and longitude in decimal or degrees/minutes/seconds
• Street address (optional)
• Date and time in your preferred format
• GPS accuracy, altitude, speed and compass heading
• Optional map thumbnail, company name, project name and note
• Four stamp styles, top or bottom placement, three text sizes

VERIFIED CAPTURE
Turn on Verified Capture to take a fresh GPS fix at the moment of capture and record a SHA-256
fingerprint of each photo. Re-check a photo any time to see whether the file has changed since it
was taken. Approximate or mock locations are never marked verified.

PRIVATE BY DESIGN
• No account, no ads, no analytics
• Photos and records stay on your phone
• Optional EXIF metadata and gallery export
• Address lookup and map stamp can be turned off

Works offline: coordinates and time are stamped even without a connection.
```

**Category:** Photography. **Tags:** camera, GPS, location, maps.

**Graphics you still need to make:**

| Asset | Size | Source |
|---|---|---|
| App icon | 512×512 PNG | `docs/store/icon-512.png` |
| Feature graphic | 1024×500 PNG/JPG | `docs/store/feature-graphic.png` (source: `feature-graphic.html`) |
| Phone screenshots | 2–8, e.g. 1080×1920 | take on a device: camera HUD, stamped preview, gallery, details, settings |

## 4. App content answers (suggested; review each against the current form)

- **Privacy policy:** the GitHub Pages URL above.
- **Ads:** No.
- **App access:** All functionality available without special access.
- **Content rating questionnaire:** category "Utility, Productivity, Communication, or Other";
  answer No to violence, sexual content, gambling, controlled substances; No to user-to-user
  interaction (sharing goes through the system share sheet). Expect an "Everyone" rating.
- **Target audience:** 18+ (or 13+). Avoid ages under 13, which brings in the Families policy.
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** No.

### Data safety

| Question | Answer |
|---|---|
| Collects or shares user data? | Yes (location leaves the device for address lookup / map tiles) |
| Encrypted in transit? | Yes |
| Users can request deletion? | Data is on-device only; captures can be deleted in the app |
| **Location → Precise location** | Collected: Yes. Shared: No (sent to service providers on the app's behalf). Processed ephemerally: Yes. Required or optional: Optional. Purpose: App functionality |
| **Photos and videos** | Not collected (never leave the device unless the user shares them) |
| Everything else (personal info, contacts, identifiers, app activity, crash logs…) | Not collected |

The in-app privacy text (Settings → Privacy, permission screen) matches these answers; keep them
in sync if network features change.

### Permissions declarations

Only foreground location, camera and legacy storage (≤ Android 9) are requested, so no
background-location or "All files access" declarations are needed.

## 5. Already verified in this build

- Target SDK 36 and 64-bit native code (arm64-v8a, x86_64), both required by Play.
- All native libraries are 16 KB page-aligned (required for apps targeting Android 15+).
- Release build signed with a dedicated upload key, not the debug key.
- Schema migrations in place so database changes in future updates don't break existing installs.
- OpenStreetMap attribution is drawn on the map thumbnail, as its licence requires.
