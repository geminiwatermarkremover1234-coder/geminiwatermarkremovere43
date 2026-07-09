# Tasks: add-security-payments

## 1. Backend foundation

- [ ] 1.1 Create `server/index.js` — Express app serving the existing static frontend; move `dev` script to `node server/index.js`
- [ ] 1.2 Add deps: `express`, `better-sqlite3`, `helmet`, `express-rate-limit`, `razorpay`, `@paypal/paypal-server-sdk`, `dotenv`
- [ ] 1.3 Create `server/db.js` — SQLite schema: `identities`, `orders`, `webhook_events` tables; startup migration
- [ ] 1.4 Add `.env.example` (all required vars with placeholders) and gitignore `.env`; fail-fast startup check for missing vars

## 2. Credit system

- [ ] 2.1 Implement signed device-token cookie middleware (issue on first visit, verify signature, 401 on tamper)
- [ ] 2.2 Implement `GET /api/credits` (balance + free quota remaining) and `POST /api/credits/consume` (atomic decrement, free quota first, 402 when empty, UTC-day reset)
- [ ] 2.3 Rewire `app.js` conversion gate: call `consume` before processing, show pricing modal on 402; keep localStorage counter as display-only
- [ ] 2.4 Self-check: concurrent-consume test proving balance never goes negative (spec: credit-system)

## 3. Razorpay

- [ ] 3.1 Server price table (packId → credits, INR paise, USD cents) — single source for both gateways
- [ ] 3.2 `POST /api/pay/razorpay/order` — validate packId, create Razorpay order, persist to `orders`
- [ ] 3.3 `POST /api/pay/razorpay/verify` — HMAC-SHA256 check, idempotent `creditOrder()`, return new balance
- [ ] 3.4 `POST /api/pay/razorpay/webhook` — raw-body route mounted before JSON parser, verify `X-Razorpay-Signature`, handle `payment.captured` idempotently via `webhook_events`
- [ ] 3.5 Client: pricing modal + checkout.js integration in `index.html`/`app.js`; test full sandbox purchase

## 4. PayPal

- [ ] 4.1 `POST /api/pay/paypal/order` and `POST /api/pay/paypal/capture` — server-side create/capture, amount-match check, idempotent credit
- [ ] 4.2 `POST /api/pay/paypal/webhook` — SDK signature verification with webhook id, handle `PAYMENT.CAPTURE.COMPLETED` idempotently
- [ ] 4.3 Client: PayPal Smart Buttons in pricing modal wired to server create/capture; env-driven sandbox/live; test full sandbox purchase

## 5. Security hardening

- [ ] 5.1 Input validation on every endpoint (types, allowlisted packIds, length caps); generic 400s, no stack traces in responses
- [ ] 5.2 Rate limits: 10/min payment endpoints, 60/min credits endpoints, per IP+identity
- [ ] 5.3 helmet + CSP allowing self, Razorpay, PayPal origins, and wasm; verify zero console CSP violations during a full convert + both checkouts
- [ ] 5.4 Production HTTPS redirect, HSTS, `Secure; HttpOnly; SameSite=Lax` cookie flags, CORS origin allowlist
- [ ] 5.5 Secret scan: confirm no key/secret in tracked files or client bundles (only Razorpay key id / PayPal client id reach browser)

## 6. Verification & launch

- [ ] 6.1 End-to-end sandbox run: exhaust free quota → 402 → buy pack (Razorpay) → convert; repeat with PayPal
- [ ] 6.2 Webhook backstop test: complete payment, skip client verify (close tab), confirm webhook credits once; replay webhook, confirm no double credit
- [ ] 6.3 Update README + prd.md with backend setup, env vars, and new credit flow
- [ ] 6.4 Deploy to chosen host with live keys; smoke-test one real small payment on each gateway
