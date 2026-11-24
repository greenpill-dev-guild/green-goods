# Member account migration characterization — 22 October 2026

The fictional account still derives to the same address across Gnosis, Arbitrum and Celo. A
read-only simulation reproduces the original missing validator through canonical CREATE2 creation
and then creates that exact account inside the call. This closes the mechanical dependency/address
question. It does **not** establish safe migration, member control or usable Gnosis sponsorship.

The user authorized this bounded local proof continuation and signed local commits. The
prompt-preparation chat confirmed no newer architecture decision: preserve the gardener's address
across all three chains, keep G$ on Celo, and do not activate an unreviewed migration. No runtime,
dependency, provider, account or live deployment configuration changes in this slice. The earlier
145-path checkpoint is signed locally as `0f4e62bae5d7696f9d07b0cdb8715f8aeec5e86e`.

## Evidence and its boundary

[The public observation artifact](../artifacts/member-migration-characterization-2026-10-22.json)
contains complete creation bytecode, exact simulation calldata/results, pinned identities,
source references and consistency checks. It references the unchanged fictional credential fixture
in [the earlier evidence](../artifacts/member-readiness-2026-10-22.json); no real member credential
or private signer information is included. Reads use the user-selected Green Goods Alchemy app
and read-only Etherscan tools. No API key is copied.

- **ESTABLISHED:** the complete 3,500-byte original creation code hashes to
  `0x6fa43ac364e3690aecc9441041ee49b90948ebcc1fac1fdac782bb7c9fe2cb5e`.
  Canonical deployer `0x4e59b44847b379578588920ca78fbf26c0b4956c` and zero salt derive
  `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd`. Its complete embedded 3,472-byte runtime
  matches the fresh Arbitrum runtime byte for byte, with hash
  `0x17589a97c20e5e650d920a76e13ae0f05efcc719b96eb352bc9504d0ae946d07`.
- **ESTABLISHED:** at Gnosis block `0x2e9fa9c`, hash
  `0x11a68d53c3dc81c412402cc1393e379358763ede55ab53fe0a9e361b21878867`, the unchanged
  meta-factory call reverts without the dependency. A strict three-call Multicall3 simulation
  creates the validator, runs that same meta-factory calldata, and reads the expected legacy root
  on `0x9546b80b2faf5d5a9905c752d26b60296d6bc305`. An identical retry returns identical bytes.
  Separate reads still show no code for either address. These are ephemeral `eth_call` results.
- **ESTABLISHED:** unchanged initializer/salt returns that same account address at the recorded
  Gnosis pin, Arbitrum `0x1ed56c8a` and Celo `0x4d0cd54`. The artifact retains each block hash.
  Replacing only the root with patched validator `0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69`
  changes the Gnosis derivation to `0x8542eb44aa0858e8131f4f2d0fe73e30cadd8fbc`. That is an
  address counterexample, not an accepted fallback.
- **ESTABLISHED:** the patched validator, migration helper and P256 verifier have Gnosis code.
  Their provider-reported hashes match the preparation chat's earlier observations. EIP-1186
  Merkle paths were not independently verified, and no source build was reproduced.
- **UNRESOLVED:** Etherscan returns unverified source for the migration helper on both Gnosis
  and Arbitrum. Bounded official-source searches found no helper implementation. The SDK's ABI,
  migration encoder and matching runtime identities do not establish helper security provenance.
  No helper migration call was executed or accepted on that basis.

