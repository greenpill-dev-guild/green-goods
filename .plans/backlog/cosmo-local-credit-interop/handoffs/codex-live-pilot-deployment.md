# Controlled live pilot deployment package

**Current target:** Saturday, 24 October 2026 Pacific. Deck Saturday; participant testing Sunday
and Monday, 25–26 October. This package is in preparation; no broadcast is claimed.

## Accepted release disposition

On 22 October Pacific, the human release owner selected live contract deployment for the
hackathon. External audit evidence and audit intake are outside this release's prerequisites.
The older two-week testnet waiting period is replaced by focused pre-deployment tests,
deployment simulation and post-deployment smoke checks. These decisions are resolved.

Existing Safe controls and implemented contract delays remain intact, including mandatory
48-hour upgrade scheduling where enforced. Preserve exact consent, escrow before activation,
and the holder-approved immutable delivered/refundable allocation. No waiver establishes an
endpoint, credential, signer, issuer approval, successful test or elapsed contract delay.

The repository's contracts CLI and phase-aware deployment workflow own simulation, execution,
artifact persistence and verification. Make the exact candidate reviewable before execution.
Keep Git signing and platform safeguards. Git publication, merging, new worktrees and unrelated
tracker writes are not added by this deployment dispatch. The preparation chat owns Linear updates.

## Selected boundaries

| Boundary | Required selection and present evidence |
|---|---|
| Arbitrum One, 42161 | Existing promises, consent/acceptance and voucher source integration; enumerate exact proxy upgrades, modules, peers and writer roles before simulation |
| Gnosis, 100 | One shared curated exchange pool; exact published token/pool/limiter/fee/index/quoter versions and integration endpoints must be pinned and verified |
| Celo, 42220 | Optional G$ remains independent; preserve current funds, routes and recovery without making a voucher receipt imply monetary settlement |
| Member identity | Preserve the same address across all three chains; canonical initializer changes that produce another address are not an accepted workaround |
| Authority | Record exact owner/admin/pause/recovery addresses and verify the owning workflow's Safe threshold/control policy; finite issuer allowances and pool administration grant no issuer minting or reserve authority |
| Issuer obligations | Tech and Sun and Green Goods each need versioned terms, service units, capacity, issuance/holding limits, reserve address, acceptance authority, presentment and remedy rules; issue status is not evidence of those facts |

## Current evidence and technical work

The reconciled application source is signed in `a6461989e`; its evidence is signed in
`f1ae06046`. All 31 selected automated runtime checks and the additional Storybook build pass
across their recorded runs. The Docs dependency and stale-projection blockers are resolved.
That evidence does not certify a new contract deployment or actual-member ceremony.

The same-address fixture uses Kernel 0.3.1 and EntryPoint 0.7. Eleven recorded Gnosis cases prove
patched-root dispatch, explicit removed-legacy rejection, signature binding and replay/retry
behavior at the original fictional address. The existing two-call native batch candidate is
insufficient to establish atomic credential cleanup: Kernel may disable a module while swallowing
its cleanup callback failure. Disabled authority and residual validator data require separate
observations. Helper runtime identity is recorded; source/build/privilege provenance is unresolved,
so that helper is not selected for deployment. Continue a source-backed native candidate proof
with actual execution, failure, retry and recovery before selecting migration operations.

A new isolated pinned-fork proof now passes nine cases for an ordered native candidate:
`changeRootValidator` self-call, explicit legacy `onUninstall` call from the account, then
`uninstallModule` self-call in default atomic batch mode. Direct cleanup must precede module
removal: the legacy callback rejects a second cleanup, which Kernel can ignore after the first
cleanup has already succeeded. Forced cleanup failure rolls back the migration; EntryPoint can
retain fresh account creation and consume the operation nonce. Next-nonce retry succeeds and
patched-root signing remains usable at the same fictional address. This selects no actual
member operation or hosted provider. Exact traces, dependency hashes and proof limits are in
the [native batch evidence](../artifacts/member-native-batch-execution-2026-10-22.json).

