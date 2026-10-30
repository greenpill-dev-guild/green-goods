# Local branch blockers and readiness continuation — 22 October 2026

The user authorized fixing the two contract source-size failures and three missing Admin stories,
then continuing member-signing and issuer-readiness proof. Work stays on
`feature/cosmo-local-contracts`, with required signed local commits and no push or deployment.
The starting checkpoint is `efa04cc52ddf5123e19997084f207d6aa137ea57`; its index was empty.
Concurrent Admin, auth, public-site, plan and translation work remains outside these fixes.

## Scope and implementation boundary

The source checker reproduced 387 lines in `GnosisVoucherEscrow.sol` and 389 in
`VoucherRedemptionModule.sol`, above the 350-line new-source limit against refreshed
`origin/develop` (`d7bbbf00d6af63f39a1aea6fe84fb6f2bbcc72be`). Required Storybook coverage
reproduced 309/312, missing `AdminStartupConnect`, `AdminWorkspace` and `ConnectPrompt`.
These are observable RED gates, not new failing economic behavior tests.

Existing contracts own the public API, frozen layout, access checks and transport. Cohesive
internal libraries now own immutable setup-record/outbox authoring and final-allocation/custody
transitions. The compiler probe rejected moving public declarations into abstract bases:
concrete-qualified error names fail and ABI `internalType` metadata changes. Keep declarations
in the concrete contracts and compare complete ABI plus recursive storage before and after.
The extraction must introduce no new authority, storage, deployed library link or economic rule.
Deleting either internal library would return its full transition rules to the existing owner;
this is an in-process responsibility split, not a new integration seam.

Admin stories exercise the existing components without editing their concurrent implementation.
Storybook fixtures substitute auth facts, wallet-modal state, analytics and production routing
only as needed for isolated composition. Rendered rehearsal never proves member signing.

The prompt-preparation chat confirmed the settled direction and no newer conflicting human
decision: vouchers first; optional independent G$ on Celo; one shared curated Gnosis exchange
pool; same member address across chains; exact consent, escrow, acceptance, activation and final
allocation safeguards. New Celo purchase escrow, standing approvals and timed completion remain
unselected. No external issue was edited.

## Fresh member and issuer observations

[The refresh artifact](../artifacts/member-readiness-refresh-2026-10-22.json) records reads through
the user-selected Green Goods Alchemy app at Gnosis block **48,891,789** (`0x2ea078d`), hash
`0xfd0e17aa567fda74e3f9bbc82d5e08f101bea5d05de848ac12f8a2e4ce5a5cd6`.
The recorded WebAuthn validator and fictional derived account still have empty code. The
unchanged fixture derives the same address; direct and meta-factory simulations both revert.
The connector omits revert data, so the exact revert cause was not freshly decoded.

