# Codex session prompt: pooling, settlement, and credit deployment/release

- Original handoff: 2026-08-08
- Reviewed against `develop` with owner decisions recorded: 2026-08-10
- Supersedes: `codex-deployment-release-session-prompt-2026-08-08.md`, which stays unchanged as the
  immutable dated record; this file is the current execution prompt
- Default authority: Phase A release engineering only; no broadcast

## Activation gate

Use this prompt only after the repository proves that both prior implementation increments are
ancestors of the refreshed `origin/develop`:

1. PR #694, pooling, payer, recipient, settlement contracts, and code-level read model, merged as
   `c60b38dea`; and
2. PR #695, Commitment Credit plus the final `LoanPrincipal` settlement seam, merged as
   `bff3b274d`.

This is stage 3 of 3. It owns deployment/release engineering and the explicitly authorized release
ceremony. It must not reopen product architecture, add unrelated product behavior, or repair either
earlier PR by silently changing its frozen ABI or storage.

The dated merge SHAs above identify the known starting increments; they are not permission to use a
stale branch or snapshot. Fetch the current target base and prove ancestry again. If network access
is unavailable, report the activation gate as blocked rather than treating local refs as confirmed
current.

Repository:

```text
/Users/afo/Code/greenpill/green-goods
```

Before changing files:

1. Read the root `AGENTS.md`, `packages/contracts/AGENTS.md`, `packages/indexer/AGENTS.md`, the
   complete active Commitment Pooling and Commitment Credit hubs, `contract-spec.md`,
   `settlement-spec.md`, the credit `spec.md`, `handoffs/codex-contracts.md`,
   `handoffs/codex-settlement.md`, `handoffs/claude-contracts-hardening.md` (do-not-regress
   invariants, including the network-record prohibition),
   `reports/settlement-security-coverage-matrix-2026-08-08.md` (selector coverage only — the
   severity review is `reports/pre-merge-review-2026-08-09.md`, whose contract findings were fixed
   before merge), the credit `coverage-ledger.md` and `handoffs/codex-contracts.md`, and
   `handoffs/human-release-ops.md`.
2. Fetch the target base, then prove both merges:

   ```bash
   git merge-base --is-ancestor c60b38dea7e26378f414b81aa3bee20380cefd8e origin/develop
   git merge-base --is-ancestor bff3b274de5c83114eec43352e24f5e9cee4b877 origin/develop
   ```

   Pin the exact `origin/develop`, local HEAD, merge base, working-tree state, recent commits, and all
   concurrent worktrees.
3. Stay on the current branch. Create or switch branches only when the human launching the session
   explicitly authorizes that branch action in that turn. Never reuse either implementation branch
   as the release branch and never absorb unrelated working-tree changes.
4. Run both Plan Hub previews before implementation:

   ```bash
   node scripts/harness/plan-hub.mjs linear-sync --feature commitment-pooling --json
   node scripts/harness/plan-hub.mjs linear-sync --feature commitment-credit-follow-on --json
   ```

   Preserve `.plans` as execution truth, respect each hub's `laneSyncMode`, and query live Linear
   records rather than trusting dated report identifiers. Do not make a Linear write unless the
   human explicitly authorizes that external mutation.
5. Inspect every existing Bun deployment wrapper, production script entrypoint, artifact schema,
   persistence/recovery path, post-deploy verifier, and current deployment JSON. Read actual code;
   commit messages and green helper tests are not proof.
6. Produce a numbered preflight with: current built-vs-missing deployment coverage, exact source
   conflicts, the smallest Phase-A file scope, explicit out-of-scope items, and validation commands.
   Continue directly only when the conflicts are the dated drift already resolved below. Stop for
   any new ABI, storage, custody, authority, or release-policy decision.

If either implementation merge, final ABI/storage layout, responsible release owner, rollback
owner, or clean branch base cannot be proven, stop. Do not build or execute a transaction plan on
an ambiguous base.

### Source-reconciliation gate

The dated planning sources contain five known contradictions that Phase A must correct or escalate
without changing contract semantics:

- the Commitment Credit status/todo/handoff still says human review and merge are pending, although
  PR #695 is now on `develop`;
