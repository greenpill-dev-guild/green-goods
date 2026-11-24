# Direct Gnosis voucher purchases

**Status:** implementation and later pinned-chain/default-runner proof complete locally; see the
[proof-closure continuation](codex-service-access-execution.md). Initial failed and unavailable
checks below remain dated history. These are working-tree results, without a commit receipt.
**Dispatch:** 21 October 2026 follow-up to the earned-voucher slice. Continue on
`feature/cosmo-local-contracts`; no branch change, worktree, commit, stash, reset or discard.
The [earned-slice handoff](codex-contracts.md) remains a dated receipt for its own tested files.

The later user continuation authorizes cohesive local commits and
[service integration](codex-service-access-integration.md). The user retains required signing
and makes signed commits from their terminal. This supersedes only the earlier no-commit boundary;
all live deployment, custody and release gates remain.

## Alignment and implementation boundary

Checked the session **Prepare Cosmo contracts prompt** and exchanged alignment messages under the
user's explicit instruction. Its newer human decision adds future personal G$ service purchases
across gardens alongside voucher redemption, keeping G$ on Celo. That session confirmed this
direct-swap dispatch can proceed separately and completed its canonical planning edits first.
The [service-access amendment](codex-service-access.md) is planning-only: it does not authorize
core/G$ changes or service escrow in this slice. Preserve the original first-slice evidence and
every unrelated lane blocker. No external tracker write is authorized.

Reuse evidence: the published CLC `SwapPool.withdraw(tokenOut, tokenIn, amountIn, recipient,
minAmountOut, deadline)` already owns atomic payment and voucher delivery with the accepted bounds.
The missing Green Goods capability is its clean-room consumer interface and integration proof
against the selected implementation/configuration. Use that entrypoint directly. A new forwarding
router, mint entitlement or purchase registry would duplicate existing behavior.

Inventory: new `src/interfaces/ICLCSwapPool.sol`, test-only configuration interfaces/fixture,
and pinned direct-purchase cases. The public interface exposes only the bounded swap overload;
quotes remain non-view because the published interface permits stateful quoters. The existing
voucher endpoints, commitment core, registry, Hats, G$ settlement and app flags remain unchanged.

Purchase authorization is the payer's call and token allowance to that pool. The payer may sponsor
a different named learner; the pool pulls from the caller, never from an arbitrary supplied payer.
The pool's settlement receipt proves this purchase, not service delivery or an earned reward.
Bind the learner using the bounded calldata and output-token Transfer in the same receipt: the
published `SwapSettlement` event does not contain a recipient field. Receipt identity for later
projection is chain, pool, transaction hash and log index; fork logs are simulated receipts.
There is no Arbitrum command or entitlement for this same delivery.

## Financial behavior and proof matrix

Every failed swap must revert all input/output transfers, allowance consumption, fee accounting
and purchase logs. A retry is a fresh user-authorized swap with current bounds and sufficient
funds; a lost UI response requires receipt lookup before another purchase. There is no invented
once-only purchase ID in the existing pool or guarantee that repeating a paid call buys only once.

| Boundary | Expected effect and immutable evidence | Planned proof |
|---|---|---|
| Sponsor differs from learner | Sponsor pays, only named learner receives vouchers; allowance decreases by actual input | Real pool, WXDAI and fictional GiftableToken receipt/balance checks |
| Caller equals learner | Same bounded path; no extra distribution entitlement | Real pool direct self purchase |
| No/insufficient/revoked allowance or payment balance | Entire swap reverts; repair requires payer action | Negative and repair cases with exact before/after balances |
| Minimum output, stale quoter or fee update | Below-bound execution reverts atomically, including accrued fees | Independent expected amounts, moved local rates and fees |
| Deadline | At deadline succeeds; immediately after reverts without spending | Before/at/after boundary |
| Registry de-list and limiter exhaustion | Both assets must be curated; input must fit this pool's configured holding cap | Input/output de-list, exact cap and cap-plus-one |
| Reserve depletion and owner withdrawal | No inventory means no purchase; issuer/governance replenishment repairs it | Real pool inventory failure and repair; no capacity claim |
| Different community pool | Its own registry, limiter, quoter, fees and balances determine price | Two explicit fictional pool-local prices; no universal parity |
| Pool and protocol fees | Both fee legs and learner output conserve gross quote; only available inventory can leave | Nonzero explicit fictional rates and recipients |
| Governance | Local Safe stand-ins own configuration; separate 48-hour timelock administers proxies | Owner/writer isolation, sealed pointer versus mutable dependency, timelock checks |
| Service and earned reward independence | Buying transfers existing inventory; no mint, fulfillment, discharge or Arbitrum entitlement | Supply unchanged and separate receipt semantics; existing earned regression suite |

