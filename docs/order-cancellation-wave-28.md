# Customer order cancellation — wave 28

Base: `3b9fb903bc0d1a688774c0cec05d9f76cc532520`

## Product contract

BeeECOM now has an explicit deterministic `cancellation-eligible` scenario. Its canonical order `#1001` is `placed`, `paid`, and `unfulfilled`, which is the only customer-cancellable state in this wave.

The customer endpoint is:

- `POST /api/v1/orders/:id/cancel`
- body: `{ customerId, reason }`

The Worker validates customer existence, order existence, ownership, a 5–500 character reason, and the exact cancellation window. A successful cancellation atomically persists:

- order state → `cancelled`
- fulfillment state → `cancelled`
- payment state → `refunded`

This is a commerce simulator: no real payment provider or refund transfer is implied.

## Storefront behavior

The existing customer Order Detail surface exposes cancellation only for `placed + paid + unfulfilled` orders. The customer supplies a reason and confirms the destructive action through BeeUI `AlertDialog`. Shipped/delivered/cancelled/failed-payment orders do not expose the action.

The accepted state is read back from the same D1-backed order API and must survive page reload.

## Acceptance evidence

The wave tests:

- named scenario availability and exact seeded state;
- ownership rejection without mutation;
- invalid reason rejection without mutation;
- rejection after shipment;
- explicit AlertDialog cancel/confirm behavior;
- persisted `cancelled/refunded/cancelled` state after reload;
- 390px reflow and serious/critical axe results;
- desktop and mobile full-page visual evidence.

## BeeUI boundary

BeeECOM consumes only public `@beemvp/beeui-* 0.86.2-rc.1`. A genuine BeeUI runtime/accessibility defect found by exact-head CI must be logged upstream and the consumer assertion retained. This wave does not patch BeeUI or hide defects with consumer workarounds.
