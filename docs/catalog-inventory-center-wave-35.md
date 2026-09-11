# Catalog & Inventory Center — Wave 35

Issue: #66  
Parent: #8 (WBS-07 Admin Web)  
Authoritative base: `8253f92329736df2da79a1f3f488545edb4b9efc`

## Product slice

Wave 35 promotes catalog and inventory administration beyond the focused `/conformance/forms` fixture. The new `/conformance/catalog-inventory` surface loads the canonical Worker/D1 catalog and lets an operator:

- search across product title, slug, tags, SKU and variant title;
- select any canonical product rather than implicitly editing `items[0]`;
- update product title, description and featured merchandising state through the typed Admin client;
- select any variant rather than implicitly adjusting `variants[0]`;
- add/remove stock with a reason and explicit review confirmation;
- see canonical stock quantity/state update immediately and after reload;
- monitor total products, available units, low-stock and out-of-stock counts;
- use the same responsive list/editor composition from 390px through desktop without a separate mobile data model.

The old `/conformance/forms` fixture remains a focused BeeUI form-contract harness. It is intentionally not repurposed as the product management UI.

## API boundary hardening

Independent review found that the pre-existing product Admin handlers cast untrusted JSON directly to TypeScript interfaces. Runtime values such as `{ "title": 123 }` or `{ "reason": 123 }` could therefore reach `.trim()` and escape as Worker 500s.

This wave validates product/inventory payload fields before business logic:

- metadata fields must have the documented string/boolean/string-array runtime types;
- inventory `variantId` and `reason` must be non-empty strings;
- `adjustment` must be a non-zero integer;
- negative resulting stock remains a canonical `409 NEGATIVE_INVENTORY` conflict;
- malformed payloads return deterministic 400 responses and do not mutate D1 state.

No new product model, API client or persistence authority is introduced.

## Acceptance evidence

`tests/e2e/product-catalog-inventory-center.spec.ts` validates:

1. editing `Trail Runner` (a non-first product) and persistence after reload;
2. selecting `TRAIL-41` (a non-first variant), adjusting stock and persistence after reload;
3. SKU search over the canonical loaded catalog;
4. malformed metadata/inventory payload rejection plus negative-stock rejection without state corruption;
5. 390px no-horizontal-overflow and serious/critical axe scan;
6. mobile and desktop full-page product evidence.

## BeeUI discipline

BeeECOM consumes only published BeeUI `0.86.2-rc.1`. Existing upstream conformance blockers remain isolated in their draft PRs. If this product wave exposes a genuine new BeeUI defect, preserve the consumer assertion and log/reuse the upstream issue instead of weakening the test or adding a BeeECOM-specific framework workaround.