[COM-46](https://linear.app/green-goods/issue/COM-46/agree-voucher-terms-and-capacity-for-both-pilot-issuers)
is now **In Progress**, updated **2026-10-22T22:08:16.562Z**, with no comments, attachments or
documents. Its revised description agrees with the current inventory, allowance, pool and
explicit final-allocation boundaries. Process status establishes no issuer approval. The user's
previous answer remains authoritative: no approved private evidence yet; record the gaps.

Both issuers still need exact terms/version, actual prices and capacity, issuance cap, eligibility,
remedies, accountable approval, participant/publication consent and private Safe/controller
verification references. Preserve available reserve, finite allowance, accepted undelivered
rewards, outstanding service obligations/capacity and pool holding limits as separate concepts.
No real issuer service or signer commitment is invented.

Actual member possession/signing, Gnosis provider/sponsorship/recovery, helper source/build/security
provenance and all live release gates remain open. The earlier matching-address fixture and
27-case local migration failure matrix remain historical evidence with their stated limits.
Neither Safe custody nor software fixture signatures establish member passkey control.

## Validation and phase record

Both source gates are repaired: escrow **341** lines, source module **342**, and the internal
libraries **90/107**, with no allowlist change. Complete compiled ABIs (127/93 entries), method
identifiers and recursive linear layouts (24 entries each) match the originals. Existing v2
namespaces are unchanged and no new deployed library link is required. Production compiler
artifacts independently match the ABI/layout comparison. Escrow **24,202** bytes and source
**24,000** fit EIP-170 with 374/576 bytes of headroom; every other deployable artifact also passes.
All protected storage and namespace baselines match.

The full checkpoint selector passes **13/13 fresh**, zero reused/unrun, including every mandatory
contract override, source structure, supply-chain, story quality, Storybook build and agentic
readiness. Both package/verifier phases pass **2,195 Solidity**, **3 production G$ gas**,
**31 CLI** and **331 script** tests. Focused voucher tests pass **112/112** before and after.
The first run caught the new startup story's callback dependency; it was corrected without
suppressions. The next run reached an EPERM block on disposable loopback chains (320 script
passes, 11 not executed); the unchanged selected plan passed with scoped approved loopback
execution. Default permissions and repository harness settings remain unchanged. Solhint retains
288 warnings, including two new memory-safe selector-revert warnings needed for exact public ABI
compatibility; no diagnostics are disabled. Probe/draft failures remain recorded.

Pinned Gnosis execution passes **57/57** across reserve (9), purchase (22), redemption (10) and
connected pilot (16), chain 100/block **48,848,261**. It preserves eight CLC runtime identity
assertions at published artifact/documentation revision
`ce090fd3d5a7493c726fb939da39af15ef1c9d7c`. The read-only loopback relay reuses genuine earlier
pin/cache responses; no new connector queue read was needed. Fresh local execution is not fresh
independent verification of all Gnosis state, live DON delivery or member signing. Solidity
0.8.28, Foundry 1.7.1, Cancun, fork viaIR/optimizer 200/fuzz 32; production viaIR/optimizer 1;
normal package fuzz 1,000. No dependency or lockfile change.

Required story coverage is **312/312**; quality passes **279** files. The static gallery builds
**434 components / 2,322 stories / 44 groups**. Nine new stories render actual components.
**Brave extension / Storybook fictional rehearsal** proof covers all six startup states, enabled
and disabled prompt actions, and actual workspace/provider/shell composition. The workspace uses
a substituted route entry, synchronous real English catalogue and inert analytics; asynchronous
production boot is outside proof. Fresh workspace render has zero console errors. The earlier
missing-catalogue fixture errors were corrected without changing runtime or locale files.

The three Admin component implementations were pre-existing untracked concurrent work and remain
untouched and excluded from this task's commits. Story compilation/rendering depends on those
working-tree inputs. A story-only commit is not a reproducible standalone production boot receipt.
The extra preview registrations and helper are Storybook-only, preserve spy defaults and reset
overrides after the story. No application auth or provider policy changed.

Six current member boundary/recovery files pass **45/45**; the fresh validator/factory and COM-46
observations above still leave actual member and issuer readiness unproved. Next bounded proof
requires reviewed Gnosis dependency/helper provenance and a supported provider path before the
actual member's signing, cancellation, sponsorship and recovery ceremony. Each issuer must supply
an approved private evidence reference and accountable versioned disposition. Do not invent these
inputs or treat a Safe fallback as member control.

The [validation record](codex-blocker-repair-validation.json) retains every selected reason,
command, configuration, public input hash and proof limit. Exact full outputs remain under
`/private/tmp/green-goods-blocker-repair-20261022/`. Evidence is working-tree execution with
reviewed source-blob attribution; concurrent inputs preclude a clean whole-commit receipt.
No full lifecycle, publication or release readiness is claimed.

Final record-only QA passes **1/1 fresh**; Plan Hub validation passes **34** hubs and guidance
links pass **94** files. Existing DL-042 stale-decision warning remains. Post-commit Brave workspace
render at **23:37:59 UTC** remains usable after the static build, with zero console errors.

## Signed local slices

- `6168fca1d38a0049f0dc56e3ce90eabda2b57167`: contract decisions/custody extraction, four paths.
- `38d93d03a33aaa358cd9c59c5696318ad478c5c2`: actual Admin stories and Storybook-only mocks, five paths.

Both signatures verify **G**. Their staged and committed blobs equal the reviewed working copies;
all 41 public source/configuration proof hashes remain unchanged after hooks. The evidence record
follows those source slices. Required SSH signing stays enabled. The dedicated agent socket uses
scoped approved execution; private keys were not read. A temporary exact hook copy preserves the
identity check and runs the existing lint-staged tasks with `--no-stash --no-hide-partially-staged`.
Persistent hooks and sandbox configuration remain unchanged. Unrelated and partial translation
work is excluded. No push, PR, deployment, broadcast, live transfer or tracker write occurred.

Task record: cosmo-local-credit-interop | Type: fix/proof | Outcome: local blockers repaired;
member/issuer readiness partial with explicit open gates
Agent/model: Codex / exact model unknown | Coverage: source-size, Admin stories and readiness refresh

| Phase | Start → end (UTC) | Result |
|---|---|---|
| Investigate | Start unknown → 23:03:51 | Both branch gates reproduced; refreshed Alchemy and COM-46 observations |
| Implement | Start unknown → 23:15:17 | Bounded contract and story fixes frozen; no runtime auth changes |
| Review | Start unknown → 23:15 | Root and independent read-only review; exact error/ABI/layout compatibility |
| Verify | Start unknown → 23:34:49 | 13/13 fresh selector, storage/size, 57 pinned cases and 45 member-boundary tests |
| Commit | 23:36:31 → 23:36:50 | Two signed source slices verified; this evidence record follows |

Human corrections: 0 observed in this segment; human attention: unknown.
