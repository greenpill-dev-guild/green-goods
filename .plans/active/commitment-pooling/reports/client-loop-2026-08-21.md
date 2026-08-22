# Client loop, D1 session report — 2026-08-21

Branch `feature/commitment-pooling-client-loop` off `origin/develop @ bcf6adfc2` (plus the
prompt refresh `ef64947a7`). Dispatch prompt: `prompt-client-loop.md`. Phase 0 and Phase 1 (D1)
are on the branch; Phase 2 (D2) waits for D1 to merge, per the prompt.

## What the branch does

Phase 0 closed the shipped slice's defects (one commit each): availability answered before
not-found on the detail; withdraw and dispute reasons pinned as CIDs before the call; the sheet
opens a commitment in its garden and pool rows mark who is waited on; the whole queue is read
before an act is offered; the membership preflight covers claim, proof, work-link and
confirmation jobs; and the small fixes (tap targets, bottom nav under the commitment routes,
translated labels, accessible progress bars, single heading, action titles on rows, cycle names
and dates).

Phase 1 closed the loop: two one-word doors into the composer; garden-work commitments with
action rows, scope and a resumable draft; a proof composer that queues offline and publishes its
media and document at sync; link work both ways; a confirmation sheet that asks each cast's
question and takes Not yet; claim panels and the protocol-pool context chooser; pool readiness,
pause reason and queued rows; the team from the record with join; and a steward-only To confirm
tab. Stories cover the five components the prompt names; a source-structure refactor keeps every
touched file inside the repository's line caps.

## Built / not built

Keyed to every state id the prompt names and to the handoff acceptance bullets. "Rendered" means
the authenticated Brave QA profile against the local stack; "Storybook" means the Chromium
interaction runner; "tests" means vitest.

| Screen | State id | Built | Proof / why not |
|---|---|---|---|
| W1 pool tab | two doors (`commitments/new?direction=offer\|request`), empty-state doors | Built | `GardenPool.test.tsx`; floating entry is client-local `PoolCreateEntry` (no FAB primitive in the client palette, flagged) |
| W1 | `not-ready` (charter row, cap row) | Built | Rendered on TAS HUB pool 3 (all 18 local pools are NOT_READY); `GardenPool.test.tsx` |
| W1 | `not-ready` Baseline row | Not built | No shared selector for a qualifying starting assessment; the checklist does not claim to know (prompt item 7) |
| W1 | `paused` with resolved reason | Built | `useCommitmentReason` over `pauseReasonCID`, em dash when unresolvable; tests |
| W1 | `queued`, `sync-failed`, `waiting-membership` | Built | `PendingCreationRow` from `useCommitmentQueueState`, retry/discard through `jobQueue.retryJob/discardJob`; tests |
| W1 + W25 | `claim-pending`, `claim-declined`, `claim-superseded`, `claim-accepted` | Built | `CommitmentClaimPanel` on the detail; fresh re-request after decline; claimant vs requestedBy shown; `GardenCommitment.test.tsx` |
| W25 | `context-chooser`, `pending`, `accepted` | Built | `ClaimContextSheet`: Personal default, Garden only for stewards, resolved before enqueue, never rewritten; tests |
| W25 | `card` (claim card on the pool tab) | Not built | Deferred; the claim lifecycle lives on the detail panel this round |
| W2 detail | acts (withdraw, take up, ask, add proof, send, confirm, offer again), queue held/failed | Built | `GardenCommitment.test.tsx` (40) |
| W2 | provenance after Fulfilled/Reconciled | Built | `Provenance` in `ConfirmOutcome.tsx`; tests and Storybook `Kept`, `KeptByFallback` |
| W2 | StateTimeline | Not built | Deferred; not named in the D1 items |
| W2a proof | `media`, `media-preview`, `details`, `review`, `review-request`, `review-support`, `review-captured`, `queued` | Built | Route `commitments/:id/proof`; `ProofComposer.test.tsx` (9); Storybook (10 plays) |
| W2a | `failed` | Built on W2, not on the proof screen | A proof that gave up shows as the detail's failed alert with the queue; the composer itself ends at `queued` |
| W2a | evidence job: queue offline → restart → upload → attach; upload failure leaves `waiting` | Built | `commitment-evidence-publish.test.ts`, `commitment-jobs.test.ts`; `evidence-publisher.ts` writes the CID back before the send |
| W2b team | `open-member` (join), `frozen`, `recognition` | Built | `CommitmentTeam`; join calls the existing `joinCommitment` mutation online, says it needs a connection offline; tests |
| W2b | `setup`, `forming` (add / remove / assign) | Not built | Decision 4: steward-gated online roster mutations deferred |
| W3 compose | `step-what`, `step-howmuch`, `step-details`, `step-review`, `step-review-read`, `request-work-*`, `validation`, `draft-resume` | Built | `ComposeCommitment.test.tsx` (21); ordered requirement payload survives restart through the draft store and the job |
| W3 | `details-preview` | Not built | Deferred to D2 with the composer's media capture |
| W3 | `step-advanced` (named confirmers, protocol-fallback opt-out) | Not built | Decision 3: the shared composer form does not model confirmers; the toggles exist in `ComposeDetails` but no named-confirmer entry |
| W3 | How-often Ongoing, saved details, suggestion chips | Not built | D2 (W32 / W3 ongoing path) |
| W4 confirm | `confirm-domain`, `confirm-support`, `confirm-request`, `confirm-request-work`, `confirm-captured` | Built | `selectConfirmCast`; Storybook `AskSupport`, `AskGardenWork`, `AskCaptured`; tests |
| W4 | `confirm-campaign-request` | Not built | No campaign-request cast in the read model this round; falls to `request` |
| W4 | named group, `PoolFallback` / `ProtocolFallback` provenance, `confirmed-pending*`, `confirmed*` | Built | `Meter`, `Provenance`; Storybook `NamedGroup`, `Pending`, `PendingOffline`, `Kept`, `KeptByFallback` |
| W4 | `not-yet*` (online `raiseDispute` with pinned reason; offline keeps the draft), `not-yet-failed*` | Built | `ConfirmNotYet`, `useCommitmentNotYetDraft`; tests; Storybook `NotYet`, `NotYetOffline` |
| WFLOW | `WFLOW@review` Fulfills row (read-only, navigable both ways) | Built | From the indexer attribution by `workUID` (`useCommitmentWorkAttributionsForWork`), not `meta.commitmentId`; `HomeGardenWork.test.tsx` |
| WFLOW | `link-picker`, `{ act: "workLink" }` | Built | `LinkWorkDialog`; `CommitmentWork` lists linked and standing approved work; tests |
| WFLOW | `meta.commitmentId` on Work submitted from a deep link | Not built | Decision 6: touches the work metadata schema outside this lane |
| W5 | `toconfirm`, `toconfirm-empty`, `toconfirm-loading`, `toconfirm-read-error` | Built | `useCommitmentsToConfirm` (garden as the party; nothing duplicates Live); tab only for stewards; `commitments-to-confirm.test.tsx`, `CommitmentsDrawer.test.tsx` |
| W5 | steward fallback confirmation rows ("needs a reason") | Not built | The reasoned `confirmFulfillmentAsFallback` step-in is not selected by the tab; ordinary confirmations only |
| Stories | `CommitmentRow`, `CommitmentStateLadder`, `CycleRail`, proof composer, confirmation sheet | Built | 37 plays green in the Chromium Storybook runner, tagged `storybook-ci` |

