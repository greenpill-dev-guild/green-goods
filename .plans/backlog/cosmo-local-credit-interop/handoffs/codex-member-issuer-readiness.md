# Member signing and issuer readiness — 22 October 2026

The bounded local investigation establishes matching address calculation and a concrete Gnosis
deployment blocker. It does not establish member signing, sponsorship, recovery or issuer readiness.
Both organizational issuers remain unverified for live use. No contract, auth configuration,
provider policy, issuer authority or release gate changes in this slice.

The user dispatched this proof after the safeguards reconciliation and now requests local signed
commits. This supersedes the previous uncommitted-only instruction. Required signing remains
enabled; the permission profile still prohibits keyring access, and the user previously selected
terminal signing. No unsigned commit, signing bypass, push, broadcast or external record write is
authorized. Preserve all unrelated work and the separate Portuguese translation hunk.

The prompt-preparation chat checked the current eval, handoffs and live COM-46 and confirmed these
acceptance criteria. It reported no newer human product decision. Its independent design prompt
does not authorize a new issuer identity, cap-growth or steward-suspension mechanism.

## Account evidence

[Public RPC observations](../artifacts/member-readiness-2026-10-22.json) retain the exact fictional
initializer, factory call data, provider results, block identities, code hashes and source hashes.
Reads use the user-approved Green Goods Alchemy app. No API key is in the artifact.

The installed application uses permissionless **0.2.57**, viem **2.55.13**, Kernel **0.3.1**,
EntryPoint **0.7**, the default meta-factory and salt zero. The fixture uses a fictional credential
ID and the P-256 generator, with relying party `greengoods.test`; it is not a member credential.
SDK encoding uses an explicitly absent-code sentinel seam only to obtain factory arguments without
deploying. All derived addresses and deployment outcomes below come from separate live `eth_call`
reads. Production account construction remains the owning interface; no validator is replaced.

| Facet | Observed result | What remains required |
|---|---|---|
| Derivation | Same initializer/salt calculates `0x9546b80b2faf5d5a9905c752d26b60296d6bc305` on Gnosis, Arbitrum and Celo | Repeat for the intended member's approved public account configuration; this fictional result proves no member control |
| Gnosis account dependencies | Factory, meta-factory, implementation and EntryPoint have code; provider-reported EIP-1186 code hashes recorded | Independently reviewed deployed configuration before any activation |
| Gnosis deployment | Validator `0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd` and calculated account have no code; direct factory and actual SDK meta-factory deployment simulations revert | Separately authorized validator/account resolution and a fresh same-configuration proof |
| Control simulations | The same direct-factory deployment simulation returns the calculated address on Arbitrum and Celo | These read-only calls establish neither a deployed account nor a signature |
| Actual member ownership/signing | Blocked/unproved; no real member credential or authenticated signing ceremony used | Intended member controls the exact holder through the supported auth path; verify account validation and operation binding |
| Sponsorship/bundler | Current app rejects chain 100 before account construction; a policy ID alone creates no Gnosis support | Approved Gnosis client/configuration, provider coverage and actual bounded sponsorship proof, with failure handling |
| Cancellation/recovery | Existing local tests retain failed credential requests, exact scope/root checks and immutable service recovery | Actual member cancellation, sponsorship failure and account recovery on the selected Gnosis path remain unproved |

Observed pins:

- Gnosis 100: **48,879,904**, `0x5cc7eb248665630e577083f0f0cff84adb6794ebd77812ef9e007d616769e6e7`.
- Arbitrum 42161: **517,143,304**, `0x493fa260b7b5b48bf6033d9beba2ba0f4f884d7e9135614cc320f411a8d4c183`.
- Celo 42220: **80,749,053**, `0xdff8cdf07d55996fe5ebe4fbbe99462077fe12dd7e43d01554f076ef844e99fe`.

These are pinned live read observations, not a newly executed fork suite or finality certificate.
The connector suppresses revert data: this fresh read proves an execution revert, not a decoded
`InitializeError()`. Earlier named-error evidence remains dated. Large implementation/EntryPoint
code reads were truncated; their identities use complete `eth_getProof` code-hash responses instead.
Merkle paths were not independently verified. Complete factory/meta-factory bytecode hashes match
their provider-reported hashes. Arbitrum/Celo validator bytecode hashes are retained separately.

