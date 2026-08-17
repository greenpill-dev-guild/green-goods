# Commitment Credit — August Companion - Codex State/API Handoff

## Status

- Machine lane: state_api
- Owner: Codex
- Execution branch: feature/commitment-pooling-credit-api-state
- Current state: passed after review remediation
- Tested source commit: `c5add7efaf65e72cfe17ece0726f18a11500da6b` at `2026-08-17T22:26:46Z`
- Linear context: PRD-786 source remediation and fresh proof are complete and ready to return to In Review. PRD-785 remains Done and PRD-787 remains the untouched UI boundary.

## Review remediation matrix

| Finding | RED boundary | Expected closure |
|---|---|---|
| Personal hook return leaks raw TanStack `data` | Provider-backed hook tests for unrelated, former-steward, self, and current-steward viewers | `useCreditLoan` and `useCreditSubjectLoans` expose only gated `loan`/`loans`; raw personal `data` is absent. |
| Frozen-event coverage records submitted events instead of observed effects | Handler-specific indexer assertions for initialization, Approved, Disbursed partial repayment, and pause false | Removing any frozen handler makes at least one focused assertion fail; no exemption list remains. |
| Shared read hooks lack integration proof | Provider-backed tests for all four hooks, chain isolation, role changes, inactive pool reads, zero relationship IDs, and errors | Hook return contracts, query enablement, disclosure, and cache behavior are pinned at the public API boundary. |
| Due-date and pause/pool rows were claimed without direct proof | Before/at/after due-date unit cases plus paused/non-open read cases | Shared reads never invent on-chain transitions or disappear solely because writes would be contract-gated. |
| Dynamic registration misses initialization-era events | Config/release-handoff assertions and documentation | Release operators must statically pin CreditRegistry at or before its deployment block; dynamic registration is fallback-only. |
| Fully blocked validation was reported as a vacuous success | Direct CLI reproduction plus a fully-blocked executor regression when missing | A plan that executes zero checks because every check is blocked exits non-zero and reports `blocked`. |

Review-remediation RED was recorded before production edits on 2026-08-17:

- `bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts src/__tests__/credit-hooks.test.tsx` failed 4 hook-return assertions because raw TanStack `data` remained present; 14 adjacent Credit assertions passed.
- `cd packages/indexer && node ../../scripts/dev/node-cli.js mocha --require tsx --timeout 30000 test/credit-registry.test.ts` failed only the replay-after-late-pool materialization assertion; the other 4 Credit read-model tests passed.
- `node --test scripts/dev/ci-local.test.mjs` passed 18/18, including the new fully-blocked-plan assertion with zero executed checks and exit code 2. The review's exit-0 observation is not reproducible in the current runner implementation and does not justify a production runner change.

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

- Original implementation RED is documented in the earlier receipt and same-day commit timeline, but was not committed as an intermediate tests-only snapshot. The review correctly classified that original provenance as documented rather than independently reconstructable.
- Fresh review-remediation RED was observed before remediation source edits:
  - `bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts src/__tests__/credit-hooks.test.tsx` failed 4 hook-boundary assertions because the returned TanStack object still exposed raw personal `data`; 14 adjacent Credit assertions passed.
  - `cd packages/indexer && node ../../scripts/dev/node-cli.js mocha --require tsx --timeout 30000 test/credit-registry.test.ts` failed the late-pool configuration replay assertion; the other 4 Credit projection tests passed.
- GREEN at `c5add7efaf65e72cfe17ece0726f18a11500da6b`:
  - Focused shared Credit unit/provider-integration suites passed 21/21.
  - Full indexer passed 282 with 1 governed pending test; the focused CreditRegistry suite passed 5/5.
  - The governed real-contract E2E passed 10/10 after mining a CreditRegistry `PausedSet` log on a disposable Arbitrum fork and reading `CreditRegistryConfiguration` plus `LoanEvent` through local Envio/Hasura.
  - The selected 15-check checkpoint executed and passed format, lint, shared/client/admin/agent/indexer/docs tests, docs build, source structure, design/vocabulary, ontology, and supply-chain/Plan Hub checks.
  - The validation-runner suite passed 18/18, including zero executed checks + fully blocked => exit code 2.

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

## Exact validation commands and summarized results

