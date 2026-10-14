# Commitment Pooling focused functional QA

## Target and environment

- Date: 2026-08-25 (America/Los_Angeles)
- Mode: A, read-only functional regression
- Exact target: `origin/develop@a5fe2c78b5f8ac66ec80ad68aa376ce882500cad`
- Target refresh: `git fetch --prune origin develop` completed before the target was recorded.
- Shared-checkout result: **BLOCKED (target drift)**. The shared checkout moved through `139bdf3bc9aa181084c1d1bcd490d6bca6e58fd8`, `c00d704932ee9493e9a72d60a435b4db87b8309e`, and then `fc27a5b000fd8ab8674ac5a6dea159a0a602234b` before the first browser phase. Rendered testing never began.
- Snapshot-safe execution: package suites and source checks ran in a detached worktree at the exact target SHA. A second clean detached worktree at the same SHA supplied the final validation-selector receipt. No branch was created or switched.
- Evidence separation: no route, fixture, or Storybook render from the later shared checkout is used here. The live chain and hosted indexer probes are identified as external read-only observations, not commit-rendered evidence.
- Browser: authenticated Brave extension control was not initialized because the target-drift stop condition applied first. Computer Use, isolated Browser, Playwright, DevTools MCP, and clean-room browser profiles were not used.
- Process boundary: existing Node listeners on `3001`, `3002`, and `3004`, OrbStack listeners on `3006`–`3008`, and an Anvil listener on `3009` were observed and left untouched. This QA stopped or restarted no process.

Fresh live read-side facts:

- Arbitrum chain ID `42161`; Commitment Pooling proxy `0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a` has bytecode.
- Its live implementation is `0x6268ec974bb217De39E7756d75c8D523b9A79218`, matching the pinned deployment artifact.
- The module is unpaused and `protocolPoolId=1`.
- Pool 1 is `PROTOCOL / NOT_READY`; pool 2 is `GARDEN / NOT_READY`. Both are proof-enabled, settlement-disabled, cycle-less, and have zero live commitments.
- The deployer fixture is a chain-confirmed steward of the protocol root only. The user and steward fixtures are not root stewards; none of the three fixture identities is a steward or owner of Garden pool 2.
- Hosted Envio reported Arbitrum start block `433713812`, first event block `433714702`, indexed block `498177636`, head `498177698`, and lag `62` blocks. Its current GraphQL schema has no `CommitmentPool` type or Commitment Pooling root fields.

Evidence: `evidence/qa-functional-focused-2026-08-25/target-preflight.json` and `evidence/qa-functional-focused-2026-08-25/qa-summary.json`.

## Functional verdict

**BLOCKED — this is not a functional release certification.**

The exact target passed all explicitly required snapshot-safe package, contracts, Storybook-contract, story-quality, and vocabulary checks. The deployed proxy and implementation match the pinned artifact, and the read-only chain probe completed. No new release-blocker or defect was confirmed by those tiers.

The pass is incomplete because the shared checkout did not remain at the pinned SHA through browser setup. Per the dispatch stop rule, client fixture, admin, public, and Storybook interaction testing stopped before it began. The four prior functional defects therefore have fresh `BLOCKED`, not `PASS`, results. Static suites and story inventory are not promoted to rendered evidence.

Coverage-row counts:

| Evidence tier | Rows |
| --- | ---: |
| `LIVE` | 3 |
| `FIXTURE` | 0 |
| `STORYBOOK` | 0 |
| `SUITE` | 12 |
| `BLOCKED (...)` | 13 |
| `NOT-RUN (...)` | 3 |

## Commands and counts

`bun run validation:plan -- --intent qa --json` returned `status=ready`, `effectiveIntent=qa`, no changed paths, and no selected checks. `selectedBy` is therefore empty. The dispatch's explicit minimum commands were still mandatory and were run.

