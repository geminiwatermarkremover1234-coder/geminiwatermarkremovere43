# Proposal: fix-lan-mobile-access

## Why

The app works only on the dev machine at `http://localhost:3000`. When opened from a phone or any other device on the local network (e.g. `http://192.168.x.x:3000`), video cleaning fails: the WebCodecs API (`VideoDecoder` / `VideoEncoder`) is restricted to secure contexts, and a plain-HTTP LAN origin is not a secure context — only `localhost` is. Users need the tool working on phones and all LAN devices without uploading anything anywhere.

## What Changes

- Add an HTTPS dev-serve option so LAN devices get a secure context and WebCodecs works: self-signed certificate + new `dev:lan` npm script using the already-used `http-server` (`-S -C cert.pem -K key.pem`).
- Add a one-time cert generation script/step (openssl or Node) so `dev:lan` works out of the box.
- Document LAN access in README: find the machine's LAN IP, open `https://<lan-ip>:3000` on the phone, accept the self-signed certificate warning once.
- **No changes to application code** (`app.js`, `processor.js`, `veo-app.js`, `index.html`, `veo.html`, CSS). Serving/config/docs only — explicit user constraint.

## Capabilities

### New Capabilities
- `lan-device-access`: serving the app over the local network so that all pages and features (including WebCodecs video cleaning) work from phones and other devices in a local browser.

### Modified Capabilities

_None. Existing capabilities (`video-watermark-remover`, `video-zoom-inspector`, `watermark-remover-ui`) keep their requirements unchanged; this change only alters how the app is served._

## Impact

- `package.json`: new `dev:lan` (and cert-generation) scripts. Existing `dev` script untouched.
- New ignored local files: `cert.pem` / `key.pem` (self-signed, never committed).
- `README.md`: new "Access from phone / LAN" section.
- No runtime code, no dependencies added beyond what `npx` already pulls (`http-server` supports TLS natively).
- Browser caveat stays as-is: video cleaning still needs WebCodecs H.264 (Chromium browsers; iOS Safari support is partial) — image cleaning is canvas-based and works on any device once the page is reachable.
