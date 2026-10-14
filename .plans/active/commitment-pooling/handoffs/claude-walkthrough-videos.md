# Commitment Pooling - Claude Walkthrough Videos Handoff

## Status

- Execution sub-lane: walkthrough_videos
- Machine lane: none
- Owner: Claude
- Branch signal: docs/commitment-pooling-walkthrough-videos
- Current state: blocked until QA Pass 2 and post-QA documentation polish are complete
- Linear context: PRD-728 (walkthrough-video lane, repurposed from docs-guides) under parent PRD-650

## Inputs

- QA Pass 2 release-certification evidence and a frozen final build/source SHA
- GREEN client, admin, editorial, and documentation-polish handoffs
- `acceptance-matrix.md` §§1, 3-4 final copy/state/public-claim proof
- Authenticated Brave access to the real surfaces
- Approved walkthrough list covering member, Garden Steward, evaluator, and operational roles

## Outputs

- Final walkthrough videos for the client PWA, admin console, and editorial/public experience.
- Accessible captions and text transcripts, with version/date/source SHA and surface provenance.
- Role-based chapters for the core member, Garden Steward, evaluator, and operational journeys.
- Honest recovery and settlement-state coverage without secrets, personal identifiers, or unsupported live claims.

## Acceptance

- Every frame comes from the QA-certified authenticated final surface; no prototype or lo-fi frame is presented as shipped product.
- Narration, captions, and on-screen labels match current accessible names, routes, and the post-QA documentation.
- Dispatched or executed/acknowledgment-pending settlement never reads as arrived.
- Recovery coverage distinguishes same-key command retry, stored acknowledgment retry, and a new attempt; it contains no manual confirmation or garden-custody claim path.
- No API key, wallet address, reporter identifier, session identifier, or other private operational evidence appears.
- Each recorded path is replayed successfully against the final build after editing and before completion.

## RED / GREEN or proof limit

- RED: the recording rehearsal exposes a route, accessible-name, state, recovery, privacy, or planned/live mismatch.
- GREEN: authenticated capture, caption/transcript review, privacy review, and step-by-step replay pass against the frozen final build.
- Proof limit: TDD is not applicable to video production. Any unavailable authenticated or external settlement state is named and cannot be converted into completed footage.

## Exact Bun commands

- bun run docs:audit
- bun run build:docs
- bun run lint:vocab
- node scripts/dev/ci-local.js --quick

## Out of scope

- Product code, route changes, defect fixes, speculative footage, test-only browser profiles reported as authenticated evidence, manual settlement confirmation, garden-held member claims, production promotion, or unrelated marketing assets.

## Unblock evidence

- QA Pass 2 is GREEN and the release-certification blocker list is empty or explicitly accepted.
- PRD-727 documentation polish is complete and re-read.
- Authenticated Brave and the required real-device PWA path can reach the final states.
- The recording checklist names route, role, locale, state, capture date, source SHA, and source handoff.
- Captions/transcripts, privacy review, final path replay, and exact commands pass.

## 2026-07-28 required walkthrough

- Record SB-33 end to end: repeatable requirements, lead and contributors, roster freeze at
  ReadyForConfirmation and direct dispute fulfillment, opened policy or cycle-less 20/80
  recognition, zero-eligible inconsistent-state blocking with no metadata repair, hash-bound
  recognition, amount-derived payment, Save draft, no-child finalization, idempotent Prepare
  payout, garden retention, all-retained completion, partial child recovery with stable parent
  pointer, and contributor receipt.
- The narration must say recognition and payment are distinct and must label all architecture-only screens as planned until runtime proof exists.
