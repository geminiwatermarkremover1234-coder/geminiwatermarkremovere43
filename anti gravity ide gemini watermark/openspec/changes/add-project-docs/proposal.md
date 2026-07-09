# Proposal: add-project-docs

## Why

Project knowledge lives scattered and stale: root `prd.md` describes an old dark-mode UI (Outfit fonts, no image cleaner, no Veo page, no 4K, no LAN access), the real bug-fix history (watermark blur ghost, Veo residual ghost, dark-background outline, double watermark, quality/download fix, LAN secure-context fix) exists only inside `openspec/changes/*` folders, and there is no written architecture doc, roadmap, or contribution rules. A new contributor (or future session) cannot answer "how does removal work", "what bugs were fixed and why", or "what are the rules" without reverse-engineering 2,100 lines of `processor.js`.

## What Changes

- Create a `docs/` folder with a complete, current documentation set:
  - `docs/PRD.md` — full rewritten PRD covering current product (video cleaner, image cleaner auto+manual, Veo page, credit system, LAN/mobile access, current light "Lumina AI" Tailwind UI).
  - `docs/ARCHITECTURE.md` — project structure, file map, module responsibilities, data flow (upload → demux → decode → clean → encode → mux → download).
  - `docs/HOW-IT-WORKS.md` — algorithm deep-dive: Pearson-correlation watermark detection, inverse alpha blending, opacity estimation (discrete candidates + least-squares + per-frame zero-residual bisection), edge cleanup, Veo despeckle, audio passthrough.
  - `docs/BUGFIX-HISTORY.md` — every fixed issue with root cause and fix, sourced from `openspec/changes/` active + archive (blur ghost, Veo residual ghost, dark-background outline, double watermark, quality/download, LAN mobile access).
  - `docs/ROADMAP.md` — prioritized improvements (bulk processing completion, Firefox/Safari story, Web Worker offload, more resolutions, PWA, real auth/payments vs mock).
  - `docs/RULES.md` — development rules: OpenSpec workflow, privacy-first constraint (no server uploads ever), no-framework vanilla JS convention, browser support policy, verification steps, file/naming conventions.
- Update root `prd.md` to a short pointer to `docs/PRD.md` (avoid two diverging PRDs).
- Link `docs/` from `README.md` (one line in structure section).
- **No application code changes** — documentation only.

## Capabilities

### New Capabilities
- `project-documentation`: a complete, accurate, cross-linked documentation set in `docs/` describing the product (PRD), architecture, algorithm, bug-fix history, roadmap, and development rules.

### Modified Capabilities

_None. No runtime behavior changes._

## Impact

- New: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/HOW-IT-WORKS.md`, `docs/BUGFIX-HISTORY.md`, `docs/ROADMAP.md`, `docs/RULES.md`.
- Modified: `prd.md` (becomes pointer), `README.md` (adds docs link).
- Zero changes to `app.js`, `processor.js`, `veo-app.js`, `index.html`, `veo.html`, `index.css`, `package.json`.