The pinned [upstream passkey version map](https://github.com/zerodevapp/sdk/blob/52b043007429c20b05aa3f08c005d32f5ec4697d/plugins/passkey/index.ts)
and [validator source](https://github.com/zerodevapp/sdk/blob/52b043007429c20b05aa3f08c005d32f5ec4697d/plugins/passkey/toPasskeyValidator.ts)
label the original root `V0_0_2_UNPATCHED` and the replacement `V0_0_3_PATCHED`.
The [SDK migration encoder](https://github.com/zerodevapp/sdk/blob/52b043007429c20b05aa3f08c005d32f5ec4697d/packages/core/accounts/kernel/createKernelMigrationAccount.ts)
starts with the historical validator and checks the active root separately. Its source is also
present in the installed SDK 5.5.10. This supports separating immutable creation inputs from
active validator state; it does not certify the helper or authorize deployment of a legacy root.
No independently established upstream security advisory, exploit assessment or member exposure
claim is made here.

[Pimlico's current Gnosis table](https://docs.pimlico.io/guides/supported-chains#gnosis) lists
EntryPoint 0.7 bundler/paymaster support and Kernel 0.3.1 as unsupported. A chain entry or policy
ID therefore does not prove acceptance of the selected account profile. No sponsorship request,
provider policy write, broadcast, impersonation, validator etching or lasting deployment occurred.

PRD-1096 and comments were read-only: its older “validator is the only missing piece” paragraph
is incomplete in light of the newly established migration and provider questions. RESR-73's
existing Done state is preserved; it does not certify member signing. The Linear field-note tool
was advertised but returned “Tool get_agent_context not found”; repository and primary sources
were used directly. No Linear record changed. COM-46 and all live/release gates remain open.

## Local characterization and validation

The existing owner-validator test now explicitly rejects the patched root, rejects a changed
chain before prompting, propagates a cancelled callback, and permits an exact approved retry.
The owner callback is a test double. These tests establish the current adapter's rejection and
error propagation, not human cancellation, WebAuthn possession, onchain migration or recovery.
Runtime code is unchanged, so there is no manufactured behavioral RED/GREEN claim. Test additions
exceed runtime additions because this is an unsupported-boundary characterization slice.

From the repository root:

```sh
PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH bun --no-env-file run --cwd packages/shared test -- src/__tests__/modules/agent-reporting/owner-validator.test.ts src/__tests__/workflows/auth-passkey-adapters.test.ts src/__tests__/config/pimlico.test.ts src/__tests__/settlement-aa-profile.test.ts
```

Observed **36/36** tests across four files, at baseline `0f4e62bae` with this test edit present.
This is working-tree evidence. Exact commands, provider responses, encoding/consistency scripts
and logs are under `/private/tmp/green-goods-member-migration-20261022/`. The public artifact
retains the reproducible inputs/results. Browser/session proof: **none**; no UI changed and no
authenticated member-signing proof is claimed.

The four-path QA selector passes **4/4 fresh**, zero reused/unrun: format, lint, Shared test/story
typecheck and the focused owner-validator file (**16/16**). Risk is sensitive because of plan
evidence; no mandatory critical override is selected for this test-only change. Lint checks zero
files under existing exclusions, so it adds no source lint coverage claim. The selector's exact
plan and argv are `selector-plan.json` and `selector-command.json` in that evidence directory.
The additional one-shot encoding and observation consistency checks pass; they are not member
authentication tests. No full contract or consumer suite is recertified by this bounded proof.

## Commit-attributed owner-adapter receipt

Source/test checkpoint `011d9b77dc0b68c245cdc4177c2fb682103a2fa4` is signed locally; Git
reports signature status `G`. A fresh post-commit run of the focused owner-validator command
above (only its first test path) passes **16/16**. The public artifact records the exact argv,
UTC timestamps, validation paths and empty pre/post status outputs. Those paths cover the owning
implementation/test, package manifests/lockfile, Vitest setup and test runner configuration.
The broader 36-test result remains working-tree evidence. The default sandbox still requires
scoped approval for the dedicated Git agent; signing remains required, with no key-file access.

This follow-up changes evidence only. Its receipt requires both the artifact's exact
`git diff --exit-code 011d9b77dc0b68c245cdc4177c2fb682103a2fa4..HEAD -- <validated paths>`
and `git status --porcelain=v1 --untracked-files=all -- <validated paths>` to be empty after
commit. No runtime/test/validation dependency changes are part of this follow-up.

## Next bounded proof

Obtain verifiable helper source/build provenance and upstream security guidance, or an explicitly
reviewed alternative migration design. Then prove owner-authorized same-address migration,
legacy-root disablement, wrong chain/account/payload rejection, failure/cancellation/retry and
recovery. In particular, prove whether EntryPoint account creation survives a later operation
execution failure; one UserOperation or an ephemeral Multicall3 success does not prove atomicity.
Keep the existing owner adapter and Gnosis auth rejection unchanged until the selected path has
that evidence. Actual intended-member signing and provider acceptance remain separate proofs.

Task record: cosmo-local-credit-interop | Type: investigation/proof | Outcome: bounded characterization complete; member signing unresolved
Agent/model: Codex / model identifier unknown | Coverage: this migration-characterization continuation only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Unknown → 2026-10-22 18:27:12 | Preparation alignment, pinned creation/source/provider observations; helper provenance remains unresolved |
| Verify | 2026-10-22 18:27:12 → 2026-10-22 18:27:15 | Four-file 36-test characterization pass; no runtime changes |
| Review / commit | Unknown → 2026-10-22T18:38:40.962765+00:00 | Signed source checkpoint `011d9b77d`; exact four-file tree and 186 unchanged working files verified; fresh committed 16-test owner receipt; no push/deploy |

Human corrections: 0 observed in this segment; attention: unknown.
