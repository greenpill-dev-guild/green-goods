# PR #749 review feedback — ledger and disposition, 2026-08-22

Twenty-eight inline review threads on PR #749, all unresolved when this pass started: one from
`github-code-quality` and twenty-seven from four `chatgpt-codex-connector` passes (one per head,
`faf05338e` → `603163d7b` → `401794dc7` → `ce6359566`). Pagination ran to completion on reviews,
threads and replies; no top-level conversation comment carried actionable feedback.

Several threads independently reproduce findings from `client-loop-review-2026-08-21.md`, which is
useful corroboration: T2 is that review's B1, T20 its B2, T6 its N1, T5 its N3.

## Fixed

| # | Thread | Root cause | Where |
|---|---|---|---|
| T1 | Superfluous constructor argument | The jsdom `IntersectionObserver` mock declared no constructor while every caller passes a callback | `__tests__/setupTests.base.ts` |
| T4 | Retry never grants a fresh window | `retryQueuedJob` cleared `attempts` but left `metadataAttempts` / `evidenceAttempts` at their ceiling, so the next gateway failure re-terminated the job immediately | `job-queue/job-recovery.ts` |
| T5 | To confirm lists rows the detail refuses | The list has no roster, so a steward on the team was still listed and marked "needs you" while `confirmFulfillment` reverts `SelfConfirmation` | `hooks/commitment-pooling/useCommitmentsToConfirm.ts` |
| T6 | Discard can delete a broadcast job | `discardQueuedJob` guarded only on `synced`; a job with `meta.submittedTxHash` may already exist on chain, and its record carries the creation request key | `job-queue/job-recovery.ts`, `useCommitmentQueueState.ts`, `PendingCreationRow.tsx` |
| T8 | Stale Not-yet draft across commitments | `useState(() => read(key))` never re-ran when the router reused the component for a different commitment | `hooks/commitment-pooling/useCommitmentNotYetDraft.ts` |
| T9 | Read failure reported as "not yours" | The composer destructured neither `isError` nor `refetch`, so an indexer failure fell into the ownership branch with no way out | `Proof/ProofComposer.tsx`, `Proof/ProofShell.tsx` |
| T10 | Preview URLs leaked | The composer created `proof`-scope object URLs on the review beat but only the submit path released them | `Proof/ProofComposer.tsx` |
| T11 | Work paired with a mismatched row | `canConfirm` checked only that some work and some row were chosen; the contract rejects a mismatched action with `WorkActionMismatch` | `Commitment/LinkWorkDialog.tsx` |
| T12 | Join offered to non-members | `canJoinTeam` never asked about garden membership, which `AcceptanceLib` requires of a contributor | `modules/commitment-pooling/acts.ts`, `GardenCommitment.tsx` |
| T13 | Unbounded requirement count | The schema accepted any positive integer; `requiredCount` is a contract `uint32` | `hooks/commitment-pooling/useCommitmentComposerForm.ts` |
| T14 | Proof links silently truncated | The composer accepted unlimited links while the document keeps ten | `modules/commitment-pooling/evidence.ts`, `Proof/ProofDetails.tsx` |
| T15 | Cache keys outside the registry | Four queries declared literal keys, against the repo's `queryKeys.*` invariant | `config/query-keys/commitment-pooling.ts` + four hooks |
| T19 | Preview opened the wrong photo | `ProofMedia` reports an index across all media; the preview array excludes videos | `Proof/ProofComposer.tsx` |
| T20 | Demo acts could reach the chain | See the correction below | `job-queue/index.ts`, `useCommitmentMutations.ts` |
| T22 | Reasons silently truncated | `buildCommitmentReason` trimmed at 2,000 characters, so the pinned words could differ from the approved ones | `modules/commitment-pooling/reasons.ts`, `WithdrawDialog.tsx` |
| T26 | `httpx://` accepted then dropped | `.url()` plus `startsWith("http")` admits any scheme beginning "http"; the metadata builder keeps only `^https?://` | `hooks/commitment-pooling/useCommitmentComposerForm.ts` |
| T27 | Blank drawer after losing the role | `activeTab` kept pointing at a tab the conditional had removed | `CommitmentsDrawer/index.tsx` |
| T28 | Focus skipped the creation choices | The choices precede the toggle in DOM order and focus was never moved into them | `Pool/PoolCreateEntry.tsx` |