WXDAI is explicitly a **local-rehearsal payment asset**, not a production payment choice or G$.
Use native xDAI wrapping on the fork, 18-decimal input and 6-decimal fictional vouchers. Each pool
uses explicit relative prices, token registry, limiter and fee policy. Rehearsal parity, if tested,
is a named fixture only. Pool holding caps, token supply, outstanding service obligations and
deliverable capacity remain distinct. Issuer inventory and pool withdrawal remain privileged
governance powers; neither minting nor a deposit proves available service capacity or LP rights.

## Verification and current limits

Pinned documentation: CLC v1.1.0 `ce090fd3d5a7493c726fb939da39af15ef1c9d7c`, published
[SPEC](https://github.com/cosmo-local-credit/protocol/blob/ce090fd3d5a7493c726fb939da39af15ef1c9d7c/docs/SPEC.md),
[DEPLOY](https://github.com/cosmo-local-credit/protocol/blob/ce090fd3d5a7493c726fb939da39af15ef1c9d7c/docs/DEPLOY.md)
and build artifacts. Prior conformance establishes GiftableToken, factory, pool and limiter at
Gnosis chain 100, block 48,848,261. Additional registry/quoter/fee creation conformance is recorded below; fresh pinned runtime reads remain blocked.
Only published documentation, metadata/ABI, compiled artifacts and chain data are inspected;
no AGPL implementation source is read, imported or vendored.

The connected explorer returned deployment transaction input exactly matching the published
creation artifacts for the newly used configuration dependencies:

| Implementation | Gnosis address | Deployment block | Artifact-derived runtime hash |
|---|---|---|---|
| TokenUniqueSymbolIndex | `0x0CEB18BA6562D3227717D98c044A5849bE8362EF` | 47,787,170 | `0x7d87c5eb290d28f0961269d99ccb278992b7a1e1ad358abb35156a80bc7f3db5` |
| RelativeQuoter | `0x0B0986c0E580377389337C453Cc65A3933511165` | 47,787,167 | `0x6b1691764731912392f3c3c24121d3d3fc26e844fa464d93f323e4205f0ac273` |
| FeePolicy | `0x1b97FfFAF2D2e16C8F7de6826F4F658dc898E5b6` | 47,787,161 | `0x7fcdb49bc3a1a63a41a22e7646e46a17d347c2aa790dbc1f524f8c50ddc03b3c` |
| ProtocolFeeController | `0x302E6d520e7D7AeFceA4813e456234B5daA23B4d` | 47,787,166 | `0xf441076998949ba0daa400a3b16613691260673679d12087fe39ddb19c62c1d9` |

This is fresh **creation-bytecode equality**, not a fresh runtime read at block 48,848,261.
The fail-closed fork suite separately asserts all eight implementation/factory runtime hashes.
Scratch evidence is in `/private/tmp/cosmo-local-purchase-research-20261021`: `research.md`,
`published-interfaces.md`, `artifact-metadata.json`, `expected-runtime-and-selectors.json`,
`creation-conformance.json` and `error-selector-evidence.json`. The archived initial
[pool/token/factory conformance](claude-conformance-evidence-2026-10-20.md) retains its date.

The selected CLC artifacts embed Solidity **0.8.34** metadata; the README's 0.8.36 compiler
sentence is stale evidence and does not override those bytes. Local test compilation uses the
repository's pinned Solidity **0.8.28**, Cancun, via-IR; fork/replay profile uses optimizer 200
and 32 fuzz runs, while the standard regression profile disables the optimizer and uses 1,000
fuzz runs with capped invariants. The production G$ gas boundary uses its existing optimizer-1
profile and isolated cold calls. No compiler/toolchain configuration was changed.

Published bounded selector is `0x909a6e32`; all six parameters, including the deadline, use
`uint256` quantities where applicable. Index initialization uses `bytes32[]` symbol keys.
Historical chain logs confirm three indexed addresses and six data words for `SwapSettlement`,
topic `0x6394474055d569feb90f5964ee258ee76713aa506f493bb07357e9aae1914016`.
The current source interface exposes those exact errors/event and bounded methods; fixture-only
administrative interfaces stay in `test/helpers`.

The current permission profile denies root secret-file reads and public Gnosis RPC access.
Disable Bun automatic dotenv loading with its supported `--no-env-file` option. The default
validation runner hashes the denied root `.env` family; do not read those files or fabricate its
receipt. Select checks without executing that fingerprint path and retain any unavailable wrapper
or fork proof explicitly. The user selected the Green Goods Alchemy app for read-only checks. Its nine pinned code reads,
chain ID and block lookup returned HTTP 403: `GNOSIS_MAINNET is not enabled for this app`.
No network/app configuration was changed. The exact responses are in
`/private/tmp/green-goods-purchases-20261021/alchemy-pinned-code.json`. No fresh pinned runtime
identity is inferred from those failed calls.

### Observed bytecode replay

At 17:45 UTC, all **22** purchase tests passed, including **32** conservation fuzz runs, in a
disposable local artifact replay. Eight published CLC runtimes were installed into synthetic
Gnosis-address accounts. WXDAI's verified deployment creation bytecode was executed locally;
its resulting runtime and constructor-written storage were copied to the rehearsal address.
Runtime hash: `0xdfff0c54be05b5df7dc8f015f8c813825344770fee1ba1202130a4652b529ca9`.
The test's runtime hash checks passed against those installed artifacts. This demonstrates
behavior of those binaries with newly initialized fictional state, **not** a chain fork,
historical WXDAI storage, live pool configuration, RPC identity or a fresh pinned chain read.
A prior replay with a standard payment mock also passed 22/22; it is the weaker result.

The real fork suite remains fail-closed: it selects Gnosis block 48,848,261 and checks the eight
implementation hashes before initializing fictional proxies. It is **unrun in this follow-up**
because the public RPC is blocked and the selected Alchemy app has no Gnosis network enabled.
Creation equality, prior dated conformance and synthetic runtime installation do not close this gap.

Replay command, from the repository root, with a task-local Bun shim that adds `--no-env-file`
to nested invocations (no repository/global configuration change):

```sh
PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true FOUNDRY_VERBOSITY=1 FOUNDRY_PROFILE=fork FOUNDRY_TEST=.generated/purchase-replay bun --no-env-file run --cwd packages/contracts test --suite solidity --profile match --json --match-contract GnosisVoucherPurchaseArtifactReplayTest -- .generated/purchase-replay/Replay.t.sol
```

Exit **0**; result `replay-wxdai.json` and stderr in the task evidence directory above. The ignored,
disposable harness and exact binary inputs are archived there as `artifact-replay.tar.gz`, SHA256
`b69bec90a2c1ec6d486970c93f795a62ab959ccb814d370cfe16ea23ea4cb3d1`.
No upstream implementation source or compiled binary is added to tracked source or vendored code.
The only injected fault in the committed-candidate cases is a false return from the learner's
final transfer, after the actual protocol-fee transfer; the entire swap rolls back and a repaired
retry succeeds. This is accurately labeled `vm.mockCall`, not a live token failure.

TDD limit: this slice binds an existing external swap implementation, so it does not have an honest
preimplementation RED for new Green Goods runtime behavior. The initial CLI/hex parsing failures
are setup failures, not RED evidence. The deadline fixture initially failed because optimized test
code can cache `block.timestamp` across a warp; using a fixed explicit timestamp repaired that test.
No upstream runtime change or new core behavior is claimed. The passing replay and financial
boundary tests are fallback conformance evidence; the earned slice retains its separate RED/GREEN.

### Working-tree identity

HEAD is `4a6b2f2e519b3e4cc675ed7bd738ab12b18bd4a2`, branch
`feature/cosmo-local-contracts`. The four new interface/test files are untracked, so HEAD does
**not** identify the tested implementation. No commit-attributed receipt is claimed.
The 14 public build/test configuration digests are in `validation-configuration.json` in the
same evidence directory; no root secret file is part of that fingerprint.
Their SHA256 bundle digest is
`ba9d1744c6b25d70da19a5c8cceac13d87e259eb6e1122db0b21f916cb05f78c`:
SHA256 of each listed path, NUL, file SHA256 and LF, in manifest order. The complete per-file
manifest is `/private/tmp/green-goods-purchases-20261021/purchase-files-manifest.json`.
All nine prior earned files still match their original
`21c73def997daeeb1ec88b548cc4f24da7ee822b5f350157b3ca9b87f564a907` bundle manifest byte for byte.
The earned handoff is untouched.

### Repository proof

The QA selector retained all five checks: format, ABI artifacts, contracts build, contracts test
and the critical `contracts-verify-fast` override. Selection command:

```sh
node scripts/dev/ci-local.js --plan --json --intent qa --changed packages/contracts/src/interfaces/ICLCSwapPool.sol --changed packages/contracts/test/helpers/CLCPurchaseInterfaces.sol --changed packages/contracts/test/helpers/CLCPurchaseFixture.sol --changed packages/contracts/test/fork/GnosisVoucherPurchase.t.sol --changed .plans/backlog/cosmo-local-credit-interop/brief.md --changed .plans/backlog/cosmo-local-credit-interop/spec.md --changed .plans/backlog/cosmo-local-credit-interop/plan.todo.md --changed .plans/backlog/cosmo-local-credit-interop/eval.md --changed .plans/backlog/cosmo-local-credit-interop/status.json --changed .plans/backlog/cosmo-local-credit-interop/handoffs/README.md --changed .plans/backlog/cosmo-local-credit-interop/handoffs/codex-contracts-purchases.md
```

The final selector output is `validation-plan-final.json` (11 current paths; same five checks). The default execution runner and the complete
`contracts-verify-fast` wrapper are **unrun**: their root-check invocations fingerprint denied
root secret files. No permissions, validation scripts or release policy were weakened. Manual
build/lint/test phases preserve the required checks and produce command-level evidence only;
they do not produce a passing default-runner receipt.

The full package command completed with exit **1** at 18:10:40 UTC:

```sh
PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts test
```

Its phases passed **2,003 Solidity tests**, **3 production G$ cold-path gas fixtures** and
**31 Node CLI tests**. Vitest reported **318 passed / 1 failed**: unchanged
`script/deploy/release.test.ts`, “ends the current core plan paused and blocks ownership broadcast
before RPC”, exceeded the existing 30-second timeout (34.292 seconds observed). No assertion
failure was reported for that case. The unchanged 33-test file subsequently passed in isolation
with the same timeout, via `bun --no-env-file run --cwd packages/contracts test --suite script --
script/deploy/release.test.ts` and the same task PATH/FOUNDRY_OFFLINE environment. That file took
49.32 seconds total, with all 33 passing; all 31 CLI tests also passed again. This supports a
load-sensitive timing hypothesis, not a proven runtime fix. No release tooling or test settings
were changed. The complete script phase then passed **319/319 Vitest tests** plus **31/31 CLI tests** on
recheck, using `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true
bun --no-env-file run --cwd packages/contracts test --suite script`, exit 0. Vitest took
109.51 seconds. Logs: `release-script-isolated.log` and `scripts-recheck.log`. The original
failed full command is never relabeled as a pass; all component phases now have passing
local evidence without assertion, timeout or concurrency configuration changes.

Available command results, from the repository root unless noted:

| Exact command | Observed result |
|---|---|
| `bun --no-env-file run --cwd packages/contracts build --mode target -- src/interfaces/ICLCSwapPool.sol` | Exit 0; public interface compiles |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts build` | Exit 0 at 18:16:46 UTC; default auto source build, `targets=src` |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts build --mode full` | Exit 0 at 17:46:14 UTC; all source/test/script compilation, test profile |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts lint --check` | Exit 0 at 17:47:35 UTC; Foundry format check and Solhint, 0 errors / 272 existing warnings |
| `node scripts/contracts/check-foundry-version.mjs` | Exit 0; installed Foundry 1.7.1 matches pin |
| `PATH=/private/tmp/green-goods-purchases-20261021/bin:$PATH bun --no-env-file run oxlint packages/client/src packages/admin/src packages/shared/src packages/indexer/src packages/agent/src packages/contracts/script --deny-warnings` | Exit 0; repository static-lint's Oxlint phase |
| `./node_modules/.bin/biome format .` | Exit 1; four preserved unrelated files: `.claude/settings.json`, PWA-simplification status, Stripe/thirdweb-pilot status and Green Goods OS status. No formatting write |
| `./node_modules/.bin/biome format --write .plans/backlog/cosmo-local-credit-interop/status.json` | Exit 0; only the owning status file formatted |
| `node scripts/contracts/check-solidity-test-names.mjs` | Exit 0; 87 added/renamed names conform, including 22 new purchase cases |
| `node scripts/docs/generate.mjs --check` | Exit 0; 17 documentation projections current |
| `node scripts/quality/check-ontology.mjs` | Exit 0; all guards passed, 7 existing baselined findings |
| `node scripts/harness/plan-hub.mjs validate --feature cosmo-local-credit-interop` | Exit 0; 34 hubs validated |
| `node scripts/harness/plan-hub.mjs linear-sync --feature cosmo-local-credit-interop --json` | Exit 0; read-only manifest: parent `preserve`, no lane actions, states `preserve_existing`; no external write |
| `git diff --check` | Exit 0 at the final local handoff |

ABI builtin was executed directly without the default runner's denied-secret fingerprint path:

```sh
node --input-type=module - <<'JS'
import {runCommandCheck} from './scripts/dev/ci-local.js';
const result=await runCommandCheck({id:'abi-artifacts',builtin:'abiArtifacts'});
console.log(JSON.stringify(result));
if(!result.ok) process.exitCode=1;
JS
```

Exit 0; `ok: true`, `exitCode: 0`, empty details. Exact programmatic command/timing records and
build/lint/test logs live under `/private/tmp/green-goods-purchases-20261021`. No passing check is
borrowed from the earlier earned receipt. The optional global Foundry signature-cache write
warns about denied access; no permission change was made and the recorded commands still exited 0.

No new member passkey, live CCIP, external membership activation, provider approval, real price or
service-capacity claim follows from local tests. COM-46, account and all audit/Safe/timelock/testnet/
rollback/human release gates remain open. No dependencies, harness permissions or release policy
are changed. Rendered proof: **none**; this slice changes no UI.

Task record: direct Gnosis voucher purchase slice | Type: integration | Outcome: implementation present; external proof gaps open
Agent/model: Codex / exact model unknown | Coverage: next-slice continuation only

| Phase | Start → end (UTC, 21 October 2026) | Result / evidence |
|---|---|---|
| Investigate | unknown → before interface proof at 17:14:26 | Published bounded API and prompt-preparation alignment; exact boundary unknown |
| Implement | unknown → before final bytecode replay at 17:45 | Hand-written bounded interface and test fixture; explicit deadline boundary repaired |
| Verify | 17:14:26 first observed → 18:17 final test/build checkpoint | 22/22 bytecode replay; full compile/lint; standard Solidity suite 2003/2003, 3/3 G$ gas, 31/31 CLI and 319/319 scripts on recheck |
| Handoff | 17:49:22 first observed → 18:18:24 | Current plan/status and separate purchase evidence; unrelated lane blockers retained |

Human corrections: 0 observed; one provider-app selection; attention: unknown. No publish phase entered.

Final integrity check: four purchase files, nine earned files and 14 public configuration files
match their recorded manifests; HEAD is unchanged and the index is empty. `final-integrity.json`
retains the result. All code remains local and uncommitted. Full source build, lint, ABI and
component tests have passing local evidence; the initial package timeout, four unrelated format
failures and unavailable root/fork proof remain recorded. The owning status passes plan validation
and formatting; no unrelated lane blocker is cleared.

Next verification is the pinned Gnosis suite through a permitted process-supplied RPC, followed
by the complete critical runner in an environment that can satisfy its existing requirements.
Do not read denied secrets or alter provider/release configuration to manufacture that receipt.
The next planned implementation is the bounded service-access eligibility/personal-G$ funding
work in [the prepared service-access prompt](codex-service-access.md), followed by voucher
presentment/redemption. Those future stages remain planning-only in this dispatch.