Published EntryPoint availability is distinct from acceptance of this exact account profile.
Configured hosted bundler/paymaster acceptance, actual member possession/ceremony, sponsorship
or selected funding, and recovery remain unproved. Do not invent or silently activate a provider.

Live COM-46 was In Progress when read on 22 October Pacific. Its description specifies required
issuer facts but contains no approved values or evidence references. The user confirmed these terms need to be defined, selected hub access and assisted sessions,
and added Claude access under a Green Goods team. The [working issuer terms](../pilot-issuer-terms.md)
now define proposed services, prices, capacities, supply/reserve/pool/allowance limits, booking,
partial delivery and remedies. The human release owner accepted the numeric baseline with assistance priced at two GG vouchers
per thirty minutes; actual
capacity, funded permitted Claude seats and public-safe control addresses remain unconfirmed.
Private issuer evidence and member identity data stay out of this public repository.

The contracts CLI now includes `release vouchers` for paused endpoint preflight, exact deployment
plans and owned-fork simulation, plus `release steward-safe` for the dynamic Tech and Sun Safe.
The dated tooling sections below record their proof and limits. Published CLC token/pool release,
live configuration, issuer approvals and activation remain separate work.

## Deployment inventory inspected in source

| New implementation / proxy | Network / authenticated peer | Initialization and build dependencies |
|---|---|---|
| `VoucherEntitlementModule` | Arbitrum / Gnosis adapter | Constructor router; initializer owner, distinct guardian, remote selector/chain/peer, existing pooling and Hats modules. No external library links in the inspected default artifact. |
| `GnosisVoucherAdapter` | Gnosis / Arbitrum entitlement module | Constructor router; initializer owner, distinct guardian, source selector/chain/module. Each reserve must call `configureAsset` itself and separately approve a finite allowance. |
| `VoucherRedemptionModule` | Arbitrum / Gnosis escrow | Constructor router; initializer owner, distinct guardian, destination selector/chain/escrow and compatible pooling module. External links: `VoucherServiceConsentLib`, `VoucherServiceResultLib`. |
| `GnosisVoucherEscrow` | Gnosis / Arbitrum redemption module | Constructor router; initializer owner, distinct guardian, source selector/chain/module. External link: `VoucherRedemptionTransfers`. |

`VoucherEndpoint` and `VoucherRedemptionReceiver` are abstract bases, not extra deployable
proxies. Each endpoint initializes paused, and each implementation disables direct initialization.
Router and local chain are constructor immutables. Remote peers are pinned during initialization;
plan both chains' predicted addresses and exact initialization data together. No placeholder peer
or owner address is an executable candidate.

The existing pooling surface owns `pinEarnedVoucherModule` and `pinVoucherServiceSetupModule`;
both require the owner while paused. Compare its deployed implementation and the personal-G$
SettlementModule against the reviewed source before choosing exact upgrade operations, linked
libraries and schedule/execute phases. Preserve existing Celo settlement deployments and routes;
this inspection does not select an unnecessary Celo redeployment.

The four new implementations, three externally linked voucher libraries, proxy creation and
initializers, existing source-module upgrades/bindings, reserve-origin authorizations, published
CLC factory/configuration operations, and final unpause each need explicit transaction boundaries
and readback. The inspected default artifacts identify link requirements; they are not the final
production-profile bytecode manifest. The voucher planner now binds production artifacts and
library links, and the network manager accepts an explicit Gnosis RPC. Its preparation/simulation
path does not execute source upgrades, reserve approvals, published CLC token/pool configuration
or final activation. The existing pooling release-stage schema covers Arbitrum/Celo; the complete
live Gnosis pool release still needs its own reviewed operations and readback.

## Safe selection: reuse and thresholds accepted; signer identities pending

