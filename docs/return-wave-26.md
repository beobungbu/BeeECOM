# Customer return request — Wave 26

Base: `92c1f5f899aa64e40c3f6f5d19d98f2f9178683e`

This wave closes the customer-side return gap without changing BeeUI or weakening commerce rules.

## Product contract

- A return starts from Order Detail only after a paid order is delivered.
- The customer route carries the selected `orderId`; the screen reloads canonical customer, order and existing return state through the API.
- `POST /api/v1/returns` rejects missing/invalid reasons, wrong ownership, duplicate requests and non-delivered orders.
- A successful request persists as `requested` in the existing D1 `returns` table and is immediately visible to the existing Admin return workflow.
- Reloading the customer route restores the submitted return instead of presenting a second submission form.

## Acceptance evidence

- typed API-client path/body contract;
- Order Detail → Start a return navigation;
- delivered eligibility and shipped-order rejection;
- customer ownership and duplicate protection;
- D1 persistence + Admin visibility + customer reload;
- 390px no-horizontal-overflow;
- serious/critical axe scan;
- desktop and mobile screenshot evidence.

## BeeUI discipline

BeeECOM consumes the published BeeUI package only. If this flow exposes a genuine BeeUI runtime or accessibility defect, the consumer assertion stays intact and the defect is logged upstream; BeeUI source is not patched from BeeECOM.