| Command or probe | Fresh result at the pinned target |
| --- | --- |
| `git fetch --prune origin develop` | PASS; recorded target `a5fe2c78b5f8ac66ec80ad68aa376ce882500cad`. |
| `bun run validation:plan -- --intent qa` | PASS. Final clean JSON receipt selected no checks; `selectedBy=[]`. |
| `bun run dev:doctor` | PASS for the production-backed frontend QA profile. |
| `bun run dev:prod:mirror:health` | FAIL; Docker CLI was present but its daemon was unavailable. The isolated target worktree also lacked generated Envio types. No restart or code generation was attempted. |
| `bun run dev:prod:smoke` | PARTIAL/FAIL because docs on `3003` did not respond. Client, admin, Storybook, Arbitrum, production agent, and hosted indexer probes passed, but the local surfaces belonged to a later checkout and are not target evidence. |
| `bun run --filter @green-goods/shared test` | PASS: 384 files passed, 2 skipped; 4,229 tests passed, 18 skipped. An initial detached-worktree dependency-link failure was replaced by this fresh pass without an install. |
| `bun run --filter @green-goods/client test` | PASS: 103 files; 867 tests. |
| `bun run --filter @green-goods/admin test` | PASS: 101 files; 720 tests. |
| `bun run --filter @green-goods/indexer test` | PASS outside the restricted loopback sandbox: 307 passing, 1 pending. The earlier nine `listen EPERM` harness failures were not reused. |
| `bun run --cwd packages/contracts test:match -- 'test/**/CommitmentPooling*.t.sol'` | PASS through the package Bun wrapper: 75 suites; 241 passed, 0 failed, 0 skipped. The first detached-worktree attempt found empty submodules and could not install them; no dependency was installed. The fresh pass used the repository's existing exact submodule SHAs. |
| `bun run --filter @green-goods/shared check:stories` | PASS: 254/254 required surfaces have stories. This does not execute story play functions. |
| `bun run --filter @green-goods/shared check:story-quality` | PASS: 226 story files. |
| `bun run lint:vocab` | PASS: 3 i18n files. |
| Repository read-only release verifier | BLOCKED before RPC because the detached worktree lacked a generated production Testimony artifact. The narrower Bun RPC probe then passed and confirmed the live proxy implementation matches the pinned artifact. |
| Read-only Arbitrum pool and role probes | PASS; no transaction simulation, preparation, or signature path was invoked. |
| Hosted Envio metadata and schema introspection | PASS as a probe; schema result is negative for Commitment Pooling entities. |

No design review or design-generation gate ran. The selector did not select one, and the dispatch excluded non-functional polish.

## Coverage ledger

Each row uses one evidence tier. `SUITE` means rule-layer or component-test proof only; it is not rendered route proof.

