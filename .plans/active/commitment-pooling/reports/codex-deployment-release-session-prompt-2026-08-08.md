# Codex session prompt: pooling, settlement, and credit deployment/release

Date: 2026-08-08

## Activation gate

Use this prompt only after humans confirm that both prior implementation increments have merged:

1. the pooling, payer, recipient, settlement-contract, and code-level read-model PR; and
2. the separate Commitment Credit contract PR, including the final `LoanPrincipal` settlement
   seam.

This is stage 3 of 3. It owns deployment/release engineering and the explicitly authorized release
ceremony. It must not reopen product architecture, add unrelated product behavior, or repair either
earlier PR by silently changing its frozen ABI or storage.

Repository:

```text
/Users/afo/Code/greenpill/green-goods
```

Before changing files:

1. Read the root `AGENTS.md`, `packages/contracts/AGENTS.md`, `packages/indexer/AGENTS.md`, the
   complete active Commitment Pooling and Commitment Credit hubs, `contract-spec.md`,
   `settlement-spec.md`, the credit `spec.md`, and `handoffs/human-release-ops.md`.
2. Refresh the target base and prove both implementation PRs are merged. Pin the merge base and
   exact HEAD; record `git status`, recent commits, and all concurrent worktrees.
3. Create or switch to a fresh deployment/release branch only when the human launching this prompt
   explicitly authorizes that branch action. Do not reuse either implementation branch.
4. Preview live Plan Hub/Linear state before implementation and preserve `.plans` as execution
   truth. Query live records rather than trusting the dated identifiers in reports.
5. Inspect every existing Bun deployment wrapper, production script entrypoint, artifact schema,
   persistence/recovery path, post-deploy verifier, and current deployment JSON. Read actual code;
   commit messages and green helper tests are not proof.

If either implementation merge, final ABI/storage layout, responsible release owner, rollback
owner, or clean branch base cannot be proven, stop. Do not build or execute a transaction plan on
an ambiguous base.

## Authority model: two hard phases

### Phase A: release engineering, no broadcast

The initial invocation of this prompt authorizes implementation, local mutation, simulation,
read-only chain inspection, and PR preparation only. It does not authorize deployment, broadcast,
Safe/Role grants, ownership transfer, value movement, a message-only mainnet ping, or a canary.

Build and adversarially review the complete deployment path. Stop after producing a pinned,
reviewed, dry-run-green release candidate and ask the human for the next explicit authorization.

### Phase B: explicitly authorized release execution

Proceed only after the human names the exact pinned commit, target chain(s), stage, signer/owner,
artifact diff, rollback checkpoint, and broadcast window. Approval of the code PR, a green dry-run,
or this prompt by itself is never broadcast authority.

Execute one authorized stage at a time. After each stage, persist the receipt and artifact, reread
live code/owner/configuration state, run the post-action verifier, and stop if it diverges. Do not
continue to the next transaction merely because an earlier transaction succeeded.

Safe authority, a message-only ping, minimum-value G$ canary, production unpause, and any cap
increase each require their own explicit authorization. Never infer one from another.

## Architecture and release boundary

Green Goods uses split-state settlement:

- commitment, payout-plan, loan, and authorization truth stay on Arbitrum;
- `SettlementModule` sends authenticated message-only CCIP commands;
- `CeloSettlementExecutor` executes exact-net canonical-G$ transfers through bounded garden Safe
  and Zodiac Roles authority; and
- Celo sends an authenticated acknowledgment before Arbitrum marks a disbursement Confirmed.

There is no token bridge. The modules do not custody G$. Contributor consideration,
garden-beneficiary payouts, protocol-to-garden funding, and loan principal are distinct immutable
disbursement kinds with distinct authorization and relationship rules.

The credit registry remains records-only. Jar/Treasury transfers and repayments are existing-rail
actions; G$ repayment remains disabled unless the final merged interface includes a bounded
authenticated receipt policy.

Core/non-value deployment and value-tier enablement are separate risk tiers. The release branch may
contain tooling for both, but no value authority exists merely because contracts are deployed.

## Dated starting state to verify

At the 2026-08-08 audit snapshot:

- pooling deploy/configure/upgrade/finalize Bun wrappers existed;
- `SettlementModule` and `CeloSettlementExecutor` implementations existed but no dedicated
  settlement-executor deploy target, settlement courier directory, role-aware artifact
  merge/recovery flow, or complete post-deploy peer/Safe verifier existed;
- `contracts:settlement:verify-lane` provided a read-only fork check only;
- no settlement address was present in `42161-latest.json`, and no broadcast had occurred; and
- the credit contract was not yet implemented.

