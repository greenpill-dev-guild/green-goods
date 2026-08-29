# Karma GAP Integration Repair Evaluation Plan

## Release Gates

1. **Authority correctness**: only GardenAccount ownership crosses the ProjectResolver admin
   boundary; the module never acquires permanent admin rights.
2. **Role parity**: Owner/Steward additions and revocations converge without duplicate attestations.
3. **Rendering correctness**: details and Project Updates use Karma-supported fields and browser-safe URLs.
4. **Failure observability**: every best-effort path records a structured outcome and indexer replay is idempotent.
5. **Recovery usability**: the admin surface distinguishes migration-needed, details, access,
   failure, retry, and synced states with correct authorization.
6. **Upgrade safety**: additive storage/ABI changes pass selected layout and size checks; faithful
   tests prove legacy direct-delegate accounts cannot execute UUPS.
7. **Evidence quality**: RED/GREEN lane proof and current validation receipts are recorded before
   any completion claim.
8. **Release boundary**: no test result authorizes a deployment, account upgrade, broadcast, or live reconciliation.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Creation ordering | Project exists before initial Owner/Steward access sync | `contracts` | integration test |
| AC-2 | Resolver authority | GardenAccount direct call succeeds; GAP facade indirect call fails | `contracts` | faithful resolver test |
| AC-3 | Role parity | Owner/Steward add and revoke reconcile admin; membership remains | `contracts` | unit/integration tests |
| AC-4 | Idempotency | repeated project/details/access reconciliation emits no duplicate attestations | `contracts` | unit tests |
| AC-5 | Metadata | canonical name, description, location, and image changes converge without blocking core writes | `contracts` | unit tests |
| AC-6 | Project Update JSON | supported keys only, Markdown GG/EAS links, HTTP proof/metadata URLs | `contracts` | schema tests |
| AC-7 | Event boundary | Karma proxy/module is registered and replay-safe records carry chain ID | `state_api` | boundary, handler, replay tests |
| AC-8 | Shared state | status derivation and role-aware retry expose errors and invalidate canonical keys; immutable accounts have no false upgrade mutation | `state_api` | direct hook/model tests |
| AC-9 | Admin recovery | every status renders; retry follows permissions and migration-needed is informational | `ui` | view tests + authenticated Brave proof |
| AC-10 | Regression review | storage, ABI, event, permission, and failure-isolation siblings are reviewed | `qa_pass_1` | review handoff |
| AC-11 | Final closure | selected validation is fresh and no Critical/High defect remains | `qa_pass_2` | final handoff |

## Required Negative Proof

- A non-Karma caller cannot invoke GardenAccount access sync.
- The Karma module cannot add itself as a permanent project admin.
- Revoking a Steward does not delete historical membership.
- A repeated reconcile does not mint a duplicate project, details, membership, or update record.
- `ipfs://https://...`, unsupported `links`, and unsupported `metadataCID` cannot appear in new payloads.
- Karma failure does not revert Garden metadata or Work approval.
- The indexer does not register Karma events against GardenAccount and does not index EAS attestations.
- Legacy deterministic GardenAccounts cannot perform a UUPS upgrade, including when called by the
  Garden NFT owner; no UI or release tool implies otherwise.
- No migration command broadcasts by default.

## Test Strategy

- **Contracts**: focused Foundry unit, schema, integration, storage-layout, upgrade-safety, and selected fork tests through Bun wrappers.
- **Indexer**: codegen when schema/config changes, boundary check, focused handler tests, replay/partial-failure tests, TypeScript build.
- **Shared**: direct tests for status derivation and mutation hooks, typecheck, public-export coverage.
- **Admin**: route-local component/view tests for all states and permissions, build when route wiring changes.
- **Browser**: authenticated Brave proof on `/garden`; if the profile is unavailable, record QA as blocked rather than substituting an isolated browser.
- **Cross-package**: root validation selector plus its selected Repo Quick Gate checks.

## Validation Receipt Requirements

Each completed implementation or QA lane records exact tested commit SHA, UTC timestamp, exact Bun
command, summarized result, validated paths, and an empty path-scoped worktree status. A dirty tree
can record iterative RED/GREEN evidence but cannot claim a commit-attributed terminal receipt.
