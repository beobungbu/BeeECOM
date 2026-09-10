# Known upstream BeeUI blockers

BeeECOM intentionally keeps confirmed BeeUI defects visible instead of normalizing them with application workarounds. A blocker here may stop one validation cell without stopping unrelated BeeECOM work.

| BeeUI issue | BeeECOM reproduction | Surface | Status | Policy |
| --- | --- | --- | --- | --- |
| [BeeUI #548](https://github.com/beobungbu/BeeUI/issues/548) | BeeECOM PR #32, exact diagnostic head `71d9e3fce693af185b233aaeadca386ac8146cea` | Web Sheet viewport/backdrop/percentage snap geometry on a short app root | Confirmed upstream defect | Keep PR #32 draft/red. Do not add a global-height workaround. Re-run the same acceptance assertion against the next BeeUI RC that contains the upstream fix. |
| [BeeUI #549](https://github.com/beobungbu/BeeUI/issues/549) | BeeECOM PR #33; exact failing head `5e693a98d01d55159f449876a497154ce9755e39`, CI `34419564897` | `useBeeToken('motion.normal')` on Web | Confirmed runtime mismatch: token reader expects `ms`, Uniwind returns `.2s` from `--motion-duration-normal` | Quarantine only the `motion.*` runtime probe so scoped color/radius/theme/portal acceptance continues. Preserve the failing evidence and re-enable the same motion assertion after consuming a BeeUI release containing #549. |

## Quarantine rule

A quarantined upstream defect must have:

1. an exact external-consumer reproduction;
2. an upstream BeeUI issue;
3. a BeeECOM matrix/tracking reference;
4. no silent application workaround that changes the public contract under test;
5. an explicit re-test condition for the BeeUI revision that contains the fix.
