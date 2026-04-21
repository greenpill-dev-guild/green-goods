# Closed Loop Cleanup V1 Metrics

## Active Loop Family

| Loop | Owning lane | Editable surface | Metric | Time budget | Keep gate | Revert / bail trigger |
|---|---|---|---|---|---|---|
| `cleanup` | `state_api` | exactly one declared cleanup surface chosen from the hub candidate ladder | bounded dead-surface count decreases while `node scripts/ci-local.js --quick` stays green | 30-45 min | declared surface stays in bounds, targeted package validation passes, quick CI stays green, and the dead-surface claim remains high confidence | validation fails, edits drift outside the declared surface, parity / reachability becomes uncertain, or another active stream still owns the area |

## Run Outcomes

| Outcome | Meaning |
|---|---|
| `keep` | the declared cleanup change is valid, in scope, and passes the required checks |
| `revert` | the change failed validation or drifted outside the declared cleanup surface |
| `bail` | the candidate would require parity review, route judgment, or behavioral comparison |
| `blocked` | the hub is not active yet, the shared tests + Storybook stream is still the blocker, or another prerequisite is missing |

## Default Candidate Order

| Order | Candidate | Surface | Notes |
|---|---|---|---|
| 1 | `admin-routes-shim` | `packages/shared/src/utils/admin-routes.ts` | Smallest current deprecated shim candidate |
| 2 | `is-zero-address-alias` | `packages/shared/src/utils/blockchain/vaults.ts`, `packages/shared/src/utils/index.ts`, `packages/shared/src/index.ts` | Alias + barrel cleanup only |
| 3 | `work-status-alias` | `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx` and its barrel exports | Allowed only as a single cohesive alias cleanup |

If none of these candidates still qualify at promotion time, record `blocked` and refresh the
candidate ladder from `.plans/clean/` before attempting a live run.
