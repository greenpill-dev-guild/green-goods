# Helper provenance and migration failure safety — 22 October 2026

The simulated nine-case failure matrix passes on pinned Gnosis, Arbitrum and Celo forks. The
historical fixture address stays `0x9546b80b2faf5d5a9905c752d26b60296d6bc305` on all three.
The helper's exact source, reproducible build and security provenance remain unresolved.
These observations authorize no production migration or live deployment.

This bounded continuation follows signed checkpoint `c10e2d2f7`. The user authorized local
focused proof and signed commits in the existing checkout, with signing required and no worktree,
push, broadcast, production auth/provider/dependency/security change or external tracker write.
The prompt-preparation chat confirms the same scope; offers/requests discussion adds no new
runtime redesign or voucher-to-voucher slice. COM-46 still has no approved issuer evidence.

## Findings and limits

**ESTABLISHED — creation and runtime identity.** The helper is
`0x03EB97959433D55748839D27C93330Cb85F31A93`. Complete Gnosis and Arbitrum creation transaction
inputs match: 14,409 bytes, consisting of the zero CREATE2 salt and 14,377 bytes of creation code
including twelve constructor addresses. The canonical `0x4e59` CREATE2 derivation reproduces the
helper address. The complete 13,368-byte Gnosis runtime hashes to
`0x73598d1ef8935a12ddd600d3ae5c443933f419b9137eed19cb66d1ffc147b4de`, matching the pinned
Arbitrum Alchemy account proof. Compiler-only CBOR identifies solc 0.8.30 and has no IPFS locator.
The [provenance artifact](../artifacts/member-migration-helper-provenance-2026-10-22.json)
retains complete creation/runtime bytecode, hashes, decoded constructor values and transaction IDs.

**UNRESOLVED — helper source and security.** Explorer source was unverified; Sourcify lookups on
100, 42161 and 1 returned 404/no match. The installed SDK 5.5.10 supplies an ABI, encoder and
constants, not the helper's implementation. Searches of the official Kernel v3.1 and plugin
repository trees found no matching helper source. The pinned migration demo uses Kernel 0.3.0;
it does not certify the selected 0.3.1 path. No exact helper source revision, complete compiler
input/dependency set, privilege inventory or applicable audit/security guidance was established.
Zero standard EIP-1967 implementation/admin/beacon slots on pinned Gnosis exclude none of the
possible custom upgrade or privileged behavior. No helper execution or certification is claimed.