- `handoffs/human-release-ops.md` still lists `CreditRegistry` activation as out of scope, while the
  maintained credit spec assigns its deployment, persistence, dependency wiring, and verification
  to stage 3; and
- the same release handoff requires two weeks of Arbitrum Sepolia operation for the core tier but
  later records that the pooling rehearsal moved to an Arbitrum One fork because its exact Hats
  dependency is unavailable on Arbitrum Sepolia;
- `settlement-spec.md` §7.1 still mandates adding `arbitrum-sepolia` (`421614`) and `celo-sepolia`
  (`11142220`) `networks.json` records, role-aware testnet gates, and testnet artifact files, and
  the pooling `handoffs/codex-contracts.md` still lists the `421614` toolchain among its outputs —
  while the merged tree forbids exactly that: `script/utils/pooling-release.test.ts` asserts
  neither network is configured, `handoffs/claude-contracts-hardening.md` says do not re-add them
  (Hats has no `421614` deployment; Celo Sepolia has no published CCIP lane), and the 2026-08-06
  `contract-spec.md` amendment withdrew the four named `421614` deliverables. Only the pooling
  side has a recorded human resolution; the settlement lane's recorded position is that it "must
  re-derive its own posture"; and
- the credit `spec.md` G$-off posture says stage 3 must leave `SettlementModule.setCreditRegistry`
  unset so G$ principal cannot queue, but the merged `CreditRegistry.setPaused(false)` requires
  `SettlementBindingRequirement.Self` — `SettlementModule.creditRegistry()` must already equal the
  registry — so with the dependency unset the registry cannot unpause and its records-only
  Jar/Treasury paths (all `whenOperational`) cannot operate. The merged code does not support the
  spec's split as written.

For this handoff the resolution is narrow: deploying `CreditRegistry` paused and wiring its
records-only dependencies belongs to Phase A/authorized core deployment. Unpausing it, enabling a
G$ loan-principal dependency, or moving any value remains separately gated. Owner resolution
2026-08-10 on the unpause seam: bind the dependency — stage-3 planning sets
`SettlementModule.setCreditRegistry` during core deployment so the registry can later unpause for
records-only Jar/Treasury lending, and the G$ off-switch is that no pool credit config enables a
G$ rail while `GDollarRepaymentDisabled` blocks G$ repayment recording. Phase A verifies the exact
merged semantics (`registries/Credit.sol` `setPaused`, `registries/CreditBase.sol`
`_validateSettlementModule`), updates the credit spec's leave-unset language to record this
decision, and keeps enabling any pool-level G$ credit rail a separately authorized value-tier act.

For the network ladder the resolution is also narrow: do not re-add `arbitrum-sepolia` or
`celo-sepolia` as configured networks, do not delete the test asserting their absence, and do not
create testnet artifact files. The §7.1 two-process fixture keeps its `421614`/`11142220` local
Anvil chain IDs — local process identities are not `networks.json` records. Rehearsal evidence
comes from the Arbitrum One fork runbook, the read-only settlement lane check, and the local
fixture, followed by the Ethereum Sepolia rehearsal pass in the owner-approved ladder. Role-aware
deploy gates derive their testnet evidence from the configured `sepolia` (`11155111`) legacy lane —
never from `421614`/`11142220`.

Owner resolution 2026-08-10 (Afolabi Aiyeloja): the two-week testnet-operation requirement is
withdrawn. The release ladder is test confidence first — the full suite plus the fork rehearsals
(`contracts:pooling:rehearse:arbitrum-fork`, the settlement lane check, and the §7.1 two-process
fixture) all green — then a staged Ethereum Sepolia (`11155111`) deployment rehearsal through the
same release tooling, then Arbitrum One, then Celo. No time-boxed soak gates any tier. Phase A
must update the two-week lines in `handoffs/human-release-ops.md` to record this decision instead
of asking for a new one; every per-stage authorization in this prompt still applies.

## Authority model: two hard phases

### Phase A: release engineering, no broadcast

The initial invocation of this prompt authorizes scoped Phase-A implementation, local mutation,
simulation, read-only chain inspection, local plan/handoff reconciliation, and PR preparation only.
It does not authorize deployment, broadcast, Safe/Role grants, ownership transfer, value movement,
a message-only mainnet ping, a canary, or Linear writes.

