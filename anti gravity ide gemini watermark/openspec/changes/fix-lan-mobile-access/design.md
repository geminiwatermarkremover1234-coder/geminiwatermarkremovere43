# Design: fix-lan-mobile-access

## Context

The app is a fully static client-side site served for development by `npm run dev` → `npx http-server -p 3000 -c-1`. `http-server` already binds `0.0.0.0`, so LAN devices can *reach* the page — but video cleaning fails there. Root cause: WebCodecs (`VideoDecoder` / `VideoEncoder`, checked in `processor.js:1239`) is limited to secure contexts. `http://localhost:3000` is a secure context; `http://192.168.x.x:3000` is not, so on phones/other devices `VideoDecoder` is `undefined` and processing throws "This browser does not support WebCodecs…".

Constraint from the user: fix this without changing anything else in the code. Touch input for the manual brush is already implemented (`app.js:1379-1381`), and image cleaning is plain Canvas — both work on mobile once the page loads; only the secure context is missing.

## Goals / Non-Goals

**Goals:**
- Full app functionality (including WebCodecs video cleaning) from phones and all LAN devices.
- Zero changes to application runtime code; serving config + docs only.
- No new committed dependencies; keep the existing `npx http-server` approach.

**Non-Goals:**
- Public/internet hosting, real TLS certificates, or domain setup.
- Making video cleaning work on browsers without WebCodecs H.264 encode (e.g. Firefox, older iOS Safari) — that is a browser capability limit, not a serving issue.
- Production deployment story.

## Decisions

1. **HTTPS via `http-server -S` with a local self-signed cert** — `dev:lan` script: `npx -y http-server -p 3000 -c-1 -S -C cert.pem -K key.pem`. Rationale: `http-server` (already used) supports TLS natively; a secure HTTPS origin makes every LAN device a secure context, enabling WebCodecs. Alternatives rejected:
   - *Chrome flag `unsafely-treat-insecure-origin-as-secure`*: per-device, per-browser fiddling; unavailable on iOS; not "working on all devices".
   - *Public tunnel (ngrok/cloudflared)*: routes traffic through third party — contradicts the app's local-only privacy promise.
   - *Switching to vite/other dev server*: bigger change, still needs a cert for HTTPS anyway.
2. **Cert generation with `npx -y mkcert` (npm package, node-forge based)** — one-time `cert` npm script (`create-ca` + `create-cert`). Rationale: works on Windows without assuming `openssl` on PATH; no global install. Alternative rejected: raw `openssl` command (not reliably present on Windows outside Git Bash).
3. **Accept the browser "not private" warning** instead of installing the CA on each device. One-tap "Advanced → Proceed" per device is the lazy, sufficient path for LAN dev use. Installing the generated CA on the phone is documented as optional for a clean padlock.
4. **Git-ignore `*.pem` / generated cert files** — private key must never be committed.

## Risks / Trade-offs

- [Self-signed warning may confuse users] → README documents the exact accept-warning steps per platform.
- [Windows Firewall blocks Node on first LAN serve] → README notes the allow prompt; without it the phone times out.
- [iOS Safari WebCodecs H.264 encode support is partial] → documented as browser limitation; image cleaning still works there. Video works on Android Chrome/Edge and desktop Chromium browsers.
- [`npx mkcert` fetches a package at first run] → one-time, dev-only; same trust model as existing `npx http-server` usage.

## Migration Plan

Additive only: new scripts + docs. Rollback = delete the two npm scripts, the README section, and local cert files. `npm run dev` untouched throughout.

## Open Questions

None.
