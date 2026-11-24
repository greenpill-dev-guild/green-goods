# Retrospective voucher awards — implementation handoff

The existing Agent SQLite database now owns durable retrospective award claims. A claim freezes
the recipient, configured reserve/token, amount, reason, prior-work reference and exact Gnosis
Safe transaction envelope. The same award ID returns the same claim; changing its terms or
claiming the same Safe nonce under another ID is rejected. Preparing an award neither transfers
nor mints vouchers. Existing accepted-work reward terms are unchanged.

## Owning surfaces and reuse

- `packages/agent/src/services/db/voucher-awards.ts` uses the existing database connection,
  uniqueness constraints, `BEGIN IMMEDIATE` claims and revision compare-and-swap updates.
  `services/db/schema.ts` initializes the table at schema version 11. The existing Dockerfile
  sets `DB_PATH=/data/agent.db` on the mounted volume; production must retain one authoritative
  ledger for these reserves, not independent SQLite copies.
- `services/voucher-awards.ts`, `services/voucher-awards-chain.ts`, and
  `api/routes/voucher-awards.ts` own authenticated commands, current Safe eligibility and
  receipt verification. Server registration uses the existing composition root.
- `packages/shared/src/public-contracts/voucher-awards.ts` owns the signed HTTP protocol.
  New `voucher-award-client.ts`, `voucher-award-safe.ts`, `voucher-award-send.ts` modules and
  `hooks/commitment-pooling/useVoucherAwards.ts` compose it with the existing account signer and
  TransactionSender journal. IndexedDB supports local recovery; it is not the global claim guard.
- `voucher-award-config.ts` derives its issuer/token allowlist from receipt-backed service
  routes and the checked-in steward receiver pin. No arbitrary caller-selected reserve is allowed.
- Closest prior capability: the pool console prepares Safe handoff files and the generic batch
  engine persists local submissions. Neither previously owned a cross-device business award ID
  or server-verified recipient receipt. Those rules now belong to the award ledger.

## UI contract

`useVoucherAwards(reserve?: Address | null)` returns `records`, `isLimited`, and these explicit
React Query mutations. Mounting never opens a signature prompt; there are no offline retries.

| Action | Input | Result |
| --- | --- | --- |
| `load` | none | Configured reserve's claims; without a reserve, the current recipient's confirmed receipts |
| `prepare` | `{awardId,reserve,token,recipient,amount,reason,reference}` | Frozen record; `amount` is positive integer token base units |
| `send` | stored record | `{record,operation}` through the existing sender/journal, only threshold-one EOA owners |
| `recover` | stored record | Reconciles a local journal operation without creating another submission |
| `reconcile` | `{awardId,transactionHash}` | Server-verified state for the exact frozen Safe hash |

`directSigningAvailable` reports signing capability; record threshold and actual EOA code are
also checked at execution. Other owners or thresholds require an exact Safe-envelope handoff.
Exporting or preparing is not sending. A handoff must retain the saved Safe nonce, calldata and
`safeTxHash`; a plain transfer draft rebuilt at a new nonce is not the same award.

Review all terms before `prepare`: a prepared claim reserves the Safe's current nonce in the
ledger. A mistaken or abandoned claim is not silently released or replaced. `read` rechecks
current nonce and token pins; a consumed nonce becomes `needs_reconciliation`. The UI can reload
existing claims and reconcile a known transaction. No cancellation transaction is added here.

Unknown local submissions may have no verifiable transaction hash yet. In that case the local
`operation.status` remains unresolved while the durable record still says awaiting authorization.
The UI must show the unresolved operation and offer recovery, not claim delivery or automatically
retry. Exact nonce-bound signatures prevent a second execution even across browser/device retries.

Lists expose at most 200 records and flag a full window as partial. Recipient filtering occurs
in SQL before this limit and uses a recipient/state index. Full history pagination is not added.

## Authority and failure evidence

- Every command signs version, chain, actor, audience, timestamp and complete normalized body.
  Proofs expire after five minutes and are checked against the request origin. Only identical
  read/list/received proofs are cached for 60 seconds; preparation and reconciliation are signed
  separately. A monotonic session generation invalidates pending work on account changes,
  account A → B → A, or sender replacement.
- Steward access requires a current actual Safe owner and recognized guard eligibility. Garden
  role labels alone do not authorize an award. Token owner, proxy/runtime pins, reserve balance
  and the Safe's onchain transaction hash are checked during preparation; send preflight rechecks
  eligibility, token pins, nonce, threshold and reserve balance.
