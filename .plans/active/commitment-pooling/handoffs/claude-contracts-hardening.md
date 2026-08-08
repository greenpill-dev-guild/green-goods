# Handoff — Commitment Pooling contracts: resolvers, cross-chain approach, hardening

Written 2026-08-06 at the end of the session that completed the 86 frozen selectors and the
Arbitrum One fork rehearsal. This is the session prompt for the follow-on work.

---

Continue the PRD-721 follow-on contract work in `~/Code/greenpill/green-goods`, on branch
`feature/build-commitment-pooling-contracts`. Do not create or switch branches — this repo runs
concurrent agent sessions on one tree.

## State

The contracts are complete. All 86 functions in the frozen `ICommitmentPoolingModule` resolve on
the compiled `CommitmentPoolingModule` ABI — verified against the artifact, not by reading source.
Eleven commits landed (`a5f78ea76..f005f7202`): term edits and reward record, work unlink and
decision catch-up, atomic bilateral exchange, canonical recognition snapshot, module-native
commitment series, the deploy/schema/upgrade toolchain, an artifact-path fix, the Arbitrum One
fork rehearsal, retirement of the Arbitrum Sepolia path, and two plan-hub records.

Gates at handoff: 1754 contract tests across 135 suites, 70 script tests, 7 fork tests, 122 of
those contract tests specific to pooling. `check:storage-layout` reports
`OK: CommitmentPoolingModule`, `check:source-structure` clean, `lint:check` and `build:full`
exit 0, full monorepo Ship Gate green, working tree clean.

## Architecture you must preserve

Behavior lives in deployed external libraries under `src/lib/CommitmentPooling/`, called by one
linear shell chain under `src/modules/CommitmentPooling/`:

Storage -> Base -> Admin -> Lifecycle -> Operations -> Extensions -> the concrete
`CommitmentPoolingModule` in `src/modules/CommitmentPooling.sol`.

- **Only `CommitmentPoolingStorage` declares state** (38 entries + `__gap[12]`). New behavior
  contracts declare NO storage. Constants are fine — they occupy no slots.
  `bun run check:storage-layout` must keep reporting `OK: CommitmentPoolingModule`.
- New selectors put their behavior in an external library and keep only the thin forwarding shell
  in the appropriate chain contract. Extensions stays last before the concrete contract.
- Keep `src/modules/CommitmentPooling.sol` and the name `CommitmentPoolingModule` — tests use
  `deployCode("CommitmentPooling.sol:CommitmentPoolingModule")` and the storage baseline is keyed
  on the name. Keep `initialize` on the concrete contract.
- Helpers stay `private` unless another module actually calls them.
- **File-size gate**: new files <= 350 lines, modified <= 500
  (`scripts/quality/check-source-structure.js`). Never add an allowlist entry — split instead.
- `src/interfaces/ICommitmentPoolingModule.sol` is **FROZEN**. If you find a defect, stop and ask.

## Work area 1 — Deploy and wire the two resolvers (PRD-799, critical path)

Tracked as PRD-799. This blocks everything else; none of it is contract code.

`TestimonyResolver` exists in `src/resolvers/Testimony.sol` with unit tests and a storage-layout
baseline, and **nothing in the repo deploys it**. Three configuration setters exist that nothing
calls: `AssessmentResolver.setAssessmentV3SchemaUID`, `TestimonyResolver.setSchemaUID` and
`.setCommitmentModule`, and `WorkApprovalResolver.setCommitmentModule`. That last one is
load-bearing: without it the Work-approval bridge never fires, so a commitment can never earn
credit from approved work and the module deploys inert.

Build a deploy target for `TestimonyResolver` (ERC1967 proxy plus `initialize(owner)`; the
implementation constructor takes the EAS address) and a configure step making all four calls. The
two existing targets are the pattern to copy: `script/deploy/pooling.ts` +
`script/DeployPooling.s.sol`, and `script/deploy/commitment-schemas.ts` +
`script/DeployCommitmentSchemas.s.sol`. Both already fail closed today naming exactly these
missing pieces — run them to see the current honest state:

```
bun script/deploy.ts pooling --network arbitrum --dry-run
bun script/deploy.ts commitment-schemas --network arbitrum --dry-run --pure-simulation
```

The configure step must be safe to re-run and must fail closed on a missing prerequisite. The
ordering constraint is real and already asserted by the fork rehearsal:
`setAssessmentV3SchemaUID` reverts `AssessmentV2SchemaUIDRequired` while the v2 UID is zero, which
is the live Arbitrum state.

Expose everything as named root `contracts:*` scripts per CLAUDE.md and add the
`scripts/README.md` line. **Dry-run and verification only. No broadcast, no live chain mutation,
no authority change.**

The acceptance test already exists: `test/fork/ArbitrumCommitmentPooling.t.sol` walks this exact
sequence against live Arbitrum dependencies. Extend it to drive the new deploy/configure code
paths rather than duplicating them inline, and keep it green:

```
bun run contracts:pooling:rehearse:arbitrum-fork
```

Note that step 1 of the runbook upgrades `WorkApprovalResolver`, which handles real attestations
on Arbitrum One today. That is the highest-risk operation in the sequence and unrelated to whether
pooling is correct. Treat it as its own change with its own storage-layout check and fork test.

## Work area 2 — Cross-chain settlement: establish the approach, do not invent contracts

**Read this before touching anything cross-chain: the settlement contracts do not exist yet.**
`src/` contains no settlement module. `Commitment.settlementEnabled` and `settlementAdapter` are
reserved fields that are always false and zero in MVP, and `RewardRail.CeloSettlement` is an enum
value the module deliberately refuses in `recordRewardPaid`. Do not write a
`CeloSettlementExecutor` — that is the settlement lane's work (PRD-686), and its architecture is
frozen in `settlement-spec.md`.

What this session should do is **unblock and de-risk** that lane, cheaply.

The key insight, decided 2026-08-06: **the repo already solved cross-chain testing for ENS.**
`test/fork/CrossChainENS.t.sol` runs two forks in one process, alternates with `vm.selectFork`,
hand-builds a `Client.Any2EVMMessage`, and delivers it with `vm.prank(router)` followed by
`receiver.ccipReceive(message)`. That is exactly the right pattern, because a CCIP receiver's
entire trust model is "the router called me, from this source selector, with this sender" —
impersonating the real router on a fork exercises that precise boundary with real contracts on
both ends. The only simulated part is Chainlink's transport, which is their audited
infrastructure, not ours. Same logic as the pooling fork decision: simulate only what belongs to
someone else.

Concrete, buildable work now:

1. **Fill in Celo's CCIP configuration.** `packages/contracts/deployments/networks.json` currently
   has `celo.contracts.ccipRouter` and `celo.ccipChainSelector` both **zero**, while Arbitrum has
   real values. Nothing cross-chain to Celo can be fork-tested until those are real. Look up the
   Celo Mainnet CCIP router and chain selector from Chainlink's official directory, verify the
   router has deployed bytecode on a Celo fork before trusting it, and record where the values
   came from. This is a read-only lookup plus a config edit.
2. **Add a read-only lane verification.** With the config filled in, prove the Arbitrum One <->
   Celo Mainnet route is live using `IRouterClient.isChainSupported(destChainSelector)` and
   `getFee(...)` against the real routers on forks of both chains. This costs nothing, needs no
   broadcast, and converts "the directory says the lane is published" into an on-chain fact. It is
   the cheapest possible de-risking of the whole settlement lane and it can be done today.
3. **Write the pattern down** in `settlement-spec.md` or the release-ops handoff as the lane's
   testing approach, pointing at `CrossChainENS.t.sol` as the working precedent, so the settlement
   lane builds against it instead of re-deriving it.

