# Phase A Release Engineering Review — 2026-08-11

## Verdict

**Review verdict: COMMENT_ONLY. Phase A is blocked. Do not authorize broadcast.**

The complete Phase A tooling range is pinned at
`7a9c7eeef96b17c96d5a5f7e15d3e181223bbe6b..f5cc0eca3f06063b4c7b83c91c3dca03cd0324d9`.
The release tooling, persistence boundary, two-process settlement fixture, post-action verifier,
and Green Goods-only indexer projection passed their local and fork gates. No unresolved Critical
or High defect remains in that tooling range after the committed-range review.

The combined release is not a dry-run-green candidate. One Critical release-order conflict and six
High release-input or live-state mismatches remain unresolved. They are outside this lane's
authority to repair or mutate. No deployment, broadcast, ownership or authority change, value
movement, indexer activation, message-only ping, canary, unpause, cap change, or Linear write
occurred.

## Pinned scope

- Branch: `feature/commitment-pooling-contracts-deployment`
- Fresh combined base and starting HEAD:
  `7a9c7eeef96b17c96d5a5f7e15d3e181223bbe6b`
- Reviewed implementation commit: `f5cc0eca3f06063b4c7b83c91c3dca03cd0324d9`
- Pooling/settlement merge: PR #694, merge commit `c60b38dea`
- Credit merge: PR #695, merge commit `bff3b274d`
- Release manifest hash:
  `0x4a6c0f7d0ddf923463a9af928d9048724c2db68e9250fff88206b3e0ea474ae6`
- Indexer configuration hash:
  `0xb3cfc35d0ff1152a7543c5209032ac4b118b08cbd2c916f6d62fdef0bb3b82b0`
- Manifest identity set: 20 libraries, five implementations, and five proxies
- Responsible release owner: Afolabi Aiyeloja
- Deployment sender and live owner:
  `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`
- Protocol Safe target: `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`
- Garden recovery owner target: `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`
- Rollback owner before transfer: deployment EOA
- Rollback owner after transfer: protocol Safe

The source commit in the manifest intentionally identifies the final merged implementation base.
The release-engineering code that consumes and verifies that manifest is the separately pinned
implementation commit above.

## Coverage ledger

| Review batch | Files and boundaries reviewed | Disposition |
|---|---|---|
| Manifest and identity | Combined manifest and lock, decimal CCIP selectors, CREATE2 identities, linked libraries, schema identities, proxy targets, ownership, Safe/Zodiac, fee/cap, indexer, and rollback inputs | Tooling passes; activation values remain fail-closed where incomplete |
| Persistence and recovery | Atomic artifact merge, partial/conflicting artifacts, stale side files, interrupted writes, receipt recovery, code-hash checks, and unrelated historical-key preservation | Pass |
| Transaction boundaries | Selective release CLI, schema preparation, deployment, configuration, upgrade, rollback, ownership, peer, Safe, and backfill plans; nonce, owner, sender, and receipt rechecks | Pass; no transaction was sent |
| Settlement transport | Two local chain processes, courier workers, serialized command and acknowledgment tuples, retry/reorder/duplicate/drop/cancel/batch/rotation/malformed/idempotency cases | Pass |
| Live verification | Proxy/code/owner/initializer/pause/wiring checks, route and gas checks, Safe threshold/owners, Roles/cap/fee boundaries, artifact hashes, and indexer diff/read-back plan | Verifier passes its tests and exposes live blockers below |
| Indexer boundary | CreditRegistry and `LoanPrincipal` projections, address/start-block diff, generated schema, and settlement-event-only boundary | Pass; hosted activation command remains unavailable |
| Plan and operator handoff | Authoritative August 10 prompt, owner decisions, exact Bun wrappers, recovery checkpoints, no-broadcast boundary, and blocked release status | Pass |

## Unresolved release findings

### Critical — frozen ABI conflicts with the authoritative release order

`CommitmentPoolingModule.registerPool` is gated by `whenOperational`. The August 10 release order
requires verified pool registration and backfill before the separately authorized pooling
unpause. The frozen merged ABI cannot execute that order. The backfill wrapper therefore refuses
to emit an executable plan. Resolving this needs an explicit release-order decision or a separately
authorized implementation increment; this release lane cannot silently change the ABI or storage.

### High — finalized garden inventory and root identity drift

A finalized Arbitrum read at block `493390418` found 18 GardenToken accounts, token IDs 0 through
17. The frozen release inventory says 13, and the finalized root derivation is token 0 while the
artifact identifies token 1. The backfill preflight fails closed.

### High — protocol Safe does not match the approved target shape

The live Arbitrum protocol Safe is 2-of-6. The approved target is 3-of-5. The preflight reports the
live mismatch and does not present the approved target as current fact.

### High — live AssessmentResolver is not v3-capable

