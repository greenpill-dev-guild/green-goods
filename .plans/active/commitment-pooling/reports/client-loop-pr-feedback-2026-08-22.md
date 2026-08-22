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

## Proof

Ship Gate at the fix commit: `bun format` clean, `bun lint` 0 errors, `bun run test`, `bun run build`.
Client `tsc -p tsconfig.app.json` exits 0 with zero errors. New regression coverage: discard safety
and the demo-mode write guard in the job-queue suites, garden-membership gating in
`commitmentActions.test.ts`, the not-discardable row in `GardenPool.test.tsx`, action-matched work
linking in `GardenCommitment.test.tsx`, and contributor exclusion in `commitments-to-confirm.test.tsx`.

Two client tests changed meaning rather than shape, and both were asserting the defect:
`GardenCommitment` linked a work with action 44 to a requirement row of action 45 (which the
contract rejects), and its Join test used a reader with no role in the garden.
