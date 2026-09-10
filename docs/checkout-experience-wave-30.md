# Product wave 30 — checkout experience

## Product intent

Replace the cart-to-order shortcut with a reusable customer checkout surface that can become the base for future BeeECOM-derived ecommerce products. The page uses canonical Worker + D1 state and public BeeUI components; it does not keep a second fake checkout model in the browser.

## Checkout contract

`POST /api/v1/checkout` remains backward-compatible with existing callers and now accepts optional method metadata:

- `shippingMethod`: `standard | express` (defaults to `standard`)
- `paymentMethod`: `card | wallet` (defaults to `card`)
- existing simulator-only `paymentScenario`: `success | failure`

Newly created orders persist the selected shipping and payment methods. Existing seeded orders remain valid because the added order fields are optional.

## Pricing

The Worker and checkout preview both use the shared `calculateCartTotals` domain function.

- Standard delivery: $9.00
- Express delivery: $18.00
- merchandise tax behavior is unchanged
- active cart coupons continue to flow through the same totals engine

## Customer experience

`/conformance/checkout` provides:

1. account/contact summary from the canonical customer;
2. delivery-address selection from the customer's saved addresses;
3. Standard vs Express delivery selection;
4. Card vs Wallet selection;
5. cart item and totals review;
6. explicit confirmation before `Place order` is enabled;
7. a polished confirmation state with a link to the persisted Order Detail.

The dedicated Cart page now sends `Continue to checkout` to this surface.

## Simulator boundary

BeeECOM does not charge a real card or wallet. A deterministic failed-payment outcome remains available only through the API/test layer; it is deliberately not exposed as a customer-facing payment option.

Successful payment empties the cart. Failed simulated payment preserves the cart so the order can use the existing failed-payment recovery lifecycle.

## Acceptance evidence

`tests/e2e/product-checkout-experience.spec.ts` covers:

- Cart → Checkout navigation;
- confirmation gating;
- Standard/Express price recomputation;
- Express + Wallet method persistence;
- successful order persistence and cart clearing;
- invalid shipping/payment method rejection;
- non-owned/missing address rejection without cart mutation;
- failed payment preserving cart state;
- 390px no-horizontal-overflow and serious/critical axe checks;
- desktop/mobile full-page visual evidence.

`packages/api-client/src/checkout.test.ts` locks the exact checkout request body.

## BeeUI discipline

This wave intentionally uses BeeUI families already proven independently in BeeECOM (`RadioGroup`, `Radio`, `Checkbox`, cards, lists, description content, buttons and layout). It does not reuse blocked Sheet, Stepper, Switch, disclosure, Progress or datetime primitives merely to increase component coverage.

If exact-head evidence reveals a genuine BeeUI defect, the consumer assertion remains intact, the upstream issue is logged/reused, and the BeeECOM PR stays draft/red. BeeUI itself is not patched from this project.