Build and adversarially review the complete deployment path. Stop after producing a pinned,
reviewed, dry-run-green release candidate. Phase-A code must be human-reviewed and merged before any
Phase-B production transaction. Approval, merge, and broadcast remain three different authorities.

### Phase B: explicitly authorized release execution

Proceed only in a later Phase-B invocation after the Phase-A release tooling is merged and the
human names the exact merged commit, target chain, one release stage, signer/owner, expected artifact
diff, rollback checkpoint, and broadcast window. Approval of the code PR, its merge, a green dry-run,
or this prompt by itself is never broadcast authority.

Start Phase B from a clean checkout of the pinned merged commit. Do not broadcast from unmerged or
locally modified implementation code. Broadcast-created receipts and canonical artifact updates may
be committed afterward in a separately reviewed artifact-only change; never change implementation
code during the release ceremony.

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
authenticated receipt policy. The current merged boundary has no such receipt policy: Phase A must
therefore keep G$ credit-principal enablement off and must not imply that a deployed `CreditRegistry`
authorizes that rail. Jar/Treasury readiness and G$ settlement readiness are separate facts.

Core/non-value deployment and value-tier enablement are separate risk tiers. The release branch may
contain tooling for both, but no value authority exists merely because contracts are deployed.

## Dated starting state to verify

At the refreshed 2026-08-10 repository snapshot:

- PR #694 (`c60b38dea`) and PR #695 (`bff3b274d`) are both merged into `develop`;
- pooling deploy/configure/upgrade/finalize Bun wrappers existed;
- `CommitmentPoolingModule`, `CommitmentRegistry`, `SettlementModule`, `CeloSettlementExecutor`,
  and `CreditRegistry` implementations exist. The merged indexer read model is settlement-only:
  13 settlement handler files, a chain-42161 `SettlementModule` entry with the address
  intentionally absent, and a code-level `CeloSettlementExecutor` entry registered on no chain.
  The pooling module/registry have no indexer handlers, `config.yaml` entry, or
  boundary-allowlist entry — the pooling read model is its own downstream lane, as is
  CreditRegistry indexing;
- no deploy-script target references `SettlementModule`, `CeloSettlementExecutor`, or
  `CreditRegistry`; no settlement courier directory, role-aware artifact merge/recovery flow, or
  complete post-deploy peer/Safe/credit verifier exists;
- the existing post-deploy verifier and its Etherscan source-verification list contain no
  pooling, settlement, executor, or credit coverage; no path captures the linked-library address
  map (the module links 14 pooling libraries and settlement links 6 more, all auto-linked by
  forge with no `--libraries` handling anywhere); root `package.json` has zero Celo `contracts:*`
  wrappers; and `check-indexing-boundary.mjs` hard-requires exactly chains `42161` and `11155111`
  and rejects any `CreditRegistry` entry, so Celo executor indexing and credit indexing are
  boundary-policy changes, not configuration flips;
- `contracts:settlement:verify-lane` provided a read-only fork check only;
- `packages/indexer/config.yaml` intentionally keeps the merged settlement handlers addressless
  before broadcast; and
- the canonical Arbitrum/Celo deployment artifacts contain no pooling, settlement, executor, or
  credit addresses, and no broadcast is recorded.

Every point above may drift. Re-audit before writing. Missing pre-broadcast addresses are expected;
a missing or broken safe deploy/dry-run/persistence/recovery path is the blocker. Do not infer
deployment from generated ABI/handlers, merged implementation code, or historical green tests.

## Required Phase-A work

### 0. Reconcile the execution sources and freeze scope

Update the two active hubs and their maintained handoffs only where necessary to reflect the merged
implementation base, the stage-3 boundary above, and the 2026-08-10 owner decisions recorded in
this prompt (release ladder, timelock waiver, audit disposition, protocol Safe, rollback owner,
recovery owner, credit unpause posture). Do not rewrite dated reports or decision-log
history. Record the Phase-A owner, base commit, exact release-engineering scope, RED/GREEN or
proof-limit evidence, deferred external gates, and explicit no-broadcast boundary in `.plans` first.