The branch created for this stage begins after later merges, so every point above may have drifted.
Re-audit before writing. Missing pre-broadcast addresses are expected; a missing or broken safe
deploy/dry-run/persistence/recovery path is the blocker.

## Required Phase-A work

### 1. Freeze the combined release manifest

Create one declarative, reviewable release manifest that names every target and exact dependency:

- implementation, proxy, admin/owner, initializer, CREATE2 salt/domain, linked libraries, and
  expected code hash;
- EAS schema UIDs and resolver/module relationships;
- Arbitrum/Celo EVM chain IDs, CCIP selectors as decimal strings, routers, peers, gas/version, and
  pause state;
- protocol Safe/timelock, garden Safe owners/recovery, Zodiac Roles key/conditions, allowance and
  transfer/batch/period caps, fee mode, reserve floors, dispatcher, and rollback owner; and
- indexer network, address, start block, ABI/event contract, reindex/cutover, and read-back plan.

Reject JavaScript numeric selectors, zero required addresses, duplicate schema identities,
ambiguous senders, unsupported lanes, stale official-directory facts, or manifest values that do
not round-trip to the on-chain type.

### 2. Complete Bun-wrapped deployment targets

Use the existing repository deploy CLI and package-script patterns. Never expose raw Forge commands
to operators. Add or finish help-documented, selective targets for:

- Arbitrum protocol/core preparation and finalization;
- Arbitrum `SettlementModule` deployment/configuration;
- Celo `settlement-executor --network celo|celo-sepolia`, persisting only executor/Safe/local
  configuration keys and preserving every historical Celo core key;
- the merged `CreditRegistry` and its dependency wiring;
- Safe prediction and Zodiac Roles configuration planning;
- peer wiring only after the exact bidirectional route is freshly verified; and
- post-deploy verification and artifact/indexer handoff.

Deploy link-time Commitment Pooling libraries explicitly before the proxy implementation and pass
the exact library map to build, CREATE, and verification paths. Keep selector weight out of module
shells.

Every dry-run must predict identities, print the exact salt/version/sender/owner, produce a complete
transaction plan, and exercise the same persistence/merge path as broadcast without mutating the
canonical artifact. A simulation that silently calls RPC when labeled pure, ignores a CLI salt,
overwrites unrelated keys, or cannot recover from on-chain-success/local-write-failure is not green.

### 3. Prove persistence, recovery, and transaction boundaries

Test the real script entrypoints, not only helpers:

- first run, replay, partial artifact, conflicting artifact, stale side file, interrupted local
  write, and on-chain-success/local-artifact-failure recovery;
- exact old/new merge behavior with unrelated historical keys preserved;
- repeated configuration, ownership races between simulation and broadcast, wrong sender, wrong
  live owner, nonce drift, and one-of-many transaction failure;
- deployment address prediction and code-hash verification after retry; and
- upgrade/rollback plans from the actual old proxy implementation to the final merged one.

Preflight reads do not make several broadcasts atomic. Model each transaction boundary explicitly,
define the safe resumable state after every step, and require a post-action verifier before the next
step.

### 4. Build the exact two-process settlement fixture

Implement the frozen `settlement-spec.md` section 7.1 contract:

- `packages/contracts/script/settlement/dual-chain-courier.ts`;
- `packages/contracts/script/settlement/dual-chain-lifecycle.test.ts`;
- help-documented `settlement:dual-chain:up`, `settlement:dual-chain:down`, and
  `settlement:courier` Bun commands; and
- two distinct local processes and chain IDs, with only serialized message tuples and receipts
  crossing the boundary.

Prove hold, reorder, duplicate, drop/replay, retry, batch, cancellation, peer rotation, failure,
acknowledgment retry, malformed payload, and idempotent value execution. Neither process may share
fork state, RPC handles, in-memory contract objects, or storage snapshots.

### 5. Finish verification and live-activation planning

Add post-deploy verification that rereads:

- proxy implementation/admin/owner/timelock, linked-library code, initializer state, pause state,
  and storage-compatible version;
- router, selector, supported lane, peer/version/gas, retiring-peer grace, unresolved-command
  inventory, dispatcher, caps, batch limits, and fee reserves;
- Safe owners/recovery, executor-not-owner, Zodiac Roles module/key/condition tree, canonical G$
  target/selector/recipient rules, allowances, gross-debit caps, period caps, and fee policy; and
- exact deployment artifact hashes and the indexer address/start-block diff.

Prepare Envio activation and reindex/cutover/read-back commands, but do not activate production
addresses during Phase A. Index only Green Goods settlement events; do not broaden the indexer to
raw G$ transfers or claim that Arbitrum events alone prove Celo value movement.

