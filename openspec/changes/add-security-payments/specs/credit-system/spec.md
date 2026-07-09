# credit-system

## ADDED Requirements

### Requirement: Server-authoritative credit balance
The system SHALL track conversion credits on the server per user identity. The `localStorage` counter (`gwmr_daily_video_usage`) MAY remain as a UI hint only and MUST NOT gate conversions.

#### Scenario: Balance check before conversion
- **WHEN** the user starts a conversion
- **THEN** the client calls `POST /api/credits/consume` first, and only proceeds with processing if the server returns success with remaining balance

#### Scenario: No credits left
- **WHEN** the user has 0 free quota and 0 purchased credits
- **THEN** the server responds 402 and the client shows the pricing modal instead of processing

### Requirement: Free daily quota
The system SHALL grant each identity a free daily quota (default 3/day, configurable) that resets at UTC midnight, consumed before purchased credits.

#### Scenario: Daily reset
- **WHEN** a user exhausted yesterday's quota and returns after UTC midnight
- **THEN** free quota is available again while the purchased balance is unchanged

### Requirement: Lightweight identity
The system SHALL identify users by a server-issued signed device token (HTTP-only cookie or bearer token) created on first visit. Purchased credits attach to this identity.

#### Scenario: First visit
- **WHEN** a client without a token calls any credits endpoint
- **THEN** the server issues a signed token and creates a zero-balance identity

#### Scenario: Tampered token
- **WHEN** a request carries a token whose signature fails verification
- **THEN** the server responds 401 and issues no credits

### Requirement: Atomic, idempotent credit mutations
Credit grants (payments) and consumption SHALL be atomic and idempotent — a payment credited via both client verify and webhook counts once; concurrent consume requests cannot drive the balance negative.

#### Scenario: Double-credit prevention
- **WHEN** `verify` and webhook both attempt to credit the same payment id
- **THEN** the balance increases exactly once

#### Scenario: Concurrent consume
- **WHEN** two consume requests race with balance 1
- **THEN** exactly one succeeds and the other gets 402
