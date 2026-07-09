# Spec: project-documentation

## ADDED Requirements

### Requirement: Complete PRD reflecting the current product
`docs/PRD.md` SHALL describe the product as it exists today: video watermark cleaner (720p/1080p/4K, landscape+portrait), image cleaner (auto Gemini detection + manual brush inpainting), Veo remover page, local credit system, LAN/HTTPS mobile access, current light "Lumina AI" Tailwind UI, privacy model (100% client-side), and explicit non-goals (no invisible-watermark removal, no server processing).

#### Scenario: PRD answers product questions
- **WHEN** a reader consults `docs/PRD.md`
- **THEN** they can determine supported resolutions, daily credit limits, supported browsers per feature, and what the product explicitly does not do — without reading source code

#### Scenario: No stale claims
- **WHEN** `docs/PRD.md` is compared against the shipped UI and code
- **THEN** it contains no descriptions of removed/never-shipped behavior (e.g. old dark-mode Outfit-font UI)

### Requirement: Architecture document
`docs/ARCHITECTURE.md` SHALL map the project structure (every top-level file/folder and its responsibility) and describe the video processing data flow end to end: file input → MP4Box demux → WebCodecs decode → per-frame cleaning → WebCodecs encode → Mp4Muxer mux → Blob download, including where audio passthrough happens.

#### Scenario: New contributor orientation
- **WHEN** a new contributor reads `docs/ARCHITECTURE.md`
- **THEN** they can name which file to edit for a UI change (`app.js`/`index.html`), an algorithm change (`processor.js`), or a Veo-page change (`veo-app.js`/`veo.html`)

### Requirement: Algorithm documentation
`docs/HOW-IT-WORKS.md` SHALL explain the removal pipeline at implementation depth: corner candidate search via Pearson correlation over the first frames, the inverse alpha blend formula `B = (O − Wc·p)/(1 − p)`, opacity estimation stages (discrete candidates, weighted least-squares refinement, per-frame per-channel zero-residual bisection for Veo), edge cleanup rules (white/high-opacity marks only, radius 2, strength 0.6, no padding), Veo median-clamp despeckle, and why each stage exists.

#### Scenario: Algorithm change safety
- **WHEN** a developer plans a change to `processor.js` cleaning logic
- **THEN** the doc tells them which prior regression each safeguard prevents (e.g. edge-cleanup restrictions prevent the blur-ghost bug)

### Requirement: Bug-fix history
`docs/BUGFIX-HISTORY.md` SHALL list every resolved issue from `openspec/changes/` (active and archive) with: symptom, root cause, fix summary, and files touched — including at minimum: watermark blur/ghost patch, Veo residual ghost, dark-background watermark outline, Veo double watermark (obsolete), video quality/download fix, LAN mobile access (WebCodecs secure context).

#### Scenario: Regression triage
- **WHEN** a user reports "blurry patch where the watermark was"
- **THEN** the history doc identifies the prior blur-ghost fix, its root cause, and the settings that must not regress

### Requirement: Improvement roadmap
`docs/ROADMAP.md` SHALL list prioritized future improvements with rationale and rough effort, including at minimum: finishing `add-bulk-processing`, Web Worker offload of frame cleaning, Firefox/Safari support position, additional resolutions/aspect ratios, PWA/offline packaging, and replacing mock auth/premium with real or removing it.

#### Scenario: Picking next work
- **WHEN** deciding what to build next
- **THEN** the roadmap gives a priority-ordered list with enough context to open an OpenSpec change for any item

### Requirement: Development rules
`docs/RULES.md` SHALL state binding project rules: (1) all processing stays client-side — no telemetry, no uploads; (2) spec-driven workflow — non-trivial changes go through OpenSpec propose→apply→archive; (3) vanilla JS/no build step — no frameworks or bundlers without a proposal; (4) app runtime files stay untouched by tooling-only changes; (5) verification checklist before completion (localhost + LAN device, video + image paths, git status clean of generated files); (6) browser support policy per feature.

#### Scenario: Rule enforcement
- **WHEN** a change proposal introduces a server-side processing step or a bundler
- **THEN** `docs/RULES.md` provides the explicit rule it violates, forcing a deliberate documented exception

### Requirement: Single source of truth and discoverability
Root `prd.md` SHALL be reduced to a pointer at `docs/PRD.md`, and `README.md` SHALL link the `docs/` folder. Documents in `docs/` SHALL cross-link each other where they reference shared concepts.

#### Scenario: No diverging PRDs
- **WHEN** the PRD is updated
- **THEN** only `docs/PRD.md` holds content; root `prd.md` merely redirects

#### Scenario: Discoverable from README
- **WHEN** a reader opens `README.md`
- **THEN** they find a link to the documentation set
