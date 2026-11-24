# Two-pool contracts and indexer handoff

The schema-v3 preparation path adopts the active Green Goods exchange and plans one additional Tech and Sun exchange with six independent CLC components. It preserves the existing collective voucher tokens, reserve/adapter/escrow identities, and issuer authority. The real-runtime fork suite passes all 24 tests. The existing downstream command now has a separate v3 execution and recovery path. No live broadcast was performed: operating inputs remain unset, source changes remain uncommitted, and the live TAS approval policy differs from the accepted one-approval plan.

## Implemented boundary

- Existing `contracts release clc` owns v3 preflight, committed-revision planning, isolated deployment simulation, and canonical receipt-prefix adoption. No broadcast mode was added to this preparer.
- `config/clc-garden-exchanges.json` is a separate activation draft. Historical deployment records and v1/v2 manifests remain unchanged. Dedicated deployer and nonce are unset; rates, inventory, holding cap and approval evidence are explicit missing inputs.
- Plans expose canonical `assets` plus `pools.greenGoods` / `pools.techAndSun` records. Stable pool IDs are `green-goods` and `tech-and-sun`. Each record carries chain, garden, owner, upgrade administrator, six component addresses and independent listings. Green Goods is adopted; TAS is newly predicted. Member tokens retain their own owner/upgrade authority and are admitted only to TAS by this plan.
- Simulation verifies published CLC implementation/factory hashes, exact proxy initializer/admin, canonical partial-deployment receipts, current authorities, and unchanged collective supply, reserves, GG inventory, adapter allowances and upgraded endpoint/source bindings. It snapshots existing timelock delays instead of requiring the historical zero-delay bootstrap.
- Safe/AccessManager ownership accepts only the recorded Safe or the exact reviewed GG manager with the Safe's administration role. Wrong manager, missing Safe role, wrong source peer/chain, missing admission, and changed TAS policy fail tests.
- Fork tests use published CLC/Safe/Hats runtime and current production-profile Green Goods artifacts. Synthetic identities and manually relayed router bytes are clearly labeled. These tests do not establish live CCIP delivery, issuer service capacity, or real member signatures.
- Indexer `projectPoolExchange` already keys chain + pool address + transaction + log index. A new focused test proves two pools with identical transaction/log position remain separate, exact replay deduplicates, and conflicting replay cannot mutate either record. Production indexing configuration still contains only the deployed GG pool.

## Live read-only observations

Read through public `https://rpc.gnosischain.com` on 2026-11-08 around 05:13–05:15 UTC; no transactions sent.

- GG timelock delay is 86,400 seconds; its Safe retains proposer/executor/canceller roles and no bypass administration. TAS timelock delay remains zero.
- At Gnosis block 49,168,127, TAS Safe threshold is **2**, with five owners. Guard/module `0x3Cc943796ccb2fC122b6a61978474Def8fA318c6` is locked with threshold config `[0,2,2]`. The preparer explicitly gates activation on `live.techAndSunOneApprovalPolicy`; readback still requires the accepted one-approval/unfinalized policy. It does not change governance or silently accept two approvals.
- GGV owner is GG Safe; supply 120,000,000, reserve 110,000,000, GG pool inventory 10,000,000, adapter allowance 110,000,000 base units.
- TSV owner is TAS Safe; supply 20,000,000, reserve 10,000,000, GG pool inventory 10,000,000, adapter allowance 10,000,000 base units.
- Adapter and escrow use their current upgraded implementations and the reviewed GG AccessManager. Their source bindings, implementation code and issuer authorizations were read successfully. TAS source issuer authority remains its recorded source-side account, distinct from the destination Safe.

## Verification

Commands run from repository root unless stated otherwise:

