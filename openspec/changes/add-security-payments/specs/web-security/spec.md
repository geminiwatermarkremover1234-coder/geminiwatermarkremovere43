# web-security

## ADDED Requirements

### Requirement: Security headers
The system SHALL serve all pages with security headers: Content-Security-Policy (allowing self, Razorpay checkout, and PayPal SDK origins only), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (except frames Razorpay/PayPal require), `Referrer-Policy: strict-origin-when-cross-origin`, and HSTS in production.

#### Scenario: Page load
- **WHEN** any HTML page is served
- **THEN** the response includes the CSP and companion headers, and the app functions (WebCodecs, wasm, checkout scripts) without CSP violations

### Requirement: HTTPS enforcement
The system SHALL redirect HTTP to HTTPS in production and mark auth cookies `Secure; HttpOnly; SameSite=Lax`.

#### Scenario: Plain HTTP request
- **WHEN** a production request arrives over HTTP
- **THEN** the server responds 301 to the HTTPS URL

### Requirement: API input validation
Every API endpoint SHALL validate request bodies (types, allowed values, length limits) and reject malformed input before any business logic runs.

#### Scenario: Malformed body
- **WHEN** a request body is missing required fields or has wrong types
- **THEN** the server responds 400 with a generic error, without stack traces or internal details

### Requirement: Rate limiting
The system SHALL rate-limit API endpoints per IP/identity — stricter limits on payment endpoints (e.g. 10/min) than on credit checks (e.g. 60/min).

#### Scenario: Burst of order creations
- **WHEN** a client exceeds the payment endpoint limit
- **THEN** subsequent requests get 429 until the window resets

### Requirement: Secret management
Payment keys and signing secrets SHALL live only in environment variables. No secret SHALL appear in client-delivered JS, HTML, or the git repository. Only the Razorpay key id and PayPal client id (public by design) may reach the client.

#### Scenario: Repository scan
- **WHEN** the repo is scanned for the configured secrets
- **THEN** none are found in tracked files; `.env` is gitignored and `.env.example` documents required vars with placeholders

#### Scenario: Missing secret at startup
- **WHEN** the server starts without a required env var
- **THEN** it exits with a clear error instead of running unconfigured

### Requirement: CORS lockdown
API endpoints SHALL accept cross-origin requests only from the configured site origin.

#### Scenario: Foreign origin
- **WHEN** a browser request arrives with a non-allowlisted Origin
- **THEN** no CORS allow headers are returned and the browser blocks the response
