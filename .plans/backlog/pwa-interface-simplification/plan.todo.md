# PWA Interface Simplification Plan

**Feature Slug:** `pwa-interface-simplification`
**Stage:** backlog
**Status:** DESIGN REVIEW — no implementation authorized
**Created / Last Updated:** 2026-10-06

The accepted direction is in [brief.md](brief.md); requirements and open decisions are in
[spec.md](spec.md). [status.json](status.json) owns lane state. This plan creates no Linear record
and does not alter existing hubs. No branch or implementation task has been dispatched.

## Design gate

- [x] Record the user's confirmed preferences separately from recommendations.
- [x] Identify the existing Home, sheet, garden-switching, and submission owners.
- [x] Bound this hub against Community, Commitment Pooling, Credit, CLC, and admin work.
- [x] Define evaluation and recovery cases without claiming measured improvement.
- [ ] Refresh the rendered baseline for the exact release being redesigned; label engine/session.
- [ ] Compare compact journal and featured activity using the same realistic content.
- [ ] Resolve the four product decisions in the specification; record acceptance explicitly.
- [ ] Specify selection persistence, deep links, sheet scope, role capabilities, and draft recovery.
- [ ] Approve the first implementation slice and promote the hub only when execution is authorized.

Existing prototypes are exploratory inputs. Preserve an accepted design as a portable, sanitized
artifact when one is selected; do not commit private transcript material or host-specific previews.

## Conditional delivery sequence

These steps describe future work. They are not authorization to start it. Select exact files and
focused tests from the then-current owning code before each bounded change. Split a step further
if it would exceed one coherent session or mix independent behaviors.

| Step | Lane | Work and likely owners | Completion evidence |
|---|---|---|---|
| 1. Garden-context contract | `state_api` | Reuse membership and identity sources; define selected-garden state, persistence, and invalidation in Shared. Inspect existing hooks/stores before introducing an owner. | Focused proof for zero/one/many gardens, account/chain switch, failed reads, revoked membership, and no draft mutation. |
| 2. Scoped Home shell | `ui` | Home plus a PWA-appropriate garden switcher. Preserve directory/join behavior and bottom navigation. | Rendered zero/one/many states, existing-link behavior, and accessible switching at phone widths. |
| 3. Selective Home sections | `ui` | Activity, unfinished work, participation; reuse current read models and route into existing detail/sheet surfaces. Any new derivation belongs in a separate bounded Shared step. | Correct ordering, truthful counts/status, empty/loading/error/offline states, and no duplicate workflow. |
| 4. Deeper actions | `ui` | Accepted management/about placement and existing sheet launchers; retain all current permission-gated destinations. | Gardener, steward, evaluator, owner, community-member, and qualifying-depositor access matrix. |
| 5. Submission context | `state_api` | Existing work-flow controller and selection state carry valid garden/promise/requirement context; preserve draft and queue identities. | RED/GREEN proof at the owning boundary for fresh, promise-linked, draft, and invalid-context entry. |
| 6. Submission presentation | `ui` | Existing Intro and submission shell display preselection and skip only choices already resolved; preserve action-specific details and review. | Rendered full path and recovery with original drafts/unlinked work still accessible. |
| 7. Acceptance | `qa_pass_1`, then `qa_pass_2` | User-flow review followed by independent regression review. Update accepted design documentation with the implementation. | Criteria in [eval.md](eval.md), accurate session labels, and fresh receipts for the changed surfaces. |

Step 4 depends on accepted action placement, not on a CLC release. Step 5 can be designed alongside
Home, but must be independently verified before step 6 consumes it. No contract lane is needed.
No admin, indexer, or protocol migration is expected; a discovered need returns to scope review.

## Requirements coverage

| Requirements | Planned steps |
|---|---|
| R1 garden-scoped entry and switching | 1–2 |
| R2 ordered, selective previews | 3 |
| R3 familiar navigation and sheets | 2–4, 6 |
| R4 deeper garden actions | 4 |
| R5 submission and draft continuity | 1, 5–6 |
| R6 role/capability preservation | 1, 4, 7 |
| R7 existing records, recovery, and domain boundaries | 3, 5–7 |
| R8 discovery and personal context | 2–4, 7 |

## Execution rules

- Re-read nearest package guides, PWA design decisions, and relevant concurrent changes before work.
- Use Shared for React hooks and authoritative state; consume its declared exports.
- Reuse AppSheet/PwaSheet, existing queue/state derivations, and action schemas. Avoid a new generic
  dashboard framework, duplicate queue, role switch, or speculative per-garden configuration.
- Keep strings in existing i18n, retain accessibility and offline behavior, and preserve current
  badge meanings. Existing deep links and unlinked work need no forced migration.
- Select meaningful failing proof for changed behavior before implementation. Record RED/GREEN in
  lane handoffs and with the plan helper before terminal lane claims. A visual-only proof limit
  must be explicit; do not use it to waive state or recovery proof.
- Create lane handoffs when moving to active. Keep branches null until separately authorized work
  begins; a lane owner is a planning default, not an instruction to start another agent.
- Use the validation selector for the eventual changed surfaces. Auth/queue-sensitive paths retain
  their critical checks. Browser evidence must use the repository's engine/session labels.

## Planning validation

The hub-only check is `node scripts/harness/plan-hub.mjs validate`. Check local Markdown links and
JSON consistency as well. Application tests and rendered implementation proof are not applicable
to creating this hub; no implementation lane is passed by these document checks.

Validation result is recorded after execution in [eval.md](eval.md#hub-creation-check).