Keep this lane limited to release engineering for already-merged contracts and the merged
settlement read-model contracts. Building read models is other lanes' work: pooling and
CreditRegistry indexer/shared/UI work, product UI, shared hooks, new lending policy, raw G$
indexing, a settlement relayer in `packages/agent`, transferable-voucher work, partner operations,
and release execution are out of scope — this lane plans activation only for read models already
merged. The manifest must mark both missing read models honestly; pooling read-model activation
and `CreditRegistry` unpause stay blocked until each separately dispatched downstream lane is
proven.

### 1. Freeze the combined release manifest

Create one declarative, reviewable release manifest or generated transaction-plan input, using the
existing artifact and deploy-CLI patterns, that names every target and exact dependency:

- implementation, proxy, admin/owner, initializer, CREATE2 salt/domain where the target actually
  uses CREATE2 (TestimonyResolver and Safe prediction do; the merged pooling deploy is plain
  CREATE), the complete linked-library address map, and expected code hash;
- EAS schema UIDs and resolver/module relationships;
- canonical token and dependency addresses each initializer requires (G$ on each chain, protocol
  garden, Hats module), and the named keystore account and sender per chain and per stage;
- Arbitrum/Celo EVM chain IDs, CCIP selectors as decimal strings, routers, peers, gas/version, and
  pause state;
- protocol Safe/timelock, garden Safe owners/recovery, Zodiac Roles key/conditions, allowance and
  transfer/batch/period caps, fee mode, reserve floors, dispatcher, and rollback owner; and
- indexer network, address, start block, ABI/event contract, reindex/cutover, and read-back plan; and
- the feature tier and activation state for every target: core/pooling, records-only credit, or
  value settlement, with deployed, wired, paused, and enabled represented as distinct facts.

Reject JavaScript numeric selectors, zero required addresses, duplicate schema identities,
ambiguous senders, unsupported lanes, stale official-directory facts, or manifest values that do
not round-trip to the on-chain type. The manifest and artifacts are world-readable files in a
public repository: addresses, selectors, and identifiers only — never key material, keystore
contents, or RPC credentials.

The owner-decided identity facts recorded in this prompt — protocol Safe, rollback owner,
network-council recovery owner, timelock waiver, audit disposition, and the release ladder — are
manifest inputs. Do not reopen them; verify each on-chain claim read-only during Phase A and
surface mismatches instead of silently accepting or correcting them. Note the live ownership
split the manifest must pin per target: several existing Arbitrum proxies are owned by the network
council Safe while the protocol Safe decision names the Green Goods Safe — map current versus
target owner for every touched surface.

### 2. Complete Bun-wrapped deployment targets

Use the existing repository deploy CLI and package-script patterns. Never expose raw Forge commands
to operators. New root wrappers follow the existing `contracts:*` conventions —
`APP_ENV=development`, `FOUNDRY_KEYSTORE_ACCOUNT=green-goods-deployer` on broadcast wrappers,
blanked `PINATA_JWT=`/`PINATA_GATEWAY=`, and an explicit `SENDER_ADDRESS` plus `--sender` wherever
a call is owner-sensitive; Celo wrappers must name their signer identity explicitly instead of
inheriting an Arbitrum assumption. Any new repo-root script gets its one-line `scripts/README.md`
entry in the same PR. Do not install or upgrade dependencies. Treat `package.json`, lockfiles,
deploy scripts, and deployment artifacts as security-sensitive and call out every change. Add or
finish help-documented, selective targets for:

- Arbitrum protocol/core preparation and finalization;
- Arbitrum `SettlementModule` deployment/configuration;
- Celo `settlement-executor --network celo|celo-sepolia`, persisting only executor/Safe/local
  configuration keys and preserving every historical Celo core key. Keep `celo-sepolia`
  unavailable unless the re-audit proves the exact current rehearsal dependencies and labels the
  result honestly; never fall back to the full-core Celo deploy target;
- the merged `CreditRegistry`, deployed paused, plus its records-only dependency wiring. Leave its
  G$ loan-principal dependency disabled unless the separately approved receipt-policy gate exists;
