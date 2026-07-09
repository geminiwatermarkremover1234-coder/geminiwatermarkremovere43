## ADDED Requirements

### Requirement: Pages served through Astro
The system SHALL serve the watermark-remover home page and Veo page through an Astro build, with rendered markup, styles, and scripts producing behavior identical to the pre-migration static site.

#### Scenario: Home page renders
- **WHEN** a user opens the site root in a supported browser
- **THEN** the page renders the same hero, studio panel, pricing, comparison, and FAQ sections as the original `index.html`
- **AND** no JavaScript console errors occur

#### Scenario: Veo page reachable via nav link
- **WHEN** a user clicks the "Veo Remover" navigation link
- **THEN** the Veo page loads and renders identically to the original `veo.html`

### Requirement: Runtime assets served verbatim
The system SHALL serve `app.js`, `veo-app.js`, `processor.js`, the `vendor/` libraries, and the `watermarks/` templates without modification, preserving their page-relative paths and version query strings.

#### Scenario: Module entry and dependencies load
- **WHEN** the home page loads
- **THEN** `app.js` loads as an ES module and successfully imports `./processor.js`
- **AND** `vendor/mp4box.all.min.js` and `vendor/mp4-muxer.min.js` load without 404

#### Scenario: Watermark templates resolve
- **WHEN** processing requests a watermark template (e.g. `watermarks/bg_48.png`)
- **THEN** the file resolves and loads successfully

### Requirement: Local processing behavior preserved
The system SHALL perform watermark removal entirely in the browser using WebCodecs, with the same processing pipeline and output as before the migration.

#### Scenario: Video cleaned end-to-end in dev
- **WHEN** a user uploads a supported Gemini MP4, accepts the agreement, and runs removal on the Astro-served site over a secure context
- **THEN** processing completes and a cleaned output video is produced, matching the original tool's behavior

### Requirement: UI and styling unchanged
The system SHALL preserve all markup, Tailwind classes and config, custom styles, and animations so the visual result and interactions are unchanged.

#### Scenario: Interactive controls work
- **WHEN** a user toggles the Images/Videos tabs, expands an FAQ item, opens the mobile menu, or switches the currency toggle
- **THEN** each behaves exactly as on the original static site

#### Scenario: JS-injected elements are styled
- **WHEN** the application injects queue items or the brush cursor at runtime
- **THEN** those elements receive their intended styles (global, not scoped away)
