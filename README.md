# GPS Location Camera

An Android camera app that burns verified GPS coordinates, address, timestamp
and compass heading permanently into the captured photo, with an optional
tamper-evident capture record. Offline-first: everything except address lookup
and map tiles works with no network at all.

---

## 1. Status

| Area | State |
| --- | --- |
| TypeScript app layer | Complete, `tsc --noEmit` clean, ESLint 0 errors |
| Native Kotlin modules | Complete (location, compass, geocoder, image/stamp, media) |
| Android Gradle build | **Not yet compiled** — see §2 |

The JavaScript layer has been type-checked and linted. The Android build has
**not** been run, because the environment this was authored in has no Android
SDK and no access to Google's Maven repository. Everything else was verified.
Treat §7 as the list of things to check on your first `run-android`.

---

## 2. Setup

Requirements: Node ≥ 22.11, JDK 17+, Android SDK 36 with build-tools 36.0.0 and
NDK 27.1.12297006, a physical device (the camera, GPS and magnetometer are all
real hardware — an emulator only partly works).

```bash
npm install
npx react-native start          # terminal 1
npx react-native run-android    # terminal 2
```

Release build:

```bash
cd android && ./gradlew assembleRelease
```

Codegen for the TurboModule specs runs automatically as part of the Gradle
build, driven by the `codegenConfig` block in `package.json`. If you change a
file under `src/specs/`, rebuild the Android project so the generated
`com.gpslocationcamera.specs.Native*Spec` base classes are regenerated.

---

## 3. Architecture

```
src/
  specs/          TurboModule contracts (TypeScript -> generated Kotlin base classes)
  services/
    location/     LocationManager streaming + one-shot fixes
    geocoding/    Provider interface + on-device Android Geocoder + LRU cache
    compass/      Rotation-vector heading
    image/        Stamp construction and burn-in
    hashing/      SHA-256 over file bytes
    map/          Optional static map tiles (the only network call)
    media/        MediaStore export, share sheet, clipboard, maps hand-off
    camera/       CaptureService — the end-to-end pipeline
    permissions/  Runtime permission handling
  database/       SQLite schema + capture repository
  store/          Zustand stores (settings, GPS, captures)
  hooks/          Location/compass/geocode subscriptions with throttling
  components/     Presentational UI
  screens/        Camera, Preview, Gallery, PhotoDetails, Settings
  navigation/     React Navigation stack

android/app/src/main/java/com/gpslocationcamera/
  GpsCameraPackage.kt   Module registration
  LocationModule.kt     LocationManager (no Google Play Services)
  CompassModule.kt      SensorManager + magnetic declination
  GeocoderModule.kt     android.location.Geocoder
  ImageModule.kt        Hashing, stamping, EXIF, map tiles, file I/O
  StampRenderer.kt      Canvas compositing of the overlay
  MediaModule.kt        MediaStore, FileProvider share, clipboard
```

---

## 4. Dependency decisions

**`react-native-geolocation-service` was rejected.** Its last publish was
September 2022 and it is effectively unmaintained. Rather than pin an outdated
package (and definitely rather than downgrade React Native to suit it), location
is implemented natively on `android.location.LocationManager`. That also removes
the Google Play Services dependency entirely, so the app runs on de-Googled
devices and needs no network for positioning.

**VisionCamera 5.x is a Nitro-based redesign** — `usePhotoOutput()` /
`capturePhotoToFile()` / `outputs={[...]}`, not v4's `takePhoto()`. The camera
screen targets the v5 API.

**MMKV v4** replaced `new MMKV()` with `createMMKV()` and `delete()` with
`remove()`. Handled.

Compass, reverse geocoding, stamping, EXIF and hashing are native because no
maintained React Native library does them reliably — in particular there is no
library that burns an overlay into the exported pixels.

Installed: `react-native-vision-camera` 5.2.1 (+ `nitro-modules`,
`nitro-image`), `react-native-mmkv` 4.3.2, `@op-engineering/op-sqlite` 17.1.4,
`zustand` 5.0.14, React Navigation 7, `react-native-screens` 4,
`react-native-safe-area-context` 5.

---

## 5. Behaviour worth knowing

