# Wave 33 — Saved Items

Base: `d11bc79e767f65194c1ee5fa27a26a539b42f74e`

## Product goal

Turn the existing wishlist persistence into a complete reusable commerce flow rather than an account-only readout.

- Save/remove a selected product from Collections.
- Open a dedicated Saved Items surface from Collections or Account Hub.
- Add an in-stock saved product to the canonical cart without silently removing it from saved items.
- Persist save/remove/cart mutations through the existing Worker + D1 APIs.
- Preserve a useful empty state when nothing is saved.

## Evidence

`tests/e2e/product-saved-items.spec.ts` covers persisted save/remove state, cart mutation, Account Hub navigation, 390px no-overflow, serious/critical axe checks, and desktop/mobile screenshots.

## BeeUI discipline

This wave only uses BeeUI families already independently green in BeeECOM. It does not modify BeeUI source or introduce workarounds for known upstream blockers.