| UTC observation | Command / result |
|---|---|
| 04:47:15 | Initial planner RED: new module absent; the focused test import failed. |
| 05:04–05:16 | `bun run --cwd packages/contracts test --suite script -- script/utils/clc-garden-release.test.ts script/utils/clc-garden-readback.test.ts script/utils/clc-member-release.test.ts script/utils/clc-member-simulation.test.ts` — final run 73 tests + 38 CLI Node checks passed. |
| 05:16 | `bun run --cwd packages/contracts typecheck` — passed. |
| 05:17 | `bun run --cwd packages/contracts contracts -- release clc --mode preflight --manifest config/clc-garden-exchanges.json` — passed; one adopted pool, one new pool, explicit missing operating/governance inputs. |
| 05:06 and 05:18 | Initial focused fork attempts failed in existing Journey/Member setup. Verbose trace identified a stale production `VoucherEntitlementModule` artifact lacking `setFeeReserveMinimum`, before new pool assertions. |
| 05:18:50–05:20:56 | `FOUNDRY_PROFILE=production bun run --cwd packages/contracts build --mode target -- lib/tokenbound/lib/openzeppelin-contracts/contracts/governance/TimelockController.sol lib/tokenbound/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol src/modules/CommitmentPooling.sol src/modules/GnosisVoucherAdapter.sol src/modules/GnosisVoucherEscrow.sol src/modules/Hats.sol src/modules/VoucherEntitlementModule.sol src/modules/VoucherRedemptionModule.sol src/registries/Action.sol src/registries/Commitment.sol` — passed, using the existing gnosis-vouchers shard target list. |
| 05:21:40 | `bun run --cwd packages/contracts test --suite solidity --profile match -- test/fork/GnosisVoucherPilot.t.sol` — **24 passed**, zero failed/skipped. Nonfatal Foundry cache write warnings under the sandbox. |
| 05:13–05:21 | In `packages/indexer`: `node ../../scripts/dev/node-cli.js mocha --require tsx --timeout 30000 test/voucherIssuer.test.ts` — six passed; `bun run --cwd packages/indexer build` passed after correcting test-only unknown transaction typing; `bun run --cwd packages/indexer check:indexing-boundary` — 15 checks passed. |
| 05:16 | `git diff --check -- packages/contracts packages/indexer/test/voucherIssuer.test.ts` — passed. |

## Execution and dependent registration

The existing `script/deploy/pilot-downstream.ts` now dispatches a v3 manifest and plan to `clc-garden-downstream.ts`. Its historical pilot branch is unchanged. The extension supports:

- `bun run --cwd packages/contracts contracts -- release downstream --mode simulate --manifest config/clc-garden-exchanges.json --plan .generated/clc-release/<release>.plan.json`
- The same inputs with `--mode broadcast` rehearse remaining deployments before the existing keystore credential flow. Only the exact new factory calls are sent; configuration, issuance, funding and Safe owner calls remain excluded.
- The same inputs with `--mode verify` reconcile canonical live receipts without signing. Optional `--receipts .generated/clc-release/<release>.receipts.json` supplies an exact contiguous component-to-transaction map. `--recover-lock` is available only in verify mode and rejects a lock whose process may still be alive.

These are implemented operator commands, not commands run live in this task. Committed source/manifest checks and exact current plan binding remain mandatory. The deployment preparer and journal are separately bound to chain 100, source revision and plan digest. An ambiguous pending intent blocks another send. An explicitly supplied replacement receipt may reconcile the same sender/nonce/target/value/calldata after canonical verification, retaining the original-to-replacement hash audit; it never automatically resends.

The execution journal lives in `.generated/clc-release/<release>.execution.json`. After complete canonical receipts, expected CLC runtime/admin/implementation, initial local pool state, and current authorities pass verification, the operator writes **new** `deployments/100-garden-exchanges.json`. It never overwrites `100-pilot-downstream.json`. The new deployment artifact contains immutable plan, addresses, receipt and initializer facts; changing adopted GG balances/authority observations go to a separate `<release>.readback.json`. A regression proves legitimate subsequent GG reserve activity can refresh readback without rewriting or rejecting deployment identity. Verification is the deployment/pre-activation phase; later member issuance/local funding belongs to the separate activation readback.

`<release>.registration.json` contains the exact live indexer address/start-block/deployment receipt and the Shared-compatible pool record: all six proxy pins, owner, administrator, factory deployer/salt/initializer, runtime and implementation hashes, block/transaction receipts, garden, pool ID and per-pool listings. It is marked `canonical-live` and application activation remains pending. The indexer owner can add its verified address/start block to `CLCSwapPool`; the Shared catalog owner can consume the verified pool record after admission/funding/source readback and curation approval. No generated file is silently promoted into either production catalog, and no simulated receipt or predicted-only address is eligible. The current production config remains GG-only.

