# Karma GAP Integration Repair Specification

## Summary

Repair the Karma GAP integration at the authority boundary rather than masking it in the UI.
GardenAccount remains the Karma project owner and makes direct ProjectResolver access changes when
the configured Karma module requests a role-verified sync. KarmaGAPModule owns idempotent project,
details, membership, and Project Update reconciliation. A replay-safe event projection then gives
shared and admin consumers an observable recovery model.

## Users

- Primary: Garden Owners and Stewards operating a Garden from the admin canvas.
- Secondary: Gardeners and funders viewing Garden work on Karma.

## Functional Requirements

1. Garden initialization creates or reconciles the Karma project before role synchronization.
2. The Karma project owner is the GardenAccount; the module cannot become a permanent project admin.
3. Current Garden Owners and Stewards are Karma project members and admins. Removing either Hat
   removes project admin while historical membership remains.
4. `GardenAccount.karmaSyncVersion()` exposes upgrade readiness and
   `GardenAccount.syncKarmaProjectAccess(address)` accepts calls only from the configured Karma
   module, then calls Karma's ProjectResolver directly using Hats as role truth.
5. `KarmaGAPModule.reconcileProject(garden)` is permissionless and idempotent: it validates the
   Garden, creates a missing project, and creates ProjectDetails only when the canonical details
   hash changed.
6. `KarmaGAPModule.reconcileProjectAccess(garden, account)` is permissionless but role-verified and
   reconciles Karma membership plus project-admin state through the GardenAccount.
7. Name, description, location, and image metadata updates trigger best-effort reconciliation.
   Integration failure never reverts canonical Garden metadata, but always emits an observable
   failure outcome.
8. Approved Work remains a Karma Project Update. Its JSON uses supported Project Update fields only:
   `title`, `text`, `startsAt`, `endsAt`, `deliverables`, and `type`.
9. Project Update text includes Markdown links to the canonical Green Goods Work route and the
   original EAS attestation. Deliverable proof and metadata URLs are browser-safe HTTP URLs, never
   `ipfs://` or an embedded URL prefixed with `ipfs://`.
10. ProjectDetails writes the canonical Garden image as Karma `imageURL` using an HTTP gateway URL.
11. `KarmaSyncRecorded` reports Garden, project UID, account, operation, outcome, source UID, result
    UID, and reason while existing integration events remain backward compatible.
12. The indexer registers the Karma proxy/module emitter, persists replay-safe sync records, and
    projects Garden-level sync status without indexing EAS attestations.
13. Shared exposes typed status and role-aware reconcile hooks through declared exports. It reports
    the legacy migration boundary without offering an upgrade transaction that cannot succeed.
14. `/garden` shows one compact Karma integration panel with Karma profile link, no-project,
    upgrade-needed, stale-details, access-pending, failed, retrying, and synced states. The
    upgrade-needed state explains that a reviewed compatibility migration is required; Owner/Steward
    retry follows existing privileged mutation patterns. All strings exist in English, Spanish,
    and Portuguese.

## Research Evidence

- `packages/contracts/src/modules/Karma.sol` currently calls GAP facade admin methods and stores the
  project UID after role hooks may already have run.
- Karma's ProjectResolver authorizes its direct caller. A call routed through GAP changes
  `msg.sender` to GAP, producing `ProjectResolver: Not owner` even when GardenAccount owns the
  project.
- `packages/contracts/src/resolvers/WorkApproval.sol` intentionally calls the Karma integration
  best-effort so an external integration cannot block a Work approval.
- The current payload adds unsupported top-level `links` and `metadataCID`; Karma renders Project
  Update `text` as Markdown and deliverable proof as a URL.
- The current indexer registers `GAPProjectCreated` on the GardenAccount implementation even though
  the Karma module emits it, and therefore cannot be a trustworthy reconciliation source.
- GardenToken derived existing GardenAccounts directly from the GardenAccount implementation, not
  from the separately deployed AccountProxy. Those ERC-6551 delegates cannot execute UUPS upgrades,
  even when called by the Garden NFT owner. A separately reviewed compatibility design is required.
- Aiyeloja Family Garden is the release canary reference:
  `https://www.karmahq.org/project/aiyeloja-family-garden`.

## State and Invariant Matrix

| Action | Garden state | Actor / role | Expected effect |
|---|---|---|---|
| Reconcile project | missing | anyone | one GardenAccount-owned project and current details |
| Reconcile project | present/current | anyone | no duplicate attestation |
| Reconcile access | Owner or Steward | anyone triggers | member present, admin present |
| Reconcile access | role revoked | anyone triggers | admin removed, membership retained |
| Sync from account | any | non-Karma module | revert without external write |
| Metadata update | Karma healthy | authorized Garden editor | canonical metadata persists and details converge |
| Metadata update | Karma failing | authorized Garden editor | canonical metadata persists and failure event records retry need |
| Work approval | Karma healthy | valid independent approver | supported Project Update emitted once |
| Work approval | Karma failing | valid independent approver | approval remains valid and failure is observable |
| Replay sync event | already indexed | indexer | same entity is updated, never duplicated |
| Inspect migration readiness | legacy account | anyone, read-only | identify immutable delegate and block release |

## Human Judgment Points

- Approved: GardenAccount owns the project; the Karma module is not made a permanent admin.
- Approved: Project Update semantics remain unchanged; existing immutable updates are legacy and
  are not duplicated.
- Approved: current Owner and Steward Hats define live project-admin parity; membership is historical.
- Approved: all existing Arbitrum Gardens are eventual migration scope, with Aiyeloja first.
- Discovered boundary: existing GardenAccounts cannot receive this implementation through UUPS;
  the UI and inventory must report that fact rather than expose a misleading upgrade action.
- Protected boundaries: Solidity storage layout, GardenAccount UUPS authorization, Karma resolver
  addresses/schema identifiers, and release inventory require independent review before any
  production upgrade or reconciliation.

## Non-Functional Constraints

- Additive ABI and storage-safe changes only; preserve storage gaps and legacy selectors.
- External Karma failure remains isolated from core Garden creation, metadata, and Work approval.
- No unbounded on-chain Garden or steward loops; reconciliation is per Garden/account.
- Hooks live in `@green-goods/shared`; indexer entities include `chainId`.
- UI is operational, permission-aware, translated, and reduced-motion safe.
- No environment, dependency, deploy, broadcast, or live authority mutation in implementation.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| GardenAccount, Karma module, library, interfaces, tests | `contracts` | Critical; RED first and storage proof |
| Indexer event/config/schema/tests and shared hooks/types | `state_api` | Sensitive; indexer before shared consumers |
| Admin `/garden` status and recovery panel | `ui` | Depends on shared status contract |
| Independent regression and security review | `qa_pass_1`, `qa_pass_2` | No deployment authorization |

## Risks

- A mistaken resolver interface could strand project ownership. Mitigation: faithful local resolver
  integration tests plus a pinned Arbitrum fork check selected by validation.
- Additive GardenAccount storage/function changes preserve layout for compatible deployments, while
  faithful upgrade tests prove the current direct-delegate accounts reject UUPS. Mitigation: block
  release until a separate legacy-compatibility design is reviewed; no broadcast.
- Best-effort hooks can hide failures. Mitigation: structured outcome event, replay-safe indexer
  projection, visible admin status, and explicit retry.
- Event/ABI changes can drift downstream consumers. Mitigation: dependency-ordered generation,
  indexer boundary checks, shared public-export tests, and root quick gate.
