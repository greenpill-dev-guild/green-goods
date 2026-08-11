# Commitment Pooling - Claude UI Handoff

## Status

- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui/commitment-pooling
- Current state: prototype/spec review may continue; runtime implementation is blocked
- Linear context: this machine lane aggregates PRD-724 (client UI), PRD-725 (admin UI), and PRD-726 (editorial). PRD-727 is post-QA documentation polish, PRD-728 is post-certification walkthrough video, and PRD-682 is September Community context.

Concurrent agents share this repository. Each UI sub-lane stays inside its named package/spec
paths, preserves unrelated working-tree changes, and does not switch the primary tree's branch.

## Inputs

- GREEN shared state/API handoff and exported types/hooks/selectors
- GREEN indexer query contract
- Verified non-value mainnet artifacts and live indexer deployment/read-back
- Completed scoped existing-admin fixes and polish, including PRD-737
- Corrected uiux-spec.md, wireframes.md, diagrams.md, and settlement status vocabulary — including
  Appendix D and the bilateral-wave Appendix E. Appendix E.1 owns exchange-pair UX, E.2 owns the
  Offer-template library, and E.3 owns the noun-reduction/plain-language rules. The executable
  source is now the hi-fi registry: `hifi/screens/exchange.ts` draws W28–W31 with their recovery
  states, and `sb35`/`sb36` are validated journeys, not planned ones (register #97f).
- acceptance-matrix.md for the final state/copy/public-claim/role proof
- Admin/client package guides and authenticated Brave access

## Outputs

- Coordinated runtime client, admin, and editorial sub-lane evidence. Post-QA docs, final videos,
  and September Community record their own later evidence.
- Cross-surface state/copy consistency for claims, confirmation, disputes, settlement, and recovery,
  including explicit `Ordinary`, local `PoolFallback`, and Green Goods `ProtocolFallback`
  provenance.
- Cross-surface exchange proposal, atomic match, counterpart-lapsed, template-first creation, and
  first-exposure copy remain consistent with Appendix E and never imply coupled lifecycles.
- Register #51 placement consistency: `W10@cancel`, `W10@mark-ready-override`, and `W10@attach-assessment` own their admin actions; `WFLOW@review` owns the read-only fulfills row; `W25@context-chooser` owns the pre-claim personal/garden provider chooser. These are locked August states, not optional follow-ups.
- en/es/pt coverage, accessible names/order/status announcements, responsive/reduced-motion behavior, and real-browser proof.
- Aggregate proof record; detailed proof remains in each sub-lane handoff.

## Acceptance

- Every product write flows through shared mutation hooks.
- Offer receiver, Request creator, named group, local fallback, and opted-in Green Goods protocol
  fallback eligibility agree across surfaces. Every frozen contributor is excluded; actor, path
  and reason remain visible after fulfillment.
- Acceptance requires the four register #51 placements to be implemented and proved at their named parent states with their role, reason, identity, and provider-garden constraints; no substitute placement or visually silent action satisfies this gate.
- Dispatched and Celo-executed/acknowledgment-pending are never presented as arrived; Confirmed
  requires an authenticated success acknowledgment for the subject's current execution key and
  attempt.
- Admin pool operations live under /community and remain a restrained CanvasLayout command surface.
- Client hero moments remain client-only.
- Member-delivery-disabled and all loading/empty/offline/pending/failed/retry states have clear exits.
- Every new user-facing string exists in en, es, and pt.
- Core pooling UI can turn GREEN independently of the separately gated settlement slices; neither phase can be represented as the other.

## Proof limit

This aggregate handoff introduces no independent product behavior. It turns GREEN only by collecting the sub-lanes' RED/GREEN and authenticated-browser evidence; it cannot substitute a broad build for missing flow proof.

## Exact Bun commands

- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/client test
- bun run --filter @green-goods/admin test
- bun run --filter @green-goods/client build
- bun run --filter @green-goods/admin build
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens
- bun run --filter @green-goods/shared check:stories
- bun run --filter @green-goods/shared check:story-quality

Run the shared story commands only when a Storybook-covered shared component changes; all other commands above are required for the August aggregate.

## Out of scope

- Contract, indexer, or shared behavior changes; a new top-level admin Pools root; direct app contract calls; manual settlement confirmation; garden-held member claims; rankings; credit; or broadcasts.

## Unblock evidence

- state_api is GREEN with indexer codegen/build and shared targeted proof.
- The authorized non-value broadcast, artifact persistence, indexer deployment/reindex, and live
  entity/query read-back are complete.
- The scoped existing-admin fixes and polish are complete and re-proven.
- Every runtime UI sub-lane handoff (`ui_client`, `ui_admin`, `editorial`) has recorded acceptance and proof. Post-QA docs, walkthrough videos, and `community` are intentionally excluded.
- Authenticated Brave covers admin/client visible flows; member PWA also has a real-device pass.
- Any unavailable external settlement or AA path is reported as a proof limit, never a pass.