### Member approval evidence

The durable desk's exact draft and signed approval export must be reviewed and published as evidence at HTTPS before its reference/digest is put in the member manifest. The exported `issuer-approval:100:<member>:<draftId>:<revision>` reference alone is not proof of a signature. The contracts manifest retains its HTTPS provenance constraint; terms and approval digests must correspond to the reviewed evidence. Actual member signing and source/reserve readback remain activation gates. No regex-only URI acceptance or automatic minting was introduced.

### Additional verification

- Execution RED at approximately 05:26 UTC: the new CLI regression rejected `--manifest` on `release downstream` before the extension existed.
- Final script proof at 05:41:32–05:42:03 UTC: `bun run --cwd packages/contracts test --suite script -- script/utils/clc-garden-execution.test.ts script/utils/clc-garden-release.test.ts script/utils/clc-garden-readback.test.ts script/utils/clc-member-release.test.ts script/utils/clc-member-simulation.test.ts` — **89 tests and 39 CLI Node checks passed**.
- `bun run --cwd packages/contracts typecheck` passed after execution/recovery changes. `git diff --check -- packages/contracts packages/indexer/test/voucherIssuer.test.ts` passed.
- Focused execution regressions cover mode/manifest binding, exact plan/source journal binding, chain/nonce/calldata/canonical block/runtime/admin/implementation/fee drift, simulation promotion rejection, immutable artifact versus live state, explicit replacement recovery and changed-calldata replacement rejection. These are unit boundary proofs; no live signing/broadcast was exercised.
- CLI registry changes are sensitive and intentional: downstream gains optional v3 manifest/plan/receipts, verify mode and dead-lock recovery. No dependencies or permissions changed.

The lead owns consolidated critical gates, package consumer tests/builds and hub status. No source contract, ABI, historical deployment record, production indexer pin, branch, commit, or live state was changed by this lane. Full activation remains gated on financial/curation inputs, actual governance reconciliation, source/member signing evidence, and explicit live authorization.

Task record: cosmo-local-credit-interop / two pools P1–P4 + indexer compatibility + ontology/docs integration | Type: feature | Outcome: local implementation and owned verification complete; live activation gated
Agent/model: `/root/two_pool_contracts`; model unknown | Coverage: contracts/indexer/ontology/docs segment through 2026-11-08 07:25 UTC

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | 04:43:46 → 04:47:15 | Owning guidance, live/historical release boundaries; preserved parent-only Linear ownership. |
| Implement / verify | 04:47:15 → 05:16 | v3 preparer/readback, governance tests, independent pool fixture, indexer replay test; command results above. |
| Investigate / verify | 05:06 → 05:21:40 | Traced stale production artifact, rebuilt owned target list, all 24 fork tests passed. |
| Review / implement | 05:21:40 → 05:41:32 | Added the reviewed v3 downstream execution/recovery/registration path; kept historical branch and artifacts intact. |
| Verify | 05:41:32 → 05:42:42 | 89 script tests, 39 CLI checks, typecheck and diff checks passed; live activation remains gated. |

Human corrections: unknown in this delegated segment; attention: unknown.

## Ontology and documentation integration

At the lead's request, the canonical ontology now defines Service Voucher, Voucher Exchange Pool, and Voucher Award, plus the award state vocabulary/lifecycle and constraints for independent curation, two-pool adoption, and exact existing-reserve transfers. Capability projections distinguish the deployed GG/collective vouchers from the unprovisioned TAS exchange and unpromoted award service. Public glossary examples cover hub days, local designer services, the separately curated Green Goods offerings, and recognizing past contributions. A prepared award is never described as payment.

Generated formal reference, agent manifest, glossary, data-model diagrams, and dependent documentation were regenerated through their existing commands. The existing docs generator now reads the two new route-constant sources and groups the voucher entities explicitly. No generic parser, alternate glossary, or drift-baseline entry was added.

