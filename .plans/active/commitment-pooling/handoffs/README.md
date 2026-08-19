# Commitment Pooling Handoffs

These files are the lane-level dispatch surfaces for .plans/active/commitment-pooling/.

## File index

All 25 files in this directory. The plan hub's document map points here for the enumeration, so
**a new handoff must get a row below in the same change** — this file previously described source
order only, and a reader following the map could miss an active dispatch surface entirely.

| File | Lane / role | Owner | Dispatch state |
|---|---|---|---|
| `README.md` | This index, the required handoff contract, the Linear boundary, and the shared safety rules that bind every lane | — | Always in force |
| `codex-contracts.md` | Pooling module + register + resolver/schema contract work (PRD-721) | Codex | Backend lane 1 — the other two wait on it |
| `codex-indexer.md` | Envio entities, handlers, replay/reverse-delivery fixtures (PRD-722) | Codex | Source GREEN; hosted deployment/read-back remains human-owned |
| `codex-state-api.md` | Shared domain types, selectors, hooks, mutations, six offline job kinds (PRD-723) | Codex | Source GREEN; runtime capability remains fail-closed pending hosted read-back. **One open seat amendment (2026-08-18)** |
| `commitment-view-state-reference.md` | Generated implementation contract for the commitment detail screen: every state's cast, seat, phase and act. Regenerate with `hifi/state-reference.gen.ts` | Claude (UI) | Generated — never hand-edit |
| `commitment-pooling-query-contract.md` | PRD-723 entity/query contract, selector inventory, availability gate, and settlement extension | Codex | Accepted and implemented in source |
| `codex-settlement.md` | G$ split-state settlement: CCIP command module, Celo executor, acknowledgment | Codex | Separate later slice; not a core-pooling dependency |
| `codex-release-engineering.md` | Phase A manifest, deployment/recovery tooling, courier, and verification | Codex | Active; no broadcast or Linear writes |
| `fable-phase-a-release-review.md` | Final combined Phase A committed-range adversarial review | Fable 5 | Dispatched against `de7863391`; refresh required after candidate changes |
| `claude-contracts-hardening.md` | Resolver wiring, cross-chain approach, and contract hardening follow-ups (PRD-799) | Claude | Runs alongside the contracts lane |
| `claude-ui.md` | Shared UI lane framing that `claude-ui-client.md` and `claude-ui-admin.md` narrow | Claude | Blocked behind state/API |
| `claude-ui-client.md` | Client PWA surfaces (PRD-724) | Claude | Blocked behind state/API |
| `claude-ui-admin.md` | Admin cockpit surfaces (PRD-725) | Claude | Blocked behind state/API |
| `claude-editorial.md` | Editorial / public website surfaces (PRD-726) | Claude | Blocked behind state/API |
| `claude-community.md` | September Community interface work (PRD-682 track) | Claude | Follow-on wave |
| `claude-docs.md` | Post-QA documentation polish (PRD-727) | Claude | Blocked until QA1 |
| `claude-walkthrough-videos.md` | Post-certification walkthrough videos (PRD-728) | Claude | Blocked until QA2 |
| `claude-qa-pass-1.md` | Staging QA pass 1 (PRD-729) | Claude | Blocked until runtime UI lands |
| `codex-qa-pass-2.md` | QA pass 2 (PRD-730) | Codex | Blocked until docs polish lands |
| `claude-standing-artifacts.md` | **Completed** 2026-08-02 Offer-once / Offer-over-time artifact convergence record | Claude | Closed — historical record |
| `claude-offer-vocabulary-correction.md` | **Completed** PRD-789 sweep retiring `Practice` in favour of Offer once / Offer over time | Claude | Closed 2026-08-02 — historical record |
| `claude-full-pooling-visual-docs.md` | Current bounded, additive unit: hand-drawn Story assets + the canonical Google Doc pass. Not a product implementation lane or branch instruction | Claude | Active, additive only |
| `claude-components-tab-brief.md` | Three-phase alignment brief for a reviewable Components tab in the existing prototypes artifact | Claude | Phase 1 is read-only; generation waits for explicit approval |
| `human-release-ops.md` | Broadcast, Garden-ID cutover, and live settlement exit evidence (PRD-731) | Afolabi Aiyeloja | **Human authorization boundary, not a machine lane** |
| `human-settlement-evidence.md` | September measurement-definition and operational-assignment gate (COM-11) | Afolabi Aiyeloja | **Human authorization boundary, not a machine lane** |

## Source order

1. status.json is machine truth for owner, lane state, dependencies, and dispatchability. Read `execution_sub_lanes` before trusting a machine-lane status: a ready machine lane can contain a blocked sub-lane (`contracts` ready does not make `settlement` dispatchable), and the blocked aggregate `ui` lane does not imply any sub-lane is dispatchable. Docs remains explicitly blocked through source convergence.
2. `standing-commitments-spec.md`, `contract-spec.md`, `settlement-spec.md`, `uiux-spec.md`, `diagrams.md`, `wireframes.md`, and `acceptance-matrix.md` define active behavior and final copy/state/public-claim proof. The additive CreditRegistry companion is active in the August wave at `.plans/active/commitment-credit-follow-on/`; its contracts increment merged in PR #695 and is an input to the Phase A release-engineering lane.
3. plan.todo.md defines sequencing.
4. A handoff narrows one lane; it never overrides a blocked status or expands scope.
5. human-release-ops.md owns separately authorized broadcast, Garden-ID cutover, and live settlement exit evidence; human-settlement-evidence.md owns the September measurement-definition gate; implementation handoffs own only code, tests, artifacts, and dry runs.

