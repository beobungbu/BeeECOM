# Known upstream BeeUI blockers

BeeECOM intentionally keeps confirmed BeeUI defects visible instead of normalizing them with application workarounds. A blocker here may stop one validation cell without stopping unrelated BeeECOM work.

| BeeUI issue | BeeECOM reproduction | Surface | Status | Policy |
| --- | --- | --- | --- | --- |
| [BeeUI #548](https://github.com/beobungbu/BeeUI/issues/548) | BeeECOM PR #32, exact diagnostic head `71d9e3fce693af185b233aaeadca386ac8146cea` | Web Sheet viewport/backdrop/percentage snap geometry on a short app root | Confirmed upstream defect | Keep PR #32 draft/red. Do not add a global-height workaround. Re-run the same acceptance assertion against the next BeeUI RC that contains the upstream fix. |
| BeeUI motion token reader issue (pending issue reference) | BeeECOM PR #33, CI run `34419184167`, exact head `91c21bfbc6dffd2f1601bd6521cbcf36f03de86d` | `useBeeToken('motion.normal')` on Web | Confirmed runtime mismatch: token reader expects `ms`, Uniwind returns `.2s` from `--motion-duration-normal` | Quarantine the motion-token assertion from the scoped-theme acceptance so scope/portal coverage can continue. Preserve this exact failing evidence and re-enable the assertion only after consuming an upstream fix. |

## Quarantine rule

A quarantined upstream defect must have:

1. an exact external-consumer reproduction;
2. an upstream BeeUI issue;
3. a BeeECOM matrix/tracking reference;
4. no silent application workaround that changes the public contract under test;
5. an explicit re-test condition for the BeeUI revision that contains the fix.