Sensitive integration changes: `.github/workflows/ontology.yml` and `scripts/data/validation-policy.json` add the 16 exact new ontology anchor/evidence paths; `.github/workflows/docs.yml` and the same policy add the two exact API route-constant source paths. All prior filters and permissions remain intact. The workflow catalog itself did not change.

Observed proof by 2026-11-08 06:18 UTC:

- `bun ./scripts/quality/check-ontology.mjs --generate` and `bun ./scripts/docs/generate.mjs --scope ontology` passed after explicit diagram/glossary registration.
- `bun run check --only ontology` passed: 73 fixtures plus the drift gate. Initial RED exposed missing exact CI routing; those routes were added, not waived.
- `node --test scripts/docs/generate.test.mjs` passed 46 tests, including exact API route registration, every canonical glossary anchor, and all entity relationships/lifecycles.
- `node --test scripts/quality/ci-gate.test.mjs scripts/quality/workflow-performance-parity.test.mjs` passed 74 tests. No permissions or workflow protection were weakened.
- The package, workflow, and integration documentation projections are being regenerated/checking freshness. The new Mermaid diagram parse and ABI artifact check are running separately.

Fresh public Gnosis observation at 2026-11-08T05:50:17.657Z, block 49,168,571: GG exchange pool `owner()` is the reviewed GG AccessManager; `hasRole(uint64,address)(0, GG Safe)` returns `(true, 86400)`. The Safe is an administrator with a 24-hour execution delay, not the manager contract itself. This was sent to the award/desk owner for correct authority handling.

The full contracts gate started at approximately 05:43:45 UTC with `bun run --cwd packages/contracts test`. It is still in its initial 142-file Solc compilation as of 06:18 UTC under substantial host contention; no result is claimed. The lead's read-only process diagnostic confirmed an active Solc child. This lane owns the remaining serialized build and `./scripts/contracts/verify-production.sh --skip-e2e --skip-dry-run` after that gate; the lead owns consumer suites/builds. No duplicate compiler was launched.

At approximately 06:22 UTC, after application/API sources were frozen:

- `bun ./scripts/docs/generate.mjs --scope package`, `--scope qa`, `--scope workflow`, and `--scope integration` completed; `bun ./scripts/docs/generate.mjs --check` passed for all 17 projections. The existing QA catalog source changes were preserved and its generated projection refreshed canonically.
- `node --test scripts/docs/mermaid-parse.test.mjs` passed the rendered Mermaid syntax check (all generated diagrams, one fixture).
- `bun run check --only abi-artifacts` passed (one fresh selected check).
- `git diff --check -- packages/contracts packages/indexer/test/voucherIssuer.test.ts packages/shared/src/ontology scripts/docs scripts/data/validation-policy.json .github/workflows/ontology.yml .github/workflows/docs.yml docs/docs/reference docs/docs/builders/architecture docs/docs/builders/packages docs/claims.generated.md` passed.
- `bun run check --only docs-authority` is running the combined documentation gate. No rendered browser UI evidence is claimed by this contracts/docs lane.

At approximately 06:27 UTC, `bun run check --only docs-authority` passed the combined fixture/audit/freshness gate (131.367s under host contention). Two existing editorial advisories remain in `architecture/anatomy.mdx` and `integrations/eas.mdx` for endpoint literals; no hard authority error or stale projection remained.

Read-only compile diagnosis at approximately 06:30 UTC: `bun run --cwd packages/contracts test --explain` confirms the running step is the ordinary suite under `FOUNDRY_PROFILE=test`, `via_ir=true`, `optimizer=false`, Solc 0.8.28/Cancun, with `--no-match-contract E2E --no-match-path test/fork/**` and the existing three release-gas exclusions. The test cache was last updated on October 26; 40 cached source paths have later modification times, including unrelated Hats/CookieJar/Yield/entitlement changes and ordinary unit/integration tests. The modified CLC journey/member fixtures are referenced only by the separately proven Gnosis fork file. The log does not expose the compiler's exact standard-JSON input, so exclusion from execution is not claimed as proof of exclusion from compilation. The existing profile comment records prior M4 cold-compile timing of 195 seconds; the current >45-minute run is abnormal and coincides with observed host contention. Optimizer is disabled. The subsequent release-gas step intentionally forces a separate full production build under existing policy; no cache bypass or policy change was introduced.