| # | Functional anchor | Tier | Fresh evidence and result |
| ---: | --- | --- | --- |
| 1 | Deployed chain ID, module/implementation bytecode, pause state, protocol pool ID, and pools 1/2 | `LIVE` | Read-only Arbitrum RPC. Proxy implementation matches the pinned artifact; module unpaused; both pools are `NOT_READY`, cycle-less, and empty. |
| 2 | Effective steward role for `mockAuth=user`, `deployer`, and `steward` | `LIVE` | Direct `isStewardOf` and `isOwnerOf` calls. Deployer is protocol-root steward only; no fixture actor stewards Garden pool 2. Role source is chain, not fixture or indexer. |
| 3 | Hosted indexer chain, source block, indexed block, lag, and pooling schema | `LIVE` | GraphQL metadata and schema introspection: chain `42161`, source `433713812`, indexed `498177636`, lag `62`; no Commitment Pooling entity/root fields. |
| 4 | Target-matched local production mirror read-back | `BLOCKED (Docker daemon unavailable and target-matched local Envio mirror not running)` | Mirror health failed. Hosted health is not promoted to pooling read-back proof. |
| 5 | Client `/home` to GG Community Pool and fixtures 1001–1021: state sentence, seat, actions, claims, team, Work/evidence, provenance, and exits | `BLOCKED (target drift)` | The shared checkout moved before browser testing; no target-rendered fixture evidence was collected. |
| 6 | Client cycle/campaign filters, Live/Over time grouping, and absence of the fixture-unwrapped To confirm tab | `BLOCKED (target drift)` | Required click-driven checks did not begin. |
| 7 | Offer and Request composers through Review and queued result | `BLOCKED (target drift)` | No target-rendered clicks, typing, review, or result beat. |
| 8 | Proof composer media/details/review, text-only fallback, and NotYours guard | `BLOCKED (target drift)` | Browser capability was not reached after the hard stop. |
| 9 | Claim/take-up, withdrawal reason, Confirm kept, Not yet reason, and terminal recovery interactions | `BLOCKED (target drift)` | No target-rendered interaction evidence. |
| 10 | Demo mutations visibly queued/waiting, no broadcast/prompt, and repeat-interaction dedupe | `BLOCKED (target drift)` | Queue rules passed in suites, but visible queue behavior was not exercised on the target. |
| 11 | `mockPooling=0`, other garden routes, and fixture-mode cache eviction before real reads | `BLOCKED (target drift)` | Route and session-state behavior was not rendered. |
| 12 | Paused deep link, pause reason with zero commitments, withheld claim/accept/decline/exchange/Ready/confirm acts, and permitted reads | `BLOCKED (target drift)` | Rule tests passed below, but the seeded route/story was not rendered at the target. |
| 13 | Admin `/garden/pool`, `/community/pools`, and `/hub/confirm` authenticated routes | `BLOCKED (target drift)` | Deployer is a valid protocol-root steward, but no target-rendered admin route phase was allowed. |
| 14 | Admin setup resumption/failure recovery and seed direction/scope/quantity/proof/confirmer/review/cycle-less creation | `BLOCKED (target drift)` | Story and route interactions, including play functions, were stopped. |
| 15 | Admin ordinary/fallback confirmation provenance, no-credit Kept guard, loading/empty/read-error/retry exits | `BLOCKED (target drift)` | Component suites passed, but no target-rendered route or story evidence exists. |
| 16 | Public garden and `/impact`: gates, populated states, kept-rate threshold, unavailable values, privacy, and settlement truthfulness | `BLOCKED (target drift)` | Public component suites passed; the target routes/stories were not rendered. |
| 17 | Offer receiver confirms; Request creator confirms; contributors do not confirm | `SUITE` | Passing `commitment-seat-and-scope.test.ts`, `commitment-steward-selectors.test.ts`, and `commitmentActions.test.ts` exercise seat and act rules. |
| 18 | Local fallback precedence, protocol fallback opt-in/reachability, and distinct ordinary/local/protocol paths | `SUITE` | Passing confirmation selector and `commitments-to-confirm.test.tsx` cases keep ordinary/local/protocol paths distinct and protocol fallback opt-in only. The module-owner rule is also enforced by the contract permission suite in row 28. |
| 19 | Declined claim state, terminal/lapsed exits, and queue suppression of duplicate acts | `SUITE` | Passing client controller and commitment action suites preserve declined claim state, terminal no-act behavior, lapsed re-offer, and pending-queue suppression. The superseded browse exit remains part of the blocked rendered row 9. |
| 20 | Ready freezes team/credit edits and requires verified credit | `SUITE` | Passing core selector tests expose roster-frozen and credited-contributor blockers; contracts tests cover freeze and credit invariants. |
| 21 | Demo/local jobs stay idempotent, recoverable, and non-rebroadcasting | `SUITE` | Passing `commitment-jobs.test.ts` cases dedupe same claims/confirmations, hold read-through recovery, reject conflicting payloads, and support explicit retry/discard. |
| 22 | Address casing and demo-to-real query-state isolation | `SUITE` | Passing address-normalization tests and `commitment-demo-mode.test.ts` cache-boundary case cover case-insensitive identity and eviction in both directions. |
| 23 | Paused action gating and recovery reads | `SUITE` | Passing `commitment-pooling-hooks.test.tsx` and `GardenPool.test.tsx` keep cancellation/recovery available while holding ready/confirm/claim decisions and retaining the pause reason. |
| 24 | Admin readiness, setup write ordering, partial-failure resume, claim decisions, confirmation rows, and read-error retry | `SUITE` | 720 passing admin tests include `PoolSetupFlow`, `GardenPool`, `CommunityPools`, and `HubConfirm`. No suite is promoted to a rendered play result. |
| 25 | Public readiness/paused/between-season/empty/unavailable states, threshold, and privacy | `SUITE` | Passing public reader and editorial tests avoid fake zeros, provider addresses/outcomes, and cancelled/disputed private counts. |
| 26 | Settlement state and copy do not promote queued/dispatched/acknowledgment-pending to arrived | `SUITE` | Passing settlement selectors/hooks and client editorial tests count only acknowledgment-confirmed support as arrived. |
| 27 | Indexer Commitment Pooling schema, event routing, replay, placeholder, count, and review rules | `SUITE` | 307 passing indexer tests, 1 pending. This proves source behavior, not hosted pooling availability. |
| 28 | Contracts lifecycle, permissions, bounds, accounting, freeze, confirmation, and recovery invariants | `SUITE` | Targeted wrapper: 75 suites and 241 tests, zero failures. |
| 29 | Wallet signatures, passkey ceremonies, approvals, broadcasts, and on-chain mutations | `NOT-RUN (Mode A explicitly forbids signatures and writes)` | No prompt or transaction path was entered. |
| 30 | Mode B, availability-ledger changes, deployment/activation, and Linear workflow | `NOT-RUN (outside dispatched Mode A authority)` | No ledger, plan, configuration, deployment, or Linear record was changed. |
| 31 | Anvil/local-chain behavior and real settlement execution | `NOT-RUN (local chain and settlement execution were not authorized)` | The existing Anvil listener was left untouched and supplied no evidence. |