On 22 October Pacific, the user selected reuse of the repository-named Green Goods Safe on
Gnosis: `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19`. The [read-only observation](../artifacts/green-goods-safe-gnosis-2026-10-22.json)
at block 48,895,536 records five owners, threshold two, reported version 1.5.0 and no enabled
modules. Keep its current owners/threshold. The user has not authorized a change to that Safe's
configuration, module set, allowances or custody through this selection. Refresh applicable
state and release verification before executing its transactions. Historical Arbitrum/Celo
owner lists and timelock dispositions remain historical inputs, not new pilot waivers.

The user subsequently selected the **same existing Green Goods Gnosis Safe** for network
exchange-pool administration and the GG issuer reserve, keeping its observed **2-of-5**.
This supersedes the separate 3-of-4 pool Safe and the proposed two delegates per organization.
No new GG Safe is needed; garden admission confers no network-administration seat. The two
inventory allocations remain separately accounted even though their controlling Safe is shared.
Tech and Sun retains authority over its own reserve and obligations.

Tech and Sun starts from the accepted **2-of-3** bootstrap. Its active garden stewards are the
intended signer source, replacing the earlier fixed service-lead/finance/backup proposal.
Actual signers remain unconfirmed. The latest user decision supersedes majority signing with
**two valid steward signatures regardless of roster size**. The dynamic implementation below
uses an ordered Arbitrum publisher and a dedicated Gnosis Hat with locked HSG v2. Funded role
hooks dispatch automatically; authenticated destination delivery makes changes effective on Gnosis.
No live Safe configuration, module, allowance or transaction has changed.

## Execution review and proof to complete

- Pin the reviewed source revision, compiler/build inputs, runtime hashes, networks and exact
  ordered operations; separate new paused deployment, upgrade scheduling and value activation.
- Bind actual issuer terms/caps, token and shared-pool controls, both transport directions,
  finite allowances, owner/admin/writer/pause/recovery roles, member account and gas policy.
- Run focused tests and exact simulation for success, wrong chain/owner/peer, exhausted or
  revoked allowance, partial transport outcome, retry, pause and rollback. Preserve existing
  Celo behavior and every implemented consent/escrow/final-allocation control.
- Persist the exact manifest and simulation result for the human execution review. Missing
  inputs remain explicit blockers for the affected operation, rather than fabricated defaults.
- After execution, persist receipts and read back code, implementation, owner/Safe threshold,
  peers, roles, caps, allowances, pause state and dependent app/indexer configuration. Run the
  bounded smoke and recovery checks before declaring the controlled live pilot ready.

Historical audit/soak requirements remain in earlier evidence for provenance. They do not apply
as hackathon prerequisites under this dated release disposition. Unrelated lane completion
states and the hub's overall backlog state are preserved.

## Task and phase record

Task: Cosmo-Local Integration controlled live pilot | Type: feature/investigation | Outcome: partial.
Agent/model: Codex / model unknown | Coverage: current release-policy, issuer-term and native-proof segment.

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate / implement | Earlier start unknown → 2026-10-23 03:56:53 | Current release disposition reconciled; earlier lane states preserved. |
| Investigate / implement | 2026-10-23 04:03:50 → 04:15:37 | Services selected; proposed numeric baseline drafted; Claude pricing and named-seat constraints checked against official sources. |
| Verify | 2026-10-23 04:03:50 → 04:14:05 | Nine native local-fork cases pass; wrong-order candidate fails as expected. Earlier trace assertion included initialization/validation calls; corrected to identify migration selectors. |
| Verify / review | 2026-10-23 04:14:05 → 04:15:37 | Selected QA format/lint 2/2 fresh; 34 Plan Hubs validate; 87 local links resolve. All nine proof source hashes match and all 114 unrelated file hashes remain unchanged. Selector lint processes no files under this Plan Hub; the executed fork proof owns behavior evidence. |
| Implement / verify | 2026-10-23 04:18:01 → 04:19:01 | Accepted baseline recorded with two GG vouchers per thirty-minute session; revised service-budget arithmetic and selected formatting pass. Safe creation/reuse remains for discussion. |
| Investigate | 2026-10-23 04:19:01 → 04:20:38 | Safe discussion requested; existing GG address found in repository and inspected read-only on Gnosis. Exact calls and limits are linked above. Creation/reuse remains unselected. |