- Safe prediction and Zodiac Roles configuration planning;
- peer wiring only after the exact bidirectional route is freshly verified;
- explorer source verification: extend the existing `verify:etherscan:*` entry list so every new
  implementation, proxy, and deployed library verifies on Arbiscan/Celoscan with its exact library
  mappings — the fork rehearsal cannot prove this, and it stays a named release gate; and
- post-deploy verification and artifact/indexer handoff.

The merged deploy path auto-links the 14 pooling and 6 settlement link-time libraries at forge
script time and records none of their addresses. Phase A must capture the complete linked-library
address map for every implementation into the artifact and manifest and pass it to code-hash and
explorer verification. Whether libraries stay auto-linked or move to explicit deterministic
deployment is a decision Phase A must surface — implementation-address prediction depends on it —
and changing the merged deploy shape is a reviewed decision, not a silent rewrite. Keep selector
weight out of module shells.

Every dry-run must predict identities, print the exact salt/version/sender/owner, produce a complete
transaction plan, and exercise the same persistence/merge path as broadcast without mutating the
canonical artifact. A simulation that silently calls RPC when labeled pure, ignores a CLI salt,
overwrites unrelated keys, or cannot recover from on-chain-success/local-write-failure is not green.
Staged dry-runs have data dependencies on earlier stages — the merged pooling dry-run refuses to
plan while `schemas.assessmentV3SchemaUID` is absent, which is the live-artifact state until the
schema stage broadcasts — so plans must consume predicted values, label them predicted, and never
persist them as live.

Do not treat the existing generic `deploy:dry:*` or `verify:contracts` core paths as proof for new
selective settlement/executor/credit targets. The real new CLI entrypoints and their `--help`,
simulation, artifact, recovery, and post-deploy paths require direct tests.

### 3. Prove persistence, recovery, and transaction boundaries

Test the real script entrypoints, not only helpers:

- the three audited defects in the merged paths: `script/deploy/pooling.ts` writes the canonical
  artifact with a plain write-then-unlink whose comment overstates the guarantee (a crash mid-write
  truncates the artifact); Solidity `_saveDeployment` rewrites `{chainId}-latest.json` from a fixed
  key enumeration that omits settlement/executor/credit keys, so a later core deploy would silently
  destroy them unless the merge becomes role-aware; and `DeployPooling.s.sol` takes its owner from
  the artifact `guardian` while the CLI signs as the keystore deployer with no owner-equals-sender
  preflight — on the live Arbitrum artifact they differ, so wiring reverts mid-plan;
- first run, replay, partial artifact, conflicting artifact, stale side file, interrupted local
  write, and on-chain-success/local-artifact-failure recovery;
- exact old/new merge behavior with unrelated historical keys preserved;
- atomic canonical-artifact replacement and recovery from a crash before or after side-file
  promotion; the current pooling helper's direct write/unlink sequence is not sufficient proof for
  the combined release;
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
fork state, RPC handles, in-memory contract objects, or storage snapshots. Per §7.1, both files run
under the existing `test:script` vitest surface, and courier runtime state stays under
`.generated/runtime` — never merged into any `*-latest.json` artifact.

### 5. Finish verification and live-activation planning

Add post-deploy verification that rereads:

- proxy implementation/admin/owner/timelock, linked-library code, initializer state, pause state,
  and storage-compatible version;
- router, selector, supported lane, peer/version/gas, retiring-peer grace, unresolved-command
  inventory, dispatcher, caps, batch limits, and fee reserves;
- Safe owners/recovery, executor-not-owner, Zodiac Roles module/key/condition tree, canonical G$
  target/selector/recipient rules, allowances, gross-debit caps, period caps, and fee policy;
- the deployment-identity pin events (`SettlementDeploymentPinned` and its executor twin): they
  populate `remoteEvmChainId`, `localChainSelector`, and `localRouter`, and every settlement
  entity in the merged read model gates on them — configuration must emit them, and activation
  read-back must confirm them; and
- exact deployment artifact hashes and the indexer address/start-block diff.