## Regression rechecks

The prior Wave 1 report is inventory only. None of its rendered results is reused.

| Regression | Fresh result | Evidence |
| --- | --- | --- |
| Fallback confirmation provenance produces no invalid DOM nesting or hydration errors | **BLOCKED (target drift)** | Requires a target-rendered fixture 1012 console/hydration check. No browser phase began. |
| `Admin/Pool/PoolSetupFlow--FirstRun` renders and completes its play assertion | **BLOCKED (target drift)** | `check:stories` passed static inventory only; it does not execute the play function. The later running Storybook was not the pinned target. |
| ConfirmSheet does not pair a positive proof count with “No proof has been attached yet.” | **BLOCKED (target drift)** | Requires target-rendered ConfirmSheet/fixture 1009 evidence. |
| Local PWA navigation avoids the Service Worker `text/html` MIME registration failure | **BLOCKED (target drift)** | Requires target-matched local PWA navigation and console capture. |
| Composer controls respond to actual clicks and typing | **BLOCKED (target drift)** | No target browser interaction. |
| Address casing does not produce an identity mismatch / “Garden not found” path | **PASS — `SUITE`** | Case-insensitive seat, visibility, and claim-preflight tests passed. No route render is claimed. |
| Stewards are not seated as ordinary confirmers | **PASS — `SUITE`** | Seat and fallback-group tests passed, including contributor/steward exclusions. |
| Pause reason remains visible with zero commitments | **BLOCKED (target drift)** | The paused suite preserves a reason, but the exact zero-commitment rendered state was not exercised. |
| Protocol-pool creation controls are hidden from ordinary members | **BLOCKED (target drift)** | Requires target-rendered ordinary-member client/admin proof. |
| Double submission cannot create duplicate jobs | **PASS — `SUITE`** | Same claim and confirmation enqueue calls return the existing job; conflicting payloads are rejected. |
| Demo query state is cleared before returning to non-demo reads | **PASS — `SUITE`** | `commitment-demo-mode.test.ts` removes pooling queries when the flag flips in either direction. |

## Defects

No release-blocker or defect was freshly confirmed in the evidence tiers that completed. This does not clear the four prior defects: each rendered recheck is blocked above.

## External blockers

- **Target drift:** the shared checkout moved off `a5fe2c78b5f8ac66ec80ad68aa376ce882500cad` before browser testing. This is the controlling blocker for every client, admin, public, and Storybook rendered row. Testing was not resumed on the later checkout.
- **Target-matched local mirror:** `bun run dev:prod:mirror:health` could not reach a Docker daemon, and the isolated snapshot had no generated Envio types. Existing listeners were not replaced because they were not proven to belong to this QA. The hosted indexer was not substituted for local pooling read-back.
- **Hosted Commitment Pooling schema:** hosted GraphQL is healthy and near head, but fresh introspection has no `CommitmentPool` type or pooling query roots. It cannot prove pooling read-back.
- **Docs runtime:** `bun run dev:prod:smoke` received no response from docs on `3003`. No process was restarted because the stack belonged to another checkout/session.
- **Generated production verifier artifact:** the repository's read-only release verifier stopped before RPC because the detached worktree lacked the generated production Testimony artifact. The narrower direct RPC checks completed, but this verifier command remains unavailable in that harness.

## Not run

- No authenticated Brave route or Storybook interaction phase after target drift.
- No screenshots; there was no valid target-rendered surface to capture.
- No wallet, passkey, signature, approval, transaction simulation, broadcast, on-chain write, settlement execution, Safe action, or availability-ledger change.
- No Mode B, Anvil, local-chain replacement, Docker/OrbStack restart, unknown-listener stop, raw package server, `dev:web`, isolated Browser, Playwright, or DevTools MCP.
- No visual-style, layout-taste, motion, dark-mode, locale-tone, design-system, typography, density, or other polish evaluation.
- No product, test, configuration, plan, prior report, or prior evidence edit. Only this new report and its new evidence directory were created.
- No branch create/switch, commit, push, fix, or Linear record.
