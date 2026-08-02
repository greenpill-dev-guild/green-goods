# Commitment Credit — August Companion Plan

**Feature Slug**: `commitment-credit-follow-on`
**Stage**: `active`
**Status**: `UNBLOCKED into the August wave (2026-08-01, pooling plan register #73) — dispatch gates below still bind`
**Last Updated**: `2026-08-01`

## Promotion record and remaining dispatch gates

1. [x] Explicit scope unlock — granted 2026-08-01 by Afo (Grassroots Economics review session; pooling plan register #73). Hub promoted backlog → active; builds in the same August wave as Commitment Pooling as an additive companion chain with zero pooling-module/register changes.
2. [x] Product-evidence decision — gardens already running mutual credit by hand (spec.md §11) plus the build-once-then-pilot posture justify the dedicated register now.
3. [x] Settlement seam — locked to option (a), `DisbursementKind.LoanPrincipal` (spec.md §5; settlement-spec 2026-08-01 amendment).
4. [ ] **Dispatch gate**: Commitment Pooling and settlement ABIs, events, permissions, and deployment paths frozen **in code** (pooling PR chains 2/2.5 merged).
5. [ ] **Dispatch gate**: revalidate every interface and path cited by [spec.md](spec.md) against the implemented code.
6. [ ] **Dispatch gate**: human-owned legal/operations review of the interest-free, records-only lending posture — start immediately; runs in parallel with the pooling build.
7. [x] PRD-697 updated in Linear 2026-08-01: Todo, Medium, dispatch gates in the body; the fresh-executable-issue clause superseded. Validation commands still join the contracts handoff at dispatch.

## Implementation order after the dispatch gates clear

1. Contracts and storage/event tests.
2. Indexer entities, handlers, replay, and generated queries.
3. Shared types, selectors, jobs, and receipt verification.
4. Admin and member surfaces with mutual-aid language.
5. Two QA passes plus deployment-path and real-rail proof under separate authorization.

No lane implements before gates 4–6 are complete.
