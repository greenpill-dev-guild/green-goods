# Commitment Pooling - Claude Editorial Handoff

## Status

- Execution sub-lane: editorial
- Machine lane: ui
- Owner: Claude
- Branch signal: claude/editorial/commitment-pooling
- Current state: blocked on state_api
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
- `acceptance-matrix.md` §3 is approved and every public claim maps to its required evidence class.
- GREEN includes targeted tests, client build, and rendered public-browser proof for readiness, live, queued, dispatched, confirming, confirmed, empty, and error states.