Final maturity correction: `voucher-exchange-pool` is marked deployed because the Green Goods exchange already exists. Its evidence separately identifies the additional TAS pool as unprovisioned and the two-pool product activation as pending. After this single field correction, formal/package/ontology/integration projections were regenerated; `bun run check --only ontology` passed again (73 fixtures, zero baselined findings), and all 17 documentation projections passed freshness checks.

The initial full-gate compiler completed successfully at approximately 06:33 UTC: Solc 0.8.28 reported `finished in 2957.69s` and warnings only. Standard tests then began. This confirms the long compilation was not a compiler failure; the full gate outcome remains pending until test/gas/script stages finish.

At 06:35:49 UTC, the full standard Solidity stage passed: 171 suites, 2,233 tests, zero failures/skips, 126.10 seconds execution. Its nonfatal sandbox signature-cache warning did not fail the suite. The wrapper then entered the required release-gas stage and its full unlinked production-artifact rebuild. The overall full contracts command is still pending that stage and the following script suite.

Final formatting follow-up: Biome normalized only the two owned ontology source JSON files (short arrays). `node scripts/dev/node-cli.js biome format packages/shared/src/ontology/green-goods-ontology.json packages/shared/src/ontology/green-goods-projections.json scripts/data/validation-policy.json` then passed without changes. Their generated projections were refreshed; ontology again passed with zero baselined findings and all 17 documentation projections remained current. No runtime semantics changed.

At approximately 06:50 UTC, the initial full contracts command finished with one script-test timeout: Solidity 2,233/2,233 passed, isolated release-gas fixtures 3/3 passed, CLI checks 39/39 passed, and script tests 803 passed / one failed. The only failure was the existing keystore test's unchanged 60-second deadline while encrypting a synthetic wallet and performing 23 real Cast decrypt calls; it ran about 75 seconds under contention. No implementation assertion failed.

`bun run --cwd packages/contracts test --suite script -- script/utils/keystore-session.test.ts` then passed all four tests (27.31 seconds) with the same deadline and assertions. No test or keystore code was changed. The remaining verification wrapper will use the installed Vitest-supported `VITEST_MAX_WORKERS=2` resource cap, retaining its entire scope and all timeouts. This is not a passing claim for the original aggregate command; the subsequent whole wrapper outcome is recorded separately.

At approximately 06:52 UTC, `bun run --cwd packages/contracts build` passed through the existing adaptive wrapper (source targets, test/script excluded as documented). `VITEST_MAX_WORKERS=2 ./scripts/contracts/verify-production.sh --skip-e2e --skip-dry-run` then started as the remaining required verification gate. It includes its own full build, static lint, and whole contracts test wrapper. Only the supported Vitest resource cap differs from default concurrency; no required checks are skipped beyond this selector's documented fast-mode flags.

Read-only explanation of the second compile: adaptive `--mode full` sets `skipTest=false`, `skipScript=false`, and no target filter, selecting the test profile without `--force`. The standard-suite test cache written at 06:33:39 UTC contains 506 sources and omits `GnosisVoucherPilot.t.sol`, `CLCMemberProjectFixture.sol`, and `CLCVoucherJourneyFixture.sol` entirely; ordinary entitlement source/unit entries are fresh. The full build therefore must add the fork/E2E/script graph excluded by the standard suite. The earlier focused fork used the default match profile, and the gas gate rebuilt the separate production profile, so neither supplies the missing test-profile artifacts. This later cache evidence resolves the earlier uncertainty about whether the standard compile included those fixtures. No gate or cache policy was changed.

At approximately 07:10 UTC, the lead's broader validation-system run exposed additional selector integration lists (separate from CI workflow filters). `scripts/data/validation-policy.json` now also mirrors all 16 new ontology paths in the local ontology conditional rule, adds the four new API/generator inputs to docs-generated, and classifies `useServiceIssuerDesk.ts`, `useVoucherAwards.ts`, and `voucher-award-send.ts` as critical. The old `useServiceIssuerOnboarding.ts` exact entry was removed because its implementation is now exclusively a read-only listing query; the signing responsibilities moved to the explicitly classified desk hook.

