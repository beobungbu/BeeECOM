# Order tracking wave 32

## Product goal

Make customer Order Detail useful as a reusable e-commerce tracking surface instead of only a static order summary.

## Scope

- render a BeeUI `Timeline` directly inside the real Storefront Order Detail;
- derive progress only from persisted order state (`placedAt`, `updatedAt`, payment state, fulfillment state);
- show persisted shipping/payment method metadata introduced by checkout wave #61;
- keep legacy seeded orders honest by showing `Not recorded` when those optional method fields do not exist;
- format persisted timestamps for customers without changing canonical values;
- unlock review and return actions only after a paid order is delivered;
- enforce the delivered-order rule in both the Storefront review page and the customer review API;
- preserve existing payment retry and cancellation behavior.

## Truthfulness boundary

BeeECOM does not currently persist carrier, tracking number, scan events or ETA. This wave must not invent them. Processing, shipped and delivered presentation is derived only from the current persisted fulfillment state.

## Acceptance

- healthy `shipped` order shows Order placed → Payment confirmed → On the way and no post-delivery actions;
- `delayed-shipment` scenario shows preparation state without invented carrier/ETA copy;
- Express + Wallet checkout metadata survives into Order Detail;
- Admin `deliver` transition updates Timeline and unlocks review + return actions;
- direct/API review submission before delivery is rejected with `REVIEW_DELIVERY_REQUIRED`;
- unpurchased products remain rejected with `REVIEW_PURCHASE_REQUIRED`;
- 390px order tracking passes serious/critical axe and horizontal-overflow checks;
- desktop delivered and mobile shipped screenshots are attached to release QA evidence.

## BeeUI discipline

This wave consumes published BeeUI only. `Timeline` is validated independently from the blocked Accordion/Collapsible disclosure oracle. If a genuine BeeUI runtime or accessibility mismatch appears, keep the valid BeeECOM assertion and log/reuse an upstream BeeUI issue; do not patch BeeUI from this repository.