- Direct sending uses the owner's EIP-712 signature over the exact SafeTx including nonce.
  Safe prevalidated `v=1` owner signatures are deliberately rejected because identical calldata
  could otherwise execute at a later nonce.
- A confirmed receipt requires the exact Safe `ExecutionSuccess(safeTxHash)` and the token's
  exact reserve-to-recipient transfer amount. The outer initiator is never treated as recipient.
  A proven replacement outer hash can resolve an earlier submitted hash. An unrelated receipt,
  success event without delivery, or arbitrary reverted transaction cannot resolve the claim.
- Pending/reverted direct transactions additionally require sorted nonce-bound EOA signatures,
  current signer eligibility, matching threshold and unchanged nonce. Unsupported contract
  signatures wait for the exact Safe receipt. Unknown outcomes retain the claim.
- HTTP failures distinguish malformed input (400), invalid signature (401), absent authority
  (403), missing record (404), competing/stale claim (409), rate limit (429), and unavailable
  dependencies (503), without exposing private provider details.

## Gnosis RPC correction

The generic source-garden `getNetworkConfig(100)` falls back to Arbitrum. Awards now use explicit
Gnosis selection in `packages/agent/src/services/agent-rpc.ts`, including optional existing-process
`GNOSIS_RPC_URL` and the chain's public RPC when unset. A source-chain Alchemy key cannot redirect
chain 100. `packages/agent/src/index.ts` constructs both the award chain reader and account
signature verifier with `resolveAgentRpcUrl(100)` and the Gnosis chain. No environment files changed.
`agent-rpc.test.ts` proves configured/default/key-present Gnosis selection.

## Verification

- RED: initial focused award service test failed because the durable award store did not exist.
- Additional RED/GREEN boundary loop: malformed JSON reached a mocked service (fixed with an
  explicit 400 guard); the unit SQLite shim ignored filenames (disk persistence proof now uses
  actual file SQLite with independent connections and reopen, while production remains Bun).
- `bun run --cwd packages/agent test -- src/__tests__/voucher-awards.test.ts src/__tests__/voucher-awards-chain.test.ts src/__tests__/voucher-awards-api.test.ts src/__tests__/agent-rpc.test.ts`
  — 4 files / 28 tests passed, latest observed start 2026-11-08 05:25:45 UTC.
- `bun run --cwd packages/agent test -- src/__tests__/voucher-awards.test.ts src/__tests__/storage.sqlite.test.ts`
  — focused unit test passed and existing real Bun SQLite lane passed 23 files / 256 tests.
- `bun run --cwd packages/shared test -- src/__tests__/voucher-award-safe.test.ts src/__tests__/voucher-award-client.test.ts src/__tests__/voucher-award-send.test.ts src/__tests__/hooks/commitment-pooling/useVoucherAwards.test.tsx`
  — 4 files / 16 tests passed, latest observed start 2026-11-08 05:26:03 UTC.
- `bun run --cwd packages/agent typecheck --scope full` and
  `bun run --cwd packages/shared typecheck --scope full` — passed, observed by 05:32:08 UTC.
- Targeted `oxlint ... --deny-warnings` across award runtime/protocol files — passed.
- `bun run check --plan -- --intent qa` selected critical owner/consumer proof across the shared
  checkout. Root coordinates consumer source/test checks and the remaining cross-package gates.
- Browser evidence: **none** for this backend/hook slice. Authenticated signing remains pending;
  no live transaction was signed or broadcast and no deployment or external record was published.
- Sensitive edits: Shared `package.json` adds two pure leaf exports only; Agent schema version
  and startup wiring changed. No dependencies, lockfile, permissions or release settings changed.

Task record: cosmo-local-credit-interop / retrospective awards | Type: feature | Outcome: local implementation complete, UI and integration proof owned by root
Agent/model: voucher_award_storage / runtime model unknown | Coverage: award implementation through 2026-11-08 05:32 UTC

| Phase | Start → end (UTC) | Result / evidence |
| --- | --- | --- |
| Investigate | unknown → unknown | Existing Agent SQLite selected; local journal insufficient as global guard |
| Implement | unknown → 2026-11-08 05:26:54 | Durable protocol, ledger, API, signing, receipt and recovery boundaries |
| Verify/review | 2026-11-08 05:13:22 → 05:32:08 | Focused green suites, source/test typechecks, targeted lint; minor formatting/type fixes interleaved |

Human corrections: unknown; attention: unknown. No publish phase entered.
