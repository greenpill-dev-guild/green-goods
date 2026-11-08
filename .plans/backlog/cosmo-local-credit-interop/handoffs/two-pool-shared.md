# Two-pool Shared implementation

The Shared model now separates issuer/token identity from per-pool listings. The live catalog retains the existing Green Goods pool and adds the receipt-backed TSV identity. No undeployed TAS pool address is activated. This is uncommitted working-tree implementation, not a deployment or commit-attributed validation receipt.

## Public interface and migration

- `ServiceIssuerRoute.assets` owns each issuer/token once. `route.pools[]` owns `id`, `name`, `chainId`, `garden`, deployment/dependency pins and `listings[]`. A listing owns `assetId`, `poolHoldingCap`, `priceIndex`, `delisting`; these fields were removed from the asset.
- Every exchange/approval/revocation names `ServiceIssuerActor.poolId`; issuer reserve/booking actions do not need a pool. Quotes include `poolId` and `poolAddress`. Reviews, configuration fingerprints, pending checkpoints and receipts bind the selected pool.
- `issuerPool(route, poolId)` and `issuerPoolPolicy(pool, assetId)` validate explicit selection. Governance drafts require the pool ID. `serviceIssuerListingKey(routeId, poolId, assetId)` takes three arguments.
- Snapshot `pool` can be null. `poolStatus` is `unselected`, `observed` or `unavailable`. Exchange failure does not erase holdings or prevent independently valid service recovery. Listing reads retain successful observations when another pool is unavailable.
- Wallet holdings deduplicate by chain and token, not issuer address. Each issuer exposes `exchanges[]` with pool identity, local status, holding and cap; unknown exchange status is `unavailable`. A single adapter per canonical token is enforced across duplicate integration views.
- New member approvals bind exact `terms.exchangePool` chain/ID/address. Old records without that field retain their historical digest; signing a new record requires it. The existing draft hook still reports unavailable until the separately owned persistent draft desk is implemented.
- `useServiceIssuerOperations` exposes `lastExchange` (query), `quoteContinuation` and `reviewContinuation` (mutations). A first confirmed exchange receipt is saved before pending cleanup. A second hop uses a distinct explicit pool, revalidates the first receipt, requires a fresh review and cannot spend more than the actual first delivery. Quotes/reviews disclose `intermediateResidue`. A completed continuation cannot become a third hop, and replaying its stale review is rejected. Approval remains a separate finite review. This is deliberate sequential execution, not atomic execution.

The existing transaction checkpoint/receipt owner remains authoritative. No transaction batching module was changed, no parallel exchange engine or arbitrary path search was added, and no atomic account capability is claimed. If the second quote is unavailable, the intermediate voucher is held in the wallet and the first receipt remains recoverable; booking remains separate from exchange confirmation.

## Evidence and configuration

TSV factory deployment was decoded from public Gnosis RPC data supplied by the lead in `/tmp/gg-tsv-deployment-public.json`: transaction `0x6ea6507597f2a631092692692aecbf05ad8c5eb50543d0fbd7c24705660cf016`, block `48925712`, block hash `0x1f897c35019bf415cc4c93b8817a8296ce44774c515df787296b1ecc0b5589ee`. Factory, initializer, implementation, admin and salt are recorded in the existing live pins owner. TSV remains `0xB89300F212fcbdF3D5b73eADE290b3c0d6292143`. Service capacity and fresh issuer consent remain unconfirmed/null; this does not invent issuance permission. The existing source reward authority is recorded separately from the Gnosis reserve Safe.

The new TAS pool is a release/readback prerequisite. Current GG exchange remains usable when its full live checks, liquidity, caps and account authorization pass. The read-only Plan Hub gate preserved RESR-73 and parent-only Linear mode; this lane made no external writes or hub status changes.

## Focused proof

Working-tree base observed: `a0d503abcb40d835ef95992e91e78b7a7305f16f`, branch `fix/work-approval-feedback`. Validated paths are dirty, so this SHA does not certify their content. Commands use repository Bun wrappers.

RED:

- `bun run --cwd packages/shared test -- src/__tests__/service-issuer-operations.test.ts -t 'unreviewed pool|issuer recovery independent'`: 2 failures before implementation (unknown pool accepted; exchange dependency blocked issuer recovery).
- `bun run --cwd packages/shared test -- src/__tests__/service-issuer-operations.test.ts -t 'confirmed first hop|receipt persistence fails'`: 2 failures before continuation implementation (missing durable receipt API; receipt persistence failure did not retain pending). Observed start 2026-11-08 05:07:31 UTC.

Latest focused results observed by 2026-11-08 05:15:34 UTC:

- `bun run --cwd packages/shared test -- src/__tests__/service-issuer-operations.test.ts src/__tests__/service-access-wallet.test.ts`: **2 files, 123 tests passed**, start 05:12:50 UTC, duration 65.72s. Includes pool-specific review/receipt, unavailable exchange independence, shared-token deduplication, bounded second hop/residue, no replay/third hop and storage-failure reconciliation.
- `bun run --cwd packages/shared test -- src/__tests__/hooks/commitment-pooling/useServiceIssuerOperations.test.tsx src/__tests__/hooks/commitment-pooling/useServiceIssuerOnboarding.test.tsx src/__tests__/service-access-live-config.test.ts`: **3 files, 15 tests passed**, start 05:11:43 UTC, duration 56.52s.
- `bun run --cwd packages/shared typecheck --scope full`: **exit 0**, source and test projects. Completion observed by 05:15:34 UTC.
- In the preceding 7-file run, `service-issuer-metadata`, `service-issuer-approval`, `service-offer-line`, `commitment-voucher-outcomes`, and `service-access-live` passed unchanged. That overall run failed on two migration mistakes in wallet asset destructuring and synthetic swap argument order; both were corrected and the two affected files reran green above. Do not reuse that failed overall command as a green receipt.
- Focused Biome formatting completed; final formatting-only follow-up is recorded in the chat. No authenticated browser or actual-account signing proof was performed in this lane. Lead owns consolidated consumer checks and rendered proof.

## Remaining integration

Client/Admin consumers must select explicit pool IDs, handle null/unavailable pool reads and display per-pool listings. Client live service checkout must use issuer operations rather than the rehearsal-only quote action. Own service obligations and held-voucher spending require separate presentation. The lead assigned Client migration to this agent after the Shared checkpoint; that work has a separate continuation. Source-structure/whole-consumer gates and rollout are not claimed complete here.

Task record: `cosmo-local-credit-interop` P6–P10 | Type: feature | Outcome: Shared checkpoint implemented; consumer integration ongoing
Agent/model: Codex / exact model unknown | Coverage: this Shared lane across usage-limit resumptions; earlier timing unavailable.

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate | unknown | Existing issuer/service/pending/wallet owners, plan and guides inspected; read-only sync gate preserved. |
| Implement | unknown → 2026-11-08 05:08:25 | Issuer/pool separation, independent validity, live TSV pin, wallet deduplication, consent binding and continuation checkpoint. |
| Verify/correct | 2026-11-08 05:08:25 → 05:15:34 | Focused failures corrected; latest 123 domain tests, 15 hook/config tests and full Shared typecheck passed as above. |

Human corrections in this segment: none observed; human attention: unknown. No publish phase.

## Client and steward-award continuation

The earlier “Remaining integration” paragraph describes the Shared checkpoint, not the final current tree. Client integration and the steward award surface are now implemented in this lane; the persistent Admin draft editor was transferred to `voucher_award_storage` by the lead.

- Reusable issuer/holder controls moved together from `views/Profile` to `packages/client/src/components/Features/Vouchers/`. Profile composes the same capability as service checkout. `ServiceIssuerActions` owns issuer-only acts; `ServiceIssuerReceipt` keeps actual delivery and the reviewed pool with the confirmed receipt. No duplicate forms or pass-through route wrappers remain.
- Profile separates services offered from held vouchers, selects the exact pool, and exposes an explicit continuation after a confirmed first exchange. Selecting continuation uses the bounded second-hop APIs; first confirmation never starts another exchange. Holder mode does not display issuer capacity obligations.
- Live `ServiceLiveExchange` connects actual issuer-operation quote/review/execute/reconcile to checkout. Rehearsal keeps its existing labeled pilot flow. Checkout candidates subtract canonical available target-token holdings (escrow is not spendable twice) and disappear when already funded. The chosen checkout stays mounted through refresh so the receipt is retained. Direct hub redemption remains independent of swapping.
- Profile draft loading, approval and decline now use `useServiceIssuerDesk`, preserving the exact stored revision. Revised terms with cleared prior approval still require a new member approval. Approval copy explicitly says steward setup remains before issuance.
- Wallet holdings use chain+token identity and show independent exchange listings. Confirmed retrospective award receipts load only on an explicit action and stay separate from fungible holdings.
- Admin `VoucherAwardDesk` is mounted from `VoucherReserveCard` only after explicit selection, with canonical issuer/token identity and account-change resets. `VoucherAwardDialog` reviews recipient, token, reserve, exact amount, reason and reference before preparing a stable award ID. Preparation never sends. `VoucherAwardRecordView` presents exact Safe nonce/hash/threshold, a Safe handoff for additional signers, explicit journal recovery and exact-transaction reconciliation. A loaded award must be checked before a send is offered. Unresolved submissions never read as delivered.
- Known award authorization, reserve shortage, nonce conflict and unresolved-submission errors give actionable copy. No historical request is mutated, no issuance occurs, and all backend authority/receipt checks remain authoritative.
- Admin issuer listing rows match approved drafts only by exact pool chain/id/address. Legacy drafts remain independent rather than attaching to every listing. Individual admission drafts retain full reviewed capacity/consent requirements; delisting and collective recovery retain their separate behavior.
- Admin approval export contains the exact canonical draft, signed approval and provenance digest for the existing deployment evidence workflow. It does not publish or deploy anything.
- Added all new client/award/desk labels in English, Spanish and Portuguese. The lead granted exclusive locale ownership; desk UI implementation belongs to its sibling.