The schema plan and dependent pooling, SettlementModule, and CreditRegistry dry-runs stop at
`AssessmentResolverNotV3Capable`. A nonce-pinned upgrade and rollback plan exists, but executing it
requires its own Phase B authorization and post-action proof.

### High — peer destination gas is unmeasured

`destinationGasLimit` remains the decimal string `"0"`. Bidirectional peer planning rejects zero
and rejects any environment override that differs from the frozen manifest.

### High — value authority is intentionally disabled and incomplete

Garden Safe owner sets, recovery tuples, Zodiac Roles module/key/condition tree, allowances,
transfer/batch/period caps, fee policy, and native reserve floors are not frozen. The manifest keeps
value authority disabled. This is correct fail-closed behavior, not permission to infer defaults.

### High — installed Envio CLI has no hosted activation command

The installed Envio CLI exposes no hosted `deploy` command. The handoff prepares codegen, boundary,
test, build, address/start-block diff, and read-back checks, but refuses to invent an activation or
reindex command.

## Predicted identities only

These addresses are CREATE2 predictions from the frozen manifest. They are not deployment
evidence.

| Identity | Predicted address |
|---|---|
| CommitmentPoolingModule proxy | `0x7eb1e9448f5F4a14818bE789852A9d579706b7E3` |
| CommitmentRegistry proxy | `0x6678F96eC95F3577aDc801388e0b7c9A1B890349` |
| SettlementModule proxy | `0x4014eFb0573a334535FD9C5629a3E31BA00087c5` |
| CreditRegistry proxy | `0x9578496DE38ffe9c4269E22C8801a13c6fd77412` |
| CeloSettlementExecutor proxy | `0x97fc778ddd8Af6ad9F507f89e99EF8fC82f1E39F` |
| TestimonyResolver implementation | `0xA8283A563244dd002dA814A0C4CF24c29c8F30A7` |
| TestimonyResolver proxy | `0x2897BcAE282D5d99DaeE535803F531B333Cc2329` |

## Validation evidence

All commands were run from their documented package or repository root. Foundry was reached only
through repository Bun wrappers.

| Command | Result |
|---|---|
| `cd packages/contracts && bun run test` | Pass: 1,975 Solidity tests and 141 script tests |
| `cd packages/contracts && bun run test:script` | Pass: 141 tests |
| `cd packages/contracts && bun run build:full` | Pass |
| `cd packages/contracts && bun run check:sizes` | Pass; all contracts under EIP-170 limit |
| `cd packages/contracts && bun run check:storage-layout` | Pass: all 15 baselines and namespaces |
| `cd packages/contracts && bun run lint` | Pass: zero errors; 254 existing warnings |
| `cd packages/contracts && bun run test:audit:full` | Pass: realism, audit, and coverage gates |
| `cd packages/contracts && bun run test:fork:settlement-lane` | Pass: seven fork tests |
| `cd packages/contracts && bun run typecheck` | Pass |
| `cd packages/indexer && bun run codegen` | Pass |
| `cd packages/indexer && bun run check:indexing-boundary` | Pass: 12 contracts, two chains |
| `cd packages/indexer && bun run test` | Pass: 206 tests |
| `cd packages/indexer && bun run build` | Pass |
| `node scripts/quality/check-source-structure.js --base 7a9c7eeef96b17c96d5a5f7e15d3e181223bbe6b` | Pass |
| `bun .plans/active/commitment-pooling/architecture-closure.validate.ts` | Pass: 54 events, 26 entities, 86 functions, eight sparse cases, 58 calls, six jobs/states, seven lifecycle subjects |
| `bun run check:ontology` | Pass: 11 guards and nine baseline checks |
| `bun run format:check` | Pass |
| `git diff --check 7a9c7eeef96b17c96d5a5f7e15d3e181223bbe6b` | Pass |
| `node scripts/dev/ci-local.js --quick` | Pass |
| `bun run test` | Pass across contracts, indexer, shared, client, admin, agent, and docs |
| `VITE_CHAIN_ID=11155111 bun run build` | Pass |
| `bun run verify:contracts:fast` | Pass: build, Solidity format, Solhint, 1,975 Solidity tests, and 141 script tests; E2E and deployment dry-runs intentionally skipped by this wrapper |

The first sandboxed Foundry and indexer loopback attempts hit macOS sandbox restrictions. The exact
commands passed when rerun with the required execution permission. Those environment restrictions
were not test failures.

## External-audit disposition and next gate

The August 10 owner decision replaces the external vendor audit for this wave with this internal
committed-range review. The tooling range has no unresolved Critical or High implementation defect.
The combined release still has the Critical and High conditions above, so the no-unresolved-
Critical/High release gate is not met.

There is no broadcast authorization request from this review. A future request is valid only after
the blockers are resolved and a new dry-run-green commit is pinned with the exact chain, stage,
signer/owner, artifact diff, rollback checkpoint, and broadcast window. Message-only ping,
Safe/Zodiac value authority, minimum-value canary, production unpause, and every cap increase remain
separate authorization gates.
