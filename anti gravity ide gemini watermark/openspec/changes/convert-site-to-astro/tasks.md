## 1. Toolchain

- [ ] 1.1 Upgrade Astro to latest at repo root (`npm install astro@latest`)
- [ ] 1.2 Set `build.format: 'file'` in `astro.config.mjs`

## 2. Assets

- [ ] 2.1 Copy `app.js`, `veo-app.js`, `processor.js` into `public/` verbatim
- [ ] 2.2 Copy `vendor/mp4box.all.min.js` and `vendor/mp4-muxer.min.js` into `public/vendor/`
- [ ] 2.3 Copy all 4 `watermarks/*.png` into `public/watermarks/`
- [ ] 2.4 Copy `index.css` into `public/` for parity

## 3. Pages

- [ ] 3.1 Create `src/pages/index.astro` from `index.html` markup verbatim, adding `is:inline` to every `<script>` and `is:global` to `<style>` blocks
- [ ] 3.2 Create `src/pages/veo.astro` from `veo.html` the same way
- [ ] 3.3 Remove unused starter files (`src/components/Welcome.astro`, starter `src/layouts/Layout.astro`, `src/assets/*`)

## 4. Verification

- [ ] 4.1 `npm run build` succeeds; confirm `dist/index.html`, `dist/veo.html`, `dist/app.js`, `dist/vendor/`, `dist/watermarks/` present and scripts/styles unrewritten
- [ ] 4.2 Run `astro dev --background`; home + Veo pages render with no console errors
- [ ] 4.3 Exercise tab toggle, FAQ accordion, mobile menu, currency toggle, and the `veo.html` nav link
- [ ] 4.4 Upload a sample MP4, accept agreement, run removal, confirm cleaned output produced
- [ ] 4.5 `astro dev stop`
