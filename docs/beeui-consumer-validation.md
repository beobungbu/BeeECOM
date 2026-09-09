# BeeUI consumer validation log

BeeECOM is both an e-commerce reference application and an external consumer-validation program for BeeUI.

## Pinned consumer baseline

- BeeUI package version: `0.86.2-rc.1`
- Consumption model: public npm package boundary; no private BeeUI source imports
- Node: `24.13.1`
- pnpm: `10.15.0`
- React: `19.2.3`
- React Native: `0.86.2`
- React Native Web: `0.21.0`
- Expo: `57.0.18`
- Vite: `8.2.2`
- Tailwind: `4.3.3`
- Uniwind: `1.10.1`

Do not silently float BeeUI or its tested consumer stack while comparing results. A version change starts a new validation baseline.

## Evidence records

### EV-001 — Gate 0 foundation

- BeeECOM PR: #16
- Exact green head: `c028c12bebdb8024df3efa722d990dbc160888f1`
- Evidence: clean install, build, strict TypeScript, domain tests and deterministic dummy-data tests
- BeeUI surface involved: none yet; this establishes the shared consumer architecture/API baseline.

### EV-002 — Public package consumer shells

- BeeECOM PR: #17
- Exact green head: `83b8c9f1813668cb708e2fd2dac5fdd33ffbeed1`
- Evidence:
  - public `@beemvp/beeui-*@0.86.2-rc.1` packages install successfully;
  - Storefront Vite production build succeeds;
  - Admin Vite production build succeeds;
  - Expo Web export succeeds;
  - strict TypeScript succeeds across all workspace packages;
  - domain/dummy-data tests succeed.
- BeeUI surfaces: `BeeUIProvider`, `Screen`, `Box`, `Card`, `Text`, `Button`, `Table` family and shared commerce compositions.

## Upstream findings

### F-001 — Publication-state guidance conflict

- Classification: BeeUI documentation + LLM/agent guidance gap
- BeeUI issue: https://github.com/beobungbu/BeeUI/issues/543
- Trigger: clean external consumer bootstrap
- Observed:
  - current BeeUI README says `0.86.2-rc.1` is public on npm and recommends `@next` / exact RC;
  - current `docs/ai-agent-cookbook.md` still says BeeUI is unpublished, npm resolves 404 and agents must never recommend npm installation.
- Consumer impact: human and coding-agent bootstrap instructions diverge before application code starts.
- BeeECOM workaround: use the current release-control-plane/README truth and pin exact `0.86.2-rc.1`; record the contradiction instead of hiding it.

### F-002 — Expo / metro-runtime peer-pin drift

- Classification: BeeUI compatibility/reference-consumer gap
- BeeUI issue: https://github.com/beobungbu/BeeUI/issues/544
- Trigger: clean install of BeeUI's tested Expo consumer stack
- Observed peer warning:
  - `expo 57.0.18` → `@expo/cli 57.0.23` → `@expo/router-server 57.0.9` requires `@expo/metro-runtime ^57.0.15`;
  - BeeUI Expo reference consumer pins `@expo/metro-runtime 57.0.14`.
- Current impact: warning only. Install and Expo Web export still succeed.
- BeeECOM workaround: retain BeeUI's reference pin until the upstream compatibility authority is corrected; do not silently invent a wider support claim.

## Finding classification rule

Every issue discovered while building BeeECOM must be classified before a workaround is accepted:

1. BeeECOM domain/application concern;
2. BeeUI primitive/pattern gap;
3. BeeUI bug or platform divergence;
4. BeeUI documentation gap;
5. BeeUI LLM/agent-guidance gap;
6. external toolchain/dependency issue.

If the finding belongs to BeeUI, create/link an upstream BeeUI issue with a BeeECOM reproduction. Do not bury it in app-local styling or private source imports.

## Golden-slice acceptance evidence

PR #18 targets this external-consumer scenario:

1. browse deterministic catalog;
2. open a product-detail composition;
3. choose a real variant and quantity;
4. add it to the D1-backed cart;
5. apply a persisted coupon;
6. simulate checkout and create a D1-backed order;
7. load the same order from Admin;
8. customer sends a support message;
9. Admin reads the same thread and persists an agent reply;
10. reload/re-fetch restores canonical history.

Realtime WebSocket fan-out is a separate WBS-09 increment; D1 remains the canonical chat-history authority.
