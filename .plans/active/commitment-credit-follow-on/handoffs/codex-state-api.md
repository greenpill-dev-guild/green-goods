# Commitment Credit — August Companion - Codex State/API Handoff

## Status

- Machine lane: state_api
- Owner: Codex
- Execution branch: feature/commitment-pooling-credit-api-state
- Current state: in progress
- Linear context: PRD-786 is the state/API lane issue under PRD-697; it is blocked only by completed PRD-785

## Inputs

- The three credit dispatch gates recorded in `../status.json` have cleared.
- Frozen `CreditRegistry` and settlement `LoanPrincipal` ABIs/events. The settlement `LoanPrincipalRelationship` projection is GREEN, but canonical `Loan`, `LoanEvent`, and `CreditPoolStats` indexing is owned here.
- `../spec.md` sections 3, 5, 6, and 7 revalidated against the implemented interfaces.
- Existing shared query-key, mutation-error, IndexedDB job, account-profile, and online Celo-transfer patterns.

## Outputs

- Envio v3 `CreditRegistry` registration, ABI event coverage, and canonical `Loan`, `LoanEvent`, and `CreditPoolStats` projections.
- Shared `Loan`, `LoanState`, `LoanRail`, `CreditPoolStats`, and settlement relationship types.
- Centralized `queryKeys.credit.*`, hooks, selectors, invalidation rules, and mutation hooks in `@green-goods/shared`.
- Offline-safe request jobs only where the implemented write is retry-safe; G$ sends remain explicit online wallet actions.
- Separate loan and reward status rows when one commitment has both; no state or arithmetic crosses those axes.
- Viewer-aware standing and credit selectors: steward-only per-borrower operations, self-only personal rows, and aggregate-only editorial outputs.

## Public-data boundary

Loan and standing rows derive from public onchain events and may be discoverable through raw Envio queries. “Steward + self visibility” is therefore a product-disclosure rule, not a confidentiality claim. Shared selectors require the viewer account plus current steward capability and return no participant row to other viewers; client/admin code consumes those selectors rather than binding raw per-person entities. Editorial selectors expose only pool/garden aggregates and never wallet-linked outcomes.

## Acceptance

- Hooks live in `@green-goods/shared`; client/admin do not reimplement authorization or raw query joins.
- Outstanding and repayment arithmetic uses integer numerator/denominator fields and never emits a personal score, rank, or comparison.
- Same-token repayment, no-custody, and no-bridge boundaries remain explicit.
- `LoanPrincipal` joins by its loan relationship and never weakens reward/funding selectors.
- New user-facing strings are covered in en, es, and pt.

## RED / GREEN

- RED recorded before production implementation on 2026-08-17 at approximately 20:39 UTC:
  - `cd packages/indexer && node ../../scripts/dev/node-cli.js mocha --require tsx --timeout 30000 test/credit-registry.test.ts` failed because `./v3` did not export `CreditRegistry`.
  - `cd packages/shared && bun run test -- src/__tests__/credit-register.test.ts` failed because `config/query-keys/credit` and the Credit hook/module exports did not exist.
  - The tests already covered lifecycle, replay/order convergence, default recovery, installment accumulation, aggregate accounting, disclosure, editorial aggregation, query isolation/invalidation, error handling, and online/offline separation.
- GREEN: pass the same tests, regenerate Envio types, then run the required package, cross-package, ontology, vocabulary, and Plan Hub gates.

## Frozen behavior matrix

| Axis | Material cases | Expected projection/API behavior |
|---|---|---|
| Lifecycle state | Requested, Approved, Disbursed, partial repayment, Repaid, Defaulted, Cancelled | Preserve emitted hard states; derive `Repaying` only when repayment is positive and the hard state remains Disbursed; never invent transitions. |
| Viewer role | unauthenticated, unrelated authenticated, former steward, current steward, subject | Hide personal rows from the first three; expose only to a current steward or the subject. |
| Loan rail | None, Jar, Treasury, G$ settlement | None remains pre-disbursement; Jar/Treasury support online record mutations; G$ repayment is explicitly unavailable. |
| Pause and pool state | module paused/unpaused; pool open/non-open | Reads remain available; mutations preserve contract gates and are never queued offline without replay-safe identity. |
| Installment and time boundaries | zero/partial/full repayment; before/at/after due date | Accumulate emitted installments and amounts; due/default presentation derives from immutable due date plus hard state without client-side state mutation. |
| Delivery order | normal, duplicate, replay, stale, reverse | Chain-scoped entity/event IDs make duplicates idempotent; fact cursors and accumulated event facts converge without RPC reads or database scans. |
| Default recovery | default followed by partial/full repayment | Preserve default history and default numerator; later repayment updates repaid/outstanding and may reach Repaid without erasing the default fact. |
| Settlement relationship | relationship before/after disbursement, absent relationship | Join when present in either order; absence stays explicit and never changes loan or consideration status. |
| Unsupported repayment | G$ repayment attempt | Shared API exposes an unavailable action and never treats a typed hash as authenticated proof, enqueues a transfer, or submits value. |

## Exact Bun commands

- `bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts`
- `bun run --filter @green-goods/shared typecheck`
- `bun run --filter @green-goods/shared check:stories`
- `bun run --filter @green-goods/shared check:story-quality`

Indexer:

- `bun run --filter @green-goods/indexer codegen`
- `bun run --filter @green-goods/indexer check:indexing-boundary`
- `bun run --filter @green-goods/indexer test`
- `bun run --filter @green-goods/indexer build`

## Out of scope

- Contract, client, admin, deployment, Safe/Zodiac, environment, custody, bridge, broadcast, public borrower lists, personal credit scores, transferable vouchers, in-kind valuation, background G$ sends, or release operations.

## Unblock evidence

- PRD-785 is Done; `bff3b274d` is an ancestor of the current branch and the frozen interface is present.
- The existing settlement `LoanPrincipalRelationship` seam passed in the fresh 277-test indexer run; this lane supplies the missing canonical CreditRegistry projection.
- Viewer-aware selector RED proof is recorded before implementation.
- `status.json` dependency state is updated before dispatch.
