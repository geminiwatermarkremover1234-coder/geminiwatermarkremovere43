# Design: add-project-docs

## Context

Documentation-only change. Sources of truth already exist in the repo; the work is extraction and synthesis, not invention:

- Product behavior: `index.html`, `app.js` (1,644 lines), `veo.html`, `veo-app.js`, `README.md`.
- Algorithm: `processor.js` (2,100 lines) + specs in `openspec/specs/video-watermark-remover/`.
- Bug history: `openspec/changes/fix-video-watermark-blur/`, `fix-veo-residual-ghost/`, `fix-lan-mobile-access/`, and 6 archived changes under `openspec/changes/archive/`.
- Pending work: `openspec/changes/add-bulk-processing/`.
- Stale artifact: root `prd.md` (describes old dark UI, missing image cleaner/Veo/4K/LAN).

## Goals / Non-Goals

**Goals:**
- One `docs/` folder a new contributor can read top-to-bottom and then work safely.
- Every claim traceable to code or an OpenSpec change — no aspirational content presented as shipped.
- Kill the stale-PRD problem structurally (pointer, single source).

**Non-Goals:**
- No runtime/code changes of any kind.
- No auto-generated API docs, no wiki tooling, no docs site — plain markdown files.
- Not rewriting `openspec/` artifacts; history doc summarizes and links to them.

## Decisions

1. **Plain markdown in `docs/`, six files** — matches "many md files" ask while keeping one file per concern. Alternatives rejected: single mega-doc (unnavigable), generated wiki (`generate_wiki_tool` output isn't versioned/curated), README expansion (README is quick-start, not reference).
2. **Root `prd.md` becomes a pointer, not deleted** — external references/habits may target that path; a 3-line redirect is cheaper than a broken link. Rewriting it in place was rejected because README structure diagram already names `prd.md` as "PRD" and `docs/` gives all docs one home.
3. **BUGFIX-HISTORY sourced from OpenSpec proposals verbatim-summarized** — proposals already state why/what precisely (e.g. blur fix: radius 2, strength 0.6, white-mark-only edge cleanup; Veo ghost: zero-residual bisection + despeckle). The doc condenses each to symptom/root-cause/fix/files and links the change folder. No re-derivation from code diffs.
4. **RULES.md encodes existing implicit constraints as explicit rules** — privacy-first client-side-only, vanilla-JS/no-build, OpenSpec workflow, verification checklist (the same checks used in `fix-lan-mobile-access` tasks 3.x). Nothing new invented; rules that were already being followed get written down.
5. **Effort/priority in ROADMAP as T-shirt sizes (S/M/L)** — enough for ordering without fake precision.

## Risks / Trade-offs

- [Docs drift as code evolves] → RULES.md requires OpenSpec changes to update affected docs in their tasks; BUGFIX-HISTORY appends per archived change.
- [Summarizing 2,100-line processor.js may miss nuances] → HOW-IT-WORKS links to function names/line anchors in code and to the authoritative spec files rather than duplicating every constant.
- [Two PRD locations during transition] → pointer file contains zero content beyond the link, so divergence is impossible.

## Migration Plan

Additive files + two small edits (`prd.md` pointer, README link). Rollback = delete `docs/`, restore `prd.md` from git.

## Open Questions

None.
