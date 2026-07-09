## Context

The Lumina AI watermark removal site is a client-side Astro application. All video unblending and processing happens locally in the browser using WebCodecs and HTML5 canvas. Thus, we only need to host static files (HTML, CSS, JS, and media) at the edge. We will deploy the built files from the `./dist` directory using Cloudflare Workers Static Assets.

## Goals / Non-Goals

**Goals:**
- Add `wrangler.toml` specifying the static assets directory `./dist` and the worker name `anti-gravity-astro`.
- Install `wrangler` CLI as a local dev dependency.
- Integrate build and deploy scripts into `package.json` under `npm run deploy`.
- Validate that the build succeeds and deploy the site to Cloudflare Workers.

**Non-Goals:**
- Setting up server-side rendering (SSR) using the Cloudflare Astro adapter.
- Restructuring the codebase, components, or UI styles.
- Creating server-side backend logic (KV, D1 databases).

## Decisions

### Use Cloudflare Workers Static Assets instead of Astro Cloudflare SSR Adapter
- **Rationale**: Since the video cleaning application runs entirely client-side, dynamic server-side rendering is unnecessary. Statically compiling the Astro pages and serving them directly from the Cloudflare edge provides the lowest possible latency and resource consumption.
- **Alternatives Considered**: 
  - *Cloudflare Pages*: Also suitable, but the user explicitly requested "Cloudflare Workers". Workers Static Assets provides the same benefits and runs directly under the Workers product suite.

## Risks / Trade-offs

- **[Risk] Wrangler Authentication Failure** → **[Mitigation]** The deployment process runs `npx wrangler deploy`, which automatically prompts the user to log in via their browser if they are not already authenticated.
- **[Risk] Deploying Stale Builds** → **[Mitigation]** The `deploy` script will be chained with the build command (`npm run build && wrangler deploy`) to guarantee the latest codebase is built and uploaded.