## Required handoff contract

Every handoff records:

- Status: lane, owner, branch signal, current gate, and Linear context.
- Inputs: frozen specifications, upstream artifacts, and dependency evidence.
- Outputs: concrete deliverables owned by the lane.
- Acceptance: observable behavior and integration contracts.
- RED / GREEN: the first failing proof and the same proof passing, or an explicit proof limit for non-behavioral work.
- Exact Bun commands: runnable from the repository root unless another working directory is named.
- Out of scope: boundaries that may not be pulled into the lane.
- Unblock evidence: exact evidence required before status.json may advance.

Detailed proof is written here first and then recorded in status.json with the plan-hub record-tdd command. A handoff is not a branch-creation instruction.

`claude-standing-artifacts.md` is the completed 2026-08-02 Offer-once/Offer-over-time artifact
convergence record. `claude-full-pooling-visual-docs.md` is the current bounded, additive work unit
for hand-drawn Story assets and the canonical Google Doc. It is not a product implementation lane
or branch instruction and may not redefine Decision Log #51–#54/register #86–#89 or the
[PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796) compatibility gate. Human
handoffs are authorization/evidence boundaries, not machine lanes.

## Linear boundary

linear.laneSyncMode is lane_issues (register #37, amended by registers #39 and #62; supersedes register #31 and Decision Log #20). Each execution sub-lane carries a thin Linear issue: PRD-721 contracts · PRD-722 indexer · PRD-723 state/API · PRD-724 client UI · PRD-725 admin UI · PRD-726 editorial · PRD-727 post-QA docs polish · PRD-728 post-certification walkthrough videos · PRD-729 QA pass 1 · PRD-730 QA pass 2 · PRD-731 release ops · COM-11 settlement evidence (formerly PRD-735; moved to the Community team 2026-07-24). PRD-650 is the parent of PRD-721–730 and COM-11; PRD-731 is parentless. PRD-686 tracks settlement implementation and PRD-682 tracks Community. Linear owns status, dates, assignee, and dependencies; these handoffs own content, and a lane issue body must never restate handoff scope. Only ready agent-owned lanes receive `agent:*`; blocked, human, and follow-on records do not. Historical child IDs (PRD-671–681) remain labels, not dispatch targets. Handoffs still never create or dispatch Linear issues themselves — Afo does.

## Shared safety rules

- Preserve the register #62 order: Envio -> existing contract cleanup -> architecture freeze ->
  contracts/indexer/shared -> authorized core deployment/indexer read-back -> admin foundation ->
  runtime UI -> staging QA1 -> docs polish -> QA2 -> walkthrough videos.
- Use Bun wrappers; never raw forge.
- Hooks live in @green-goods/shared.
- Every user-facing string lands in en, es, and pt.
- Envio indexes Green Goods protocol events only, never EAS or raw Celo token transfers.
- Visible UI requires authenticated Brave proof; member PWA flows also require a real-device pass.
- Settlement confirmation is acknowledgment-only. Dispatched or Celo-executed/acknowledgment-pending is not arrived; only an authenticated success acknowledgment for the subject's current execution key and attempt produces Confirmed.
- No bridged G$, garden-held member-claim path, transferable voucher activation, credit scoring, or leaderboard behavior.
- Registers #81–#85 are binding: one-time and ongoing behavior are two ways of using an Offer;
  reusable Offer metadata is signed offchain and private by default; `CommitmentSeries` is the
  internal durable identity for an Offer used over time in one pool; each available place is one
  pre-created capacity-backed Offer instance; Story is exact linked history without score, rate,
  rank, inferred participants, or cross-pool identity; Ask me again is the next-cycle default;
  initial succession scope is rest/resume/retire only.
- Registers #86–#89 are binding: promise instance, ongoing Offer series, and future voucher class
  stay distinct; the reserved adapter address resolves a future versioned router; fulfilled
  backing precedes any separately gated capacity backing; one bounded pool precedes federation;
  G$ support is not voucher redemption; Codex owns repo/Linear/Mermaid closure while Claude owns
  hand-drawn Story and canonical Google Doc changes.
- The 2026-07-28 amendment plus 2026-07-29/30 review closures are binding across every lane:
  group commitments use one accountable lead plus contributors; requirements accept only
  action/count inputs; exact evidence CIDs are de-duplicated and evidence/Work credit records only
  while Accepted and unfrozen; assessment attachment is write-once before freeze; recognition
  eligibility additionally requires the commitment to be Fulfilled; each Work UID produces at
  most one verified credit; the roster and credit ledger freeze at ReadyForConfirmation or before
  a direct Fulfilled dispute resolution, where contributor-stewards remain blocked. Recognition
  uses an opened cycle policy or the immutable cycle-less 20/80 default and has no lead or
  metadata-only fallback, but cycle-less commitments are recognition/payment-only and cannot enter
  Hypercert bundles without a six-role cycle allocation. Settlement hash-binds recognition,
  persists contributor order, emits versioned complete payout snapshots, derives payment weights
  from atomic amounts, treats the canonical full-consideration base-unit allocation as
  rounding-equivalent, finalizes without creating children, rejects duplicate batch recipients,
  and materializes each immutable child only through idempotent post-finalization preparation. It
  conserves retained plus payout amounts, completes all-retained plans without CCIP, and never
  clears the parent pointer on child cancellation. This is a payout plan, not a garden-held member
  claim.