### Correction to the 2026-08-21 review

That review graded the demo-mode hole (B2) partly on the belief that mock auth has no signer. It
does. `DevAuthProvider` reports `authMode: "wallet"`, so `useTransactionSender` builds a real
`WalletSender` over wagmi's `writeContractAsync`; only `smartAccountClient` is null. A developer
with a wallet connected and `?mockPooling=1` therefore had a live signer over fixture ids. The
session report's line that "queued acts stay on the phone in this mode" was wrong.

Requiring the mock identity would not have closed it. The fix refuses the send instead: the queue
skips commitment kinds while demo mode is on (`demo-mode` waiting reason, so queued rows still
render, which is what the demo walk wants to show), and the online mutation throws before reaching
`sendContractCall`.

## Not fixed, and why

- **T2 — protocol-pool garden claims (P1).** The review's B1. Claims and confirmations take their
  garden from the route while the protocol pool is only listed under its host, so the garden door
  always sends the one context `AcceptanceLib` rejects. The fix needs an eligible-managed-garden
  chooser and a way into the protocol pool that is not "under its host" — a design change, not a
  patch. Deferred with the user's agreement.
- **T18 — Not yet from a garden-only confirmer (P1).** Same family as T2: `raiseDispute` accepts
  the creator, the counterparty address, a named confirmer or a pool steward, none of which a
  steward of the *claiming* garden is. Gating the option is small, but it belongs with T2 so the
  two do not disagree about who this seat is.
- **T21 — named confirmers behind the membership preflight (P1).** A named confirmer with no hat
  in the route garden parks on `membership-unavailable` forever. Real, and already recorded in the
  session report. The fix threads a "this authorization does not depend on membership" signal
  through the job payload on a critical surface; it wants its own change and its own proof.
- **T24 — approval-gated claims have no steward decision path.** `acceptClaim` / `declineClaim`
  exist only in the shared mutation type; no client or admin caller exists. Either build the
  steward surface (admin lane) or hide the option — a product call, not a review fix.
- **T7 — show evidence before confirming.** A real gap in the confirmation sheet, and a feature:
  resolving attribution documents and rendering a read-only proof preview.
- **T16 — reconcile evidence after an interrupted send.** Evidence jobs have no on-chain recovery
  read, so a broadcast-then-throw re-sends and `EvidenceAlreadyAttached` eventually reads as a
  terminal failure on proof that landed. Recorded as a gap in the 2026-08-21 review; the fix is a
  new recovery path on a critical surface.
- **T17 — recovery controls for failed non-creation acts.** Retry/discard reach only the pool's
  creation rows. Worth doing next to T16.
- **T23 — persist proof drafts.** Media picked offline dies with the process. A draft store, like
  the commitment composer's.
- **T25 — exclude work already linked elsewhere.** The picker checks only this commitment's
  attributions while `workCommitment[workUID]` is global. Needs per-work attribution data the
  screen does not load yet.
- **T3 — STALE.** Written against `faf05338e`, before `8a832021c` taught the detail screen to seat
  garden stewards through `stewardedGardens`. The concern it raises is exactly what that commit
  fixed; verified absent at the live head.

## Second round, same day — the fix commit's own review

Codex and the code-quality bot reviewed `1b93020d0` and opened seven more threads. All seven were
real; six are fixed here and one joins the deferred set. CI on the merge head `5e12c441d` was red
for one reason: `ProofComposer.tsx` had crossed the 350-line cap for *new* files. It had passed
locally only because the local check diffs against `HEAD~`, where the file counts as modified
(500 cap); CI diffs against `origin/develop`, where it is new.