Recommended evidence ladder to propose (`human-release-ops.md` currently carries an older one and
has an open question recorded on PRD-731): pure tuple/versioning/replay tests with no chain;
per-side fork tests; a paired-fork round trip carrying the message and the acknowledgment by hand;
read-only live lane verification; then ONE message-only, zero-value ping and acknowledgment on the
real Arbitrum One <-> Celo Mainnet lane; then the value canary.

Recommend dropping the Celo Sepolia Safe/Zodiac rehearsal and the ephemeral Arbitrum Sepolia <->
Ethereum Sepolia endpoint proof. The first uses a surrogate token, an unsupported Kernel (`0.2.4`
against production `0.3.1`), and has no published lane. The second demonstrates that Chainlink's
transport works, on a pair that will never be used. Neither is in question. Forks genuinely cannot
prove DON liveness, real delivery latency, destination gas under congestion, or the Safe/Zodiac
signer ceremony — the first three come from that single real ping, the last is a human process.

**This is a settlement-architecture recommendation, not a unilateral change.** Surface it on
PRD-731 and in the spec as a proposal; do not rewrite the frozen settlement architecture.

## Work area 3 — Hardening: pooling has no fuzz or invariant coverage

This is the largest genuine quality gap and the one most worth an audit's time.

`test/FuzzTests.t.sol`, `test/GasBenchmarks.t.sol`, and `test/invariant/RoleHierarchy.t.sol`
contain **no pooling coverage at all**. Every one of the 122 pooling tests is example-based.
`test/CommitmentPoolingBounds.t.sol` exists but only measures the 8/16/24/32/40 bounds matrix.

Two surfaces are close to ideal targets:

**Fuzz the recognition algorithm.** `validateRecognitionSnapshot` runs two independent integer
passes with remainder distribution and must total exactly 10,000 bps for every input. Fuzz over
contributor count (1..40), credit vectors, and policy splits, asserting: the vector sums to exactly
10,000; no row gains more than one extra bps from either pass; equal-pass remainders go to the
lowest addresses; verified-pass remainders go to the largest fractional remainders with ties broken
by ascending address; and the canonical hash is stable. The exact algorithm is
`contract-spec.md` lines 3700-3730 — follow it literally.

**Invariant-test the unit accounting.** `test/invariant/RoleHierarchy.t.sol` is the pattern to
copy. A handler driving create/claim/accept/link/approve/reject/cancel/expire/dispute/resolve
against the module plus register should hold, for every reachable state:

- committed + fulfilled units per class never exceed the class quota, and units are released
  exactly once across every terminal path;
- `providerOpenCommitmentCount` matches the set of non-terminal provider obligations;
- `Pool.liveCommitmentCount` and `Cycle.liveCommitmentCount` pair exactly per dispute episode —
  an Expired-to-Disputed re-increment is matched by exactly one decrement on resolution;
- `eligibleContributorCount` equals the number of contributors holding at least one credit, and
  `totalVerifiedCredits` equals the sum of per-contributor credits;
- a frozen roster never changes.

A gas benchmark row in `test/GasBenchmarks.t.sol` for the canonical lifecycle would also be
worth adding, since the bounds harness only covers worst-case bounded vectors.

## Work area 4 — Polish

- **Two frozen-error-set gaps, surfaced but unresolved.** `validateRecognitionSnapshot` has no
  dedicated recognition-mismatch error, so `InvalidAllocation` covers four distinct failures:
  wrong length, wrong sort order, caller-selected weights, and hash mismatch. And
  `createCommitmentSeries` / `updateCommitmentSeriesMetadata` must reject an empty `metadataCID`
  but no metadata-required error exists, so `ReasonRequired` stands in. Neither changes behavior.
  Both are recorded in `status.json` under `interface_observations_2026_08_06`. If the frozen
  interface is ever reopened, these are the two additions worth making — do not amend it
  unilaterally.
