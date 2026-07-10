# Mobile app setup (Capacitor Android + iOS shells)

The mobile apps are thin Capacitor shells that load the live SSR site
(`resumeflow-ats.com`) in a WebView. See the code that's already in place:

- `capacitor.config.ts` — remote-URL config (appId `com.resumeflowats.app`).
- `mobile-shell/index.html` — offline fallback (the `webDir`).
- `android/` — generated native project.
- `ios/` — generated native project (SPM, no CocoaPods).
- `app/api/auth/mobile/google/route.ts` — mints a NextAuth session from a native
  Google server auth code.
- `lib/nativeAuth.ts` + `components/SignInButton.tsx` — native sign-in bridge.

Google blocks OAuth inside a WebView, so the app signs in with the **native
Google plugin** and the server mints the session cookie. That native sign-in
needs a Google Cloud OAuth client, which is what this doc sets up.

---

## 1. Create the Google Cloud project (account: rama.prayaga@gmail.com)

Sign Chrome into **rama.prayaga@gmail.com** first (the browser account is what's
used). Then:

1. Go to <https://console.cloud.google.com/> → create a new project, e.g.
   **`resumeflow-mobile`**.
2. This is a **separate** project from the existing web-app OAuth credentials
   already wired into Vercel prod. Do NOT touch those.

## 2. Create the Android OAuth client

APIs & Services → **Credentials** → *Create credentials* → *OAuth client ID*:

- Application type: **Android**
- Package name: **`com.resumeflowats.app`**
- SHA-1 certificate fingerprint (debug, from `~/.android/debug.keystore`):

  ```
  00:C3:24:44:FD:D5:B3:FF:E4:EA:23:0D:4F:EE:2F:1C:DD:57:3F:DB
  ```

  > This is the **debug** cert. Before publishing to Play, add the SHA-1 of your
  > **release/upload** key too (and Play App Signing's SHA-1 from the Play
  > Console once the app is uploaded).

You don't paste the Android client ID anywhere in code — Google uses the
package + SHA-1 to authorize the native sign-in UI.

## 3. Reuse the existing Web OAuth client for the code exchange

The native sign-in returns a one-time **server auth code** that our server
redeems using the **Web** OAuth client — i.e. the existing `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` already in Vercel. The native plugin must be configured
with that **Web client ID** as its `serverClientId` so the code it returns is
redeemable by our server.

- If the existing Web OAuth client lives in a different Google Cloud project,
  that's fine — the plugin's `serverClientId` just has to be the Web client ID
  whose secret the server holds. (Optionally recreate a Web client in this new
  project and update the Vercel env vars to match; not required.)

## 4. OAuth consent screen scopes

Ensure the consent screen for whichever project owns the Web client lists the
same scopes the app uses (already true for the web app):

```
openid  email  profile  https://www.googleapis.com/auth/drive.appdata
```

---

## 5. Install the native Google plugin

We use `@capgo/capacitor-social-login` (Capacitor 8 compatible). The web build
does NOT import it — `lib/nativeAuth.ts` calls it through the Capacitor bridge —
so it only needs to exist in the native project.

```bash
npm install @capgo/capacitor-social-login
npx cap sync android
```

Then initialize it with the **Web client ID** as `serverClientId`. Add this once
early in the app (e.g. a small script the shell runs, or via the plugin's
Android config). Example JS init:

```js
import { SocialLogin } from '@capgo/capacitor-social-login';
await SocialLogin.initialize({
  google: {
    webClientId: '<WEB_CLIENT_ID>.apps.googleusercontent.com',
    // request the same scopes as the web flow
    scopes: ['openid', 'email', 'profile',
             'https://www.googleapis.com/auth/drive.appdata'],
    mode: 'offline', // returns a serverAuthCode + refresh
  },
});
```

> Confirm the exact `login()` return shape for the installed plugin version and,
> if it differs, adjust the `serverAuthCode` extraction in `lib/nativeAuth.ts`
> (it already accepts the common shapes).

---

## 6. Build & run

Install **Android Studio** (not yet installed on this machine), then:

```bash
npx cap open android      # opens the project in Android Studio
# or build/run on an emulator/device from there
```

First run creates/uses `~/.android/debug.keystore` — already generated here, so
its SHA-1 above is stable.

---

## 7. iOS

The `ios/` project was generated with `npx cap add ios --packagemanager SPM`
(plugins resolve through Swift Package Manager — CocoaPods is not needed).

### Build & run in the simulator (no Apple Developer account needed)

```bash
npx cap sync ios   # after any capacitor.config.ts or plugin change
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build build
xcrun simctl boot "iPhone 17 Pro"
xcrun simctl install "iPhone 17 Pro" build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "iPhone 17 Pro" com.resumeflowats.app
```

(Or `npx cap open ios` and hit Run in Xcode.)

> Do NOT pass `CODE_SIGNING_ALLOWED=NO`: simulator builds default to ad-hoc
> "Sign to Run Locally" signing, and a fully unsigned binary can't use the iOS
> keychain — Google sign-in then fails with a "keychain error".

### Native Google sign-in on iOS

Unlike Android (where the OAuth client just has to *exist* in the project),
iOS needs the client ID wired into the app. Three places, one value:

1. **Create an iOS OAuth client** in the same Google Cloud project as the
   Android client (Family-Hub): APIs & Services → Credentials → OAuth client ID
   → type **iOS**, bundle ID **`com.resumeflowats.app`**.
2. **`NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID`** — set it in `.env.local` and in
   Vercel (all environments), then redeploy. `lib/nativeAuth.ts` passes it as
   `iOSClientId` (with the web client as `iOSServerClientId`, so the returned
   server auth code is still redeemable by `/api/auth/mobile/google`).
3. **`ios/App/App/Info.plist`** — replace the
   `com.googleusercontent.apps.REPLACE_WITH_IOS_CLIENT_ID` URL scheme with the
   REVERSED client ID (e.g. `917386024820-abc.apps.googleusercontent.com` →
   `com.googleusercontent.apps.917386024820-abc`), then rebuild the app.

### What needs the Apple Developer account ($99/yr)

Running on a physical iPhone, push notifications (APNs), TestFlight, and App
Store submission. Simulator builds and the Google sign-in wiring above work
without it.

---

## What still needs your input

- **Apple Developer enrollment** — in progress (issues being resolved with
  Apple as of 2026-07-10).
- **iOS OAuth client** — create it in Google Cloud (step 7.2 above); until
  then native Google sign-in on iOS fails with a clear error, but the shell
  itself runs fine in the simulator.
- **Firebase project** (same account) for push — `google-services.json` /
  `GoogleService-Info.plist`. Only needed when we wire push notifications
  (next phase after sign-in works).
- **Which events trigger a push** — interview reminders / application follow-ups
  / status changes.