No etching, Safe impersonation, spend-capable production signature, sponsorship request or live
transaction was used. Safe custody remains a distinct model. Browser/session proof: **none** in
this slice. Earlier Brave mock-auth and Storybook evidence stays labeled as rehearsal/rendered
proof, and cannot stand in for a member signature.

## Issuer evidence

Live [COM-46](https://linear.app/green-goods/issue/COM-46/agree-voucher-terms-and-capacity-for-both-pilot-issuers)
was **Todo**, updated **2026-10-21T19:58:05.541Z**, with no comments or attached approval documents.
The bounded Linear document search returned no issuer evidence record. The user then confirmed:
**no approved evidence yet; record the gaps**. Real terms, capacity, cap, authority and approval
evidence remain prerequisites for each issuer. No private signer details were requested or published.

| Required evidence | Tech and Sun | Green Goods |
|---|---|---|
| Exact approved terms version, services, units and price basis | Unverified | Unverified |
| Actual deliverable capacity and issuance cap | Unverified | Unverified |
| Earning/purchase eligibility and meaning of mutual pool holding limits | Unverified | Unverified |
| Presentment, delivery, partial/non-delivery, cancellation, discharge, complaint and remedy | Unverified | Unverified |
| Responsible issuer identity and private Safe/controller/upgrade verification reference | Unverified | Unverified |
| Named accountable human approval of that exact version, or explicit no-go | Unverified | Unverified |
| Separate participant and publication consent | Unverified | Unverified |
| Cash-out boundary in agreed terms | Rehearsal-only swap-back; no live approval proved | No cash-out; no live terms approval proved |

Fictional fixtures, finite reserve/allowance tests and successful token transfers establish none of
these real service or approval facts. Keep available reserve/allowance, accepted undelivered
rewards, outstanding service obligations/capacity and pool-local holding limits distinct. Cap
increases need an explicit issuer decision with evidence. No automatic reputation formula is chosen.

COM-46 also requests gardener admission checks, required published terms, initial cap/growth policy
and jurisdictional legal review. Those unresolved mechanisms remain separate from assessing these
two organizational issuers. Do not close COM-46 or the wider lifecycle from this matrix.

## Local validation and attribution

Three existing test files now explicitly protect the unsupported boundary: chain-100 delivery
remains disabled; primary auth rejects Gnosis before factory/client construction; and a configured
policy ID cannot create Gnosis public, bundler or paymaster clients. Runtime code is unchanged.
These are characterization tests of deliberate rejection, not a manufactured failing RED or proof
that unsupported signing works. This proof adds test lines without runtime lines for that reason.

From the repository root, with the existing no-env Bun shim:

```sh
PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH bun --no-env-file run --cwd packages/shared test -- src/__tests__/settlement-aa-profile.test.ts src/__tests__/config/pimlico.test.ts src/__tests__/workflows/auth-passkey-adapters.test.ts src/__tests__/workflows/authPasskeyOwner.test.ts src/__tests__/modules/agent-reporting/owner-validator.test.ts src/__tests__/service-access-voucher-recovery.test.ts

PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH bun --no-env-file run check --plan -- --intent qa --changed packages/shared/src/__tests__/config/pimlico.test.ts,packages/shared/src/__tests__/settlement-aa-profile.test.ts,packages/shared/src/__tests__/workflows/auth-passkey-adapters.test.ts --test-path shared:src/__tests__/config/pimlico.test.ts --test-path shared:src/__tests__/settlement-aa-profile.test.ts --test-path shared:src/__tests__/workflows/auth-passkey-adapters.test.ts --json

PATH=/private/tmp/green-goods-local-integration-20261021/bin:$PATH bun --no-env-file run check -- --intent qa --changed packages/shared/src/__tests__/config/pimlico.test.ts,packages/shared/src/__tests__/settlement-aa-profile.test.ts,packages/shared/src/__tests__/workflows/auth-passkey-adapters.test.ts --test-path shared:src/__tests__/config/pimlico.test.ts --test-path shared:src/__tests__/settlement-aa-profile.test.ts --test-path shared:src/__tests__/workflows/auth-passkey-adapters.test.ts
```

Observed: **42/42** tests across six files; selector **4/4 fresh**, zero reused/unrun, including
Shared test/story typecheck and **20/20** tests in its three-file subset. Selector risk is routine,
with no mandatory critical override for these test-only additions. Biome lint reports zero files
under existing test exclusions; this is not a new lint coverage claim. Initial selector format
failure and its three unrun dependents are retained; formatting was corrected without runtime edits.

One-shot SDK encoding and observation consistency checks pass. Raw provider responses, the encoding
script, exact selector plan, failed/final logs and full proof files are retained locally under
`/private/tmp/green-goods-member-readiness-20261022/`. No durable runtime tool is added.

The six-path plan/handoff selector passes **1/1 fresh** (format), and these additional commands pass:

```sh
node scripts/harness/plan-hub.mjs validate
node scripts/quality/check-guidance-links.mjs
git diff --check
```

Observed: **34 feature hubs**, **94 guidance files**, no diff whitespace errors. The existing
DL-042 stale-decision warning remains; no decision or baseline is changed to suppress it.

All 134 non-plan inputs from the prior 140-path safeguards receipt still match their recorded
hashes. Its six mandatory/component passes and fork/size/storage/consumer results remain historical
working-tree evidence; this slice does not recertify them as a current commit receipt. HEAD remains
`e7cd49d6df2b0fdf0ece8ac5dd994d2ebb2effd5` until human signing. No commit-attributed proof is claimed.

## Local signed checkpoint handoff

The local checkpoint patch covers the prior 140 reviewed safeguard paths plus these five new
test/proof paths. Its exact 145-path manifest and patch hash are in
`/private/tmp/green-goods-member-readiness-20261022/checkpoint-manifest.json`; the patch is
`checkpoint.patch` beside it. The Portuguese `ownerOnly` translation is excluded from the selected
blob and remains in the working tree. All other concurrent paths are excluded. The current index
is left untouched and no new commit is claimed.

The user-terminal helper checks the branch, checkpoint HEAD, exact file/patch/hook hashes, empty
index and required signing before staging the exact patch. It uses a temporary copy of the current
Husky hooks, preserving the identity check, real lint-staged formatting tasks and all other hooks.
Its only adapter runs lint-staged with `--no-stash --no-hide-partially-staged` and restores the
previously selected partial index blob after those tasks. Unexpected files, mutations or failures
stop the commit. No persistent hook/configuration or signing change is made. Three disposable Git
fixtures pass: whole-file restaging preserves the selected partial blob; task failure propagates;
and an unexpected staged file is rejected. No fixture commit or stash is made.

Candidate formatting also passes without changes: 96 selected JS/TS/JSON paths, 95 files checked
under the existing formatter configuration. Its exact argv and output are retained in
`checkpoint-format-command.json` and `checkpoint-format.log` beside the patch.

From the user's terminal, after reviewing the patch/manifest:

```sh
python3 /private/tmp/green-goods-member-readiness-20261022/commit-reviewed-checkpoint.py --commit
```

Without `--commit`, that helper performs only read-only checks. The agent cannot perform the
signed step because the permission profile forbids keyring access. After signing, re-read the
actual commit/index and obtain fresh scoped receipts before attributing validation to that SHA.
No Push Gate, remote CI, publication or release readiness is claimed by this handoff.

## Next bounded action

Resolve the Gnosis account prerequisite through a separate, reviewed deployment/configuration
decision; then dispatch actual member ownership/signing, payload/chain/account rejection,
cancellation, sponsorship and recovery proof through the authenticated supported path. Obtain the
approved private issuer evidence reference and exact versioned human dispositions for each issuer.
Keep all Safe/timelock, audit, testnet, rollback, transport and release gates open.

Task record: cosmo-local-credit-interop | Type: investigation/proof | Outcome: partial
Agent/model: Codex / model identifier unknown | Coverage: member/issuer proof continuation only

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Unknown → 2026-10-22 06:18:33 | Fresh account dependencies and three-chain calls; read-only COM-46 and preparation alignment |
| Implement | Unknown → 2026-10-22 06:19:44 | Explicit unsupported-boundary tests; no runtime configuration changes |
| Verify | 2026-10-22 06:19:44 → 06:29, exact end unknown | Six-file 42-test pass; initial formatting failure corrected; four-check selector passes fresh |
| Wait | Unknown → end unknown | User confirmed no approved issuer evidence yet; record gaps. Gnosis signing prerequisite and terminal signing remain open |
| Review / verify | Unknown → 2026-10-22 06:47:52 | Plan/link checks, candidate formatting and three disposable partial-index cases pass; exact local signed-checkpoint handoff prepared |

Human corrections: 0 observed in this segment; attention: unknown.
