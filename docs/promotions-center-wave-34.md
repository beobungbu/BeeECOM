# Wave 34 — Promotions Center

Base: `10887c5223cd10f364ef6c8c04d6de15065456db`

## Product goal

Turn promotion scheduling into a reusable Admin campaign-management workflow rather than a single seeded campaign editor.

- Create validated percentage or fixed-value promotions through the Admin UI.
- Persist new campaigns through the Worker + D1 API with unique normalized codes.
- Edit existing campaign copy, discount type/value and schedule.
- Activate/deactivate campaigns and present Active / Scheduled / Inactive / Expired business status.
- Reuse the already-validated BeeUI DatePicker and DateTimePicker product contracts without pulling in standalone Calendar acceptance.

## Evidence

`tests/e2e/product-promotions-center.spec.ts` covers UI create/edit/activate persistence, duplicate-code and invalid-window rejection, reload state, 390px no-overflow, serious/critical axe checks and desktop/mobile screenshots.

## BeeUI discipline

BeeUI remains the published external dependency. This wave uses families already independently green in BeeECOM; any new public-package mismatch remains log-only upstream and must not be hidden with a consumer workaround.