### 6. Run adversarial release review

Review the exact committed release-candidate range for custody, authority, replay, idempotency,
partial configuration, upgrade, rollback, artifact, chain identity, route, fee, cap, batching,
indexing, and recovery failures. Require an external-audit disposition and no unresolved
Critical/High before requesting any broadcast authorization.

## Phase-B execution order

After exact authorization, operate the frozen release plan in dependency order:

1. resolver/schema preparation and compatibility verification;
2. paused module/register/credit deployment and dependency finalization;
3. integration upgrades, bidirectional wiring, ownership transfer, verified pool registration and
   backfill, followed by the separately gated core unpause;
4. paused Arbitrum/Celo settlement peer candidates with no Safe value authority;
5. separately authorized message-only ping and acknowledgment;
6. separately authorized Safe/Zodiac value authority after exact owner/recovery/cap/fee proof;
7. separately authorized minimum-value canary; and
8. observation window and explicit cap/unpause decision.

After each authorized action record the signer, transaction hash, chain, block, receipt, artifact
diff, live code/proxy/admin/owner/peer/pause verification, indexer change, and rollback checkpoint.
Any unavailable evidence leaves the next stage blocked.

## Minimum release adversarial cases

- wrong chain, RPC, selector, router, peer, sender, Safe, owner, salt, library address, proxy, or
  implementation;
- unsafe numeric selector parsing, stale official-directory data, unsupported lane, peer rotation
  with unresolved commands, or expired grace;
- artifact overwrite, key loss, partial merge, duplicate deploy after write failure, or recovery
  pointing at a different bytecode hash;
- partial multi-transaction configuration, ownership changing after preflight, nonce drift, and
  rollback owner unavailable;
- executor as Safe owner, broad Zodiac target/selector/recipient authority, zero/unbounded caps,
  fee-on-transfer mismatch, insufficient native fee reserve, and unexpected token fee mode;
- command/ack replay, same-key reroute, duplicate value, cancellation after execution, batch-kind
  mixing, acknowledgment to a new receiver, and source confirmation without authenticated success;
- indexer start-block/address mismatch, event omission, reverse-order delivery, replay divergence,
  or UI/read-model confirmation before Arbitrum acknowledgment; and
- deployment from an unreviewed commit or continuation after any post-action verifier fails.

## Exact known validation commands

Use exact Bun wrappers. Confirm package-script definitions and `--help` before invoking newly added
targets.

```bash
cd packages/contracts && bun run test
cd packages/contracts && bun run test:script
cd packages/contracts && bun run build:full
cd packages/contracts && bun run check:sizes
cd packages/contracts && bun run check:storage-layout
cd packages/contracts && bun run lint
cd packages/contracts && bun run test:audit:full
cd packages/contracts && bun run test:fork:settlement-lane
cd packages/indexer && bun run codegen
cd packages/indexer && bun run check:indexing-boundary
cd packages/indexer && bun run test
cd packages/indexer && bun run build
node scripts/quality/check-source-structure.js --base <fresh-combined-base>
bun .plans/active/commitment-pooling/architecture-closure.validate.ts
bun run check:ontology
bun run format:check
git diff --check <fresh-combined-base>
node scripts/dev/ci-local.js --quick
```

Known root read-only lane wrapper:

```bash
bun run contracts:settlement:verify-lane
```

Add the exact settlement/credit dry-run, deploy, courier, verify, and recovery commands to this
prompt only after their package scripts exist and their `--help` output has been tested. Do not
invent command names in an operator handoff and never use raw Forge.

## Completion contracts

### Phase A complete

Stop for explicit broadcast authorization only when:

- the final combined ABI/storage/event manifests are frozen and match generated artifacts;
- every deploy/dry-run/persistence/recovery/courier/post-deploy path exists and is tested through
  its real entrypoint;
- simulation produces an exact resumable transaction plan without mutating live state;
- contract, indexer, source-structure, size, storage, coverage, fork, and repo gates are fresh;
- external review has no unresolved Critical/High; and
- the pinned commit, signer/owner, targets, artifact diff, rollback plan, and proposed broadcast
  window are explicit.

### Phase B complete

Call the deployment branch release-complete only when every authorized stage has receipts and
post-action proof, canonical artifacts and indexer configuration match live state, required
read-back converges, rollback checkpoints remain available, and the human has separately approved
any value authority/canary/unpause. Hand the branch back for final review and merge; do not merge it
yourself.

Never use “deployed” to describe a dry-run, “paid” before authenticated Arbitrum confirmation, or
“release-ready” while any required external evidence or Critical/High disposition is missing.
