# Commitment Credit — August Companion - Codex State/API Handoff

## Status

- Machine lane: state_api
- Owner: Codex
- Execution branch: feature/commitment-pooling-credit-api-state
- Current state: passed
- Tested source commit: `c070d20822a862ee09df486e5769c7966e86418f` at `2026-08-17T21:05:38Z`
- Linear context: PRD-786 is the state/API lane issue under PRD-697; source proof is complete and ready for In Review. PRD-785 remains Done and PRD-787 remains the UI boundary.

## Inputs

- The three credit dispatch gates recorded in `../status.json` have cleared.
- Frozen `CreditRegistry` and settlement `LoanPrincipal` ABIs/events. The settlement `LoanPrincipalRelationship` projection is GREEN, but canonical `Loan`, `LoanEvent`, and `CreditPoolStats` indexing is owned here.
- `../spec.md` sections 3, 5, 6, and 7 revalidated against the implemented interfaces.
- Existing shared query-key, mutation-error, IndexedDB job, account-profile, and online Celo-transfer patterns.

## Outputs

- Envio v3 `CreditRegistry` registration, ABI event coverage, and canonical `Loan`, `LoanEvent`, and `CreditPoolStats` projections.
- Shared `Loan`, `LoanState`, `LoanRail`, `CreditPoolStats`, and settlement relationship types.
- Centralized `queryKeys.credit.*`, hooks, selectors, invalidation rules, and mutation hooks in `@green-goods/shared`.
- All Credit mutations remain online-only because the frozen operations do not expose replay-safe job identity. No Credit operation or G$ transfer was added to the offline queue.
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
- GREEN at `c070d20822a862ee09df486e5769c7966e86418f`:
  - CreditRegistry focused projection suite passed 4/4.
  - Shared Credit register suite passed 10/10.
  - Full indexer passed 281 with 1 governed pending integration test.
  - The selected checkpoint passed full shared (3,635 passed, 1 skipped), client (658), admin (568), agent (270 across both lanes, 1 skipped), indexer (281, 1 pending), docs (28 plus build), and every selected repository guard.

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

Cross-package and plan closure:

- `bun run validation:plan -- --intent checkpoint` — selected a sensitive 15-check plan for the 30 committed source paths.
- `node scripts/dev/ci-local.js --quick` — passed format, lint, shared/client/admin/agent/indexer/docs tests, docs build, source structure, design, ontology, and supply-chain checks.
- `bun run check:ontology` — 47 checker tests and all ontology guards passed; Solidity, GraphQL, and shared Credit vocabularies agree.
- `bun run lint:vocab` — passed for en, es, and pt.
- `node scripts/harness/plan-hub.mjs validate --feature commitment-credit-follow-on --json` — validated all 43 feature hubs.
- `node scripts/harness/plan-hub.mjs record-tdd --help` — the harness returned `Missing required flag: --feature`; top-level help and the command source were read before the supported flags were used.

## Actual files changed

- Plan state: `handoffs/codex-state-api.md`, `../status.json`, and `../plan.todo.md`.
- Indexer registration/schema: `packages/indexer/config.yaml`, `packages/indexer/schema.graphql`, and `packages/indexer/scripts/check-indexing-boundary.mjs`.
- Indexer handlers: `packages/indexer/src/EventHandlers.ts`, `packages/indexer/src/handlers/credit-registry.ts`, `packages/indexer/src/handlers/settlement-disbursements.ts`, and `packages/indexer/src/handlers/settlement-source-configuration.ts`.
- Indexer tests: `packages/indexer/test/credit-registry.test.ts` and `packages/indexer/test/v3.ts`.
- Shared Credit API: `packages/shared/src/modules/commitment-pooling/{credit,data-credit,types-credit}.ts`, their three barrel files, `packages/shared/src/config/query-keys/credit.ts`, both query-key barrels, `packages/shared/src/hooks/commitment-pooling/useCredit.ts`, and both hook barrels.
- Shared public surface/proof: `packages/shared/src/index.ts`, `packages/shared/src/__tests__/credit-register.test.ts`, and `packages/shared/src/i18n/{en,es,pt}.json`.
- Ontology: `packages/shared/src/ontology/green-goods-ontology.json` and generated `docs/docs/reference/ontology.generated.mdx`.

## Known proof limits

- No deployed CreditRegistry address exists in the indexer configuration yet. Registration is prepared through the existing SettlementModule relationship event; live-chain replay and post-deploy address pinning remain release work.
- Proof is codegen, unit/integration simulation, package build, and cross-package checkpoint evidence. It is not deployment, broadcast, live-chain transaction, or authenticated UI proof.
- The full indexer suite retains one governed pending real-contract integration test unrelated to the Credit projection; all 281 executable tests passed.
- Public onchain loan events remain publicly discoverable. Viewer-aware selectors are a product-disclosure boundary, not a confidentiality guarantee.
- G$ repayment remains unavailable under `GDollarRepaymentDisabled`; no authenticated receipt policy was introduced.

No UI, deployment, broadcast, G$ repayment, custody, bridge, Safe/Zodiac, environment, value transfer, or other value operation was performed.

## Out of scope

- Contract, client, admin, deployment, Safe/Zodiac, environment, custody, bridge, broadcast, public borrower lists, personal credit scores, transferable vouchers, in-kind valuation, background G$ sends, or release operations.

## Unblock evidence

- PRD-785 is Done; `bff3b274d` is an ancestor of the current branch and the frozen interface is present.
- The existing settlement `LoanPrincipalRelationship` seam passed in the fresh 277-test indexer run; this lane supplies the missing canonical CreditRegistry projection.
- Viewer-aware selector RED proof is recorded before implementation.
- `status.json` records GREEN TDD proof and `state_api.status = passed`; UI, QA, deployment, and release boundaries remain unchanged.
