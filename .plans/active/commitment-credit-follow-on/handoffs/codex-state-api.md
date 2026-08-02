# Commitment Credit — August Companion - Codex State/API Handoff

## Status

- Machine lane: state_api
- Owner: Codex
- Branch signal: codex/state-api/commitment-credit-follow-on
- Current state: blocked on contracts and indexer GREEN
- Linear context: PRD-697 is the parent tracker; no separate lane issue is required before dispatch

## Inputs

- The three credit dispatch gates recorded in `../status.json` have cleared.
- Frozen `CreditRegistry` and settlement `LoanPrincipal` ABIs/events plus GREEN indexer codegen and handlers.
- `../spec.md` sections 3, 5, 6, and 7 revalidated against the implemented interfaces.
- Existing shared query-key, mutation-error, IndexedDB job, account-profile, and online Celo-transfer patterns.

## Outputs

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

- RED: add focused tests for loan state overlays, viewer-aware row disclosure, aggregate-only editorial output, query invalidation, and online/offline action separation.
- GREEN: pass the same tests, then shared typecheck and story checks for any changed shared component.

## Exact Bun commands

- `bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts`
- `bun run --filter @green-goods/shared typecheck`
- `bun run --filter @green-goods/shared check:stories`
- `bun run --filter @green-goods/shared check:story-quality`

## Out of scope

- Contract/indexer implementation, public borrower lists, personal credit scores, transferable vouchers, in-kind valuation, direct app contract calls, background G$ sends, or release broadcasts.

## Unblock evidence

- Contracts and indexer lanes are GREEN against the revalidated spec.
- Viewer-aware selector RED proof is recorded before implementation.
- `status.json` dependency state is updated before dispatch.
