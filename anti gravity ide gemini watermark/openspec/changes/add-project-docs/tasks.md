# Tasks: add-project-docs

## 1. Research (read sources, no writing yet)

- [ ] 1.1 Read `app.js`, `processor.js` key sections, `veo-app.js`, `index.html`, `veo.html` to capture current shipped behavior (features, limits, resolutions, credit rules, UI)
- [ ] 1.2 Read all proposals/designs in `openspec/changes/` active + archive for bug-fix history and pending work

## 2. Write docs/

- [ ] 2.1 Write `docs/PRD.md` — full current PRD (video cleaner, image cleaner auto+manual brush, Veo page, credits, LAN/HTTPS access, browsers, non-goals)
- [ ] 2.2 Write `docs/ARCHITECTURE.md` — file map + responsibilities + end-to-end video/image data flow
- [ ] 2.3 Write `docs/HOW-IT-WORKS.md` — detection, inverse alpha blend, opacity estimation stages, edge cleanup rules, Veo despeckle, audio passthrough, with code/function references
- [ ] 2.4 Write `docs/BUGFIX-HISTORY.md` — symptom/root-cause/fix/files for each resolved change (blur ghost, Veo residual ghost, dark-background outline, double watermark obsolete, quality/download, LAN mobile access) linking change folders
- [ ] 2.5 Write `docs/ROADMAP.md` — prioritized improvements with S/M/L effort (bulk processing, Web Worker offload, Firefox/Safari position, resolutions, PWA, mock auth/premium decision)
- [ ] 2.6 Write `docs/RULES.md` — binding rules: client-side-only privacy, OpenSpec workflow, vanilla JS/no build step, docs-update requirement, verification checklist, browser support policy

## 3. Wire up single source of truth

- [ ] 3.1 Replace root `prd.md` content with short pointer to `docs/PRD.md`
- [ ] 3.2 Add `docs/` link line to `README.md` project structure/docs section

## 4. Verify

- [ ] 4.1 Cross-check each doc claim against code/specs (no stale or invented behavior); confirm cross-links resolve
- [ ] 4.2 Confirm `git status`: only `docs/*.md`, `prd.md`, `README.md` touched — zero diffs in app runtime files