Story paths for lead-rendered proof:

- `Client/Profile/ServiceIssuerPanel` (moved file, unchanged story identity), holder and finite pool review.
- `Client/Garden/ServiceLiveExchange/ChooseExchange`: selected fictional holder snapshot; all live mutations refuse.
- `Client/Profile/ServiceIssuerOnboarding/EditedAwaitingApproval` and `DraftToReview`.
- `Admin/Pool/VoucherAwards/{Review,SafeHandoff,UncertainDelivery}`.
- `Admin/Pool/VoucherAwardRecord/{ReviewBeforeSigning,Uncertain,Delivered}`.
- `Admin/Pool/VoucherAwardDesk/ExplicitLoad`: canonical discovery identity, mocked/refusing operations.

Harness change: two narrow Storybook hook spy registrations in `packages/shared/.storybook/preview.tsx` for `useServiceIssuerOperations` and `useVoucherAwards`; unrelated existing vault spies preserved. New award type consumers require the explicit `public-contracts/voucher-awards` export leaf; sibling/lead owns the manifest change.

### Continuation verification truth

Passed before the final UI integration:

- Shared issuer operations + metadata: **106 tests / 2 files**, `/tmp/two-pool-shared-final.log`, start 2026-11-08 05:30:57 UTC. Includes individual governance-capacity guard.
- Shared checkout shortfall metadata: **12 tests / 1 file**, `/tmp/two-pool-shortfall.log`, start 2026-11-08 05:42:12 UTC. Partial balance and already-sufficient target holdings covered.
- Admin issuer onboarding/export: **12 tests / 1 file**, `/tmp/two-pool-admin-export.log`, same start, 37.96s.
- Earlier Client five-file checkpoint: **55 tests passed**, `/tmp/two-pool-client-focused.log`; subsequent changes mean this is not final-tree proof.

The host became heavily contended during final checks. Lead requested stopping lane-owned checks and running consolidated gates serially. No timeout limits were raised and no unrelated process was stopped.

- `/tmp/two-pool-client-complete.log`: actual completion **52 passed / 5 failed**, all five **10-second timeouts**, duration755.54s. Files: `ServiceIssuerPanel.test.tsx`, `ServiceIssuerOnboarding.test.tsx`, `ServiceAssets.test.tsx` timed out; `VouchersTab.test.tsx` and `ServicePromise.test.tsx` passed. No assertion failures. Rerun the same focused five-file command after contention resolves.
- `/tmp/two-pool-awards-ui.log`: **1 passed / 3 failed**, including required-star label query mismatch, a test toast stub missing API methods and a timeout. Fixed to accessible textbox role queries and a shared toast-service mock; rerun `src/__tests__/views/VoucherAwards.test.tsx` is still required. Product behavior was not weakened.
- `/tmp/two-pool-client-types-complete.log`: emitted onchain-snapshot narrowing and moved-type import errors. Both corrected, **fresh full Client typecheck required**.
- `/tmp/two-pool-admin-types-complete.log`: emitted wrong live-catalog export and TextField prop errors, corrected to canonical issuer catalog and `inputProps`. Check was interrupted with exit130; **fresh full Admin typecheck required**.
- `/tmp/two-pool-structure-final.log`: broad public-contracts barrel imports in three new award UI files rejected; switched to a precise public leaf (manifest addition coordinated), **rerun required**. Existing component size caps now respected after cohesive extraction.
- `/tmp/two-pool-stories-check.log`: failed only missing AwardDesk/RecordView stories at that time; both stories subsequently added, **rerun required**. Storybook build deferred to serial lead gate.
- Formatter checkpoints passed; final small formatting follow-up is in `/tmp/two-pool-award-ready-format.log`.

Rendered evidence belongs to the lead: IAB Chromium **Storybook, synthetic**, holder finite approval with exact pool name/address was observed; no authenticated signing or live award was performed. New award/draft rendered proof was pending host/browser recovery. No chain broadcast or external data write occurred.

Task/phase continuation: consumer implementation after 05:15:34 UTC; focused correction and contention observed through about06:12UTC (exact boundaries unavailable). Outcome: code ready for lead's serial validation, not final green or deployed. Human attention unknown. No publication phase.
