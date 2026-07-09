# Design: add-security-payments

## Context

The app (`anti gravity ide gemini watermark/`) is a static, fully client-side video watermark remover: `index.html` + `app.js` + `processor.js`, served by `http-server`, no backend. Credits are a `localStorage` counter with a mocked sign-in — purely cosmetic. Monetizing requires payment verification, and payment verification is impossible client-side: any credit granted by browser code can be granted by DevTools. So this change introduces the project's first backend, kept as small as possible.

Constraints:
- Video processing must stay on-device (privacy promise, zero bandwidth cost). The backend never sees video bytes.
- Solo project, cheap hosting — one small Node service, no separate DB server.
- Razorpay for INR/domestic; PayPal for international.

## Goals / Non-Goals

**Goals:**
- Trustworthy credits: buy with Razorpay or PayPal, spend on conversions, unfalsifiable from the browser.
- Baseline web security: headers/CSP, HTTPS, validation, rate limits, secret hygiene.
- Smallest backend that achieves the above.

**Non-Goals:**
- Full account system (passwords, profiles, OAuth). Device-token identity is enough; email attach can come later.
- Subscriptions/recurring billing — one-time credit packs only.
- Server-side video processing, admin dashboards, refund automation, multi-currency price engine.
- Preventing a determined user from processing videos with a local copy of the code — the product sells convenience, not DRM.

## Decisions

1. **One Express server serves both static frontend and API** (`server/index.js`, API under `/api/*`).
   - Alternative: static host (Netlify) + serverless functions — more moving parts, webhook + SQLite awkward. Alternative: NestJS — overkill for ~6 endpoints.
   - Same-origin serving kills most CORS complexity; CORS config becomes a production allowlist safety net.

2. **SQLite via `better-sqlite3` for identities, orders, credits, processed webhook events.**
   - Alternative: JSON file — no atomicity, race bugs. Alternative: Postgres — hosting cost/ops for a table count of 4.
   - Synchronous transactions give the atomic consume/credit semantics the spec requires for free.
   - ponytail: single-file SQLite; move to Postgres if this ever needs more than one server instance.

3. **Identity = signed device token in an HTTP-only cookie** (random id + HMAC signature, server secret).
   - Alternative: JWT lib — HMAC of a random id is the same guarantee with fewer parts. Alternative: magic-link email now — friction before there's revenue; schema keeps an optional `email` column so it can attach later.
   - Trade-off (accepted): clearing cookies resets free quota. Purchased credits can be recovered later via payment id/email support flow.

4. **Payment flow: price table on server, client only sends `packId`.**
   - Razorpay: `order` endpoint → checkout.js modal → `verify` endpoint (HMAC-SHA256) → credit. Webhook `payment.captured` as the reliability backstop.
   - PayPal: Smart Buttons `createOrder`/`onApprove` both call server; capture happens server-side with amount check. Webhook `PAYMENT.CAPTURE.COMPLETED` as backstop.
   - Both paths converge on one idempotent `creditOrder(orderId)` function keyed by provider payment id — client-verify and webhook can both fire, credits apply once.

5. **Free quota lives server-side too** (per identity, UTC-day column) — otherwise the paywall's free tier stays bypassable and nobody buys packs. `localStorage` counter stays only as instant UI display.

6. **Security stack: `helmet` for headers, `express-rate-limit`, hand-rolled ~20-line body validators.**
   - Alternative: zod/joi — a dependency to validate 3 small request shapes; add if endpoints multiply.
   - CSP must allowlist `https://checkout.razorpay.com`, `https://api.razorpay.com`, `https://www.paypal.com`, `https://www.sandbox.paypal.com` (script/frame/connect as each SDK requires) and keep `wasm-unsafe-eval` if mp4box/encoder needs it — verify against console CSP violations during implementation.
   - Razorpay webhook route must use `express.raw()` body (signature is over raw bytes), mounted before the JSON parser.

## Risks / Trade-offs

- [Webhook missed → user paid but not credited] → client-side `verify`/`capture` is the primary path; webhook is backstop; orders table keeps unmatched payments queryable for manual fix.
- [CSP breaks WebCodecs/wasm or checkout popups] → implement CSP last, test full convert + both checkouts with DevTools console open; loosen only the specific directive that fires.
- [Device-token identity: cookie loss loses purchased credits] → accepted for v1; store provider payment id per order so support can re-attach credits; add email attach later.
- [Refunds/disputes not automated] → low volume expected; handle manually in Razorpay/PayPal dashboards; deduct credits by hand if needed.
- [`better-sqlite3` native build on Windows host] → prebuilt binaries cover Node LTS; pin Node version in `package.json` engines.

## Migration Plan

1. Ship server serving existing static files (no behavior change).
2. Add credits API; switch `app.js` gate from localStorage to API (**breaking** for users mid-day: counters reset once).
3. Add Razorpay, then PayPal (sandbox first, then live keys).
4. Enable helmet/CSP/rate limits; deploy behind HTTPS.
Rollback: static hosting still works — revert `app.js` gate to localStorage and redeploy static.

## Open Questions

- Pack pricing (e.g. ₹99/$1.99 for 20 conversions?) — needs owner decision before live keys; placeholder table in code.
- PayPal business account availability in owner's region (India: PayPal supports receiving international payments; domestic INR via PayPal is restricted — Razorpay covers domestic).
- Hosting target (Render/Railway/Fly/VPS) — affects HTTPS setup only.