Human corrections: 0 in this segment; service additions are scope decisions. Human attention: unknown.
Rendered proof: none in this segment; no product UI changed. No live broadcast, purchase or external tracker write.

### Safe governance decision segment

Task: Cosmo-Local Integration controlled live pilot | Type: guidance | Outcome: partial.
Agent/model: Codex / model unknown | Coverage: GG Safe reuse and new Safe governance discussion.

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Unknown → 2026-10-23 04:25:22 | Read current pilot terms, contracts threshold policy and official Safe guidance. |
| Implement / review | 2026-10-23 04:25:22 → 04:26:54 | Record accepted GG reuse; propose 2-of-3 Tech and Sun and 3-of-4 joint pool ownership. Named signers remain unselected; selected formatting passes, 34 Plan Hubs validate, links resolve and all 114 unrelated file hashes are preserved. |

Human corrections: 0 in this segment; attention: unknown. No Safe creation, configuration change,
transaction, external tracker write or new rendered proof in this guidance segment.

## Deployment tooling continuation, 22 October Pacific

The public entrypoint now includes `release vouchers --mode preflight|plan|simulate`. The owning
input is `packages/contracts/config/voucher-pilot-release.json`; accepted governance thresholds
are recorded, with unresolved addresses and nonce/router/source bindings explicitly null. The
preflight compiles eight exact production targets and reports missing deployment versus later
activation inputs. It does not read a secret file, contact an RPC or create an executable plan
from placeholder authority. `GNOSIS_RPC_URL` is explicit in the network manager, with no public
fallback or automatically chosen bundler/paymaster.

The planner binds an exact source commit, manifest/artifact hashes, production compiler profile,
linked libraries, chain-qualified senders, nonces, predicted CREATE addresses and atomic proxy
initializers. Eleven operations cover three libraries, four implementations and four proxies:
six operations on Arbitrum and five on Gnosis. CREATE address prediction avoids circular CREATE2
peer-address dependencies in the initialization data. Every initialized endpoint proxy stays
paused. Plans and simulation results are confined to `.generated/voucher-release`; canonical deployment artifacts,
indexer/app configuration and value activation are not changed.

Simulation reads selected upstream chains, then sends transactions only to owned isolated
loopback Anvil forks. It verifies chain/block pins, nonce freshness, dependencies, router peer
support, owner Safe threshold floor, creation receipts, production runtime templates, constructor
immutables, proxy implementation/owner/guardian/peers, paused state and rejected reinitialization.
Gas top-ups and owner impersonation are confined to that local fork. They prove no live sender
funding, signer possession, Safe configuration approval or CCIP round-trip delivery. The command
has no broadcast, private-key, signer, allowance or unpause mode.

Reuse review: `single-attestation-deployment.ts` owns a single non-linked CREATE, while the
existing pooling `release-manifest.ts` owns fixed Arbitrum/Celo CREATE2 stages. Neither covers
these mutually initialized Arbitrum/Gnosis peers. The new voucher capability reuses that
manifest's exact `linkBytecode`, the existing atomic release JSON writer and build wrappers.
The isolated fork lifecycle moved from `reporting-compatibility-boundary.ts` to the shared
contracts `isolated-fork.ts`, preserving its Arbitrum wrapper and adding the Gnosis consumer;
there is no second fork lifecycle implementation. Production artifact identity and input
validation remain voucher-owned. Dependencies, compiler profile, source contracts and release
safeguards were not weakened.