| Thread | Root cause | Where |
|---|---|---|
| Useless conditional | `!detail && !isLoading` past the loading guard collapses to `!detail`, which also routed a genuinely missing commitment to "error" instead of "not yours" — a real bug in the T9 fix, not just dead code | `Proof/ProofComposer.tsx` |
| Include the personal query in the tab's error state | The own-set query added for T5 was omitted from `isLoading`, `isError` and `refetch`, so its failure silently re-admitted team rows | `useCommitmentsToConfirm.ts` |
| Refresh pending rows after skipped transitions | A flush that only parks a job on a preflight rewrites the record without `job:completed`/`job:failed`; the query has infinite stale time and did not subscribe to `queue:sync-completed` | `useCommitmentQueueState.ts` |
| Keep the cycle-less option when cycles are open | The effect rewrote the legal `cycleId === "0"` to the first open cycle, and the chooser never offered "none", so an unscoped commitment was impossible while any cycle ran. The contract accepts 0 unconditionally and the handoff names "one explicit cycle or cycle-less context" | `Compose/ComposeCommitment.tsx`, `Compose/ComposeWhat.tsx`, en/es/pt |
| Reuse one operation ID per submission | `linkWork` minted `clientOperationId` per tap, so a double tap before the pending state landed sent two jobs and the second reverted `WorkAlreadyLinked` | `Commitment/LinkWorkDialog.tsx`, `GardenCommitment.tsx` |
| Restrict protocol-pool creation to stewards | Both doors showed to every member on a protocol pool while `CreationChecksLib.resolveCreator` reverts `NotPoolSteward`; the composer route was reachable by URL too | `Pool/GardenPool.tsx`, `Compose/ComposeCommitment.tsx` |

Deferred with the earlier set: **Use the accepted provider garden for proof preflight** is the same
route-versus-record family as T2/T18/T21; `providerGarden` is already in the query
(`data-core.ts:35`) but not on the read model, so it waits for that plumbing.

Source structure: the composer's bottom bar moved into `Proof/ProofBar.tsx`, which also retires
three copies of a 200-character class string. `ProofComposer.tsx` is 319 lines.

Two more tests changed meaning: both `ComposeCommitment` cycle tests asserted the auto-bind that
the "keep the cycle-less option" thread shows to be wrong.

## Third round — the merge head's review

Codex reviewed the develop merge `5e12c441d` and opened nine more. Six fixed, one duplicate, two
deferred.

| Thread | Root cause | Where |
|---|---|---|
| Keep garden-work commitments editable after evidence | The act table offered `sendForConfirmation` on `EVIDENCE_SUBMITTED` for every type, but `ConfirmLib` reverts `WorkApprovalRequired` for all DomainImpact; the chain moves garden work on its own when approvals land | `modules/commitment-pooling/acts.ts` |
| Hide Join when the roster is full | `canJoinTeam` never read `contributorCount`; the roster caps at 40 (`TooManyContributors`) | `acts.ts` |
| Stop offering Work links at the limit | The link rule lived inline in the view and never counted attributions; `ProofLib.linkWork` rejects the forty-first. Moved into `canLinkWork` beside `canJoinTeam` | `acts.ts`, `GardenCommitment.tsx` |
| Cap the total required Work count | The schema bounded rows and each row's uint32, not their sum; `validateAndBuildRequirements` rejects an aggregate above 40 | `useCommitmentComposerForm.ts` |
| Refuse placement unless the pool is open | Only the doors checked `state === "OPEN"`; a deep link or a form left open while the pool paused placed into `PoolNotInState` | `Compose/ComposeCommitment.tsx` |
| Evict demo query data before re-enabling writes | Real and demo readers share cache keys, so `?mockPooling=0` in the same tab left fresh fixture results that the lifted write guard and the persister could both act on. Pooling reads are now dropped at the flip in either direction | `demo/demo-mode.ts` |

Duplicate: **Bind protocol claims to the selected external garden** restates T2.

Deferred: **Reload the composer draft when its key changes** (the draft is captured once at mount;
re-resolving it on `viewer`/garden change needs the draft store to own that transition) and
**Route linked Work through the commitment's pool garden** (`WorkFulfills` navigates under the
Work's garden; resolving `poolId` to its garden needs a pool read the Work page does not make).
Both are real; both are their own change.

Two more tests changed meaning: `GardenCommitment`'s "queues the act the bar names" was sending a
DomainImpact commitment for confirmation, which the contract refuses.

## Fourth round — the deferred set, closed

Afo's call: the thirteen open threads were to be fixed, not carried. All thirteen are.

