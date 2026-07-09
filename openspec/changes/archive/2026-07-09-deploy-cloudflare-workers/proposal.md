## Why

Host the Lumina AI watermark removal website on Cloudflare Workers for fast, global, serverless distribution. Since the watermark removal logic runs entirely client-side using WebCodecs and canvas in the user's browser, deploying the site statically via Cloudflare Workers Static Assets offers the highest performance, lowest latency, and zero server management overhead.

## What Changes

- Add `wrangler.toml` configuration to specify the project name, compatibility date, and `./dist` as the static assets directory.
- Add `wrangler` dev dependency to `package.json` for reproducible builds.
- Configure `package.json` script hooks to build the site (`astro build`) and deploy via wrangler (`wrangler deploy`).
- Build the project and deploy it to Cloudflare Workers.

## Capabilities

### New Capabilities
- `cloudflare-workers-deployment`: Automatic build and deployment configuration to host the static Astro site on Cloudflare Workers.

### Modified Capabilities
<!-- None -->

## Impact

- Adds `wrangler.toml` in the project root.
- Adds `wrangler` dependency in `package.json` and updates `package-lock.json`.
- Minimal impact on existing application source files (`src/pages/*`, `public/*` remain unchanged).
