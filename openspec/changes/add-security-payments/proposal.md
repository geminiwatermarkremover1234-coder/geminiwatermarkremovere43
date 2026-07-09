# Proposal: add-security-payments

## Why

The watermark remover is a fully client-side app whose credit system (3 free conversions/day) lives in `localStorage` and can be bypassed by anyone in five seconds via DevTools — meaning it cannot be monetized and has no real security posture. To sell conversion credits through Razorpay and PayPal, the app needs a small trusted backend (payments can never be verified client-side) plus baseline website security hardening.

## What Changes

- Add a minimal backend API (Node.js/Express, single service) — the first server component in this project. It owns payment verification and credit accounting.
- Integrate **Razorpay Checkout**: server-side order creation, client checkout modal, server-side HMAC-SHA256 signature verification, webhook handling for `payment.captured`.
- Integrate **PayPal Smart Buttons**: server-side order create + capture (never client-side capture), webhook handling for `PAYMENT.CAPTURE.COMPLETED`.
- Replace the trust-the-browser `localStorage` credit system with server-issued credits: free daily quota + purchased credit packs, tracked against a lightweight user identity (email magic-link or device token). **BREAKING**: `gwmr_daily_video_usage` localStorage counter no longer authoritative.
- Website security hardening: CSP and security headers, HTTPS-only, input validation on all API endpoints, rate limiting, webhook signature verification, secret management via environment variables (no keys in client code or git), CORS lockdown.
- Video processing stays 100% client-side — the backend never touches video files (preserves the privacy promise and zero-bandwidth cost).

## Capabilities

### New Capabilities
- `payment-razorpay`: Razorpay order creation, checkout flow, signature verification, and webhook processing for INR/domestic payments.
- `payment-paypal`: PayPal order create/capture flow and webhook processing for international payments.
- `credit-system`: Server-authoritative conversion credits — free daily quota, purchased packs, balance check before processing, decrement on conversion.
- `web-security`: Security headers/CSP, HTTPS enforcement, API input validation, rate limiting, secret management, CORS policy.

### Modified Capabilities
<!-- none — no existing specs in openspec/specs/ -->

## Impact

- **New code**: `server/` (Express API: orders, capture, webhooks, credits), payment UI in `index.html`/`app.js` (pricing modal, Razorpay/PayPal buttons).
- **Modified code**: `app.js` credit-gate logic calls the API instead of `localStorage`; `index.html` gets checkout scripts + CSP meta/headers.
- **New dependencies**: `express`, `razorpay`, `@paypal/paypal-server-sdk`, `helmet`, `express-rate-limit`; Razorpay `checkout.js` and PayPal JS SDK on the client.
- **New external accounts/secrets**: Razorpay key id/secret + webhook secret, PayPal client id/secret + webhook id — env vars only.
- **Deployment**: app can no longer be purely static; needs a Node host (or static frontend + small API host) with HTTPS.