At the lead's refined instruction, the concurrent `wallet-endow-batch.ts` source was inspected only to confirm that `sendOctantWalletBatch` forwards `sender.batches` to `sendDepositBatch`; its exact path was added to the critical list. Its runtime and tests remain untouched, and this metadata classification is not a runtime-review claim for that separate work.

`node --test --test-name-pattern='local ontology routing|every docs generator input|every Shared file that signs' scripts/quality/select-validation.test.mjs` passed all three checks. The policy format check passed, affected package/workflow/QA projections were regenerated, and all 17 documentation projections passed freshness. No exception or baseline entry was added.

Verify-fast full compilation passed at 07:09:17 UTC (979 seconds). The wrapper then passed static lint and advanced to its whole contracts test stage.

## Final contracts gate result

At approximately 07:19 UTC, `VITEST_MAX_WORKERS=2 ./scripts/contracts/verify-production.sh --skip-e2e --skip-dry-run` completed with **exit 0** and all selected verification checks passing (1,593 seconds total): full build 979s; lint 40s; whole test phase 538s. That whole test phase passed **2,233 Solidity tests**, all **three isolated production release-gas fixtures**, **39 CLI checks**, and **804 script tests across 62 files**. The prior keystore timeout did not recur under the supported two-worker resource cap; no timeout or assertion changed. E2E and dry-run phases were skipped only by the selector's existing fast-verification flags.

The refreshed focused Gnosis voucher fork proof is now running against the final production artifact tree. The full validation-system selected gate will follow it sequentially, as requested by the lead.

At 07:21:27 UTC, `bun run --cwd packages/contracts test --suite solidity --profile match -- test/fork/GnosisVoucherPilot.t.sol` passed again against the final artifacts: **24 tests across three suites, zero failures/skips** (5.52s execution). This includes earned TSV reaching Green Goods, independent local/GG admission and inventory, local-cap failure preserving network inventory, member authority, and the request/exchange/redemption journeys. Only nonfatal global Foundry RPC/signature-cache write warnings remained under the sandbox. `bun run check --only validation-system-test` then started as the final aggregate policy proof.

## Lane completion

At approximately 07:24 UTC, `bun run check --only validation-system-test` passed **432/432 tests** with zero failures/skips (64.709s selected gate), closing the earlier aggregate policy failures. Final owned-path `git diff --check` passed, and the documentation generator again confirmed all **17 projections current**. No background compiler or verification command remains in this lane.

Additional phase record:

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Implement / verify ontology and docs | 05:43 → 06:38 | Three canonical entities, award lifecycle, independent pool policy, generated projections and exact CI routing; ontology/docs/format proof passed. |
| Verify broad contracts gate | 05:43:45 → 06:50 | Stale-cache compile completed; 2,233 Solidity + 3 gas + 39 CLI passed; 803 scripts passed, one existing keystore timeout. |
| Verify focused recovery | 06:50 → 06:52 | All four unchanged keystore tests passed; adaptive package build passed. |
| Verify required fast gate | 06:52:23 → 07:19 | Full compilation, static lint, 2,233 Solidity, 3 gas, 39 CLI and 804 script tests all passed; supported two-worker Vitest cap only. |
| Correct validation metadata / verify | 07:07 → 07:10 | Exact selector input/critical lists corrected, including confirmed concurrent sender classification; three focused guards and docs freshness passed. |
| Verify final fork and policy aggregate | 07:20 → 07:25 | Refreshed 24-test voucher fork and full 432-test validation-system gate passed; final diff/docs checks passed. |

The lead retains ownership of consumer suites/builds, rendered UI evidence, final integration review and Plan Hub/Linear state. Activation still requires approved operating inputs, the explicit TAS one-approval governance reconciliation, committed release inputs, reviewed source/member evidence, and separately authorized live execution. No live transactions, production address promotion, historical deployment rewrite, dependency installation, branch change or commit occurred in this lane.