- `bun run validation:plan -- --intent checkpoint` — READY, sensitive, 38 changed paths, 15 checks.
- `bun run --filter @green-goods/shared test -- src/__tests__/credit-register.test.ts src/__tests__/credit-hooks.test.tsx` — 21/21 passed across 2 files.
- `bun run --filter @green-goods/shared typecheck` — passed.
- `bun run --filter @green-goods/shared check:stories` — 205/205 required surfaces covered.
- `bun run --filter @green-goods/shared check:story-quality` — 177 story files passed.

Indexer:

- `bun run --filter @green-goods/indexer codegen` — passed.
- `bun run --filter @green-goods/indexer check:indexing-boundary` — 3/3 checks; 15 contracts on 3 chains.
- `bun run --filter @green-goods/indexer test` — 282 passed, 1 governed pending E2E in the default suite.
- `bun run --filter @green-goods/indexer build` — passed.
- `bun run --filter @green-goods/indexer test:contract-events` — 10/10 passed, including the real local-fork Credit pause projection through Envio.

Cross-package and plan closure:

- `node scripts/dev/ci-local.js --quick` — executed all selected stages and passed; full shared 3,646/1 skipped and client 658, plus the remaining app/package/guard stages.
- `node --test scripts/dev/ci-local.test.mjs` — 18/18 passed; fully blocked zero-check plans exit 2.
- `bun run check:ontology` — 47 checker tests and all ontology guards passed; 7 existing baselines remained valid.
- `bun run lint:vocab` — passed for en, es, and pt as part of the checkpoint design guard.
- `node scripts/harness/plan-hub.mjs validate --feature commitment-credit-follow-on --json` — rerun after receipt closure; passed.
- `node scripts/harness/plan-hub.mjs record-tdd --help` — the harness returned `Missing required flag: --feature`; top-level help and the command source were read before the supported flags were used.

## Actual files changed

- Plan/release guidance: `.plans/active/commitment-credit-follow-on/{handoffs/codex-state-api.md,plan.todo.md,status.json}` and `.plans/active/commitment-pooling/handoffs/human-release-ops.md`.
- Indexer schema/config/handlers: `packages/indexer/{config.yaml,schema.graphql}`, `src/handlers/credit-registry.ts`, and new bounded helper modules `credit-registry-configuration.ts` plus `credit-registry-projections.ts`.
- Indexer proof: `packages/indexer/test/credit-registry.test.ts`, `test/contractEventsLocal.test.ts`, and `test/helpers/local-contract-events.ts`.
- Shared API/proof: `packages/shared/src/hooks/commitment-pooling/useCredit.ts`, `modules/commitment-pooling/{credit.ts,types-credit.ts}`, `__tests__/credit-register.test.ts`, and new provider-backed `__tests__/credit-hooks.test.tsx`.
- Validation regression: `scripts/dev/ci-local.test.mjs` only; production runner behavior already returned blocked/exit 2 and required no source change.

## Known proof limits

- Static CreditRegistry address/start-block activation remains release work. Dynamic registration begins at the binding block and cannot recover initialization-era events, so release must pin at or before deployment before reindex/cutover.
- Proof includes unit tests, provider-backed shared integration tests, codegen/build, a full cross-package checkpoint, and a disposable-fork/Docker/Envio E2E. It is not deployment, broadcast, hosted-indexer replay, live-chain transaction, or authenticated UI proof.
- The default full indexer suite keeps the governed E2E skipped unless explicitly enabled; all 282 default executable tests and all 10 explicitly enabled E2E tests passed.
- Public onchain loan events remain publicly discoverable. Viewer-aware selectors are a product-disclosure boundary, not a confidentiality guarantee.
- G$ repayment remains unavailable under `GDollarRepaymentDisabled`; no authenticated receipt policy was introduced.

No UI, deployment, broadcast, G$ repayment, custody, bridge, Safe/Zodiac, environment, value transfer, or other value operation was performed.

## Out of scope

- Contract, client, admin, deployment, Safe/Zodiac, environment, custody, bridge, broadcast, public borrower lists, personal credit scores, transferable vouchers, in-kind valuation, background G$ sends, or release operations.

## Unblock evidence

- PRD-785 is Done; `bff3b274d` is an ancestor of the current branch and the frozen interface is present.
- The existing settlement `LoanPrincipalRelationship` seam and canonical CreditRegistry projection both pass in the fresh 282-test indexer run and the real local-fork E2E.
- Viewer-aware hook-boundary and late-pool replay RED proof is recorded before remediation source edits.
- `status.json` records GREEN TDD proof and `state_api.status = passed`; UI, QA, deployment, and release boundaries remain unchanged.
