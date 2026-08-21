# Commitment Pooling - Claude Editorial Handoff

## Status

- Execution sub-lane: editorial
- Machine lane: ui
- Owner: Claude
- Branch signal: feature/commitment-pooling-editorial
- Current state: the `/gardens/:id` page conversion has landed and the public copy is frozen on
  "commitment"; the section's scope is a record across seasons and campaigns, not one live cycle
  (2026-08-20). Implementation still waits for verified non-value deployment/indexer output, the
  shared admin/UI foundation cleanup, the pool-scoped distinct-provider counter, a public pool
  reader, a CCIP-confirmed settlement selector, and the `PublicEvidencePipeline` i18n prerequisite
- Linear context: PRD-726 (editorial lane) under parent PRD-650

## Inputs

- GREEN aggregate/query selectors with privacy thresholds
- uiux-spec.md editorial contract and W15/W16
- the canonical [Commitment Pooling Google Doc](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit) for external language; `external-brief.md` for the repo source map
- acceptance-matrix.md §3 public claims matrix
- The public Garden page (`packages/client/src/views/Public/GardenDetail.tsx`) and `/impact`
  composition. The Garden page is a page, not a dialog, as of 2026-08-19; its `Section` shell,
  `StatCell` em-dash contract, and always-render rule are what the commitments section plugs into

## Outputs

- Read-only garden pool story at `§ 02` and protocol-wide commitment aggregates.
- Clear labels separating planned, queued, dispatched, confirming, and CCIP-confirmed behavior.
- Privacy-thresholded counts with readiness/empty/error copy.
- en/es/pt copy and accessible public-browser proof.

## Acceptance

- Public copy says commitment, never promise (C.14; the prototype build already enforces it).
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

- Indexer/shared aggregate selectors and privacy thresholds are GREEN. §7.2's threshold is not
  buildable today: `selectPromiseKeptRate` applies no gate, and no distinct-provider counter
  exists in the indexer schema. **Scope amended 2026-08-20**: the section publishes the garden's
  record across seasons and campaigns (§7.1), so the rate is a pool-lifetime figure and the gate
  reads lifetime due commitments and lifetime distinct providers. That makes the required counter
  the cheap one — a `distinctProviderCount` on `CommitmentPool`, incremented the first time a
  `CommitmentProviderExposure` key appears, on the same dedup pattern the other pool counters use.
  No new entity, and it publishes a number rather than a list. The per-(cycle, provider) sentinel
  Decision Log #161 called for is no longer this lane's dependency; a surface that later publishes
  a per-cycle rate owns it. Counting `CommitmentProviderExposure` rows is still not an option.
- NOT MET — no public reader exists. `packages/shared/src/hooks/public/` has no pooling hook, and
  the reader that does exist, `getCommitmentPoolDetail`, selects `CommitmentProviderExposure
  { provider }` — reusing it would ship provider addresses to a signed-out browser against §7.4.
  This lane adds its own reader over pool, cycle, and unit-summary fields only.
- NOT MET — the `/impact` band's CCIP-confirmed G$ tile has no selector. `Disbursement`,
  `SettlementMessage` and `SettlementExecution` carry the lifecycle; nothing returns an
  acknowledged-only total, and dispatched or executed-ack-pending must never reach the tile.
- NOT MET — `PublicEvidencePipeline` must be internationalised and laid out for five nodes before
  the `/impact` band can ship. It is not yet: its node titles and descriptions are literal English
  (only the closing caption goes through `formatMessage`) and it is `md:grid-cols-3` with three
  hardcoded domain tones.
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
  reliability language, cross-pool identity, rate, rank, or score.
- “Kept N times across M cycles” is permitted only when exact linked Fulfilled instances and
  unique cycle IDs support it; “verified impact” requires its own evidence authority.
