# payment-razorpay

## ADDED Requirements

### Requirement: Server-side order creation
The system SHALL create Razorpay orders only on the server via the Razorpay Orders API, using amounts from a server-side price table. The client MUST NOT be able to set the price.

#### Scenario: User buys a credit pack
- **WHEN** the client calls `POST /api/pay/razorpay/order` with a valid `packId`
- **THEN** the server creates a Razorpay order for that pack's server-defined amount (INR paise) and returns `{ orderId, amount, currency, keyId }`

#### Scenario: Unknown pack rejected
- **WHEN** the client sends a `packId` not in the price table
- **THEN** the server responds 400 and creates no order

### Requirement: Payment signature verification
The system SHALL verify the Razorpay payment signature (`HMAC-SHA256(order_id + "|" + payment_id, key_secret)`) on the server before crediting the user. Client-reported success MUST NOT grant credits.

#### Scenario: Valid signature
- **WHEN** the client posts `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` to `POST /api/pay/razorpay/verify` and the HMAC matches
- **THEN** the server marks the order paid, adds the pack's credits to the user's balance, and returns the new balance

#### Scenario: Invalid signature
- **WHEN** the signature does not match
- **THEN** the server responds 400, grants no credits, and logs the attempt

### Requirement: Webhook processing
The system SHALL expose a webhook endpoint that verifies the `X-Razorpay-Signature` header against the webhook secret and processes `payment.captured` events idempotently, so payments are credited even if the user closes the tab before client-side verification.

#### Scenario: payment.captured received
- **WHEN** a `payment.captured` webhook arrives with a valid signature for an unpaid order
- **THEN** the server credits the user exactly once and responds 200

#### Scenario: Duplicate webhook
- **WHEN** the same event id is delivered again
- **THEN** the server responds 200 without crediting twice

#### Scenario: Bad webhook signature
- **WHEN** the signature header fails verification
- **THEN** the server responds 400 and processes nothing