Handoff acceptance bullets:

| Bullet | Status | Evidence |
|---|---|---|
| Six field job kinds offline, restart, waiting/retry/failure, no duplicates; `transfer` online-only | Built | `commitment-jobs.test.ts`, `job-queue.commitment-policy.test.ts`; `job-recovery.ts` |
| `clientCommitmentId` + creator-scoped `creationRequestKey` before send; work-link `operationKey` | Built | Draft store carries `clientCommitmentId`; identity dedupe in `queue-policy.ts`; tests |
| DomainImpact creation rejects empty / over-cap / missing actions / zero counts; ordered payload survives | Built | `commitment-composer.test.ts`, `ComposeCommitment.test.tsx` |
| One open Season plus concurrent Campaigns; scope labels; creation binds one cycle or cycle-less | Built | `ComposeWhat` scope select, `CycleRail`; tests |
| Decline leaves peers Pending; acceptance supersedes; re-request never mutates the old record | Built (read side) | `CommitmentClaimPanel`; steward decline/accept acts are admin-side, not in this lane |
| Individual vs Garden claim identity; runtime claim type never differs from stored | Built | `ClaimContextSheet`, `enqueueClaim(kind 0/1)`; tests |
| `W25@context-chooser` resolves before the mutation; Garden absent for ineligible members | Built | Tests |
| `WFLOW@review` Fulfills row from `meta.commitmentId` | Built from the indexer attribution instead | Decision 6 |
| G$ transfer online Celo; consideration rails; settlement phrases; AA failure | Out of scope | Settlement slices are not in this lane (prompt boundaries) |
| Loading, empty, offline, pending, declined, superseded, failed, retry, terminal states | Built where applicable | State ladders, queue rows, claim panel, confirm phases |
| Saved Offer persistence states | Not built | D2 (W32) |
| Accessible names, focus order, 44px targets, contrast, reduced motion | Built | `tap-target-lg` at every control, `aria-label` on bars and lists, native controls; no new motion |
| Hero moments PWA-only | Not applicable | No hero moment added |

## Evidence

- Targeted suites green: client `GardenCommitment` (40), `ComposeCommitment` (21),
  `ProofComposer` (9), `GardenPool` (23), `CommitmentsDrawer` (25), `HomeGardenWork` (4),
  `Home` + `display-mode` (14); shared `commitments-to-confirm` (5), `locale-coverage` (12),
  `commitment-jobs` + `commitment-evidence-publish` + `job-queue` policy (58).
