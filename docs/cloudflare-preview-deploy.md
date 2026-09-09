# BeeECOM Cloudflare preview deployment

This runbook describes the first deployable environment for BeeECOM. It is a **preview/demo** environment, not a production commerce backend.

## What is deployed

- `beeecom-api-preview`: Cloudflare Worker REST API + Durable Object chat coordinator.
- `beeecom-demo`: D1 canonical demo state.
- `beeecom-storefront-preview`: Cloudflare Worker Static Assets SPA.
- `beeecom-admin-preview`: Cloudflare Worker Static Assets SPA.
- Mobile iOS/Android builds point to the same API through `EXPO_PUBLIC_API_BASE_URL`.

BeeUI is pinned to `0.86.2-rc.1` for this showcase line.

## Cloudflare resources

Create one D1 database named `beeecom-demo` (or choose another name and set the variable below). Record its database UUID.

The API Worker configuration is generated at deployment time. No account IDs, D1 IDs or application secrets are committed.

## GitHub environment: `preview`

Required secrets:

- `CLOUDFLARE_API_TOKEN` — token allowed to deploy Workers and manage D1 for this account.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `BEEECOM_DEMO_RESET_TOKEN` — high-entropy token required by `/api/v1/demo/reset`.

Required variables:

- `CLOUDFLARE_D1_DATABASE_ID` — UUID of the preview D1 database.
- `BEEECOM_API_BASE_URL` — stable public base URL of `beeecom-api-preview` (Workers.dev or custom domain).
- `BEEECOM_CORS_ORIGINS` — comma-separated allowed Storefront/Admin browser origins.

Optional variables:

- `BEEECOM_D1_DATABASE_NAME` — defaults to `beeecom-demo`.
- `BEEECOM_API_WORKER_NAME` — defaults to `beeecom-api-preview`.
- `BEEECOM_DEFAULT_SCENARIO` — defaults to `healthy`.

## First deployment

1. Create the D1 database and record its UUID.
2. Configure the GitHub `preview` environment secrets/variables above.
3. Ensure `BEEECOM_API_BASE_URL` resolves to the API Worker name/custom route that will be deployed.
4. Run GitHub Actions -> `Deploy Preview` -> `Run workflow` on the exact reviewed SHA.

The workflow performs, in order:

1. clean dependency install;
2. full repository check;
3. generated API Wrangler config;
4. remote D1 migrations;
5. API Worker + Durable Object deployment with reset secret uploaded in the same deployment;
6. `/health` smoke test;
7. Storefront rebuild using `VITE_API_BASE_URL`;
8. Storefront Static Assets deployment;
9. Admin rebuild using the same API URL;
10. Admin Static Assets deployment.

Normal PR CI performs Wrangler `--dry-run` deployment validation for all three deployable Workers without requiring Cloudflare credentials.

## Deterministic reset

The public reset endpoint must never be deployed without `BEEECOM_DEMO_RESET_TOKEN`. The deployment workflow supplies it as a Worker secret. Reset requests require the `x-demo-reset-token` header and a named scenario.

Do not expose the reset token in Storefront/Admin client bundles. Public scenario-selection UI, if added later, must go through a safer server-side control rather than embedding the secret in browser JavaScript.

## CORS

`BEEECOM_CORS_ORIGINS` should contain only the deployed browser origins, for example the Storefront and Admin Workers.dev/custom-domain origins. Do not use `*` for the shared showcase environment.

## Native

For a native preview build, set:

```text
EXPO_PUBLIC_API_BASE_URL=<same BEEECOM_API_BASE_URL>
```

The mobile bundle already consumes the shared API and does not require a separate backend.

## Rollback

- Application code: use Cloudflare Worker deployment/version rollback for each Worker or redeploy a previously green SHA.
- Demo data: run the protected deterministic reset endpoint with the `healthy` scenario.
- Schema: D1 migrations are forward-applied. Do not perform destructive rollback migrations in the shared preview environment; provision a fresh preview D1 database if a schema experiment must be discarded.

## Preview-ready vs showcase-ready

A green deploy dry-run means **preview-deployable**: packaging and Cloudflare configuration are valid, but the account resources/credentials still must exist.

A **public showcase release** additionally requires WBS-13 release evidence: deployed golden-flow E2E, responsive/visual/accessibility evidence, Worker+D1 integration coverage, native runtime device/simulator evidence, documented demo script and known limitations.
