## Context

The watermark-remover is two static HTML pages (`index.html`, `veo.html`) plus three ES-module scripts (`app.js`, `veo-app.js`, `processor.js`), a `vendor/` folder (mp4box, mp4-muxer), a `watermarks/` folder (4 PNG templates), and Tailwind loaded from CDN with an inline `tailwind.config`. All asset references are page-relative. The repo root already holds an Astro scaffold. The migration must not alter rendered UI, script behavior, or the WebCodecs-based local processing pipeline.

## Goals / Non-Goals

**Goals:**
- Serve the existing pages through Astro's dev server and production build.
- Keep browser-delivered HTML, CSS, JS, and assets identical in effect to the current site.
- Preserve page-relative asset paths and the `veo.html` cross-link.
- Upgrade to the latest Astro.

**Non-Goals:**
- Refactoring processing logic, splitting scripts into components, or converting inline scripts to Astro-bundled scripts.
- Replacing the Tailwind CDN with a build-time Tailwind integration.
- Changing any markup, class, color token, animation, or copy.
- Touching the original `anti gravity ide gemini watermark/` source folder (kept as backup).

## Decisions

**Assets go in `public/`, not `src/`.** Astro serves `public/` verbatim with no processing, so `app.js?v=15`, `vendor/...`, and `watermarks/...` resolve exactly as before. Putting them in `src/` would subject them to bundling/hashing and break the relative paths and cache-busting query strings. Alternative (import as modules) rejected — it would rewrite the code the user requires unchanged.

**`is:inline` on every `<script>`.** By default Astro processes/hoists/bundles `<script>` tags, which would rewrite the inline Tailwind config, the CDN loader, the vendor `<script src>` tags, and the module entry. `is:inline` tells Astro to emit them exactly as written. This is the mechanism that guarantees "no code change."

**`is:global` on `<style>` blocks.** Astro scopes component styles by default (adds a hash attribute to selectors). The runtime JS creates elements (queue items, brush cursor) that never carry that hash, so scoped styles would silently miss them. `is:global` keeps the CSS applying site-wide as it does today.

**`build.format: 'file'`.** Produces `dist/index.html` and `dist/veo.html` (not `dist/veo/index.html`), so the existing `href="veo.html"` link works in the built output without editing markup.

## Risks / Trade-offs

- [Astro rewrites a script despite `is:inline`] → Verify built `dist/*.html` scripts are byte-equivalent to source; the vendor/module tags must survive untouched.
- [Dev server serves `/veo` but not `/veo.html`] → With `build.format: 'file'` the built site is correct; if the dev route differs, the fallback is absolute `/veo.html` hrefs (behavior identical). Confirmed during verification.
- [Scoped-style regression on JS-injected DOM] → `is:global` mitigates; verified by exercising queue/brush UI in the browser.
- [WebCodecs unavailable off secure context] → Unchanged from today; localhost dev is a secure context, so processing works in `astro dev`.

## Migration Plan

1. Upgrade Astro at repo root.
2. Copy runtime assets into `public/` unmodified.
3. Create `src/pages/index.astro` and `src/pages/veo.astro` from the HTML with only `is:inline`/`is:global` added.
4. Set `build.format: 'file'`; remove starter files.
5. `npm run build` + browser smoke test (render, interactions, one real video clean).

Rollback: the original folder is untouched — reverting is deleting the Astro `src/pages/*` and serving the old folder directly.