- Repo Quick Gate (`ci-local --quick --no-fail-fast`): format, lint, shared-typecheck,
  shared-test (3811), client-test, admin-test, agent-typecheck, agent-test (265),
  source-structure (62 files), supply-chain all green. `design-guardrails` red on one step,
  `check:design-generated`: `docs/docs/builders/packages/client-pwa-token-audit.generated.md` is
  stale by line references only (the audit lists token usages by file:line and this branch moved
  them). The regeneration is `bun run design:generate`; the file is outside this lane's write
  paths, so it is not committed here (see Decisions).
- `bun run lint:vocab`, `bun run check:design-tokens`, shared `check:stories` and
  `check:story-quality`, the prototype build (44 screens, 0 warnings): green.
- Client `tsc --noEmit -p tsconfig.app.json` filtered to the touched views: zero errors in
  commitment, compose, proof, drawer, work-fulfills files. Two pre-existing errors remain in
  `Work.tsx` (a retry passing `smartAccountClient` to `processJob`; `effectiveStatus` typed
  string) and the `Assessment.tsx` family; not touched.
- Ship Gate: `bun format` 0, `bun lint` 0, `bun run test` 0 (contracts 2053, docs 283, shared 3811, agent 270, client 813, admin 583), `bun run build` 0.

## Rendered proof

Authenticated Brave QA profile through Claude-in-Chrome, dev stack owned by this worktree
(`lsof` ownership check printed `/Users/afo/Code/greenpill/green-goods/.claude/worktrees/client-loop`).
`bun run dev:smoke:full` passed with the local indexer 3 blocks behind the fork head
(`source=497045764`, `indexed=497045761`, 574 events), so local data was live for this session.

- Production ledger (`entity:commitment-pool` on 42161 = `deployed-not-available`): the
  Commitments sheet renders the not-ready ladder ("Commitments are not ready here yet") for
  `mockAuth=user`; two tabs, no To confirm.
- Local ledger flipped to `available` for the session only (reverted before staging, both files
  back to HEAD): the sheet renders the genuine empty state for `user` and `operator` (neither
  mock address is a party to anything on the local fork); the TAS HUB pool tab renders the
  NOT_READY notice and the readiness checklist with both rows open. That view caught a copy slip
  ("promises" on the cap row), fixed in `30d8a6338`.
- Not rendered live: the detail, composer, proof, confirmation, claim, team and To confirm
  screens. All 18 pools on the local fork are NOT_READY with zero commitments and zero cycles, so
  no door opens and no record exists to read. These are covered by tests and the Storybook
  Chromium runner, which is not an authenticated claim. Live authenticated proof of those screens
  is pending the hosted Envio deployment and at least one open pool.
- Real offline proof: BLOCKED. No open pool means no act can be queued from the rendered app;
  the authenticated Brave path has no network-offline control that is not the clean-room
  DevTools profile, and turning the machine's network off would cut the other sessions on this
  machine. A synthetic `offline` event in the authenticated tab flipped the app to Offline Mode
  and kept the pool checklist rendered from cache; that is a signal, not the proof the prompt
  asks for. Job and media survival across restart is proven in jsdom with fake-indexeddb
  (`commitment-jobs.test.ts`, `commitment-evidence-publish.test.ts`).
- Real-device installed-PWA airplane-mode pass: BLOCKED, no device in this session.

## Decisions for Afo

1. PRD-724: reopen or successor. The PR links `Refs PRD-724`; no Linear write was made.
2. Two-door entry: built and visible; confirm it replaces the in-form direction control.
3. `step-advanced`: not built (the shared form has no confirmer model).
4. Roster: join built through the existing `joinCommitment` mutation; add/remove/assign deferred.
5. Ledger flip: used for one QA session and reverted; nothing committed.
6. `meta.commitmentId`: not built; the indexer attribution is the Fulfills row's only source.
7. New: the design-generated token audit regeneration (`bun run design:generate`, one file under
   `docs/`) is outside this lane's paths but required for the Design Guardrails check to pass. Say
   whether to commit it on this branch or land it separately.

## Flags

- `PoolCreateEntry` is a client-local floating entry because the client palette has no FAB
  primitive; flagged for the design system rather than invented as a shared component.
- The confirmation preflight checks membership in the commitment's garden for all six kinds per
  the handoff rule; the contract gates `confirmFulfillment` on confirmer identity, not Hats, so a
  named confirmer who is not a member would wait on membership locally.
- The spec's metadata `description` and the schema's `note` diverge; the client writes `note`
  and reads both.
- Pre-existing `Work.tsx` type errors and the `Assessment.tsx` family are not touched.
- The source-structure refactor (`8f9424a76`) split seven files along existing seams with no
  behaviour change; `job-queue/index.ts` and `Work.tsx` are exactly at their frozen ceilings.
