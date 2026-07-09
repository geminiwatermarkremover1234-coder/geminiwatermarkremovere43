## Why

The site is a hand-maintained set of static HTML pages with inline Tailwind config, inline scripts, and page-relative asset paths. Moving it onto Astro gives a real build/dev toolchain (dev server, HMR, production build, room for future components) without changing what ships to the browser. The constraint is strict: UI, behavior, and the local video/image processing pipeline must stay byte-for-byte identical — only the framework wrapper changes.

## What Changes

- Adopt the existing repo-root Astro scaffold as the build system and upgrade Astro to the latest release.
- Move runtime assets (`app.js`, `veo-app.js`, `processor.js`, `vendor/`, `watermarks/`, `index.css`) into Astro's `public/` so they are served verbatim with unchanged relative paths.
- Convert `index.html` → `src/pages/index.astro` and `veo.html` → `src/pages/veo.astro`, copying markup verbatim. The only mechanical edits: `is:inline` on every `<script>` (stops Astro bundling/hoisting) and `is:global` on `<style>` blocks (stops scoping, since JS injects DOM at runtime).
- Configure `build.format: 'file'` so production output keeps `index.html` + `veo.html`, preserving the existing `href="veo.html"` nav links.
- Remove unused Astro starter files (`Welcome.astro`, starter `Layout.astro`, `src/assets/*`).
- No changes to processing logic, Tailwind config, CDN usage, or any UI markup.

## Capabilities

### New Capabilities
- `astro-build-migration`: Serve the existing watermark-remover pages and their local-processing runtime through an Astro build, preserving identical markup, styling, scripts, asset paths, and browser behavior.

### Modified Capabilities
<!-- None. This is a build-tooling migration; no spec-level behavior of the watermark-remover changes. -->

## Impact

- **Build/tooling**: repo-root `package.json` (astro dep bump), `astro.config.mjs` (`build.format`), new `src/pages/*.astro`, populated `public/`.
- **Source of truth folder** `anti gravity ide gemini watermark/` is left untouched (it is the backup/source).
- **Runtime code** (`app.js`, `veo-app.js`, `processor.js`, vendor libs, watermark PNGs): copied verbatim, zero behavioral change.
- **Browser support unchanged**: WebCodecs still required (Chrome/Edge); localhost dev server remains a secure context so processing works in dev.
