# Karma GAP Arbitrum Release Evaluation Plan

## Release Gates

1. **Authority**: the compatibility path never gives the Karma module permanent project-admin
   rights; only the GardenAccount crosses the ProjectResolver admin boundary.
2. **History**: the upgrade seeds every historical work-to-update pair, and no historical Project
   Update is duplicated.
3. **Canary first**: Aiyeloja's live post-state verifies before any other Garden is touched.
4. **Evidence**: each broadcast is preceded by a fresh read-only inventory with no blockers and
   followed by live post-state verification.
5. **Release boundary**: no test result authorizes a deployment, upgrade, broadcast, or
   reconciliation; each needs its own human authorization.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Legacy compatibility | The chosen path reaches existing GardenAccounts without widening authority | `contracts` | Faithful resolver tests and pinned fork proof |
| AC-2 | Upgrade seeding | Missing, mismatched, zero, or conflicting pairs block the upgrade | `contracts` | Upgrade tests |
| AC-3 | Canary post-state | Sync version, Karma URL, details, image, membership, admin access, and revocation match | `state_api` | Live reads and indexer projection |
| AC-4 | Admin panel | `/garden` shows the synced state for the canary | `ui` | Authenticated Brave proof |
| AC-5 | Release review | Storage, ABI, permission, and failure-isolation siblings are reviewed with no open Critical or High finding | `qa_pass_1` | Review handoff |
| AC-6 | Closure | Fresh evidence agrees across contracts, indexer, and admin | `qa_pass_2` | Final handoff |

## Test Strategy

- Unit and integration: Foundry tests through Bun wrappers, using a resolver that keeps Karma's
  real ownership semantics.
- Fork: pinned Arbitrum fork proof of the compatibility path and the seeded upgrade.
- Manual checks: a read-only inventory before each release step and authenticated Brave proof on
  `/garden`.
- TDD proof: RED/GREEN commands and evidence are recorded in lane handoffs and summarized in
  `status.json`.
