# PRD-1158 repository-wide cleanup implementation

The approved R01–R62 scope is implemented in three code batches on draft [PR #1102](https://github.com/greenpill-dev-guild/green-goods/pull/1102). All 62 candidates were applied, including the separately qualified real-SQLite and reentrancy repairs. No candidate was silently deferred. The [accepted plan](../plan.todo.md#prd-1158-repository-wide-scope-2026-10-15) retains the per-candidate caller traces, unique-proof requirements and exclusions.

This report records the cleanup comparison before integrating newer `develop` changes. Local publication gates and current-head GitHub CI are still pending at this checkpoint; the PR checks own the eventual CI state. The broader hub remains active and its other lanes and historical receipts are unchanged.

## Measured reduction

Comparison: `547e64248390d72b94a1ecc5772b4d7c9bc9fe9a` → `36fd6babd`.
Physical source lines include blank lines and comments. The fixed before-inventory classifier is reused after editing and checked against Git's added/deleted counts. Plans, guides, generated documentation, manifests, configuration and binaries are excluded from test/support code totals.

| Code | Before files | After files | Before lines | After lines | Added | Deleted | Net |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tests | 1,296 | 1,275 | 352,204 | 344,276 | 707 | 8,635 | −7,928 |
| Support | 109 | 97 | 20,196 | 16,099 | 98 | 4,195 | −4,097 |
| Total | 1,405 | 1,372 | 372,400 | 360,375 | 805 | 12,830 | **−12,025** |

There are **zero new executable test/support files**. The earlier narrow PR already removed 265 test/support lines, so the full issue's cleanup removes **12,290 lines**. Two unused tracked SQLite fixtures remove another **1,044,480 bytes**, counted separately.

The 133 changed test/support paths shrink from 45,807 to 33,782 lines. Commit grouping assigns each path once; Shared transfer owners are counted in the Shared commit, not again in App totals.

| Code batch | Commit | Changed test/support footprint | Net |
|---|---|---|---:|
| Shared/Agent, including Shared transfer owners | `805e9333f` | 17,009 → 14,193 | −2,816 |
| Client/Admin/browser and their direct tooling | `4281c072f` | 14,536 → 9,880 | −4,656 |
| Contracts/Indexer/root test controls | `36fd6babd` | 14,262 → 9,709 | −4,553 |

## Applied scope and retained protection

| Approved IDs | Completed work | Meaningful protection retained or transferred |
|---|---|---|
| R01–R06 | Retire assigned-literal type cases, existence/default duplicates, duplicate Button cases and unused render/offline/factory helpers. | Compile-time legacy metadata contracts; exact enum/default wire values; real listing retry/sign/send; loading Button behavior, size and accessibility. |
| R07–R13 | Delete always-skipped browser chains, unused Pimlico fake and dead helpers; consolidate mock blocks, real pooling routes, empty-state and header proof. | Real lazy route/view/params/query context, null router errors, CTA permission/click, three zero-garden REPLACE redirects, real PublicShell header composition. |
| R14–R18 | Remove literal storage arithmetic/getter duplication, unused Solidity helpers, duplicate Indexer cases and unused Agent controls. | Actual storage loads and post-upgrade state; Indexer title update preserves WASTE domain; real event owners and Agent request consumers stay. |
| R19–R25 | Delete copied approval/filter algorithms, unused browser/server mock graph, local scenario lists and repeated utility/error trivia. | Production approval/filter/provider owners, transaction encoding, timer cleanup, offline and actual GraphQL failure behavior. |
| R26–R33 | Consolidate ENS success, progress and profile writes; remove unused plumbing and ineffective cancellation setup. | Exact resolver/cache arguments; strict path/search increments; six progress rows; four independently encoded profile fields, pending/error reporting; actual missing-signer/readiness rejection. |
| R34–R39 | Transfer durable query migration, create-Garden retry and loaded Garden ARIA; remove dead CreateAction mocks, dormant passkey chain and exact duplicates. | Fresh persistence instance and absent legacy key; fail→retry→success/hash→close/reset; four labelled sections with unique heading IDs; active role/auth and control behavior. |
| R40–R45 | Remove permissive auth, unknown-route, assertion-free fork/client and optional-PWA claims; consolidate six mint rows and unused timeout keys. | Real split-route wildcard loaders, six expanded mint statuses, field/distribution/edit assertions, qualified strict passkey/PWA proof and byte-identical full-stack fork bodies. |
| R46–R54 | Delete mock-only Hats/GAP/GoodsProject/schema/legacy Aave/direct-vault suites and exclusive support; deduplicate fork token and pooling schema cases. | Real Karma captured schema/recipient/refUID/payload; Hats cap/inactive/immutability/eligibility/ancestry; production JSON builder, Aave and vault custody owners; token cap→burn→remint; schema-conflict rejection. |
| R55–R56 | Delete unused Agent runner; consolidate root skill mutations and QA invocations. | All 15 skill mutations, live control, all eight QA harness bodies, stdio/timeout options and thrown subprocess failures remain. |
| R57 | Replace handwritten SQL parsing/maps with a 39-line Node SQLite adapter in the existing setup file; remove unused DB binaries. | All seven SQL consumers; real migration/rerun and owner quota/update/other-owner/tombstone behavior; separate native Bun persistence lane unchanged. |
| R58–R59 | Repair authorized one-shot reentrancy observations; narrow MockGAP to its real consumer. | Six attack directions including both resume directions, exact guard revert bytes, persisted inner observations and successful outer state/event; exact recorder selector/fields, uniqueness and failure controls. |
| R60–R62 | Remove ineffective browser admission/cancellation claims, write-only receipt/encoder mocks and uncalled protocol-mock controls. | Actual SessionGate/modal/retry/qualified rejection owners, mobile home smoke, protocol interfaces, hierarchy/standing/eligibility and distinct yield mock receivers. |

No production application, deployed contract module, handler or guard behavior was changed by these cleanup commits. Mock/support changes and sensitive metadata are deliberate: unused Shared `./mocks/server` export and Knip entry removed; stale Juicebox compilation restriction removed; Hub preset keeps 13 surviving paths; retired guide/inventory references corrected; two obsolete advisory entries removed; all four certified seam fingerprints refreshed after fresh proof. No dependency version, lockfile, CI workflow, coverage floor, include/exclude, isolation rule or direct-seam debt baseline was weakened.

## Before/after coverage

The same commands, instrumentation, configuration and source owners were used on both sides. Shared uses all configured projects with two workers; Client/Admin use their package coverage command; Agent uses the unit scope. All global and 11 critical-path coverage floors remain unchanged.

| Package | Statements before → after | Branches | Functions | Lines | Passed cases before → after |
|---|---|---|---|---|---:|
| Shared | 77.42 → 77.44 | 71.06 → 71.07 | 76.16 → 76.20 | 79.27 → 79.29 | 7,465 → 7,377 |
| Client | 75.25 → 75.26 | 70.13 → 70.14 | 72.48 → 72.52 | 77.15 → 77.16 | 1,720 → 1,714 |
| Admin | 73.29 → 73.29 | 68.90 → 68.90 | 66.52 → 66.52 | 74.65 → 74.65 | 1,337 → 1,306 |
| Agent | 43.95 → 43.99 | 35.96 → 35.99 | 44.07 → 44.19 | 46.19 → 46.21 | 524 → 526 |

Shared has two existing skipped files/16 skipped cases after cleanup (19 before); Agent retains one existing skipped file/case. These are reported separately from passed counts. The full Solidity control passed 2,100 cases in 162 suites; the cleanup run passed 1,949 in 155, with zero failures/skips. Runtime case counts differ from static declaration counts and from table-row counts.

Per-position comparison finds no previously executed production statement, function or branch position missing in Shared/Client/Admin; no production source file disappears. Agent has one qualified lost branch position: the null `COUNT(*)` fallback in `saved-offers.ts:81`. The old emulator returned null for the aggregate; SQLite always returns a count row. Actual SQL quota and migration proofs replace that artificial hit, improve owner coverage and reject the old emulator. No production statement/function hit is lost.

Observed coverage durations were Shared 441.75 → 347.95 s, Client 258.69 → 142.57 s, Admin 228.04 → 183.95 s, Agent 19.88 → 13.67 s. These are single observations under varying host contention; they establish no controlled speedup. Machine-wide lease waiting is excluded from the runner durations.

## Proof and review

- Shared direct batches pass 67, 226, 186 and 164 cases; App transfers pass Client 148 / Shared 85 / Admin 216 plus additional migration 10. Clean fault-restoration controls pass Shared 66 and App 200.
- All four certified seams were traced through their implementation, composition and consumers; 13 proof files pass 275 cases with six existing skips. Fingerprints were refreshed only after that proof. The final workflow import repair changes none of these fingerprints.
- Solidity survivor/fidelity/storage/invariant matrix passes 411 cases in 14 files; clean guard/Karma/Hats restoration passes 127; Indexer passes 32 and restored action owner 17; contract script checks pass 31 Node + 39 Vitest; root controls pass 71; QA table passes all eight rows.
- The real Bun SQLite lane passes 196 cases in 21 files. Seven unit SQL consumers pass 113, preserving the original 111 callbacks and adding two meaningful SQL cases. Both additions reject the retired emulator and pass native SQL.
- All **31 intentional runtime faults** fail the intended assertions: eight Shared, 11 App, 12 Contracts/Indexer. Every faulted source is restored byte-identically. Reentrancy guard omissions fail by exact assertion, not role rejection or recursive out-of-gas.
- Shared/Client/Admin/Agent test typechecks pass, including the legacy compile-time metadata assertions. All nine test-quality checks pass; source-structure has no new debt, certified seams have no drift, and package/export boundaries pass.
- Repository format check and lint pass (existing Solhint warnings remain). Independent cross-lane App, Contracts/Indexer and Shared/Agent reviews found no actionable regression or lost meaningful same-failure protection.

The initial Shared control exposed an unrelated far-future timer-drain timeout; invoking the captured capped/rearmed callbacks preserves before/due behavior and passes 13 owner cases. Agent baseline initially lacked installed pinned dependencies; the user-approved frozen restoration changed no versions or lockfile. The first Shared AFTER run caught a real helper side effect: deleting navigator mutation helpers correctly moved three pure workflow suites into the shared Node graph, exposing a React helper import. Removing that DOM dependency preserves all 224 assertion lines; focused 90 and final full coverage pass with the leak guard unchanged.

## Publication verification still in progress

- Mandatory ABI/build/full-contract/safety gate: full Solidity and production gas-boundary proof passed; complete verification remains running.
- Strict browser: passkey 3/3 and production PWA-preview 1/1 pass with zero retries/skips (CI Playwright, clean-room). Final Client/Admin/exploration proof remains pending. Earlier failed/flaky runs are not used as closure.
- Full local Ship Gate, latest-develop integration, post-commit Push Gate, normal push and required current-head CI remain pending. No merge to develop or deployment is authorized.

## Retained limits

Live RPC/fork execution and authenticated real-wallet/session restoration are not claimed by clean-room proof. Actual qualified browser subjects remain; removing permissive manual claims does not fill those preexisting external-integration gaps. The existing GraphQL variable-forwarding gap, four missing storage-checker entries and Juicebox deployment-configuration gap remain explicit in the accepted plan. This is completion of the selected cleanup scope, not line-by-line certification that every remaining repository test is ideal.

Task record: PRD-1158 / PR1102 | Type: test refactor | Outcome: implementation and comparable coverage complete; publication verification ongoing.
Agent/model: Codex / GPT-6 with three package implementation/review agents | Coverage: expanded implementation segment starting 2026-10-15T04:08:09Z.

| Phase | Start → end (UTC) | Evidence or blocker |
|---|---|---|
| Investigate/implement/verify | 2026-10-15T04:08:09Z → 2026-10-15T05:20:30Z | Baselines, three code batches, fault restoration, comparable coverage and cross-lane review above; sub-boundaries unknown. |
| Wait | Within that interval; exact boundaries unknown | Missing pinned dependencies resolved by approved frozen restore; test leases respected. |
| Verify/publish | 2026-10-15T05:20:30Z → ongoing | Full gates, browser, develop reconciliation and current-head CI pending. |

Human corrections: 0 in this implementation segment; attention unknown.
