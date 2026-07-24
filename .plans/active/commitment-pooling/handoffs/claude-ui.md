# Commitment Pooling - Claude UI Handoff

## Status

- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui/commitment-pooling
- Current state: blocked on state_api
- Linear context: this is the machine-lane `ui` handoff and owns no lane issue of its own. It aggregates the sub-lane issues PRD-724 (client UI), PRD-725 (admin UI), PRD-726 (editorial), PRD-727 (docs), PRD-728 (docs-guides) under parent PRD-650; PRD-682 is September Community context. Each per-surface handoff carries its own lane issue.

## Inputs

- GREEN shared state/API handoff and exported types/hooks/selectors
- GREEN indexer query contract
- Corrected uiux-spec.md, wireframes.md, diagrams.md, and settlement status vocabulary
- acceptance-matrix.md for the final state/copy/public-claim/role proof
- Admin/client package guides and authenticated Brave access

## Outputs

- Coordinated August client, admin, editorial, docs, and docs-guide sub-lane evidence. September Community records its own later GREEN and is not part of the August aggregate.
- Cross-surface state/copy consistency for claims, confirmation, disputes, settlement, and recovery.
- Register #51 placement consistency: `W10@cancel`, `W10@mark-ready-override`, and `W10@attach-assessment` own their admin actions; `WFLOW@review` owns the read-only fulfills row; `W25@context-chooser` owns the pre-claim personal/garden provider chooser. These are locked August states, not optional follow-ups.
- en/es/pt coverage, accessible names/order/status announcements, responsive/reduced-motion behavior, and real-browser proof.
- Aggregate proof record; detailed proof remains in each sub-lane handoff.

## Acceptance

- Every product write flows through shared mutation hooks.
- Offer recipient and Request creator confirmation, provider exclusion, pending/declined/superseded claims, and recovery states agree across surfaces.
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
- Every required August UI sub-lane handoff (`ui_client`, `ui_admin`, `editorial`, `docs`, `docs_guides`) has recorded acceptance and proof. `community` is intentionally excluded.
- Authenticated Brave covers admin/client visible flows; member PWA also has a real-device pass.
- Any unavailable external settlement or AA path is reported as a proof limit, never a pass.
