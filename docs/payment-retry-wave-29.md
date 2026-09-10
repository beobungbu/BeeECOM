# Product wave 29 — failed payment recovery

## Product intent

Give a customer a clear recovery path when an order exists but its payment failed before fulfillment. The flow lives in the existing Order Detail experience so BeeECOM remains a coherent ecommerce product rather than a collection of isolated conformance fixtures.

## Canonical state

The existing `payment-failed` demo scenario is the oracle:

- order: `order-1001` / `#1001`
- customer: `cust-ava`
- order state: `placed`
- payment state: `failed`
- fulfillment state: `unfulfilled`

No fake screen-local domain data is introduced.

## Customer contract

`POST /api/v1/orders/:id/retry-payment`

Input:

- `customerId`
- optional deterministic simulator `outcome: success | failure`

The endpoint requires the customer to own the order and only accepts `placed + failed + unfulfilled` orders. A successful simulated retry persists `paymentState=paid`; a failed simulated retry remains `paymentState=failed`. Fulfillment does not advance automatically.

## Product UX

Order Detail exposes a `Payment needs attention` recovery card only while the order is retryable. The customer action uses the success path. After recovery:

- the payment badge updates to `paid`;
- the recovery card disappears;
- the existing pre-fulfillment cancellation flow becomes available;
- the persisted state survives reload.

## Acceptance evidence

`tests/e2e/product-payment-retry.spec.ts` covers:

- canonical failed-payment scenario state;
- ownership rejection;
- unsupported outcome validation;
- rejection once an order is already paid/shipped;
- deterministic failed retry persistence;
- customer success flow and reload persistence;
- 390px no-horizontal-overflow + serious/critical axe gate;
- desktop/mobile full-page visual evidence.

## BeeUI discipline

BeeUI is consumed only through published `@beemvp/beeui-* 0.86.2-rc.1`. If exact-head browser evidence exposes a genuine BeeUI defect, preserve the consumer assertion, log/reuse the upstream issue and keep the BeeECOM PR draft/red. Do not patch BeeUI or add a workaround that hides the defect.