Focused RED/GREEN is retained in the local task evidence. The first RED is an absent planner
module. Runtime fixture failures used addresses in the precompile range; the fixture now uses
ordinary synthetic addresses and reads Anvil's auto-mined receipts directly. Exact-source
artifact validation also required updating the synthetic fixture metadata. The later focused
run passes 19 script cases and 32 CLI cases, including actual production-bytecode deployment.
The final focused run adds three source/output ownership cases: 22 script cases and 32 CLI
cases pass, and the contracts TypeScript check passes. Git dependency scope includes vendored
libraries and root build inputs, with Git repository/index overrides cleared for source identity.
JSON inputs and outputs reject symlink escapes. `env.schema` now names optional blank
`GNOSIS_RPC_URL`; no private environment file was read or changed.

The first selected critical gate passed eleven checks, including application suites, all 2,195
Solidity tests, the production gas boundary and contracts verification. It then failed
`docs-authority` on the generated entity-matrix source digest after the network metadata change;
the ontology generator refreshed that digest. The next full-scope run passed eleven checks,
including the previously unselected Agent checks, but exposed an immediate-receipt assumption
in the new simulator under the full contracts suite. A regression forces the first receipt read
to return pending: it fails before the fix and passes with bounded local polling. The revised
simulator retains status, created-address and runtime readback checks. All 22 focused script
cases and 32 CLI cases pass after the fix. The six-check selected contract rerun passes fresh,
retaining every critical override, including all 2,195 Solidity tests, three cold-path production
gas fixtures, all 349 contracts script tests and `contracts-verify-fast`. The four deferred
documentation/ontology checks also pass fresh, including documentation authority and the site
build. Contracts TypeScript passes after the receipt fix. Earlier application passes cover
unchanged inputs. No failed check is treated as reusable proof, and no broader live readiness
claim follows from local checks.