**Coordinates are never invented.** If there is no fix, the stamp reads
"Location unavailable" rather than omitting the section — a stamped photo can
never imply a position it does not have. A coarse-only permission grant is
labelled as such, on screen and in the stamp.

**Capture is never blocked by an optional step.** Reverse geocoding is
time-boxed at 5 s, map tiles at 6 s, and both degrade to text-only. A failed
stamp keeps the unmodified photo. Every degradation is surfaced as a warning on
the Preview screen.

**Verified capture mode** takes a *fresh* fix at the moment of capture (up to
8 s), hashes the original, produces the stamped image, hashes that too, and
stores both digests. The `gps-verified` label is only written when the fix was
fresh, fine-grained and not mocked — otherwise the record is `unverified`.
Re-checking integrity later re-hashes the file; a mismatch is recorded as
`tampered` rather than silently corrected.

**Performance.** Location updates are buffered in a ref and flushed to the store
once per second, so a 1 Hz GPS stream does not re-render the HUD on every tick —
the buffer always holds the newest value, so throttling costs render frequency,
never accuracy. Reverse geocoding is guarded by an LRU cache plus
minimum-movement (40 m) and minimum-interval (15 s) checks. Hashing, bitmap
decoding, stamping and JPEG encoding all run on background executors in Kotlin.
The camera session, GPS stream and sensors are torn down whenever the screen
loses focus or the app backgrounds.

**Privacy.** No analytics, no ads, no tracking SDKs, no account, no upload.
Photos, coordinates and capture records never leave the device. The single
network call is the optional OSM map tile fetch, isolated behind
`StaticMapProvider` in `src/services/map/MapService.ts` so it can be swapped or
deleted. Reverse geocoding uses the on-device `Geocoder`, behind
`ReverseGeocodeProvider`.

---

## 6. Testing checklist

Behaviour that is worth exercising on a real device:

1. **Cold start** — permission rationale appears before the system dialogs.
2. **Deny location, allow camera** — capture still works; stamp says location
   unavailable; a banner offers to grant.
3. **Grant approximate only** (Android 12+) — HUD and stamp both flag it, and
   verified capture refuses to label it `gps-verified`.
4. **Location off in system settings** — banner with a shortcut to settings;
   toggling it back on resumes the stream without restarting the app.
5. **Airplane mode** — coordinates, timestamp, compass, stamp, gallery, hashing
   and verification all still work; address degrades to "unavailable".
6. **Indoors** — GPS phase moves to `timeout` after 45 s with a "move to an open
   area" hint; capture is never blocked.
7. **Rapid double-tap on the shutter** — the second tap is ignored (guarded by a
   ref, not by state).
8. **Background mid-capture** — the session stops, the torch turns off.
9. **Rotate zoom presets / flash / front camera** — no crash, torch resets.
10. **Verified capture** — Details screen shows both SHA-256 digests; edit the
    file externally and re-check to see `tampered`.
11. **Share / open in maps / copy coordinates** from Preview and Details.
12. **Delete** — file and record both disappear; gallery count updates.
13. **Device with no magnetometer** — direction is hidden, nothing crashes.

---

## 7. Known risks (unverified — check these first)

Because the Android build has not been compiled, these are the areas I would
verify before anything else:

1. **TurboModule codegen registration.** The Kotlin classes extend generated
   `Native*Spec` base classes. If a generated signature differs (for example
   `getCurrentPosition(ReadableMap, Promise)`), the override will fail to
   compile and the fix is mechanical — match the generated abstract method.
   Generated sources land in
   `android/app/build/generated/source/codegen/java/com/gpslocationcamera/specs/`.
2. **`ReactContext.emitDeviceEvent`.** Used for location and compass events. If
   the bridgeless API differs on this RN version, swap for the
   `RCTDeviceEventEmitter` JS module; the JS side listens on `DeviceEventEmitter`
   either way and needs no change.
3. **VisionCamera 5 preview/output wiring** — v5 is very new, so confirm the
   preview renders and `capturePhotoToFile` returns a readable path.
4. **`androidx.exifinterface` version pin** (1.3.7) against compileSdk 36.
5. **Stamp layout on extreme aspect ratios** — the panel is capped at 42% of
   image height; check a 16:9 and a 1:1 capture.

Nothing in the app is designed to fail hard if one of these does: every optional
subsystem degrades and reports a warning instead of crashing.