Prepare Envio activation and reindex/cutover/read-back commands, but do not activate production
addresses during Phase A. Index only Green Goods settlement events; do not broaden the indexer to
raw G$ transfers or claim that Arbitrum events alone prove Celo value movement. Celo executor
indexing requires widening the boundary script's fixed two-chain requirement — plan that as an
explicit, reviewed boundary-policy change (keeping the CLAUDE.md indexer-boundary line aligned),
or plan executor read-back over direct RPC, and say which. Plan activation only for read models
already merged; the pooling and credit read models arrive through their own lanes.

### 6. Run adversarial release review

Review the exact committed release-candidate range for custody, authority, replay, idempotency,
partial configuration, upgrade, rollback, artifact, chain identity, route, fee, cap, batching,
indexing, and recovery failures. The external-audit disposition is recorded (owner decision
2026-08-10): internal review only, for every tier of this wave. The adversarial release review
must therefore close with no unresolved Critical/High before any broadcast authorization is
requested — it is the whole review bar, so run it at full depth, not as a formality.

## Phase-B execution order

After the Phase-A tooling PR is merged and exact stage authorization is recorded, operate the frozen
release plan chain-by-chain in the owner-approved ladder — a complete Ethereum Sepolia (`11155111`)
rehearsal pass through the same tooling first (all applicable stages; no supported CCIP lane exists
there, so cross-chain evidence stays fork + courier + the later mainnet ping), then Arbitrum One,
then Celo — and within each chain in dependency order:

0. re-fetch `origin/develop`, prove the authorized Phase-A merge is an ancestor, check out the exact
   clean merged commit, re-run the stage-specific dry-run and post-deploy preflight, and verify the
   signed core/value checklist applicable to this one stage;
1. resolver/schema preparation and compatibility verification;
2. paused pooling module/register deployment and paused records-only credit deployment, with exact
   dependency finalization and no G$ credit-principal enablement;
3. integration upgrades, bidirectional core wiring, ownership transfer, verified pool registration
   and backfill, followed by the separately gated pooling unpause and indexer activation/read-back
   (pooling read-model activation exists only after the separate pooling indexer lane merges;
   until then unpause evidence is direct-RPC only and the stage record must say so);
4. any separately authorized `CreditRegistry` records-only unpause after its owner/dependency/indexer
   proof, while the G$ credit rail remains disabled;
5. paused Arbitrum/Celo settlement peer candidates with no Safe value authority;
6. separately authorized message-only ping and acknowledgment;
7. separately authorized Safe/Zodiac value authority after exact owner/recovery/cap/fee proof;
8. separately authorized minimum-value canary; and
9. observation window and explicit cap/unpause decision.

After each authorized action record the signer, transaction hash, chain, block, receipt, artifact
diff, explorer source verification with library mappings, live code/proxy/admin/owner/peer/pause
verification, indexer change, and rollback checkpoint. Any unavailable evidence leaves the next
stage blocked.

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
targets. Run the lightest focused loop while implementing, the Repo Quick Gate at the cross-package
checkpoint, and the full Ship Gate before Phase-A merge readiness or Phase-B authorization.

```bash
bun run --cwd packages/contracts test
bun run --cwd packages/contracts test:script
bun run --cwd packages/contracts build:full
bun run --cwd packages/contracts check:sizes
bun run --cwd packages/contracts check:storage-layout
bun run --cwd packages/contracts lint:check
bun run --cwd packages/contracts test:audit:full
bun run --cwd packages/contracts test:fork:settlement-lane
bun run contracts:pooling:rehearse:arbitrum-fork
bun run test:contracts-verifier
bun run env:check
bun run --cwd packages/indexer codegen
bun run --cwd packages/indexer check:indexing-boundary
bun run --cwd packages/indexer test
bun run --cwd packages/indexer build
node scripts/quality/check-source-structure.js --base <fresh-combined-base>
bun .plans/active/commitment-pooling/architecture-closure.validate.ts
bun run check:ontology
bun run format:check
git diff --check <fresh-combined-base>
node scripts/dev/ci-local.js --quick
bun run verify:contracts:fast
```

Before Phase-A merge readiness, run the repository Ship Gate and the full production contracts
verifier. The latter's generic core dry runs support the result but do not replace the new selective
target proofs:

```bash
bun format
bun lint
bun run test
VITE_CHAIN_ID=11155111 bun run build
bun run verify:contracts
```

