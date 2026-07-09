# payment-paypal

## ADDED Requirements

### Requirement: Server-side order create and capture
The system SHALL create and capture PayPal orders only on the server via the PayPal Orders v2 API, using amounts from the same server-side price table as Razorpay. The client renders PayPal Smart Buttons and passes order ids only.

#### Scenario: Order creation
- **WHEN** the PayPal button's `createOrder` callback calls `POST /api/pay/paypal/order` with a valid `packId`
- **THEN** the server creates a PayPal order for the pack's server-defined USD amount and returns the PayPal `orderID`

#### Scenario: Order capture
- **WHEN** the button's `onApprove` callback calls `POST /api/pay/paypal/capture` with the `orderID`
- **THEN** the server captures the order, verifies capture status is `COMPLETED` and the captured amount matches the pack price, then credits the user and returns the new balance

#### Scenario: Amount mismatch
- **WHEN** the captured amount does not match the pack's price
- **THEN** the server grants no credits and flags the order for review

### Requirement: Webhook processing
The system SHALL verify PayPal webhook signatures (via the SDK's verify-webhook-signature using the configured webhook id) and process `PAYMENT.CAPTURE.COMPLETED` idempotently.

#### Scenario: Capture completed webhook
- **WHEN** a verified `PAYMENT.CAPTURE.COMPLETED` event arrives for an order not yet credited
- **THEN** the server credits the user exactly once and responds 200

#### Scenario: Unverifiable webhook
- **WHEN** signature verification fails
- **THEN** the server responds 400 and processes nothing

### Requirement: Sandbox/live separation
The system SHALL select PayPal sandbox or live environment from an environment variable, never from client input.

#### Scenario: Production config
- **WHEN** `PAYPAL_ENV=live`
- **THEN** all PayPal API calls target the live endpoint and sandbox credentials are rejected at startup