The shared exchange pool starts with the two pilot issuers and may admit more issuers later.
New gardens need not mint a voucher merely to participate. Expansion needs explicit curation,
capacity/terms, inventory, limits and governance representation; admission is not automatic.
Arbitrum garden commitment pools remain separate. Multiple independently governed exchange
pools are compatible with the protocol, but federation is outside the current executable slice.
See [current scope](../spec.md) and the [published network model](https://docs.cosmolocal.credit/protocol/network/).

Remaining work includes actual authority/transport inputs, published CLC token/pool/factory
operations, any needed existing-module upgrades/bindings, activation, dependency configuration
persistence and post-deployment smoke. The full deployment package is still incomplete.

Task: Cosmo-Local Integration controlled live pilot | Type: feature | Outcome: partial.
Coverage: accepted thresholds, pool scope clarification and paused endpoint deployment tooling
through pre-commit verification. Local signed checkpoint attribution is reported in the chat;
no push, broadcast, Safe creation or canonical deployment promotion is included.

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Earlier start unknown → 2026-10-23 04:33:30 | Read release owners, closest deployment/link/fork capabilities and primary CLC docs; parent-only Linear sync preserves RESR-73, observed Done. No external write. |
| Implement / verify | 2026-10-23 04:33:30 → 2026-10-23 05:18:33 | Exact planner, preflight and isolated-fork simulation implemented; focused tests pass. Full-scope checks expose generated documentation drift, then a receipt timing defect in the new simulator. |
| Investigate / verify | 2026-10-23 05:18:33 → 2026-10-23 05:27:57 | Deterministic pending-receipt RED/GREEN; bounded polling added. All six selected contract checks pass fresh with every critical override. |
| Verify / review | 2026-10-23 05:27:57 → 2026-10-23 05:28:46 | Four deferred docs/ontology checks and final contracts TypeScript pass. No owned source input changed during the contract rerun; all 114 unrelated dirty file hashes remain unchanged. |

Human corrections: 0 in this segment; attention unknown. Signer names/addresses deliberately
remain open under the user's instruction. Rendered product proof: none; no product UI changed.

## Unified GG Safe and steward-based Tech and Sun signers, 23 October UTC

Accepted scope: reuse GG Safe `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` for the network
exchange pool and the GG issuer reserve at existing 2-of-5. The public voucher draft and synthetic
fixture now record that same address/configuration for both governance roles. Tech and Sun
remains a separate issuer Safe, with intended signers drawn from active garden stewards.
No new Safe is created by these edits.

Research boundary: inspected `HatsModule` exact steward membership and grant/revoke hooks,
Garden authority, the existing Celo Garden-account Safe-owner fork spike, current voucher
release inputs and official Safe/Hats sources. `HatsModule` synchronizes Karma access and
conviction power; no production source integration was found that mutates a Gnosis Safe owner
list on steward grant/revoke. The Celo fork spike tests Garden-account plus recovery ownership;
it is not a dynamic Gnosis steward-signer implementation.

[Hats Signer Gate](https://github.com/Hats-Protocol/hats-zodiac) supports role eligibility,
revocation enforcement and configurable thresholds, and is a candidate rather than a selected
integration. [Ordinary Safe owner updates](https://help.safe.global/articles/9629761095) use
approved transactions. Arbitrum role authority must reach Gnosis through a verified, ordered
mechanism before automatic signer synchronization is claimed. A revoked source role may remain
valid at the destination until an authenticated update is applied; no instant cross-chain
revocation claim is made. All eligible signing accounts also need Gnosis-compatible signing
proof. No dependency/module installation or new runtime behavior is authorized by this research.

The user selected strict-majority active-steward signatures with a minimum of two; see the
formula in [current scope](../spec.md). This keeps the initial 2-of-3 snapshot and yields 3-of-4
or 3-of-5 as the confirmed roster grows. Fewer than two eligible signers blocks spending; no
silent one-signature fallback or platform recovery signer is added. Signer identities remain
deliberately deferred. Source membership must be verified, rather than trusting a display-only
or stale indexed roster. These are selected rules for the future integration, not current
Gnosis Safe enforcement.

Focused voucher proof passes 18 script cases and all 32 CLI checks. All six selected checks
pass fresh, including every mandatory contract override, all 2,195 Solidity tests, 349 contracts
script tests, cold-path production gas proof and `contracts-verify-fast`. No contract source,
compiler profile, dependency, live Safe state or application runtime was changed. The later
majority-policy update is confined to planning prose; the tested manifest and fixture remain
unchanged at the accepted same-GG-Safe values and initial Tech and Sun 2-of-3 snapshot.

Task: Cosmo-Local Integration controlled live pilot | Type: guidance/configuration | Outcome: partial.
Coverage: unified GG custody decision and bounded steward-signing research; dynamic owner sync
remains unimplemented.

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Earlier start unknown → 2026-10-23 06:07:56 | Read current roles/Safe capabilities and primary sources; no current dynamic Gnosis owner sync found. |
| Implement / verify | 2026-10-23 06:07:56 → 2026-10-23 06:17:52 | Same-Safe draft/fixture aligned; 18 focused script cases, 32 CLI cases and all six selected critical checks pass fresh. Human selects strict majority with a minimum of two; no automatic signer sync implemented. |

The majority-policy prose follow-up passes its selected formatting check; all 34 Plan Hubs
validate and changed links resolve. The tested manifest and fixture content hashes are unchanged.
Coverage ends at pre-commit verification; signed local checkpoint attribution is reported in chat.

Human corrections: one governance simplification; attention unknown. Existing lane objects and
overall backlog are preserved. Rendered product proof: none; no product UI changed.

## Dynamic steward Safe implementation, 23 October UTC

User explicitly dispatches implementation and replaces majority policy with fixed two. Reuse
the deployed Gnosis HSG v2.0.0 (upstream commit `2c0172e979e64f6f73647adc634a4622cba465ef`),
canonical Hats and HSG-created SafeL2 1.4.1. The seven dependency code hashes are checked onchain
by the receiver constructor. The existing GG Safe version/control policy is untouched.

Source roster changes retain the existing HatsModule permissions: a garden owner or steward
can grant or revoke roles. Two signatures govern issuer Safe transactions; this implementation
does not add a second approval for changing the source steward roster.

The source publisher reads exact HatsModule steward membership and the pinned operator Hat.
Source hooks queue canonical revisions and automatically dispatch with bounded best-effort
callbacks when native CCIP fuel is available. Unknown non-stewards and already-dispatched
revisions cannot drain the balance. Failed quoting/send preserves queued state; any caller can
refresh to retry, or pay the exact quoted fee directly. Direct dispatch refreshes immediately
before sending. Initial stewards need refresh after observer registration. Same-version conflicts reject; older
updates cannot resurrect a revoked signer. The destination owns its dedicated top Hat and
immutable signer Hat. It creates HSG and Safe atomically, disables all three default delegatecall
targets and irreversibly locks config. HSG is the sole Safe module and guard, with no submodules.
Mirror authority commits before a bounded, retryable reconciliation call. Explicit false
eligibility survives failed cleanup; it does not rely on Hats' reverting eligibility fallback.

The new `release steward-safe` preflight/plan/simulate operation binds production artifacts,
source commit, exact deployer nonces/peers and expected next top Hat. It prepares observer
registration separately without executing it. Simulation owns each loopback fork, verifies
runtime/immutable readback and the locked zero-signer Safe state, then closes its processes.
No signer input, live broadcast, observer registration or activation exists in this operation.
Existing `upgrade hats-module` owns source upgrade preparation. The public manifest deliberately
leaves actual garden, source Hat/module, routers, deployers/nonces/top Hat and signer accounts pending.

Initial direct proof: source/hook cases and actual deployed Gnosis Hats/HSG/Safe cases
pass at block 48,897,095 (observed public block hash
`0xc7c8062a4b2f5ea5fe60c67f985e966d8eec60b7cd3ab33ad90b78d2eb9182e3`).
These exercise fixed-two with two/three/five stewards; one/zero signer blocking/recovery;
reordered/duplicate/conflicting delivery; wrong transport/domain; cleanup failure and locked
Safe configuration. Transport and source roles are fictional. Final proof is recorded below.
Rendered proof: none (contracts/tooling only).

Live prerequisites: confirmed compatible signer accounts; source HatsModule upgrade and
observer registration; exact endpoint/router/nonce/top Hat inputs; funded event dispatch and
refresh operations; real CCIP delivery/readback; at least two valid signers; integration of the
resulting Tech and Sun Safe into issuer/pool release inputs. The complete CLC live pool/token
release, member ceremonies and other recorded issuer/provider gates remain open. No extra GG Safe.

Final local proof, completed 23 October UTC:

- The 35-path critical QA plan selected nine checks. The full run passed formatting, lint,
  ABI artifacts, contract build, package tests and `contracts-verify-fast`, including all four
  mandatory critical overrides. Its documentation authority check detected a stale generated
  integration digest after the final source edit. Regeneration changed only generated data;
  the docs-only follow-up passes formatting, authority and build, and the exact selected
  ontology command passes separately. All nine selected check IDs are satisfied across these
  runs. No failed check or cached receipt is counted as a pass. Runtime contract and tooling
  content hashes are unchanged since the six passing checks. Staging removed one trailing
  blank line from a test fixture; its final focused proof is reported in chat.
- `bun run --cwd packages/contracts test` passes 2,209 Solidity cases, three production cold-path
  gas cases, 33 CLI cases and 361 script cases. The focused release/simulation group passes
  19 cases. Contracts typecheck and the 16 existing ABI exports also pass.
- `FOUNDRY_PROFILE=production GNOSIS_RPC_URL=https://rpc.gnosischain.com bun run --cwd
  packages/contracts test --suite solidity --profile match -- test/fork/GnosisStewardSafe.t.sol`
  passes all nine cases, including 1,000 explicit-denial fuzz runs, actual Safe transfers and
  the funded source-hook lifecycle. Hats, HSG and Safe are deployed Gnosis dependencies;
  source Hats, router, delivery and signer keys are fixtures. This is not a live CCIP proof.
- The production-profile Arbitrum upgrade rehearsal passes at block 517,467,166, hash
  `0x1f501796cafe2a53083f5e64f426e426d8e7f1216fd5d6086a8dc54de2a23adf`, preserving all 18
  gardens and their current state. The original implementation is
  `0xe5e5cbeda7dc1139af2e04bd4a6784b42b4becd2`. The command is the same Solidity match wrapper
  targeting `test/fork/ArbitrumHatsModuleUpgrade.t.sol`, with public Arbitrum RPC and
  `HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER`, `HATS_MODULE_UPGRADE_GARDEN_COUNT` and
  `HATS_MODULE_UPGRADE_EXPECTED_IMPLEMENTATION` set to those values. One invocation failed
  before execution because the garden-count variable was misnamed; the corrected run passes.
- `bun run --cwd packages/contracts check:storage-layout --contract HatsModule` passes.
  Every pre-existing non-gap field is unchanged; the observer uses slot 166, and the reduced
  gap still ends at slot 200. `bun run --cwd packages/contracts check:sizes` passes for every
  deployable contract: HatsModule 16,424 bytes, receiver 4,449 and publisher 3,898.
- The Gnosis deployment-tooling rehearsal also passes against actual destination dependencies
  at block 48,897,471, hash
  `0x3b8df66351b812d0138b4f47b072d735bb6ffab024291cc1fe5fddf290e6253a`.
  Its source/router and gas are fictional; only process-owned forks receive transactions.
  The resulting Safe is locked with zero valid signers, effective threshold two, physical
  threshold one and spending disabled. The synthetic upstream remains unchanged.

The source and hook tests first failed before their APIs existed. Automatic funded dispatch
has a behavioral RED of two failures/seven passes before implementation and a final ten-case
publisher GREEN. Intermediate formatting and generated-data drift were corrected; interrupted
or failing runs are retained as such in local evidence. No dependency, compiler profile,
permission, CI or agent-instruction change is included. The public release
input, CLI registry, storage baseline and generated docs are the sensitive owned configuration
changes. All 114 unrelated file hashes and every original lane object remain unchanged.

Proof ran on the working copy above parent `d2c2e1d34f3694e4a6b2d7ddf3127b109a34d31d`;
source content hashes bind it to the staged/committed tree. Signed checkpoint attribution and
post-commit tree verification are reported in chat. No remote CI, publication or live readiness
is claimed. The local implementation is complete; the broader live pilot remains partial.

Task record: cosmo-local-credit-interop live pilot deployment | Type: feature | Outcome: complete locally; live pilot partial
Agent/model: Codex / GPT-6 | Coverage: dynamic Tech and Sun steward Safe implementation

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | Earlier start unknown → 2026-10-23 06:39:11 | Primary HSG source/deployed binary fit; fixed-two and authority boundaries recorded. |
| Implement | 2026-10-23 06:39:11 → 2026-10-23 07:34:59 | Publisher/receiver/Hats observer and deployment tooling; direct RED/GREEN logs retained privately. |
| Verify | 2026-10-23 07:05:08 → 2026-10-23 07:53:03 | Required check IDs, final Gnosis/Arbitrum forks, size/storage and source hashes verified above. Intervals overlap; do not sum them. |
| Review | 2026-10-23 07:36:57 → 2026-10-23 07:53:03 | Source, callers, failure/recovery and owned diffs inspected; final notes/index/signature checks are reported in chat. |

Human corrections: 0 in this segment; attention: unknown. Rendered proof: none (no product UI change).
