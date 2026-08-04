# Commitment Pooling - Claude Editorial Handoff

## Status

- Execution sub-lane: editorial
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/editorial/commitment-pooling
- Current state: prototype/copy review may continue; implementation waits for state_api, verified
  non-value deployment/indexer output, and the shared admin/UI foundation cleanup
- Linear context: PRD-726 (editorial lane) under parent PRD-650

## Inputs

- GREEN aggregate/query selectors with privacy thresholds
- uiux-spec.md editorial contract and W15/W16
- the canonical [Commitment Pooling Google Doc](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit) for external language; `external-brief.md` for the repo source map
- acceptance-matrix.md §3 public claims matrix
- Existing public GardenDialog and /impact composition

## Outputs

- Read-only garden pool story and protocol-wide promise aggregates.
- Clear labels separating planned, queued, dispatched, confirming, and CCIP-confirmed behavior.
- Privacy-thresholded counts with readiness/empty/error copy.
- en/es/pt copy and accessible public-browser proof.

## Acceptance

- Public views render only indexer-backed aggregates and approved EAS/shared joined reads.
- No per-person lists, wallet addresses, rankings, funding-ordering, or unsupported percentage claims.
- Dispatched or Celo-executed/ack-pending settlement never reads as arrived; only a CCIP-confirmed outcome may use arrival language and it remains distinct from community narrative and evaluator conclusions.
- Pre-launch surfaces use planned/readiness language rather than live counts.
- Headings, links, status text, focus order, contrast, and reduced motion pass public-browser review.

## RED / GREEN

- RED: focused public component tests fail for thresholding, empty/error, and evidence labels.
- GREEN: the same tests pass; client build and public-browser proof pass.

## Exact Bun commands

`src/__tests__/commitment-editorial.test.tsx` does not exist yet; it is the intentional to-be-created RED-first deliverable for this lane.

- bun run --filter @green-goods/client test -- src/__tests__/commitment-editorial.test.tsx
- bun run --filter @green-goods/client build
- bun run lint:vocab

## Out of scope

- Product writes, personalized lists, rankings, steering, escrow claims, unpublished metrics, manual receipt verification, or changes to public funding rails.

## Unblock evidence

- Indexer/shared aggregate selectors and privacy thresholds are GREEN.
- Verified live indexer output and the scoped shared admin/UI foundation cleanup are complete.
- `acceptance-matrix.md` §3 is approved and every public claim maps to its required evidence class.
- GREEN includes targeted tests, client build, and rendered public-browser proof for readiness, live, queued, dispatched, confirming, confirmed, empty, and error states.

## 2026-07-28 public-story amendment

- Public team attribution may name contributors only where privacy/publication rules allow and must reflect approved contribution, not an equal-by-presence split.
- Hypercert recognition can be described as contribution credit; contributor payment, garden retention, and delivery status remain separate claims with their own proof.
- A public story must never imply that a Hypercert share itself paid a member or that one failed child payout invalidated the fulfilled commitment.

## Binding ongoing-Offer amendment — 2026-08-02

- Public ongoing-Offer copy uses separately approved pool-level aggregates only.
- Do not expose a person's saved Offer metadata, series Story, inferred participant count,
  reliability
  language, cross-pool identity, rate, rank, or score.
- “Kept N times across M cycles” is permitted only when exact linked Fulfilled instances and
  unique cycle IDs support it; “verified impact” requires its own evidence authority.