The six in the route-versus-record family fall to one change: the record now carries
`providerGarden` (already queried, never mapped), and a new `useCommitmentViewerRoles` hook
reads the reader's hats against the route garden, the pool's garden and the garden that took an
offer up, once, from chain. Claims are scoped by a rewritten `ClaimContextSheet` that offers one
personal option per garden the claimant belongs to and one garden option per garden they steward,
with the pool's host left out — the context the contract refuses. Proof, work links and
send-for-confirmation are preflighted against the provider garden; a steward's confirmation
against the counterparty garden; Not yet is withheld unless `raiseDispute` would take it; a named
confirmer's confirmation skips the membership wait entirely (`membershipNotRequired` on the
payload, honoured by the executor); `WorkFulfills` resolves the commitment's pool garden before
navigating.

The rest: evidence jobs recover through `isEvidenceAttached` before re-sending, the way creations
and work links already did; failed non-creation acts get retry and discard on the detail
(`FailedActAlert`, with the same discard guard the pool tab applies); proof drafts persist words in
a new store and files in the draft image table, under one key, restored on remount; the composer
draft re-resolves when its key changes; the work picker excludes work linked to any commitment
(`useLinkedWorkUIDs`, one batched indexer read); stewards accept or decline gated claims from a
`ClaimDecisionPanel`, with `declineClaim` now among the reasoned inputs the hook pins; and the
confirm sheet renders what was submitted (`useCommitmentEvidence` + `EvidencePreview`) above its
controls instead of a count.

`GardenCommitment.tsx` gave up its role block and its claim lifecycle to stay under its cap
(`useCommitmentViewerRoles`, `CommitmentClaims.tsx`). Twelve strings added in en, es and pt.

## Fifth round — six more on the ledger commit

All six fixed. Not-yet drafts are keyed by the signer as well as the commitment, so two
confirmers on one device never share words. Creations queued before a pool closed stay reachable
above the lifecycle notice, discard only, since those rows are the one way to throw the record
away. Proof notes keep their paragraphs: a note-specific cleaner tidies spaces and blank lines and
leaves the breaks, so the pinned document is the text the review screen showed. Unit chips store
the word they display, so a Spanish commitment does not say "hours" on chain. The action rail
shows only actions inside their window, the same filter the Work composer applies, because a
commitment kept by an expired action could never be kept. And the proof route asks the same act
table that draws Add proof, so a saved URL opened after the roster froze reads a plain answer
rather than queueing a send that reverts.

`prepareMediaForUpload` moved into shared while the composer was at its cap; the Work media
screen carries the same logic and can adopt it.

## A validation gap, recorded so it is not repeated

CI on `04e9b47e6` failed two jobs the local gate never ran: `typecheck:tests` in shared and
client, added by develop's strict-typecheck lane (`94a002214`) and merged in on `5e12c441d`.
The local client typecheck uses `tsconfig.app.json`, which excludes tests, and the Ship Gate
does not include `typecheck:tests`. Six fixtures predated fields this branch made required;
fixed in `931cb0d0d`. One of them is deliberately incomplete — a claim record persisted before
2026-08-21 must still send without a membership preflight — and now says so with a cast rather
than testing the wrong thing.

Running both `typecheck:tests` scripts belongs in the local proof for any branch that touches
payload types. The local worktree also reports ~100 `@storybook/react` resolution errors in that
job that CI does not: the package is a declared devDependency that is not installed here. Not a
defect, and not installed without approval.

## Proof

Ship Gate at the fix commit: `bun format` clean, `bun lint` 0 errors, `bun run test`, `bun run build`.
Client `tsc -p tsconfig.app.json` exits 0 with zero errors. New regression coverage: discard safety
and the demo-mode write guard in the job-queue suites, garden-membership gating in
`commitmentActions.test.ts`, the not-discardable row in `GardenPool.test.tsx`, action-matched work
linking in `GardenCommitment.test.tsx`, and contributor exclusion in `commitments-to-confirm.test.tsx`.

Two client tests changed meaning rather than shape, and both were asserting the defect:
`GardenCommitment` linked a work with action 44 to a requirement row of action 45 (which the
contract rejects), and its Join test used a reader with no role in the garden.