**ESTABLISHED — a separate Kernel rebuild.** The deployed Kernel implementation's verified
[Arbitrum compiler input](https://arbiscan.io/address/0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D#code)
is available. Installed solc 0.8.25+commit.b61c2a91, optimizer 200/viaIR/Paris and the recorded
metadata settings reconstruct its 22,784-byte runtime after filling constructor immutable values.
Chain-specific EIP-712 values explain the different Gnosis, Arbitrum and Celo hashes. The
Arbitrum result matches its pinned Alchemy code hash exactly; Gnosis/Celo results match their
complete cached fork runtimes. This is Kernel provenance, not helper provenance. Settings,
source hashes, immutable offsets/values and compiler input/output hashes are in the artifact.

**CORRECTED — execution failure is not validation rollback.** Wrong chain, wrong account and
changed payload produce exact AA24 validation rejection, with no surviving account creation or
consumed account nonce. Insufficient verification gas also rolls back creation. Once validation
succeeds, an execution revert can leave a newly created account with its legacy root/module/key
and consume its EntryPoint nonce. A root change followed by execution revert or gas exhaustion
rolls back that change while initial account creation survives. None is marked migration-ready.

**ESTABLISHED — replay, retry and module boundaries.** An identical operation replay rejects
without changing the observed state. Rebuilding with the next nonce and omitting creation data
for the surviving account permits a newly signed retry; the controlled failure remains a failure.
A successful root change retains the legacy validator module and stored owner key. A separate
owner-authorized uninstall clears them; a later failed operation preserves that earlier removal
and patched root. That uninstall is an existing-Kernel control experiment, not an adopted
production migration or proof that all possible account permissions have been removed.

**INFERRED — readiness must inspect surviving state.** Outer transaction success, a failure event
or a changed root alone cannot establish safe migration. Preserve the address, actual root,
module/key state and nonce history when assessing repair. Production policy remains unchanged.

## Exact proof boundary

The one-shot [runner](../proofs/member-migration/failure-proof.mjs) reuses the real software P-256
approach from `packages/contracts/script/utils/reporting-compatibility-passkey.ts`, without its
protected root-env loader or unrelated reporting flow. It imports installed permissionless
0.2.57 and viem 2.55.13, uses Kernel 0.3.1/EntryPoint 0.7 and preserves the earlier canonical
initializer/salt/factory data. The owner coordinates are decoded from the actual initializer.
Public P-256 scalar 1 and synthetic `greengoods.test` WebAuthn responses produce real fixture
cryptography; they do not prove any member's credential possession, passkey ceremony or custody.
A public Anvil development EOA signs only to the runner's owned loopback node. No impersonation
or runtime etching is used. Missing Gnosis legacy-validator code is deployed canonically on the
isolated fork only. Fixture balances are simulated native currency, not sponsorship or live funds.

The only Solidity addition is
`packages/contracts/test/helpers/MemberMigrationFailureFixture.sol`, a controlled delegatecall
failure target. It makes a real Kernel self-call before returning, reverting or exhausting its
execution gas. It is neither the helper nor a migration implementation. Each case observes code
existence/hash, active root, both validator module configurations and stored owner keys,
EntryPoint nonce, Kernel nonce bounds, selector permission and raw validation/implementation slots.
Every outcome records `migrationReady=false`. Initial account creation and later execution are
observed separately. Source, configuration, dependency and compiled fixture hashes must remain
unchanged during each run. Synthetic operation signatures are omitted from the evidence files.

| Fork | Block | Block hash | Observed Anvil 1.7.1 hardfork |
|---|---:|---|---|
| Gnosis 100 | 48,888,476 | `0x11a68d53c3dc81c412402cc1393e379358763ede55ab53fe0a9e361b21878867` | Bpo1 |
| Arbitrum 42161 | 517,303,434 | `0x4c4568b7c14a4063beeab6ce876454c12d2f7d6afd19e499fdcb0a50748c9c95` | Prague |
| Celo 42220 | 80,792,916 | `0x4b488d836419d68983df7f9dd85e5b551f0e5eac0cd7664da54b9d586eae6d70` | Bpo1 |

These are real pinned dependency bytecodes executed by Anvil with the recorded hardforks, not
live sequencer, bundler, browser, member-signing or paymaster certification. The
[failure artifact](../artifacts/member-migration-failure-safety-2026-10-22.json) retains all 27
cases, operation receipts with signatures omitted, exact source hashes and scope limits.

## Alchemy, cache and retained failures

After the user directed Alchemy, every new upstream chain request used the selected Green Goods
app. No API key was extracted, stored or supplied on a command line. A disposable read-only
[loopback bridge](../proofs/member-migration/alchemy-gateway.mjs) queues connector reads and rejects
transaction submission and non-pinned state reads. Complete cached/compiled code is accepted only
when its hash matches Arbitrum's pinned Alchemy code hash. Arbitrum's absent-account zero-hash
sentinel is handled separately: zero balance/nonce/storage hash plus a separate empty `eth_getCode`
response are required; zero is never presented as `keccak256(empty code)`. Guard checks reject
nonempty/mismatched code and invalid empty-account fields. Merkle proofs are retained as RPC
observations, not independently verified trie proofs.

The final runs reuse genuine Foundry public fork caches at these exact pins. Their initial
Gnosis/Celo state came from public RPC before the Alchemy steering. A later Gnosis historical
`eth_getProof` probe returned -32000/unsupported; do not describe the Gnosis result as fresh,
independent Alchemy full-state authentication. The recorded local pinned execution still passes.
Arbitrum's missing archive state was actually supplied through Alchemy. All selected Arbitrum
runtime dependency hashes match fresh complete Alchemy account-proof responses. The
[complete code candidates](../artifacts/member-migration-runtime-candidates-2026-10-22.json)
retain their cached/reconstructed provenance. Truncated connector bytecode was never accepted
as complete. A cold-cache repeat needs complete upstream state/code access; do not invent it.

Retained failures under `/private/tmp/green-goods-helper-failure-20261022/` include:

- Initial public Arbitrum archive refusals: missing trie state and personal-token requirement.
- Initial Celo AA21 prefund failure with 1 simulated native. Its first four generic outer-revert
  checks did not prove signature binding. Repair used 100 simulated native and exact AA24/gas
  assertions, then reran all nine cases.
- Initial fixture key-description parsing, bridge startup/read-method/syntax defects, absent-account
  sentinel mismatch and cold-read timeout. These fixture repairs are not product RED/GREEN claims.
- Manual lint/format checks found CLI console warnings and Solidity layout differences; both were
  corrected before the final validation. No lint/security/toolchain configuration was weakened.

## Reproduction and validation receipt

No dependency was installed or upgraded. The temporary wrapper has only a `test` script pointing
to the Plan Hub runner, with no dependencies. Run from the repo root; exact observed commands:

```sh
PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH FOUNDRY_OFFLINE=true bun --no-env-file run --cwd packages/contracts build --mode target -- test/helpers/MemberMigrationFailureFixture.sol
bun --no-env-file run --cwd /private/tmp/green-goods-helper-failure-20261022/wrapper test --guards
bun --no-env-file run --cwd /private/tmp/green-goods-helper-failure-20261022/wrapper test --network arbitrum
bun --no-env-file run --cwd /private/tmp/green-goods-helper-failure-20261022/wrapper test --network gnosis
bun --no-env-file run --cwd /private/tmp/green-goods-helper-failure-20261022/wrapper test --network celo
```

For the matrix commands, `MEMBER_MIGRATION_RPC_URL` was supplied only in the child process from
the owned Alchemy bridge endpoint. The runner then creates a different owned signing node and
checks exact upstream block hash, local chain/block and loopback confinement. The bridge's request
queue was serviced through read-only connector tools; it does not contain an API key or invoke
MCP tools itself. The bridge requires `gateway/candidates.json` under the task's temp evidence
directory; the checked-in candidates artifact supplies those complete bytecodes. This is a
session-operated proof harness, not an unattended transport integration or production service.
The protected root `.env` was not read. Exact public responses and session launcher logs remain
under the task temp directory; the durable artifacts contain the decision-relevant results.

Selector: `bun --no-env-file run check --plan -- --intent qa --changed <the nine owned paths> --json`.
`owned-paths.json` and selector logs in the task temp directory retain the exact expanded list.
It selects sensitive test-only work: `format`, `lint`, `contracts-test`; no mandatory critical
override is selected because production contract/auth/runtime/release code is unchanged.
Additional direct proof checks cover Plan JS through included virtual `.ts` Biome stdin paths,
`bun --no-env-file run oxlint --no-ignore <the three proof .mjs paths> --deny-warnings`,
and `bun --no-env-file run --cwd packages/contracts lint --check` through the no-env shim.
Final selected execution passed all three checks fresh: 0 reused and 0 unrun. Contracts passed
2,191 Solidity tests, three unchanged production G$ gas fixtures, 31 CLI tests and 331 script
tests. Direct Plan-JS Oxlint passes with warnings denied; the contracts formatting/Solhint check
exits zero with 286 existing source warnings and an unavailable optional update check. The initial
unapproved-loopback package run failed its local script fixture with EPERM; the fresh selected
run used scoped local-fixture permission and passed.
The final 27-case matrix was rerun after source formatting and package compilation; every recorded
input hash matches the working tree. Exact expanded selector/execution argv, logs and exit codes
are retained in the task temp directory. The selected command is `bun --no-env-file run check --
--intent qa --changed <the exact nine paths>`, with the no-env shim first on PATH and
`FOUNDRY_OFFLINE=true`.

These are working-tree observations at base HEAD `c10e2d2f7bd33885df49142682f390b0e495cf8a`,
with input hashes, not a fabricated post-commit receipt. A local signed source checkpoint follows;
its SHA is established only after the commit and signature/tree verification. No push/readiness,
merge, live-chain or actual-member claim follows from this local proof.

The nine-path source checkpoint is signed locally as `ea28e3b55536f75cd278fcf300629bd5f071d686`.
Signature verification returns `G`; every committed blob equals its reviewed staged digest and
owned paths/index are clean. Required SSH signing and the repository hook configuration remain
unchanged. The commit used scoped approved signing through the dedicated agent, not a claim that
the default sandbox socket restriction disappeared. Temporary copies of all hooks retained the
identity check; only lint-staged's automatic stash/hiding were disabled to preserve concurrent work.
No stash, reset, worktree, force switch, push or live deployment occurred. `origin/develop` was
refreshed and remains `d7bbbf00d6af63f39a1aea6fe84fb6f2bbcc72be`.

After committing, all 27 cases passed fresh against that exact SHA with empty status on every
validated tracked source/dependency/configuration path. The ignored compiled fixture artifact is
fingerprinted separately. The failure artifact now owns that narrow commit-attributed receipt.
The broader three-check package pass remains working-tree evidence, not a newly invented
post-commit full-suite run. Evidence/handoff-only hygiene also passed 2/2 fresh after the first
result files were written. This receipt follow-up changes only evidence and the owning plan;
retain attribution only with an empty source-path diff and clean source status from the tested
commit to the final HEAD. The committed source, dependencies, configuration and validation entrypoints are unchanged.
However, after the clean run was captured, another session added the
`./config/query-persistence-clear` export to `packages/shared/package.json`. Its dependency
versions did not change. The manifest is a validated input and is now dirty, so the clean-status
condition for a current/final-HEAD receipt is not satisfied. The recorded run remains historical
commit-attributed evidence; its reuse is blocked until the owning change resolves and applicable
proof is refreshed. The manifest and all other unrelated changes remain outside these commits.
The prompt-preparation chat was informed; no attempt was made to stage, revert or commit that
session's manifest change.

TDD mode: not applicable to product behavior. This is an investigation with controlled failure
inputs, real integration observations and guard regression checks. No product lane is marked
passed/completed, and no historical failure is relabeled as an intended product RED.

## Remaining bounded work

The exact maintainer question is retained in the provenance artifact: identify the helper's public
source revision, complete solc 0.8.30 standard-json input/dependencies/constructor values, privilege
and upgrade model, and applicable audit/security guidance for this runtime and Kernel 0.3.1/EP 0.7.
No maintainer message has been sent. Until that evidence and a separately reviewed design exist,
the helper remains unverified. Actual-member signing, provider acceptance, Gnosis sponsorship,
recovery, private issuer readiness and every release gate remain open. Returning tokens, proving
service delivery and supply/outstanding-obligation accounting retain their accepted distinctions.
No offer/request, swap, voucher-to-voucher or service-access runtime change is added by this proof.

Task record: cosmo-local-credit-interop | Type: investigation/proof | Outcome: complete within the bounded investigation; live proof gates unresolved
Agent/model: Codex / model identifier unknown | Coverage: helper provenance and failure-boundary continuation

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Unknown → 2026-10-22 21:11:23 | Full helper creation/runtime, source searches, exact Kernel compiler rebuild, Alchemy capability/cached-state limits |
| Implement / verify | Unknown → 2026-10-22 21:21:52 UTC | Final source: 27 pinned cases, three fresh selected checks and direct guard/style/lint proof pass; initial failures retained |
| Review | Unknown → 2026-10-22 21:21:52 UTC | Scope, exact source hashes, bytecode provenance, failure/nonce state, relative links and signing config checked |
| Publish locally / verify | Unknown → 2026-10-22 21:26:01 UTC | Signed nine-path source checkpoint; fresh committed 27-case matrix passes; evidence-only follow-up retains source attribution |

Human corrections: 1 observed in this segment (use Alchemy for requests); attention: unknown.
