# Product review submission — wave 24

BeeECOM treats customer reviews as a real commerce workflow rather than a component demo.

## Product contract

- A signed demo customer enters the review flow from a purchased order line.
- The review route carries `orderId` and `productId`; the screen does not hard-code a product.
- The Worker verifies customer, product, paid-order ownership and duplicate-review constraints.
- New reviews persist as `pending` moderation records.
- Customer-scoped reads can restore the customer's own pending review after reload.
- Public product review reads expose only `published` records.
- Admin review APIs see the same persisted record for moderation.

## BeeUI validation

The screen consumes only public BeeUI package exports and exercises `AppHeader`, `IconButton`, `FormGroup`, `RadioGroup`, `Radio`, `Field`, `Input`, `Textarea`, `FormMessage`, `Button`, `Card` and layout primitives in normal storefront UX. Browser acceptance includes keyboard/semantic behavior through role-based locators, responsive reflow, axe serious/critical checks, and desktop/mobile visual evidence.

Genuine BeeUI defects must be logged upstream and left visible in BeeECOM; BeeUI source is not patched from this repository.
