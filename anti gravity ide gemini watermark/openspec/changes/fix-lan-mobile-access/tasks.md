# Tasks: fix-lan-mobile-access

## 1. Serving config (package.json + gitignore)

- [x] 1.1 Add `cert` script to `package.json`: `npx -y mkcert create-ca && npx -y mkcert create-cert` (generates ca/cert files in project root, one-time)
- [x] 1.2 Add `dev:lan` script to `package.json`: `npx -y http-server -p 3000 -c-1 -S -C cert.crt -K cert.key` (keep existing `dev` script untouched)
- [x] 1.3 Add generated cert files (`*.pem`, `*.crt`, `*.key`) to `.gitignore` (create file if missing)

## 2. Documentation

- [x] 2.1 Add "Access from phone / other devices (LAN)" section to `README.md`: run `npm run cert` once, then `npm run dev:lan`; find LAN IP via `ipconfig`; open `https://<lan-ip>:3000`; accept self-signed certificate warning; allow Node through Windows Firewall if prompted
- [x] 2.2 Note device-side browser support in same section: video cleaning needs Chromium browser (Chrome/Edge on Android or desktop); image cleaning works in any modern mobile browser

## 3. Verify

- [x] 3.1 Run `npm run cert` then `npm run dev:lan`; confirm `https://localhost:3000` loads with WebCodecs available (`typeof VideoDecoder !== "undefined"` in console) — verified on port 3001 (3000 occupied by running HTTP dev server): `isSecureContext: true`, `VideoDecoder: function`, `VideoEncoder: function`
- [ ] 3.2 From a phone (or second device) on same network, open `https://<lan-ip>:3000`, accept warning, confirm page loads and a video processes end to end — **needs physical phone; server verified reachable over TLS on LAN interface via curl (HTTP 200)**
- [x] 3.3 Confirm `npm run dev` + `http://localhost:3000` still works unchanged
- [x] 3.4 Confirm `git status` shows no cert/key files and no diffs in `app.js`, `processor.js`, `veo-app.js`, `index.html`, `veo.html`, `index.css`