- **`DeployHelper.DeploymentResult` does not carry `commitmentPoolingModule` or
  `commitmentRegistry`.** A from-scratch core deploy will not emit them; the standalone pooling
  target merges them instead. `contract-spec.md` section 7.2 asks for the struct fields. Low
  priority, but it means a fresh chain needs the extra step.
- **Unreachable-by-design guards in `acceptExchange`.** Several named preconditions cannot be
  reached through the public API because creation already validates the immutable half. They are
  spec-mandated and cheap, and the `ExchangeDirectionInvalid` path IS reachable via a Request-B.
  Do not delete them; if you touch that file, keep the comment explaining why they stay.

## Invariants a review has already enforced — do not regress

- **Every roster or confirmer mutation revalidates reachability.** The pattern is: apply the
  mutation, then call `_assertConfirmationReachable`, so the predicate sees the resulting roster
  and a revert unwinds the write. `setConfirmerRule` follows this too.
- **Do not reintroduce any Hats wearer-supply reachability guard**, and never change a Hats mock to
  decrement supply on revoke. `HatsModule._revokeRole` transfers the Hat to a burn address rather
  than burning it (`Hats.sol:716`), so `viewHat().supply` never falls. That guard was built and
  withdrawn as inert; `status.json` records why.
- **Do not change the Garden branch of `_ordinaryConfirmationReachable`.** It answers `true`
  deliberately; recovery runs through `raiseDispute` / `expireCommitment`, both implemented.
- **Do not re-add `arbitrum-sepolia` or `celo-sepolia` as configured networks.** A test in
  `script/utils/pooling-release.test.ts` asserts their absence. Hats has no Arbitrum Sepolia
  deployment and Celo Sepolia has no published CCIP lane, so neither can carry an honest
  rehearsal. The verified 421614 EAS addresses are preserved in
  `script/utils/pooling-release.ts` if the decision is ever revisited.
- **The resolver bridge is only exercised unmocked in the fork rehearsal.** Every unit test drives
  `onWorkDecision` through `MockWorkDecisionResolver`. Keep the fork test green.
- Don't touch `test/helpers/MockHatsModule.sol` unless a new test genuinely needs it — 20 test
  files share it.

## How to work

- **Never use raw `forge`.** Bun wrappers only: `bun run test`, `bun run test --match-contract X`,
  `bun build`, `bun run build:full`, `bun run lint:check`, `bun run check:storage-layout`,
  `bun run test:script`, `bun run test:fork:pooling:arbitrum`.
- TDD mode is `required`: write failing tests first, confirm they are RED for the right reason,
  then implement.
- Run `bun run format` from `packages/contracts` before `lint:check` — that runs `forge fmt`. The
  root `bun format` is Biome and does not touch Solidity. The formatter reflows multi-line
  signatures and will otherwise fail the gate.
- Fork tests need an RPC. `ForkTestBase` now derives one from `ALCHEMY_API_KEY` if no
  `ARBITRUM_RPC_URL` is set, and the shard runner supplies a public default plus a pinned block.
- One conventional commit per area, scope `contracts`, body explaining the semantics and the
  verification evidence. Re-check `git branch --show-current` before each commit.
- Per-area gates: full `bun run test`, `check:storage-layout`, `check:source-structure`,
  `lint:check`, `build:full`, plus `node scripts/harness/plan-hub.mjs validate` if you touch
  `.plans/`.
- Keep `.plans/active/commitment-pooling/status.json` current — its
  `execution_sub_lanes.contracts` handoff note is the running record.
- Linear is connected. PRD-799 tracks work area 1; PRD-731 carries the cross-chain open question;
  PRD-721 has the full contract-completion record. Prompt before creating new Linear records.

## When done

Run the Ship Gate from the repo root (`bun format && bun lint && bun run test && bun build`), then
report what remains before the module could actually deploy. Dates live in Linear and are Afo's to
re-set — surface drift rather than assuming a date.
