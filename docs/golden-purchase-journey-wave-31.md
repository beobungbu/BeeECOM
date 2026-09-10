# Golden purchase journey — wave 31

## Purpose

Keep BeeECOM useful as a realistic e-commerce reference product while it validates BeeUI as an external consumer. This wave removes the duplicate direct-order path from the Storefront root and makes the customer journey converge on the reusable checkout introduced in wave 30.

## Product behavior

- Storefront cart uses one `Checkout` CTA and navigates to `/conformance/checkout`.
- The Storefront root no longer calls the checkout API directly.
- `Latest order` is loaded from the canonical orders API for `cust-ava`, so it survives navigation and reload instead of depending on component-local state.
- A persisted latest order exposes a `View order` CTA back to the canonical Order Detail route.
- Cart management continues to use the same checkout route, so root cart and dedicated cart no longer diverge.

## Acceptance evidence

`tests/e2e/product-golden-purchase-journey.spec.ts` proves:

1. the Storefront has no direct `Place order` action and its cart enters Checkout;
2. a checkout completed from the Storefront becomes the latest customer order in the Worker/D1-backed orders API;
3. returning to the Storefront shows that persisted order and reopens the same Order Detail;
4. 390px has no horizontal overflow and no serious/critical axe findings;
5. desktop and mobile screenshots remain product-quality evidence rather than isolated harness fixtures.

## BeeUI boundary

No BeeUI source or package is modified. The wave uses only published `@beemvp/beeui-* 0.86.2-rc.1` components already present in the Storefront. Any genuine runtime/accessibility defect found by exact-head CI must be logged upstream and must not be hidden with a BeeECOM workaround.

## Native evidence boundary

Expo iOS/Android bundle gates validate compile/package integration only. They do not count as native runtime parity evidence.
