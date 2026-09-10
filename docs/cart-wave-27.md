# Wave 27 — Customer cart management

## Exact base

`fbe79206d6b4e75f10faefd4a1f72a0f278f1e7b`

Parent product workstream: BeeECOM #6 — Storefront Web cart, checkout, account and order lifecycle.

## Product gap

The Storefront could add an item and apply a coupon, but it did not expose the WBS-required customer cart lifecycle for changing an existing line quantity or removing a line. Wave 27 closes that BeeECOM product gap without changing BeeUI.

## API contract

- `PATCH /api/v1/cart/:id/lines/:lineId` with `{ quantity }` sets the absolute positive integer quantity.
- Quantity may not exceed the canonical product variant inventory quantity.
- `DELETE /api/v1/cart/:id/lines/:lineId` removes that exact persisted line.
- Missing carts, lines and variants return explicit not-found errors; invalid quantity returns `400`; insufficient stock returns `409`.
- The existing `PATCH /api/v1/cart/:id/coupon` remains the single coupon mutation path.

All mutations write the canonical D1-backed cart. Reload acceptance therefore validates persistence rather than component-local state.

## Storefront product surface

`/conformance/cart` provides a reusable customer cart screen with:

- product/variant identity and line totals;
- increment/decrement quantity controls;
- inventory-aware upper bound;
- destructive removal behind BeeUI `AlertDialog` confirmation;
- coupon apply/remove;
- subtotal, discount, shipping, tax and total derived through the shared commerce domain;
- empty-cart and recovery states;
- Storefront root entry through `Manage cart`.

The screen consumes public BeeUI package exports only (`0.86.2-rc.1`): `AppHeader`, `IconButton`, `Card`, `Badge`, `Input`, `Button`, `Separator`, `AlertDialog` and layout/text primitives.

## Acceptance evidence

The Playwright wave validates:

- Storefront → cart navigation;
- D1-backed quantity persistence and reload restoration;
- invalid, over-stock and missing-line rejection without state mutation;
- coupon persistence and deterministic total recomputation;
- explicit AlertDialog cancellation before destructive removal;
- persisted empty-cart state after confirmed removal;
- 390 px no-horizontal-overflow and serious/critical axe gate;
- desktop and mobile full-page visual evidence.

## Upstream discipline

BeeUI remains an external dependency. If the published BeeUI runtime breaks a valid component/accessibility contract, preserve the BeeECOM assertion, log or reuse an upstream BeeUI issue with evidence, and leave the BeeECOM PR draft/red. Do not patch BeeUI or hide the defect with a consumer workaround.
