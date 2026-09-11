# Product Admin shell — Wave 36

Issue: #68  
Parent: #8 (WBS-07 Admin Web)  
Authoritative base: `ffc06ecc81842d0fcadbc45f064d438e52db2dab`

## Why this wave exists

The Admin app already had an operations dashboard plus product-quality Catalog/Inventory and Promotions surfaces, but the latter were only discoverable through `/conformance/*` acceptance URLs. That is useful for isolated consumer validation but not a credible product experience.

Wave 36 introduces a small product-facing Admin shell without adding a router dependency or moving business state into navigation.

## Product routes

- `/` — Operations
- `/catalog` — Catalog & inventory
- `/promotions` — Promotions

Cloudflare Admin already configures `assets.not_found_handling = "single-page-application"`, so these paths support direct navigation and reload in the deployed SPA as well as Vite development.

The existing conformance paths remain isolated and unchanged:

- `/conformance/catalog-inventory`
- `/conformance/promotions`
- other existing `/conformance/*` harnesses, including theme preference

## Shell semantics

`AdminShell` owns navigation context only. Feature surfaces continue to own canonical API reads and mutations.

The shell uses native Web navigation semantics intentionally:

- `<nav aria-label="Admin primary navigation">` for the three product sections;
- real `<a href>` deep links so browser navigation/reload works without custom client routing;
- `aria-current="page"` on the active section;
- a separate breadcrumb landmark with current-page context;
- responsive one-column-to-three-column navigation rather than a Sheet/Dropdown mobile drawer.

The last choice is deliberate: Sheet and Dropdown currently have known BeeUI upstream conformance blockers in separate BeeECOM draft PRs. Product navigation must not hide those defects behind a consumer workaround or depend on a known-red primitive.

## Acceptance evidence

`tests/e2e/product-admin-shell.spec.ts` covers:

1. visible navigation from Operations → Catalog → Promotions and programmatic current state;
2. direct `/catalog` and `/promotions` reload behavior;
3. isolated `/conformance/*` aliases with no product shell injection;
4. 390px no-horizontal-overflow, all navigation destinations visible and serious/critical axe = 0;
5. desktop and mobile full-page evidence.
