# Spec: lan-device-access

## ADDED Requirements

### Requirement: App is served over HTTPS on the local network
The project SHALL provide an npm script (`dev:lan`) that serves the app over HTTPS on all network interfaces, so that any device on the LAN loads the page in a secure context and the WebCodecs API (`VideoDecoder` / `VideoEncoder`) is available.

#### Scenario: Video cleaning works from a phone
- **WHEN** a phone on the same network opens `https://<machine-lan-ip>:3000` and accepts the self-signed certificate warning
- **THEN** the page loads, and uploading a supported Gemini video processes and downloads a cleaned MP4 without any WebCodecs "not supported" error caused by an insecure context

#### Scenario: Image cleaning works from any LAN device
- **WHEN** any LAN device opens the app over HTTPS
- **THEN** image watermark removal (auto and manual brush, which already handles touch events) works end to end

### Requirement: One-time local certificate generation
The project SHALL provide a documented one-time command that generates a local self-signed certificate/key pair used by `dev:lan`, without requiring globally installed tools beyond Node.js/npx. Generated certificate files SHALL be git-ignored and never committed.

#### Scenario: Fresh setup
- **WHEN** a user on a fresh clone runs the documented cert command and then `npm run dev:lan`
- **THEN** the HTTPS server starts successfully using the generated certificate

#### Scenario: Certs stay out of version control
- **WHEN** certificates have been generated
- **THEN** `git status` shows no certificate or key files as untracked/staged

### Requirement: Existing localhost workflow is unchanged
The existing `npm run dev` script and `http://localhost:3000` workflow SHALL continue to work exactly as before.

#### Scenario: Desktop localhost unaffected
- **WHEN** a user runs `npm run dev` and opens `http://localhost:3000` in Chrome or Edge
- **THEN** all features work identically to the pre-change behavior

### Requirement: No application code changes
This change SHALL NOT modify application runtime files (`app.js`, `processor.js`, `veo-app.js`, `index.html`, `veo.html`, `index.css`). Only serving configuration (`package.json`, `.gitignore`) and documentation (`README.md`) may change.

#### Scenario: Runtime files untouched
- **WHEN** the change is applied
- **THEN** `git diff` shows no modifications to `app.js`, `processor.js`, `veo-app.js`, `index.html`, `veo.html`, or `index.css` attributable to this change

### Requirement: LAN access is documented
The README SHALL document how to reach the app from other devices: start `dev:lan`, find the machine's LAN IP (`ipconfig` / `ifconfig`), open `https://<lan-ip>:3000`, accept the self-signed certificate warning once, and allow the Node process through the OS firewall if prompted. It SHALL also state the device-side browser requirement (Chromium browser for video; image cleaning works in any modern mobile browser).

#### Scenario: User follows README on phone
- **WHEN** a user follows the documented steps on a phone using Chrome for Android
- **THEN** they reach the app and can clean a video without further troubleshooting