Run the mutating `bun format` step only from a clean/isolated worktree whose pre-existing changes are
all in this scope. If unrelated concurrent work is present, do not format or stage it and do not claim
the Ship Gate passed; move the final gate to an authorized clean worktree.

Treat every failure as a blocker. If a required external RPC, fork, authenticated owner, audit,
signer, or chain observation is unavailable, report it as unverified/blocked rather than substituting
a helper test or a different browser/chain/profile.

Known root read-only lane wrapper:

```bash
bun run contracts:settlement:verify-lane
```

Add the exact settlement/credit dry-run, deploy, courier, verify, and recovery commands to this
prompt only after their package scripts exist and their `--help` output has been tested. Do not
invent command names in an operator handoff and never use raw Forge.

## Completion contracts

### Phase A complete

Call the release-engineering change merge-ready only when:

- the final combined ABI/storage/event manifests are frozen and match generated artifacts;
- every deploy/dry-run/persistence/recovery/courier/post-deploy path exists and is tested through
  its real entrypoint;
- simulation produces an exact resumable transaction plan without mutating live state;
- contract, indexer, source-structure, size, storage, coverage, fork, Repo Quick, full Ship, and
  production-verifier gates are fresh;
- the linked-library address map, owner-equals-sender preflights, role-aware artifact merge, and
  explorer-verification path for every new implementation, proxy, and library exist and are
  tested, or carry a recorded human deferral;
- the adversarial release review — the whole review bar under the recorded internal-only audit
  disposition — has no unresolved Critical/High; and
- the pinned commit, signer/owner, targets, artifact diff, rollback plan, and proposed broadcast
  window are explicit.

Owner decisions recorded 2026-08-10 close the previously open checklist facts, and Phase A copies
them into the applicable handoffs:

- release ladder: fork-confidence → Ethereum Sepolia rehearsal → Arbitrum One → Celo; the
  two-week testnet-operation requirement is withdrawn;
- external-audit disposition: internal review only for every tier of this wave; the adversarial
  release review, coverage matrices, fork rehearsals, and the ping/canary/cap ladder are the bar;
- 48-hour timelock: waived for this wave — Safe multisig approval is the only delay; update the
  handoff lines that required it;
- protocol Safe: the existing Green Goods Safe `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`
  (`networks.json` `greenGoodsSafe`/`multisig`). Phase A verifies its live owner set and threshold
  on-chain and surfaces any mismatch with the handoff's 3-of-5 claim rather than editing the claim
  to fit;
- rollback owner: the deployment EOA (the `green-goods-deployer` keystore identity the root
  wrappers pin). After ownership transfers to the protocol Safe, rollback transactions execute
  through the Safe with that EOA as proposer/coordinator — the release plan must model both
  periods;
- garden-Safe recovery owner (PRD-733): the network council Safe
  `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C`. It is live on Arbitrum as an owner of existing
  proxies; Phase A must verify a deployed Safe exists at this address on Celo (Safe identities do
  not carry across chains automatically) and record the HoA receiving-address evidence alongside
  it, treating absence as a named value-tier blocker; and
- credit unpause seam: bind-plus-pool-gating per the source-reconciliation gate.

The checklist must still keep the core, records-only credit, and value-settlement activation
decisions separate, with each Phase-B stage individually authorized.

Then stop for human review and merge. After merge, stop again for an artifact-specific Phase-B
authorization. Phase-A completion never rolls directly into a broadcast in the same authority
window.

### Phase B complete

Call an authorized release stage complete only when it has receipts and post-action proof, canonical
artifacts and indexer configuration match live state, required read-back converges, rollback
checkpoints remain available, and the human has separately approved any activation, value
authority, canary, or cap/unpause change. Stop after that one authorized stage.

Record broadcast-created receipts and artifact changes in a separately reviewed artifact-only
change from the pinned implementation commit. Do not self-merge it, and do not mix implementation
repairs into the receipt change. A failed verifier sends the release back to a new Phase-A repair and
review cycle; it never authorizes an in-ceremony code fix.

Never use “deployed” to describe a dry-run, “paid” before authenticated Arbitrum confirmation, or
“release-ready” while any required external evidence or Critical/High disposition is missing.
