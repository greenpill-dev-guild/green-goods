# Test budget and CI feedback plan

**Feature Slug**: `test-budget-and-ci-speed`
**Stage**: `active`
**Status**: `ACTIVE — Software Factory locally implemented through batch 5; live observations and snapshot 09 pending`
**Created**: 2026-09-19
**Last Updated**: `2026-10-15`

The user selected local implementation beginning with step 1 and later authorized a commit of completed slices. Item numbers below refer to the supplied twelve-item test-audit prompt. The closeout pass may push to `origin/develop` (D4); a PR, a merge to `main`, a deploy and Linear writes remain unauthorized.

## PRD-1158 repository-wide scope (2026-10-15)

**Selected by the user; batch implementation and verification are in progress on PR #1102.** The user expanded the assessment to the whole repository after PR #1102 delivered a narrow replacement rather than the intended reduction in low-value testing burden. This section supersedes the earlier three-suite implementation scope and expands the first repository pass to 62 numbered candidates: 60 core candidates (R01–R56 and R59–R62), plus R57/R58 as separately qualified proposals. Delete redundant tests and unused support first; add proof only for an identified protection that would otherwise be lost. Do not introduce new test files, support layers or fixtures for this cleanup.

### Baseline and assessment boundary

- Assessed PR head: `547e64248390d72b94a1ecc5772b4d7c9bc9fe9a`, branch `test/meaningful-regression-tests`; original develop base: `6be1e3729b4127ccb669bda5e57adc4b2100ce93`.
- Existing PR: test/support code **293 added, 558 deleted, net −265 lines**; entire PR **582 added, 565 deleted, net +17 lines**. Selected scenarios grew from 43 to 61. The earlier [implementation evidence](handoffs/prd-1158-scope.md) is historical, not completion of this broader scope.
- Develop was last read during the first repository pass at `98a83acea4500d6626c7a123b0a162ad54bf06f7` on 2026-10-15. Its queued-upload/code-load recovery fix changes 21 files; none overlapped the first pass's proposed removal paths. The implementation-start fetch confirmed that none of the deeper removal candidates overlaps those recovery files. Keep its new recovery proof. Recheck drift and callers before implementation; this assessment does not merge or switch branches.
- Inventory: **1,296 tracked test source files / 352,204 physical lines** at the assessed head. This includes `.test.*`, `.spec.*`, Solidity `.t.sol`, two Contracts `.node-check.mjs` files and Indexer's `test/test.ts`. Excludes dependency/vendor/generated trees, plan scratch tests, support files and binary artifacts. The separate 302-line Solidity realism fixture script was also inspected and retained.

| Surface | Test files | Test source lines | Assessment coverage |
|---|---:|---:|---|
| Shared | 619 | 150,836 | Type family, helpers/barrels/callers, high-mock hook families, component duplicates and source guards |
| Admin | 148 | 34,890 | Route harnesses, access/empty states, duplicate mocks and owning suites |
| Client | 150 | 41,106 | Presentation duplicates, persistence overlap, recovery/queue/auth exclusions |
| Contracts | 184 | 64,870 | Solidity and operational test inventory; storage/getter cases, unused support, security/release exclusions |
| Indexer | 37 | 11,117 | Retained-surface smoke cases versus handler tests; preserve mixed-event accounting |
| Agent | 68 | 18,124 | Setup/fake reachability, SQLite artifacts, persistence/auth/failure exclusions |
| Root scripts, including QA | 54 | 24,155 | All parsed; mutation/subprocess bodies consolidated without losing scenarios (R56); policy, CI and QA guards retained |
| Docs | 9 | 1,474 | Generator/audit failures, chart transforms, diagram IDs and theme contracts; retained |
| Root browser/fixture tests | 27 | 5,632 | All 22 Playwright specs and five fixture test files inventoried; dormant specs and unused helpers traced |

The deeper pass structurally covered all **1,296 files**: the installed Babel parser read **1,144 JS/TS files with zero parse errors**, identifying 11,469 test callback declarations, 14 exact callback-body clone groups, 45 cases without direct assertions, 207 files with at least five mocks and 14 files with skip markers. The other 152 files are Solidity. These counts are screening signals, not final runner counts or deletion findings. Identical bodies can protect different adapters or parameter tables; assertions can live in helpers/subprocesses.

Semantic follow-through inspected flagged bodies, owners, survivor tests and helper call graphs:

- **Shared:** all 619 files parsed; reviewed five exact clone groups, eight no-direct-assertion cases, 28 files without static production imports, 66 files with light-assertion flags, 48 import/mock overlap flags, and 21 suites with at least 12 mocks. Traced 15 test-utils files, 14 mock files and one fixture. Read the three largest flagged behavioral suites and retained their distinct recovery/transaction protections.
- **Admin/Client/browser:** all 325 files parsed; deeper relevant-body/harness inspection covered 60 distinct test files (18 Admin, 31 Client, 11 root browser), alongside routing, persistence, workflow and rendered owners. Screened all 23 no-direct-expect flags: ten dormant cases, nine helper/poll cases, one iPhone diagnostic, two existing skip/placeholder cases and R42's ineffective fork case.
- **Contracts/Indexer/Agent:** all 289 test sources / 94,111 lines inventoried. Contracts coverage includes six root, 61 fork, 61 unit, four invariant, 18 integration, one schema, one recognition-fuzz and 32 operational-tooling files. All 37 Indexer and 68 Agent sources were screened; the latter include unit, real storage SQLite, reporting SQLite and pure reporting families. Trace-based inspection distinguished obsolete/copied mocks from live deployment, money, authorization, event history and persistence proof.
- **Root tooling/QA/Docs:** all 63 files parsed, with 1,116 recognized callbacks. Screened 26 groups/85 cases with identical structure after literal normalization, subprocess assertion ownership and unused local declarations. Keep all nine Docs suites; R56 only consolidates repeated invocation plumbing.

This is a complete structural inventory plus targeted semantic inspection, **not a claim to have manually read every one of the 352,204 lines**. The retained-coverage table below records why flagged families remain. Installed Knip ran read-only in the first pass with `--include files,exports`, then `--include-entry-exports`; both exited 1 with findings. Manual caller/config searches rejected internal-use false positives, and this pass resolved several earlier conditional candidates. No dependency/configuration changes or repository behavioral suites ran during planning. R57's disposable SQL probe is separately labeled below.

### Concrete removal candidates

IDs below are proposed implementation scope. All paths are repository-relative; ranges refer to the assessed head. Savings are **net test/support lines**, including the stated retained-proof allowance. Partial-file figures are estimates, not an achieved deletion count.

| ID | Remove or consolidate | Surviving proof / required transfer | Expected net reduction |
|---|---|---|---:|
| R01 | Shared `types/domain-types.test.ts`: entire 465-line file, 22 literal-only cases | Remove runtime assertions of assigned literal values. Test typechecking includes this file: retain 10–30 lines of intentional compile-time compatibility, including WorkMetadataV1 legacy plantCount/plantSelection/timeSpentMinutes, in existing `utils/eas/work-metadata.test.ts`. Normal source/test typechecks retain active consumer contracts. `useAssessmentDraft.test.ts` tests AssessmentWorkflowParams persistence, not AssessmentDraft v2 type shape; do not cite them as equivalent. No new file or replacement literal-runtime assertions. | 435–455 |
| R02 | Shared `types/marketplace-types.test.ts`: 126 lines, five literal-shape cases removed | Keep the six genuine `LISTING_DEFAULTS` assertions beside existing `modules/marketplace/signing.test.ts` order-building/duration/nonce tests; budget 11–26 lines. Do not remove the real order construction tests. | 100–115 |
| R03 | Shared `types/domain-enums.test.ts:21–27,60–87,98–104`: two numeric-type and three JavaScript bitwise cases | Exact numeric wire mappings and reverse mappings remain in the same file. Those already catch the enum changes these cases depend on. | 42 |
| R04 | Shared `hooks/hypercerts/useCreateListing.test.ts:197–204,442–472` and `hooks/app/useNavigateToTop.test.ts:24–29,53–64` | Remove function-existence/static step-list/already-idle reset cases and duplicate default navigation. Retain real pending→error→reset→retry listing case and navigation invocation/default/options/scroll checks. Drop exclusive imports. | ~58 |
| R05 | Shared `components/Button.test.tsx:124–138` and `components/design-system-foundation.test.tsx:63–76` plus exclusive Button import | Transfer tertiary/sm props into the retained loading/focus/click case at 42–57, plus all four unique assertions: positive gg-button class, tertiary emphasis, sm size and broad absence of gg-button-* classes. Preserve default/secondary/asChild and native-control/DatePicker guards. A disposable formatted proposal supports the reduced estimate. | 21 |
| R06 | Shared unused `test-utils/offline-helpers.ts` (214 lines + barrel edge), `test-utils/render-helpers.tsx:78–125`, `test-utils/mock-factories.ts:172–192,369–388,412–431` | No executable consumers of offline helpers, navigator/credential/wait wrappers, CookieJar/allowlist/outcome factories. Remove exclusive imports/headings; keep active render/query wrappers, `createMockAuthContext` and job-queue factories with internal consumers. | ~328 |
| R07 | `tests/specs/client.work-submission.spec.ts` (448), `client.work-approval.spec.ts` (369), `client.offline-sync.spec.ts` (561) | All 37 cases are unconditionally skipped, including manual runs. Active `client.work-submission.ci.spec.ts`, `client.offline-work-submission.ci.spec.ts`, `client.work-approval.ci.spec.ts` and WorkDashboard tests cover current flows. Removing these loses no active proof; it does not establish full real-wallet coverage or improve execution time. | 1,378 |
| R08 | `tests/mocks/pimlico-handlers.ts` (311) and its exclusive `tests/fixtures/pimlico-handlers.test.ts` (21 / four cases) | Only executable consumer is the fake's own test. Qualified passkey specs own strict substitutes. Delete helper and exclusive tests together; correct README and the retired-path entry in `scripts/quality/check-codex-docs.js`, preserving that checker. | 332 |
| R09 | Unused root browser helpers: `test-utils.ts` (384), `test-config.ts:40–271` (232), `anvil-fork.ts:466–518` (53), `contract-helpers.ts:378–394` (17) | Remove unused authenticator/class/service/selector/retry/generator wrappers. GraphQL/hasGardens tail becomes unused after R07. Retain active wallet lifecycle and qualified passkey fixtures; R38 separately retires the remaining dormant legacy passkey chain. Keep snapshot/revert, `TIMEOUTS`, `TEST_URLS.indexer` and seeding helpers. Exact ranges below. | 686 |
| R10 | Duplicate Admin mocks: `components/CanvasLayout.test.tsx:452–482`, `components/Hypercerts/MetadataEditor.test.tsx:138–140`, `components/CreateAction.test.tsx:339–341` | Delete only identical second `vi.mock` blocks; retain first blocks and every scenario. | 37 |
| R11 | Admin `routing/garden-pool-route.test.tsx` (57), `community-pools-route.test.tsx` (55), `hub-confirm-route.test.tsx` (71), `pooling-route-harness.tsx` (72) | Delete recursive fake-loader harness only after unique view/params/context/compatibility rows move to existing `runtime-navigation.test.tsx` and unique builders to Shared `utils/admin-routes.test.ts`. Additionally transfer /hub/confirm and /hub/confirm/9→requestedStage confirm into Shared `hooks/admin-ui/hub-workbench-model.test.ts` using routeStateFor. Runtime route matching does not prove stage resolution. Reserve 53–97 total retained lines; matrix below remains mandatory. | 158–202 |
| R12 | Admin `components/empty-state.test.tsx`: 310-line overlapping harness | Existing `routes/IndexRoute.test.tsx` owns access state and eligible-garden redirects. Carry CTA navigation and can-create rejection there; carry all three no-garden Canvas redirects into existing `CanvasLayout.test.tsx`. Allow 70–110 added lines; keep auth/loading/indexer-error tests. | 200–240 |
| R13 | Client `components/display-mode.test.tsx:215–248` and exclusive SiteHeader mocks/messages/helper/imports: ~90 lines | Existing `SiteHeader.test.tsx` owns navigation/hamburger; `routes/PublicShell.test.tsx` owns actual no-AppBar composition. Carry fixed/top positioning assertions there if retained. Keep all eight AppBar states. | 85–90 |
| R14 | Contracts `test/StorageLayout.t.sol`: eight `*GapSize` arithmetic cases (93 lines); `test/unit/CookieJarModule.t.sol:696–701` (six lines) | Hard-coded sums and `assertTrue(true)` cannot detect storage changes. Keep concrete slots, upgrades, authorization, committed layout baselines and real checker. Four contracts lack checker coverage; record that existing gap without pretending arithmetic protected it. | 99 |
| R15 | Contracts `test/StorageLayout.t.sol`: seven getter-only `*StorageSlots` cases, 118 lines | Same-file `*UpgradePreservesState` cases retain GardenToken, Octant, Hats, Gardens, UnifiedPower and Yield facts; `unit/ActionRegistry.t.sol:testInitialize` retains owner. Carry Octant `pendingDeactivations(asset)==0` and Hats owner assertions (two lines). Keep GardenAccount immutables and every actual slot/load case. | 116 |
| R16 | Unused Solidity support: `test/helpers/EASHelper.sol` (82), `test/helpers/MockCookieJarFactory.sol` (31), `src/mocks/Unlock.sol:7–24` (18) | No executable consumer; current CookieJar tests use `CapturingCookieJarFactory`. Remove only `MockUnlockFactory`, retain used `MockPublicLock`, narrow exclusive import. | 131 |
| R17 | Indexer `test/test.ts:15–45,67–89`: duplicate action registration/title update and Garden mint cases | Keep actual registration/update in `actionRegistry.test.ts` and minted fields/roles in `garden.test.ts`. Before deletion, transfer `assert.equal(action.domain, "WASTE")` into the retained title-update case: registration assertions alone do not prove preservation after update. Keep mixed-domain mask and Octant mixed-event totals sequence. | 53 |
| R18 | Agent unused `src/__tests__/utils/mocks.ts:13–34` + Address import (23), `setup.ts:103–139` (37), `setup.ts:45–63` (19) | No callers for blockchain fakes, simulation/reset wrappers or timestamp setter. Replace the timestamp getter's sole internal use with `Date.now()`. Keep logger, auth/crypto globals, SQLite and handler error proof. | 79 |

Shared rows R01–R06 use paths under `packages/shared/src/__tests__/`; Admin rows use `packages/admin/src/__tests__/`; Client R13 uses `packages/client/src/__tests__/`. Contracts/Indexer/Agent paths use their respective package roots. At implementation, remove exclusive imports and obsolete headings as part of each deletion, not as a new abstraction.

R09 exact `tests/helpers/test-utils.ts` ranges: `9–13,44–88,134–151,378–460,579–693,700–705,742–853`. Verify receiver-qualified class calls and dynamic/config references again, rather than equating an unused export with an unused function. `scripts/dev/seed-test-data.ts` still calls `registerAction`, `submitWork`, `approveWork` and `createActionTimestamps`; those stay.

R11 minimum transfer matrix: `/garden/pool`, `/garden/pool/seed`, `/garden/pool/:commitmentId` must resolve the Garden module; `/hub/confirm` and `/hub/confirm/:commitmentId` must resolve Hub. Assert exact detail params, no router errors and retained garden query context. Preserve `/community/pools`→Coordination, currently tested governance redirects and `/hub/history` compatibility. Check expected owning-view markers for retained canonical routes as well. Transfer `gardenPool`, `gardenPoolSeed`, `gardenPoolCommitment`, `hubConfirm`, `hubConfirmDetail` and workspace-resolution examples only where absent from the existing Shared suite. Do not copy obsolete route-tree shape assertions. Also preserve stage resolution independently: use Shared `hooks/admin-ui/hub-workbench-model.test.ts` routeStateFor on both /hub/confirm and /hub/confirm/9, asserting requestedStage=confirm. R39 separately transfers fallbackStage=work.

R14 arithmetic case names: GardenToken, OctantModule, HatsModule, GardenAccount, ActionRegistry, GardensModule, UnifiedPowerRegistry and YieldResolver `GapSize`. R15 getter-only case names: the same list except GardenAccount. Storage checker lacks OctantModule, GardensModule, UnifiedPowerRegistry and YieldResolver entries; expanding storage policy is a separate proposal with zero savings booked here.

### Deeper Shared candidates

R19–R33 paths are relative to `packages/shared/src/`. Where abbreviated below, test paths begin `__tests__/`; mock/support and colocated paths are written explicitly.

| ID | Remove or consolidate | Surviving proof / required transfer | Expected net reduction |
|---|---|---|---:|
| R19 | Entire `__tests__/modules/work-approval.test.ts`, 180 lines / 12 cases | No production runtime imports: assertions exercise local objects, copied feedback coercion, Number, thrown Error and JSON.parse. Keep actual `hooks/useWorkApproval.test.ts:704,741,770,925`, `utils/encoders.test.ts:132–180` independent ABI checks and `modules/submit-approval-command.test.ts`. | 180 |
| R20 | Entire `__tests__/providers/garden-filtering.test.ts`, 167 lines / eight cases | Local `filterGardensByUser` explicitly copies WorkProvider and omits current steward/pending semantics. Keep real `providers/WorkProvider.test.tsx:259,300,347`, `hooks/garden/useFilteredGardens.test.ts:83–135` and pending/TTL proof for the actual `hooks/work/useWorkSubmissionFlow.ts` membership path. | 167 |
| R21 | Entire `__mocks__/browser/indexeddb.ts` (170), `__mocks__/server/viem.ts` (50), `__mocks__/server/index.ts` (2), four barrel edges, unused `__mocks__/browser/navigator.ts:12–13,109–132` and `__mocks__/browser/crypto.ts:3–4,28–35` | No executable caller; keep active fake-indexeddb/auto, navigator/crypto initialization, Node/EAS/AppKit/WalletConnect mocks. Remove stale ./mocks/server manifest export/Knip entry, reconcile MODULES.md/generated projections and obsolete advisory entries. Manifest bytes invalidate all four certified seams: retain their 13 proof files and refresh fingerprints only after fresh proof and boundary review. Ancillary lines excluded from test/support LOC. | 262 |
| R22 | Static-list cases/imports in `hooks/app/useInstallGuidance.test.ts:325–339` and `hooks/hypercerts/useBatchListForYield.test.ts:349–364` | These two cases assert local string lists. Keep actual actions, readiness, signing, pending and recovery behavior. | 33 |
| R23 | Exact duplicates in `hooks/garden/useGardenPermissions.test.ts:122–130` and `modules/submit-approval-command.test.ts:77–87` | Same assertions survive at 113–120 and 67–75 respectively, against the same production owners and inputs. | 20 |
| R24 | Five `isZeroAddress` cases and exclusive import in `hooks/hypercerts/hypercert-utils.test.ts:139–164` | `utils/vaults.test.ts:98–123` already exercises the identical owner and more boundaries. Preserve distinct timeout/abort tests. | 27 |
| R25 | Five weak/duplicate cases and imports in `modules/gql-client.test.ts:17–25,40–48,101–127` | Keep factory/singleton identity, actual request/error proof, `graphql-client-timeout.test.ts` exact error/default/cleanup and `graphql-client-offline.test.ts`. The removed “variables” case only rejects an invalid document; variable forwarding remains an existing gap, not a protection this deletion can claim. | 47 |
| R26 | Repeated success cases: `hooks/blockchain/useEnsAddress.test.ts:74–96`, `useEnsName.test.ts:72–82`, `useEnsAvatar.test.ts:82–93,130–141` | Use padded mixed-case ENS input in the retained address success/key example; transfer exact name resolver arguments and avatar cache lookup/write assertions (three assertions). Keep independent cache hit/miss, missing result, invalid/disabled input, failures, query keys and roster cache. | 55 |
| R27 | Ten function-existence/shape cases: `hooks/app/useTheme.test.ts:198–209`, `hooks/useDebugMode.test.ts:26–32`, `hooks/work/useWorkImages.test.ts:76–80`, `hooks/blockchain/useContractTxSender.test.ts:122–125`, `hooks/hypercerts/useBatchListForYield.test.ts:178–185`, `useCancelListing.test.ts:222–228`, `hooks/useAutoJoinRootGarden.test.ts:205–215`, `utils/errors/mutation-error-handler.test.ts:119–127,540–543` | Same-file invocation/failure tests already detect missing functions. Also tighten both `hooks/app/useBrowserNavigation.test.ts:48,91` comparisons from nondecrease to strict increase for pathname/search changes; the current comparisons accept unchanged keys. No savings booked for that assertion repair. | 67–78 |
| R28 | Duplicate `hooks/utils/useTimeout.test.ts:184–196` and assertion-free `hooks/utils/useCopyToClipboard.test.ts:198–216` cleanup cases | Retain timeout unmount/callback suppression at 170–182 and add timer-count zero immediately after unmount, before advancing time: isMounted can otherwise mask missing clearTimeout. Clipboard delegates scheduling to this real hook; reset/rapid-copy behavior stays. | 31 |
| R29 | Repeated progress bodies in `hooks/work/useWorkMutationWithProgress.test.ts:348–437`: 90 lines → 25–30 | Keep all six expanded scenarios: validating/compressing, uploading, confirming, syncing, complete and unknown/idle, using the real wrapper/progress hook. Table-driven bodies do not reduce scenario coverage. | 60–65 |
| R30 | `hooks/gardener/useGardenerProfile.test.ts:110–115,153–191` and weak error proof at 195–216 | Replace function names/name-only sending with four real field-write rows (Name, Bio, Location, Image), independently asserting ABI function/arguments, destination/value and pending states. Invoke refetch in the existing query case; assert logger/toast on the existing failure. Budget includes stronger assertions and imports. | 12–20 |
| R31 | Three duplicated opt-in Aave cases in `integration/arbitrum-yield-data.test.ts:81–139,265–331` plus exclusive Aave imports/address/ABI | Keep production ABI/WETH/DAI liquidity/APY in `utils/blockchain/aave.live.test.ts`; transfer nonzero aToken address and preserve ARBITRUM_RPC_URL or ARBITRUM_RPC activation/URL selection. Keep eight Octant/YieldSplitter cases. No default-run speedup claim. | 127–128 |
| R32 | Unused local support: `lib/hypercerts/distribution.test.ts:25–33`, `integration/arbitrum-yield-data.test.ts:55–66`, write-only subscription capture in `hooks/hypercerts/useHypercertDraft.test.ts:79–84`, and one unused constant each in `hooks/roles/useEffectiveToolbarPermissions.test.ts:50`, `hooks/roles/useHasRole.test.ts:16` and `modules/transactions/__tests__/wallet-sender.test.ts:27` | Preserve the typed two-argument unsubscribe stub and active fixture consumers. The unused live ABI block is distinct from R31. The wallet-sender path is colocated, not under the central test directory. | 29 |
| R33 | Ineffective auth case in `hooks/hypercerts/useCancelListing.test.ts:247–264`: 18 lines → 9–13 | Late vi.doMock runs after hook import and checks idle state. Use existing mutable signer fixture with no signer, invoke cancel and assert rejection before actual readiness/ownership/send boundaries. Encoder is not used by this hook and proves nothing. Both authentication modes remain. R61 books separate dead mock/plumbing removal and added readiness-boundary assertions. | 5–9 |

### Deeper Admin, Client and browser candidates

Admin/Client paths below begin `packages/{admin,client}/src/__tests__/` unless a full repository path is given.

| ID | Remove or consolidate | Surviving proof / required transfer | Expected net reduction |
|---|---|---|---:|
| R34 | Entire Client `query-persistence.test.ts`, 71 lines / two cases | Transfer a fresh-instance durable round trip into existing `config/queryPersistence.test.ts` compatible-migration cases for both backends: restore via a new instance without the legacy option (6–10 lines). Keep stale/incompatible/expired/quota behavior and Shared's real separate-instance IDB suite. | 61–65 |
| R35 | Entire Admin `workflows/createGarden.test.ts`, 210 lines / six cases | This imports only Shared machine/store and manually advances steps. Move first-failure→successful-retry, hash and retry-reset assertions (20–35 lines) into existing Shared `__tests__/workflows/createGardenMachine.test.ts`. Keep real `useCreateGardenWorkflow` and store proof; do not claim manual advancement tests UI wiring. | 175–190 |
| R36 | Entire Client `views/PublicGardenDetailSemantics.test.tsx`, 269 lines / two cases | Its 16-mock harness duplicates `PublicGardenDetail.test.tsx:382–395`. Transfer the four intended sections’ aria-labelledby→nested h2 IDs, including About, ID uniqueness and absent prelaunch pool copy; scope the check so the real install CTA’s additional labelled section remains valid (20–35 lines) to that existing rendered suite. Preserve failed reads, pagination, navigation and portal behavior. | 234–249 |
| R37 | Admin `components/CreateAction.test.tsx`: 18 unreachable mock blocks (152 lines) and exclusive `mockRegisterAction` | Controller/steps/shell are already replaced; the 47-line legacy wizard mock and its children cannot execute. Remove blocks at 45–47,49–56,58–60,62–64,66–68,70–77,79–89,91–96,98–100,145–191,209–211,213–229,231–233,235–242,244–248,254–256,258–266,329–337, then exclusive declarations/imports. Keep all nine cases and real footer/send-status/cancellation/dialog/alert/button dependencies, dirty-close and focus behavior. R10 separately owns 339–341. | 150–170 |
| R38 | Always-skipped `tests/specs/client.smoke.spec.ts:64–94` and now-exclusive legacy passkey helper chain | Remove `tests/helpers/test-utils.ts:106–132,153–168,230–376`, dead CDP/authenticator fields/constructor state and `client.auth.spec.ts:96` cleanup after tracing R09/R38 together. Keep qualified `client.passkey.spec.ts` and `client.reporting-account.passkey.spec.ts` actual CDP ceremonies. Keep narrow storage-injected wallet/manual diagnostics; do not call the iOS URL smoke successful wallet authentication. Correct test architecture/E2E guide references. No overlap with R09 ranges. | 220–230 |
| R39 | Duplicates: Admin `components/Hypercerts/AttestationSelector.test.tsx:598–610`, Client `views/Login.test.tsx:545–551`, Admin `components/HubWorkCard.test.tsx:328–332`, `packages/admin/src/views/Hub/hub.workbenchModel.test.ts:42–55`, Client `components/SiteHeader.test.tsx:323–330` | Same-input owner assertions survive at 524–537,324–330,311–315 and Shared Confirm model respectively. Transfer fallbackStage=work into that Shared Confirm case; keep every other Admin Hub model case. Transfer no-backdrop assertion into SiteHeader all-routes case at 332–343. | 45 |
| R40 | `tests/specs/client.auth.spec.ts:278–292` two “failure/retry” cases and 216–238 “persistence” case | First pair only checks button visibility already covered. Persistence can return on auth failure and accepts both /home and /home/login, so it proves no restored session. Keep storage-injected connect/sign-out and qualified passkey rejection; these are not real wallet-connector proof. Real-wallet reload/session restoration remains an explicit coverage gap. | 37–41 |
| R41 | `tests/specs/client.navigation.spec.ts:194–217` unknown-route case | It accepts the requested unknown URL as success. In existing `packages/client/src/__tests__/routes/presentation-mode-routing.test.ts`, import actual publicAppRoutes/pwaAppRoutes, match unknown input, assert/invoke each matched wildcard loader and assert exact / versus /home redirect responses. Do not test combined appRoutes or presentation guard instead. Allow 12–16 retained lines in a two-row table. | 8–12 |
| R42 | `tests/specs/client.fork.spec.ts:177–207`, unused `_waitForIndexerSync:258–267` and exclusive ClientTestHelper import | Case creates a garden but checks an unrelated client and can return without assertions. Keep fork creation/membership at 100–123 and client smoke at 160–175. These are separate protections; no fork→indexer→browser integration claim. | 42 |
| R43 | `tests/specs/performance.spec.ts:218–264` optional PWA case | It succeeds with no worker, then reloads public /. Keep qualified `client.pwa-preview.spec.ts` production /home worker/offline reload proof, with cache-off, worker-request blocking and missing-cache controls. Do not claim public-root offline coverage. | 47 |
| R44 | Admin `components/Hypercerts/HypercertPreview.test.tsx` repeated default bodies 177–232,259–279, weak Edit-exists case 294–299, null metadata 339–363 and status bodies 371–452 | One populated-preview case retains every field/chart/recipient/percentage assertion; existing edit-click cases remain; combine null metadata; preserve all six expanded mint-status scenarios in a table. | 120–135 |
| R45 | Unused `TIMEOUTS` keys in `tests/helpers/test-config.ts:1–38` | Recheck after R09/R38; only elementVisible/modalAppear remain used. R09 starts at line 40, so ranges do not overlap. Preserve active timeout behavior. | 30–34 |

### Deeper Contracts, Agent and tooling candidates

R46–R54 paths are relative to `packages/contracts/`.

| ID | Remove or consolidate | Surviving proof / required transfer | Expected net reduction |
|---|---|---|---:|
| R46 | Entire `test/integration/HatsGAPIntegration.t.sol`, 500 lines / 14 cases | Uses only MockHats/MockGAP/GAPTestHelper/EAS and literal production addresses. “Cannot mint operator” checks hat.active; failure isolation calls another fake. Keep real `integration/HatsModule.t.sol`, `unit/KarmaModule.t.sol`, `integration/KarmaGAPReconciliation.t.sol`, resolver suites, `E2EWorkflow.t.sol` and forks. | 500 |
| R47 | Mock-only `test/unit/KarmaGAPModule.t.sol:11–288` plus imports 6–8 (23 cases), and exclusive `test/helpers/GAPTestHelper.sol` (531) | Keep real KarmaGAPModuleResetProjectTest at 290–355 unchanged. In real KarmaModule project/impact/milestone success cases, transfer at most 20 lines checking captured schema/recipient/refUID against independent wire constants/project UID, decoded project boolean/data/exists and meaningful impact/milestone payload fields. Keep count/idempotency/details-failure/retry proof and faithful reconciliation. Delete helper after R46/fake-only R47; R59 trims newly dead MockGAP internals separately. | 792–812 |
| R48 | Entire `test/unit/HatsModule.t.sol`, 377 lines / 23 cases | Transfer 50–70 lines into existing real `test/integration/HatsModule.t.sol`: configure adapter role hat maxSupply=1, grant first actor and assert second exact MaxSupplyReached; inactive role real grant→HatNotActive; immutable worn role real revoke→HatNotMutable; eligibility true→false, generated levels and positive/negative admin ancestry. An inactive role query alone masks an erroneous mint. Keep role/configuration/isolation/cascade/Karma/conviction/upgrade and RoleHierarchy invariant proof; retain required mock constraint controls. | 307–327 |
| R49 | Entire `test/schema/KarmaGAPSchemaValidation.t.sol`, 349 lines / eight cases | Private copied JSON escape/uint/substring validator tests an obsolete project-impact shape. Keep `test/unit/GAPJsonBuilder.t.sol` against actual `src/lib/JsonBuilder.sol`: current wire shape, escaping, empty/media, chain links, dates, domains and fuzzing. | 349 |
| R50 | Entire `test/unit/AaveV3YDSStrategy.t.sol` (242 / 26 cases) and exclusive `test/helpers/AaveV3Legacy.sol` (93) | Helper is explicitly superseded and exists only for its own tests. Keep current `unit/AaveV3ERC4626.t.sol` (27 cases), fuzzing, real vault/Arbitrum repair proof. Do not migrate obsolete API tests. | 335 |
| R51 | Entire `test/unit/GoodsProject.t.sol` (588 / 33 cases) and exclusive `src/mocks/Juicebox.sol` (318) | Tests copied deployment configuration and MockJBController/Terminal/GOODS/JBTokens. Keep distinct used `src/mocks/YieldDeps.sol` MockJBMultiTerminalForYield and real GoodsToken/Gardens ownership/yield/operational proof. Remove only the stale foundry.toml compilation restriction for the deleted mock. Actual Juicebox deployment-configuration proof remains an existing gap; fake-local tests never certified it. | 906 |
| R52 | Entire `test/unit/DirectVaultInteraction.t.sol`, 182 lines / 13 cases | Transfer 20–30 lines of still-used mock fidelity into existing integration owner: zero-share/overbalance redeem and role-manager rejection. Its non-token literal cannot establish ERC20 custody. Keep real VendoredVault/Aave/fuzz/OctantVaultIntegration/mixed lifecycle proof; retain required vault interface methods and shared transfer helper. | 152–162 |
| R53 | Eight standalone GoodsToken duplicates across Sepolia/Arbitrum fork suites, 137 gross lines | Move exact zero-available error and burn-at-cap/remint-capacity assertions (14–20 lines) into existing `test/unit/GoodsToken.t.sol`. Preserve both forks' full-stack initial wiring/staking and unit allowance/transfer/burnFrom. Exact source ranges below. | 117–123 |
| R54 | `script/utils/pooling-release.test.ts:348–356` | Exact same-input production-owner case already survives at 332–340. Similar callbacks for backfill/garden-safe functions have different owners and remain. | 9 |
| R55 | Entire `packages/agent/scripts/run-tests.mjs`, 32 lines | No manifest/config/script caller; obsolete storage-only runner. Keep canonical `scripts/dev/package-commands.mjs` unit/SQLite selection and both test lanes. | 32 |
| R56 | File-local repeated root tooling/QA plumbing and one unused constant | `scripts/quality/check-skill-behavior-contracts.test.mjs:31–219`: 189 → 114–139 lines, keeping all 15 mutation rows plus baseline, marker-exists guard and exact expected failure IDs. `scripts/agents/qa-app-client.test.ts:1687–1797`: 111 → 46–66 lines, keeping all eight distinct subprocess harnesses/titles/assertions, Node/Bun/JSDOM boundary, 120-second test timeout, carryPrompt's inherited stdio/subprocess timeout and nonzero-exit propagation. Remove unused `GIBIBYTE` at `scripts/dev/ci-local.test.mjs:33`. No new runner file, policy edits or lost scenarios. | 96–141 |

R53 exact ranges: `test/fork/SepoliaGoodsToken.t.sol:18–20,52–68,75–91,98–119,160–168` and `test/fork/ArbitrumGoodsToken.t.sol:20–22,54–70,77–94,101–122,166–174`. Reconfirm spelling and line ranges against the assessed head before editing.

### Final-pass removal closure

These four candidates close unused-helper and false-proof chains found while challenging the earlier plan. They add no test/support files.

| ID | Remove or consolidate | Surviving proof / required transfer | Expected net reduction |
|---|---|---|---:|
| R59 | After R46/R47, narrow `packages/contracts/src/mocks/GAP.sol` to its only remaining consumer, real `test/unit/KarmaModule.t.sol` | Remove unused project/admin/ownership simulation, multi-attestation, custom-revert and query/string/count helpers, exclusive state/imports and IGap/IProjectResolver inheritance. Keep selector-faithful attest, captured schema/recipient/refUID/data/exists/revocable/expiration, UID uniqueness, counters and failure switches, plus record getters required by R47's payload proof. Unsupported calls must fail closed. 279 gross lines minus 0–9 accurate comment lines; no overlap with R47's proof allowance. Keep separate faithful reconciliation fixture. | 270–279 |
| R60 | False or dormant manual browser claims and their exclusive plumbing | Remove `tests/specs/client.auth.spec.ts:19,24–59,100–199,203–214,242–253`: four callback-free fixmes, a cancellation that accepts unchanged login, and modal/rejection cases that accept absent controls/actions. Remove `tests/specs/client.navigation.spec.ts:37–78,82–90`: early-return/truthy-Locator admission case and always-skipped destination placeholder. Remove no-op `tests/helpers/test-utils.ts:472–479` plus sole auth call at 67. Remove duplicate `tests/specs/client.work-submission.ci.spec.ts:35–42`; smoke at 125–132 runs identical setup/backend/path and has mobile preset callers. Retain SessionGate admission/intended-destination, deterministic CI content, Login wallet invocation, actual Auth provider modal/sign-out and auth-machine dismissal/retry, qualified passkey rejection. 229 gross lines, allow 0–14 clarification lines. | 215–229 |
| R61 | Stale hook-test mocks adjacent to R04/R27/R33 | Shared `src/__tests__/hooks/blockchain/useContractTxSender.test.ts:22,112–116` write-only receipt mock/reset and duplicate send setup; `hooks/hypercerts/useCreateListing.test.ts:100,130–134` unused wait property/encoder mock; `useCancelListing.test.ts:19,93–95,123,285` unused encoder declaration/mock/setup and vacuous no-encoding assertion. Keep actual receipt/Pimlico recovery seams. For R33, assert readiness/ownership/send are untouched when signer is missing; for readiness failure, ownership has already run and sending must not run. Count those added boundary assertions in this allowance; do not count R33's replaced case twice. | 12–18 |
| R62 | Uncalled non-interface Solidity mock controls | `packages/contracts/src/mocks/Hats.sol:415–448`: setStanding, batchSetWearers and getHatAdmin (34 lines). Keep standing state, eligibility checks, protocol batch APIs/ArrayLengthMismatch, hierarchy and R48's actually used constraint controls. `packages/contracts/src/mocks/Octant.sol:115–121`: remove only this mock's unused seven-line setExchangeRate and correct its class comment; keep rate fields/conversion math, protocol withdraw and shared asset-transfer helper. YieldSplitter's same-named calls target the distinct YieldDeps mock, which stays. 41 gross lines, reserve up to three comment lines. | 38–41 |

R59 exact source deletion ranges at the assessed head: `5–6,12–21,27–31,46–52,56–58,65–67,81–83,108–116,122–263,281–286,303–391`. Preserve `getAttestation` and record fields for the real consumer's independent payload assertions. Recheck the post-deletion call graph before narrowing; runtime code installed with `vm.etch` has no constructor-state dependency here.

The final induced-dead-code check retains MockOctantVault.withdraw because it implements IOctantVault and shares live asset-transfer behavior with redeem. Removing interface conformance or substituting reverts to shrink a faithful protocol mock is outside this cleanup. Likewise, MockHats internal hierarchy and standing chains remain live even when their old direct mock-only tests retire.


### Separately qualified proposals

**R57 — replace Agent's handwritten SQL emulator, estimated net 600–625 lines.** `packages/agent/src/__tests__/setup.ts:175–825` is a 651-line parser/map implementation. Replace it in place with a 25–50-line `node:sqlite` DatabaseSync adapter, retaining the existing Vitest mock boundary and in-memory unit isolation: exec/prepare/get/all/run/close, missing-get normalization to null and numeric changes/lastInsertRowid. No dependency, CI, new file or production Bun SQLite change. This is separate from the core estimate because seven consuming suites must still establish compatibility.

Seven actual SQL-initializing unit suites contain 3,581 lines / 113 source-declared cases: storage (478/18), handlers (943/32), funding-intents (144/5), group-capture (254/12), api-messages (557/17), profile-avatars (592/16) and saved-offers (613/13). Ten other transitive database importers inject/mock storage. Preserve all 113 cases and the real Bun SQLite storage/reporting lanes, including reopen/persistence, encryption/migrations, privacy/replay/proof digests, SavedOffer compare-and-swap/tombstones and rollback.

A disposable Node v22.22.1 probe loaded unchanged production SQL modules and passed **10 checks**: schema/migration twice and foreign keys/user_version; missing rows/malformed SQL; numeric write metadata; chat attachments/filtering; duplicate ordinal rollback; duplicate/stale claim reclaim; sweep cascade/retention; idempotency insert-ignore/response; avatar CAS conflict/rollback/update; pending-work JSON CRUD. Command: `node scripts/dev/node-cli.js node /private/tmp/prd1158-node-sqlite-probe.mjs`. Experimental SQLite/type-stripping warnings only. This supports feasibility; it is not a pass of the seven suites or Bun-driver conformance. Do not weaken SQL constraints or silently expand to production migrations if compatibility exposes a defect.

**R58 — repair reentrancy proof independently; no savings booked.** `packages/contracts/test/unit/ReentrancyGuard.t.sol` has seven cases. At this head nonReentrant runs before role checks in `src/modules/Octant.sol`; authorization is not the current first rejection. Still authorize the malicious strategy so a guard-removal counterfactual can reach the forbidden call. The existing strategy reverts after a rejected callback, rolling back recorded observations: replace its probe with a one-shot flag set before callback, saved success/revert bytes, and a normal return. Assert exact guard rejection plus observable outer completion and protected state for the four existing harvest→harvest, pause→pause, donation→donation and harvest→pause directions. Add the bounded resume→donation and donation→resume callbacks through _activateStrategy/_syncStrategyDonationAddress, using a valid strategy asset/setVault surface. Keep separate full-cascade failure and normal operation proof. Guard-removal faults must fail for outer and inner resume guards without recursive OOG masquerading as rejection. No production auth/guard change or new file. This is preexisting weak/missing proof, not a prerequisite for unrelated deletion batches. It may add test/support lines; prototype and report its cost separately, include that cost in the final whole-task net, and do not invent a reduction forecast.


### Expected reduction, limits and retained coverage

| Group | Core additional net test/support reduction after final review |
|---|---:|
| Shared | **2,118–2,188** |
| Admin, Client and root browser tests/helpers | **4,260–4,454** |
| Contracts, Indexer and Agent | **4,285–4,353** |
| Root tooling and QA plumbing | **96–141** |
| **Core beyond current PR** | **10,759–11,136** |
| **Core including the current PR's 265-line reduction** | **11,024–11,401** |

The earlier 10,261–10,613-line forecast is superseded: the final review reduced unsafe allowances and added R59–R62. R57's SQL replacement remains a **separate 600–625-line** proposal. If selected and validated, the additional total becomes **11,359–11,761**, or **11,624–12,026** including the existing PR. R58 has no savings booked and may add proof code. Estimates include retained-proof allowances; they are not achieved removals or quotas that justify dropping useful tests.

The core proposes deleting **21 entire test files and 12 entire support files**, with **zero new test/support files**. R59–R62 are partial-file changes; these whole-file counts are unchanged. Partial-file cleanup and retained-proof additions are already included in the net ranges. Scenario count must be measured from actual expanded runner results after implementation: table conversions retain rows, transfers retain protections, and deleting an always-skipped case differs from removing an active case. The first pass nominated 63 active and 37 already-skipped source declarations; the deeper Contracts/Agent pass alone nominates 149 old declarations, some with fidelity assertions transferred. Neither number is a final runner reduction.

Exclude documentation, manifests/configuration and binary sizes from test/support LOC. Report the whole-PR total separately and require it to decrease after plan/documentation overhead as well. No runtime speedup is claimed: dormant specs and opt-in live/fork tests may not affect normal execution, and smaller meaningful suites may still take similar time.

Separately, remove two unused tracked Agent test artifacts after one final caller/path check: `packages/agent/data/test/handlers-test.db` (466,944 bytes) and `orchestrator-test.db` (577,536), **1,044,480 bytes total**. Active tests generate temporary/PID-specific files. Their contents were not inspected; never count binary bytes as code lines.

The deeper pass resolved the first pass's legacy IndexedDB/Viem/reset-export, ENS, gardener-profile and Client persistence uncertainties into R21/R26/R30/R34. SQL feasibility is now supported by a probe but suite compatibility is still pending under R57. Reentrancy requires stronger authorized-attacker proof under R58; do not simply delete it.

| Area inspected | Preserve / reason for no broader deletion |
|---|---|
| Shared transaction/auth/queue and large suites | Keep job executors (2,494 lines), service-worker updates (1,316) and vault crowdfunding (1,214): recovery, ownership, receipt and input-partition checks are distinct. Of 21 suites with at least 12 mocks, 17 remain whole; three receive bounded R27/R29 cleanup and CreateListing was already R04. Similar embedded/wallet callbacks exercise different adapters; Card Endow callbacks use different invalid-input tables. |
| Shared absence-of-assertion/import flags | Of 28 files without static production imports, 26 use dynamic imports, source contracts, network behavior or real harnesses; only the two local copies R19/R20 qualify. Preserve HypercertDraft clear failure, EventListener null/undefined and empty timeout-clear nonthrow contracts, plus three opt-in RPC callability cases. Keep internally used factories, `encodeAddressResult` and active browser mock initialization. |
| Admin and Client journeys | Keep SubmitWork, WorkDashboard, HomeGarden, HubDetail, PublicVaults, PoolSetup, CreateAssessment and CreateHypercert boundaries. Boot geometry/source contracts and actual PWA proof protect different failures. Admin unauthenticated smoke has an independent preset caller. Manifest and related-app association have different contracts. No whole Hub workbench suite deletion. |
| Root browser | Keep qualified CI work submission/approval/offline/passkey and production PWA preview. No-direct-expect flags also include helper/poll assertions and diagnostic/placeholder cases; they are not all “bad tests.” Real-wallet reload and fork→indexer→browser behavior remain explicit existing gaps. |
| Contracts | Keep real deployCode/full-stack/fork compatibility, storage loads/upgrades, permissions, money movement, reentrancy after repair, replay, rollover and invariants. Keep required mock fidelity at its real consumer; retain benchmark helpers and distinct MockJBMultiTerminalForYield. Four missing storage-checker contracts and actual Juicebox deployment-configuration proof remain separate gaps. |
| Indexer | Beyond R17, preserve mixed masks, mixed Octant event totals, handler state/history/reorg/retry distinctions and retained schema contracts. Similar events with different lifecycle effects are not duplicate tests. |
| Agent | Keep actual SQLite driver/persistence/reopen, encryption/migration, rollback, privacy, replay, reporting proof digests and SavedOffer CAS/tombstones. Replacing the emulator cannot replace the real-driver lane. |
| Root scripts / QA / Docs | Keep all 15 skill-mutation rows, eight real QA page harnesses and their assertions; R56 removes repeated invocation code. Eight root no-direct-assert flags execute assertions inside subprocess harnesses. Identical unknown-argument callbacks cover different CLI owners. All nine Docs suites retain real transforms, authority/search/link and source-contract checks. No deletion quota for Docs. |

### Final adversarial review and quality safeguards (2026-10-15)

**Scope:** the full proposed R01–R62 cleanup at unchanged HEAD `547e64248390d72b94a1ecc5772b4d7c9bc9fe9a`, including survivor tests, owning implementations, helper closure, test discovery, CI selection, coverage policy and generated documentation. This is a prospective plan review; no cleanup implementation or merge-readiness verdict is implied.

The previous draft required changes. The following findings are reconciled into the candidate rows and acceptance rules; their implementation proof remains pending:

| Finding | Concrete risk / correction |
|---|---|
| F01 — R01 type proof | `domain-types.test.ts` participates in the test TypeScript project. Preserve intentional WorkMetadataV1 legacy assignability with a 10–30-line compile-time contract in an existing owner. AssessmentWorkflowParams persistence is not AssessmentDraft v2 shape proof. Do not replace literal runtime assertions with more literal runtime assertions. |
| F02 — R05 Button variant | The retiring tertiary/sm/loading example uniquely checks its positive base class and broad absence of legacy classes. Move all four assertions and its props into the retained loading/focus/click test; default/secondary/asChild examples alone are not equivalent. Net estimate reduced to 21. |
| F03 — R11 Confirm stage | Runtime lazy-route/view/params proof does not run stage resolution. Transfer both /hub/confirm and /hub/confirm/9→requestedStage confirm into `packages/shared/src/__tests__/hooks/admin-ui/hub-workbench-model.test.ts` using its existing routeStateFor helper. Retain actual no-garden controller redirects and CTA/permission outcomes for R12. |
| F04 — R17 Indexer preservation | Registration's domain assertion does not protect domain after a title update. Transfer the one-line WASTE assertion from `packages/indexer/test/test.ts:44` into `actionRegistry.test.ts:205–222`. A title-update mutation clearing domain must fail the survivor. Net estimate reduced to 53. |
| F05 — R21 API and certification | Update Shared MODULES.md and generated package projections as the export is removed. All four certified seam fingerprints include the full Shared manifest; removing one unrelated export invalidates all four. Re-run their existing 13 direct/conformance/integration proof files, inspect unchanged composition/consumer boundaries, then refresh reviewedAt/fingerprints with the actual evidence. No blind hash refresh, lifecycle downgrade or new baseline debt. |
| F06 — R28 resource release | Callback suppression by isMounted does not prove clearTimeout ran. Add timer-count zero immediately after unmount and before advancing time in the retained useTimeout case. This strengthens a preexisting weak cleanup claim; deleting Clipboard's assertion-free case itself loses no current proof. |
| F07 — R31 activation | Preserve ARBITRUM_RPC as well as ARBITRUM_RPC_URL in the surviving Aave suite's gate and URL selection. Otherwise alias-only live runs silently lose APY proof. Keep live scope opt-in. |
| F08 — R33/R61 actual seams | The hook does not use the encoder mock. Missing signer must reject before readiness/ownership/send; readiness failure occurs after ownership and before send. Assertions must follow the real order and cannot pass merely because an unused fake stayed untouched. |
| F09 — R39 fallback | Transfer fallbackStage=work into the retained Shared Confirm model case. Existing order/count/visibility assertions alone do not pin that output. Net estimate reduced to 45. |
| F10 — R41 production routes | Combined appRoutes has one wildcard, unlike the split production trees. The existing presentation-routing suite must match unknown input against publicAppRoutes and pwaAppRoutes, invoke each matched wildcard loader and assert exact / and /home redirect responses. Net estimate reduced to 8–12. |
| F11 — R47/R48/R52 mock fidelity | Use independently expected attestation wire fields; configured role hats with real adapter calls and exact failures; and actual zero-share/overbalance redeem and role-manager rejection. A role query masked by inactive=false does not prove mint failed, and mock share arithmetic does not establish custody. Keep all real integration/invariant owners. |
| F12 — R58 guard proof | Correct guard-before-role ordering, keep callback observations from rolling back, prevent recursive OOG from masquerading as rejection, and cover the material resume callback directions. This repairs preexisting proof and remains separate from deletion savings. |

**Review ledger:** every outlined candidate received a disposition; no candidate is approved solely because of its name, length, mock count or aggregate coverage.

| Batch | IDs / result |
|---|---|
| Shared types/support | R01–R03, R06, R21, R32: caller/type/export trace; conditional type/API/certification transfers as above |
| Shared behavior | R04–R05, R19–R20, R22–R31, R33, R61: compare removed inputs/assertions to actual owner and survivor; preserve ENS cache partitions, member/steward cases, progress rows, pending/error/refetch and receipt recovery |
| Apps/browser | R07–R13, R34–R45, R60: route/controller/persistence/semantic and helper/preset review; transfers precede deletion; retain all other Hub cases, four intended GardenDetail sections and independent install CTA semantics, both edit callbacks and all six mint-status rows |
| Contracts support/storage | R14–R16, R46–R54, R59, R62: complete retiring suites plus related support/callers and targeted real-consumer/invariant/fork proof; keep real reset-project class, faithful reconciliation and required interface/internal helper chains |
| Indexer | R17: title-update domain transfer; preserve mixed masks/events and handler state/history distinctions |
| Agent | R18, R55, R57: no-callers versus canonical unit/SQLite runners; SQL replacement conditional on all consumers and real-driver proof |
| Root tooling/QA | R56: all 15 mutation rows and eight subprocess harnesses remain independently reported; preserve failure propagation and execution options |
| Reentrancy | R58: separate proof repair with exact callback/outer-state checks; no deletion saving assumed |

Safety facts: **same-failure preservation** is PATH_TRACED/DEPENDENCY_WALKED for this plan, with execution required after transfers. **Quality architecture remains enforced** is EXECUTED for the unchanged current tree: all nine test-quality checks pass, including 619 Shared files/160 shared-graph members, zero direct-seam baseline violations and four valid certified entries. That execution does not certify the proposed deletions.

#### Required evidence before declaring the cleanup complete

1. **One disposition per selected candidate.** Record deleted subject/no callers, exact same-failure survivor, transferred proof or retained candidate with reason. Include actor/input/environment and executed assertion, not just another related suite name. If a protection or faithful boundary exceeds the forecast allowance, keep it and revise the measured total; never weaken proof to hit the estimate.
2. **Measured coverage, not PR status alone.** PR Test jobs run without coverage; Coverage Nightly runs nightly/on main and does not automatically certify this develop PR. Save comparable before/after JSON coverage outside Git, with the same source baseline/toolchain/configuration and all configured scopes: Shared `bun run --cwd packages/shared test --scope all-configured --coverage`; Client `bun run --cwd packages/client test --coverage`; Admin `bun run --cwd packages/admin test --coverage`; Agent `bun run --cwd packages/agent test --scope unit --coverage` if R57 is selected. Preserve all global and eleven critical-path floors, include/exclude sets and reporter scope. Inspect changed production owners' line/branch/function coverage; any lost unique executed branch requires equivalent proof or explicit retention. Aggregate passing floors cannot waive it. Do not claim numeric Solidity branch parity from Vitest; retain its real focused/invariant/storage and selector-chosen checks.
3. **Discovery and isolation.** Re-run test-quality after final deletions/transfers. The current direct-seam baseline is empty and must stay empty; no stale/new entry is permitted. Keep Node/DOM projects, shared-graph purity/leak checks, no duplicate discovery and accurate expanded table-row counts. Do not change runners, excludes, coverage configuration, query isolation or CI filters to make cleanup pass.
4. **Certified boundaries.** R21 changes the manifest bytes hashed by all four entries in `scripts/data/module-seam-registry.json`. Its existing proof map has 13 unique files. Keep every direct/conformance/integration category and production composition/consumer boundary. Record fresh proof before refreshing fingerprints; unrelated transitive helpers are not an excuse to weaken the registry.
5. **Cross-consumer and browser scope.** A read-only checkpoint selector probe for R06 selects Shared, Client and Admin tests plus all three test typechecks. Keep that fan-out after shared test-utils changes. Browser helper probes select browser-passkey, browser-pwa-preview and browser-work-exploration; run these qualified presets as well as affected client-ci/admin-ci projects. client-ci alone cannot replace them. Preserve mobile smoke preset callers and label storage-injected wallet/manual diagnostic proof accurately; the existing iOS URL check accepts /home/login and is not successful wallet authentication evidence.
6. **Independent fault checks.** Confirm transferred type shape, Button variant/loading classes, Confirm route stage/fallback, Indexer update preservation, exact unknown-route redirect, timer resource release, ABI fields, no-signer/readiness boundaries and persistence separation fail their corresponding focused counterexamples. Restore every temporary fault. Keep current PR's already-proven identity/cache/query/access/route partitions.
7. **Ancillary truth.** Remove obsolete offline-helper instructions in `.claude/context/testing.md`, update `packages/shared/src/MODULES.md` and the Contracts guide's retired schema-suite example. Regenerate package projections with `node scripts/docs/generate.mjs --scope package` and check them with `--check --scope package`; inspect every generated digest change, including Commands/API Index. Shrink only the two obsolete Viem advisory entries/count in `scripts/quality/data/lint-rules-baseline.json`; no new debt. Keep QA catalog cases and append-only Test IDs: automated test-file deletion does not retire human QA definitions.
8. **Critical gate prerequisite.** A selector probe for narrowed Solidity support/foundry configuration retains abi-artifacts, contracts-build, contracts-test and contracts-verify-fast. It currently reports contract-submodules unavailable: this worktree's pinned kernel/tokenbound submodules are uninitialized. Establish the existing pinned dependencies before that implementation batch; do not count the unavailable gates as passed or weaken the override. No initialization, dependency install, network fixture, or contract validation was attempted in this plan review.

Fresh review evidence: `bun run check --intent review --only test-quality` passed all nine checks (one selected check, zero reused/unrun). The first sandboxed attempt stopped at Vitest's temporary-config cache write; the permitted rerun passed. Four fingerprint dependencies were reproduced in memory against the exact current hashes, without modifying manifests. Four read-only selector scenarios confirmed shared-support fan-out, browser preset selection, mock-export consumers and the complete critical contract override. The plan-only review selector otherwise selects no automatic checks. Full package coverage, transferred tests, faults and final-head CI remain implementation evidence obligations.

Review disposition: **COMMENT_ONLY for the revised plan**. Its previously unsafe instructions are corrected; implementation safety and merge readiness remain unverified until the required evidence above exists. No current-head CI result is refreshed by this review.


### R60 execution-review closure (2026-10-15)

The final rendered proof review identified three remaining false/duplicate proof blocks within the selected browser-cleanup intent. Remove the unconditional skipped login-page check and duplicate unauthenticated-home redirect from `tests/specs/client.work-submission.ci.spec.ts`: both use the same client-ci project, route and unauthenticated actor as the executed `client.smoke.spec.ts` redirect/login-UI and branding cases. These two blocks remove 20 physical test lines, with no unique assertion or fixture contract lost. Update only their two direct guide labels.

Also remove the comment/empty unconditional wrong-network skip at the end of `tests/specs/admin.auth.spec.ts`. The callback has no setup or assertion and supplies no coverage. Keep the real-wagmi/wrong-network limitation in this plan and the implementation handoff; an actual connector/fork proof remains outside clean-room DevAuth coverage. The 12 executed Admin cases stay unchanged. Rerun strict Client/Admin CI after removal, with zero retries. Expected additional net reduction was **28 test lines**; measured removal is **27** (20 Client, seven Admin), zero files added/deleted and zero support growth; report the measured result. This is a bounded R60 completion, with no production behavior or new external-integration claim.

### Implementation progress (2026-10-15)

- All approved R01–R62 are implemented in three primary code commits (`805e9333f`, `4281c072f`, `36fd6babd`) plus the bounded R60 execution-review closure. No candidate is silently deferred; R57 real SQLite and R58 authorized reentrancy proof are included.
- Against integrated current develop `98e4eb7e17ce4e5e1586b94ecc1be609e0501234`, the full PR shrinks test/support code **372,982 → 360,665 lines, net −12,317** (+1,095/−13,412). It removes 21 test and 12 support files, adds zero executable files and separately removes 1,044,480 binary fixture bytes. Expanded work after the earlier narrow 265-line cleanup contributes **−12,052**.
- All four comparable cleanup coverage runs pass: Shared lines 79.27→79.29, Client 77.15→77.16, Admin 74.65 unchanged, Agent 46.19→46.21. Their fixed source boundary, per-position comparison and old-emulator COUNT fallback qualification are in the [implementation handoff](handoffs/prd-1158-expanded-implementation.md); incoming accepted runtime changes are verified separately.
- All 31 temporary runtime faults were detected and restored exactly. Focused survivor/transfer proof, test typechecks and independent cross-lane reviews pass. Fresh 13-file proof supports all four certified seams both before and after develop integration; no baseline or isolation waiver is added.
- Frozen dependency restoration and pinned submodule initialization are complete without dependency/lockfile changes. Baseline timer control and the Shared AFTER React-helper leak are repaired narrowly, preserving assertions. The four-check contract gate, canonical package projections and merged-source passkey/PWA/exploration proof pass; final ClientCI passes 18 with two unchanged conditional skips. Final AdminCI passes 12 with zero skips. All five strict browser runs total 36 executed passes, two conditional Client skips, zero retries/flaky results; servers are torn down.
- The final selector requires 37 critical-publication checks, retaining full package tests/builds, contract overrides and qualified browser presets. This handoff is pre-publication evidence; the live [PR1102](https://github.com/greenpill-dev-guild/green-goods/pull/1102) and final chat record the committed gate, push and exact-head CI. No hub-wide terminal state, historical receipt, Linear state, merge to develop or deployment is claimed.

### Implementation order and acceptance, after candidate review

1. **Reconcile source and scope.** Recheck develop drift, worktree ownership and every proposed helper consumer. Record selected IDs, source identities, physical test/support LOC, files and expanded runner counts. The develop comparison above is a prior read, not a fresh merge/conflict check. Do not count moved assertions as deleted protection or binary data as code.
2. **Delete self-contained dead support and literal/duplicate cases.** Begin with R01–R06, R08–R10, R14–R18, R19–R25, R27–R28, R32, R39, R54–R56, R61–R62. Apply each row's dependency exception and unique-proof allowance; preserve active side effects and configuration consumers. R56 retains all expanded scenarios and execution boundaries.
3. **Transfer unique proof before deleting its host.** Complete R11–R13, R26, R29–R36 and R44 in existing owners. Cover route/view/params/context, role/access partitions, separate-instance persistence, retry, rendered semantics, ABI fields and no-signer rejection. Keep six progress, six mint-status, 15 skill-mutation and eight QA subprocess rows when consolidating bodies.
4. **Retire dormant browser chains together.** R07 precedes R09's GraphQL tail; R38 closes the remaining dormant passkey consumer chain; R45 follows R09/R38. R40–R43 and R60 remove false claims while retaining qualified auth/PWA/fork proof. R37 excludes R10's already-counted duplicate mock. R31 and R32 remove different live-test ABI blocks.
5. **Remove mock-only and obsolete Solidity suites with bounded fidelity transfers.** R46/R47 precede GAPTestHelper deletion. R48/R52 must retain still-used mocks' meaningful constraints in existing real-consumer tests. R50/R51 delete exclusively used legacy implementations; R53 transfers token boundary assertions before deleting duplicate fork cases. R59 follows R46/R47 and retains independent captured-payload proof; R62 preserves protocol interfaces, hierarchy, standing and actual yield-mock receivers. Read every affected support/configuration line; no production contract behavior change is planned.
6. **Select R57/R58 independently.** For R57, pass all seven SQL-consuming unit suites and the actual Bun SQLite lane; retain constraints, rollback and migration behavior. For R58, establish one-shot authorized callbacks, persisted observations, exact rejection and successful outer completion, including the two resume directions, then prove guard removal fails the test. Any needed production fix or broad migration returns to scope review.
7. **Run focused proof and selected gates.** Use Bun/package wrappers and named surviving tests; run applicable test typechecks, test-quality/source-structure/guidance checks, and the selector's complete contract/storage/critical overrides. Run relevant Client/Admin CI Playwright projects plus selected qualified passkey, PWA-preview and work-exploration presets for browser/helper changes. Require the final-review before/after coverage comparison; PR Test jobs do not collect coverage. Keep floors, inclusion/exclusion scopes, isolation and direct-seam baselines unchanged. Use temporary faults for transferred route/permission/IDB/ABI/profile/auth protections and restore all faults. Browser evidence remains labeled; no new rendered proof is claimed in this plan-only turn.
8. **Measure and publish only after implementation is accepted.** Report gross added/deleted/net test and support LOC separately, whole-PR net, file and expanded-case counts, coverage, transferred protections and exact validation results. State any retained candidates and why. Before later publication, run the selected push gate and require green current-head CI. Compare timing only with equivalent commands/source identities. The user authorized all revised candidates, including the qualified R57/R58 work, with batch implementation, a net reduction and green current-head CI required.

Planned ancillary edits are limited and must be reported: remove the unused Shared `package.json` `./mocks/server` export and `knip.ts` entry (R21); remove only the stale `packages/contracts/foundry.toml:61–63` Juicebox mock compilation restriction (R51); correct R08's retired-path entry in `scripts/quality/check-codex-docs.js`; update direct README/`tests/ARCHITECTURE.md`/`tests/E2E_TEST_GUIDE.md` inventories after deletions. These lines are excluded from test/support estimates. Also reconcile offline-helper instructions, Shared MODULES.md, package documentation projections, two obsolete Viem advisory entries, the Contracts guide’s schema example and all four affected certified seam fingerprints as specified in the final review. These ancillary edits require their own fresh proof. No dependency/lockfile update, CI weakening, coverage-floor change, isolation relaxation or new generic support layer is proposed.

- [x] Expand the assessment across all repository surfaces and reconcile current PR/develop scope.
- [x] Deepen structural scans, inspect flagged bodies/owners, trace support consumers and record retained families.
- [x] Record R01–R62 candidates, including 60 core candidates and separately qualified R57/R58, overlap exclusions and corrected net allowances.
- [x] Adversarially review every outlined candidate and close induced dead-support chains in the plan.
- [x] Execute required type/assertion/API transfers, comparable coverage and certified-seam refresh; see the implementation handoff for evidence and limits.
- [x] Review and select the candidate implementation scope; user approved R01–R62 and publication to the existing draft PR.
- [x] Implement R01–R62 in three code batches and validate transferred/retained protection.
- [x] Record actual net reductions, coverage/fault results and timing limits in the implementation handoff; use the live PR checks/final publication record for current-head CI.

Task record, first repository pass: PRD-1158 | Type: investigation and plan correction | Outcome: candidate plan prepared; no implementation. Agent/model: Codex / GPT-6. Coverage: first repository-wide assessment. Investigate: 2026-10-15T02:19:28Z → 2026-10-15T02:39:42Z. Plan edit: 2026-10-15T02:39:42Z → 2026-10-15T02:42:53Z; verify: unknown → 2026-10-15T02:42:53Z. Working-copy checks: 27 hubs valid; 49 candidate/survivor paths, links, candidate IDs and estimate arithmetic verified; status JSON parses; `git diff --check` passes. Selector diagnose selected no automated checks for the two plan paths. No commit-attributed test/CI receipt refreshed. Human corrections: 0; attention unknown.

Task record, deeper pass: PRD-1158 | Type: investigation and plan correction | Outcome: deeper candidate plan; no implementation. Agent/model: Codex / GPT-6 with three package assessment agents. Investigate: 2026-10-15T03:17:35Z → 2026-10-15T03:39:23Z. Plan edit/verification: 2026-10-15T03:39:23Z → 2026-10-15T03:45:51Z. Working-copy checks passed: all 27 hubs valid; 157 candidate/survivor/configuration references resolve and stated ranges fit their sources; R01–R56 IDs and every subtotal/combined estimate reconcile; status JSON parses, unrelated hub content and lane/history/receipt data are unchanged, and git diff --check passes. The diagnose selector selected zero automated checks for these two plan paths. Coverage: all 1,296 test files structurally inventoried; flagged bodies, owning implementations, retained proof and support call graphs inspected, with limits above. Disposable SQL feasibility probe: 10/10; repository behavioral suites and CI not rerun. Human corrections: 1 (first assessment lacked depth); attention unknown. No commit, push, external write or new implementation receipt.


Task record, final plan review: PRD-1158 | Type: review and investigation | Outcome: candidate plan corrected; implementation unselected. Agent/model: Codex / GPT-6 with three adversarial package reviewers. Review: 2026-10-15T03:49:29Z → 2026-10-15T04:01:23Z; plan update/verification: 2026-10-15T04:01:23Z → 2026-10-15T04:05:12Z. Final plan checks: all 27 hubs validate; 169 candidate/survivor/config references and ranges resolve; 60 core candidate estimates and all combined totals reconcile; JSON parses; unrelated hub/lane/history/receipt content is unchanged; git diff --check passes. The final plan-only selector chooses zero automatic checks. Coverage: all outlined candidates, their retained owners and selected quality/coverage/CI consumers, plus induced helper closure; not a line-by-line whole-repository certification. Current-tree test-quality passes nine checks; prospective package coverage/transfer/fault/CI proof unrun. Human corrections: 0 in this segment; attention unknown. No application/test/support implementation, branch action, commit, push, merge or external write.

## Status reconciliation (2026-10-06)

The latest source record is [batch 5](handoffs/software-factory-batch-5.md), which supersedes the opening fourth-batch summary. SF05–SF08 and SF12 have recorded local acceptance; SF10 still requires an actual Claude Desktop Code observation and SF13 retains four ordinary-task categories plus the routine-dispatch observation. These handoffs record local acceptance. This status PR does not certify CI for the owning implementation range.

Snapshot 09 was scheduled for October 5 and remains unchecked in this hub as of October 6. Confirm whether its external scorecard exists before measuring again; if absent, record the actual next measurement date rather than treating the scheduled date as completion. D14's release prerequisite and the human-controlled restart, cleanup and dependency steps remain intact.

## Current execution truth (2026-09-28)

### Snapshot 08 follow-up (2026-09-28, later)

Scorecard snapshot 08, an independent re-audit at `1a3afcb52`, listed eight open items. Afo chose
items 2, 3, 5, 6 and 7 with the page's recommendations (D10). They are done and on `develop`
through `23a8d1ffb`, one commit per root cause. The
[follow-up report](reports/2026-09-28-snapshot-08-follow-up.md) holds the evidence.


The closeout pass pushed the range to `origin/develop` in three pushes (`d7cf681ec..fca76d585`,
31 commits). The [closeout report](reports/2026-09-28-closeout-push.md) holds the timings, the run
links and the evidence for steps 3 and 5. Measuring the push found two gate defects, fixed forward:
the hook could not reuse a manual pass because Husky's shim exports `NVM_DIR` (`627149a4d`), and a
manual run could not find package binaries such as `design.md` (`fca76d585`). The critical plan
for the range took 461 s cold and 2.1 s warm. Every workflow for each pushed head is green, and a
dispatched Coverage Nightly passed every floor at `627149a4d`. Snapshot 07 is on the
[Velocity Scorecard](https://claude.ai/artifact/9TkZM1T9niiwja34G9K2Mg). Metrics that need a
seven-day CI window are pending from 2026-09-28.

Correction to the closeout report, which stays as written: the 250 s cold compile in Contracts ·
Unit Tests on `8e05497f6` happened because slice 9 renamed that job's cache key (`a4b0e98d6`); the
`develop` cache it would otherwise have used had also been evicted. Lint And Build is the clean
eviction case: its key is unchanged, its Sep 25 cache was gone by Sep 28, and it rebuilt in 238 s
against a 90 s median. Afo chose to prune the unreachable CodeQL databases (D9): the 21 already
unreachable were deleted on 2026-09-28, taking the cache from 9.8 GB to 583 MB, and the hourly
prune workflow is in PR #945.

### After the review (2026-09-28)

Astra reviewed the follow-through and returned REQUEST_CHANGES: five Must-Fix findings and one
Should-Fix ([review](reports/2026-09-28-astra-review.md)). All six are fixed, and so are the three
Human Call-Outs that Afo decided (D6–D8), in fourteen commits after `01ba4e2cd`. The
[resolution report](reports/2026-09-28-astra-review-resolution.md) maps each finding to its
commit and proof, and lists the open items with their destinations. Next, the closeout pass
pushes to `origin/develop` and records current-head CI for steps 3 and 5.

### Before the review (2026-09-28)

The velocity follow-through is committed locally on `develop` from `d7cf681ec`, one commit per slice.
The [follow-through report](reports/2026-09-28-velocity-follow-through.md) holds the evidence;
[Astra's review handoff](handoffs/astra-review.md) holds the range, the claims and the limits.
Nothing is pushed. Astra reviews first, then the closeout pass pushes and supplies the current-head
CI that steps 3 and 5 below wait for. The Client validation blocker is resolved (slice 5). Open
items for Afo are listed in the handoff:
- five files whose tests depend on their order within the file;
- the hypercerts SDK's `BigInt.prototype.toJSON` patch;
- the `offlineDownloads` size assertion;
- three CI routing gaps.

### Previous record (2026-09-27)

The user authorized the remaining local work. The September 19–20 implementation is already committed in `9a0a5ac18960730f00d4dff0125286c41f23cb98`; the current cleanup was verified before commit on `develop`, based on `87938a7308d3933f61eebd9e02d27e921df60f5b`. The user authorized a local commit on September 27; the Client repair remains outside scope. Historical evidence is linked at the bottom; this file owns the current checklist.

The current slice adopts 29 Shared and two Admin query helpers, removes six caller-free settlement exports and five stale mocks, shares eight Agent conformance cases across memory and SQLite, and merges the PostHog throttle case into its existing subject. The batch-approval cache fixture and named layout/CSS tests are retained with concrete reasons. See [Snapshot 06](reports/2026-09-26-snapshot-06.md) for evidence, exclusions and measurement limits.

The former dirty-locale and Apple Git blockers are not carried forward as current findings. Current root `AGENTS.md` and the validation pipeline supersede the original browser-policy decision: browser proof is advisory for local intents and attested only at release. This slice changes no visible runtime behavior. PR #802 is merged; #795 remains open at `efd85dcebab17ceb9da87cb78fce8d3fd6aef714` (fresh GitHub read on September 27).

Three recent published Shared runs have both shards green. They provide observational timing evidence, not current-SHA CI for this slice or a controlled A/B comparison. The original twelve-fault definition remains unavailable. Keep the hub active for the Client validation blocker and publication acceptance; no Linear write or external publication is authorized.

## Decision log

| Decision | State | Reason |
|---|---|---|
| Refresh the audit and save a dedicated backlog hub | Authorized; preparation complete | Current code and PRs differ from the audit snapshot |
| Guidance → manual evidence → CI speed → critical proof → consolidation → measurement | Selected execution order | Establish the rules and protection before removing tests |
| Browser evidence policy | Superseded by current AGENTS.md / validation pipeline | Advisory for local intents; release attestation remains required. Historical decision evidence below is retained. |
| Measured coverage floors replace the calendar-based two-point ratchet | Decided (D3, 2026-09-28); the architecture hub closed `coverage_ratchet` | Protect useful coverage without arbitrary percentage growth |
| Keep test isolation enabled | Default for this plan | Item 6a requires a separate measured adoption decision |
| Consolidate by subject and prove deletions | Required boundary | Similar setup does not establish equivalent fault detection |
| Work serially in bounded slices | Selected procedure | Avoid overlapping guidance, workflow, and test rewrites |
| Existing hubs retain architecture and onboarding ownership | Required coordination | Avoid duplicate sources of execution truth |
| D1 (2026-09-28): critical means signing, money, queue and auth | Decided by Afo | Read-only hooks become sensitive; target the critical push at 5–7 minutes |
| D2 (2026-09-28): happy-dom for the Shared DOM project only if the A/B wins | Decided by Afo | Approves this one dev dependency and nothing else |
| D3 (2026-09-28): the 11 measured critical-path floors replace the September 22 ratchet | Decided by Afo | Global floors and parity arrays stay unchanged |
| D4 (2026-09-28): work on `develop`, commit each slice locally | Decided by Afo | No push, PR, merge, deploy or Linear write in the follow-through pass |
| D5 (2026-09-28): the DetailsGate table refactor is approved | Decided by Afo | Resolves the Client validation blocker's scope question |
| D6 (2026-09-28): fix the seven order-dependent Shared test files before the push | Decided by Afo (Astra's Human Call-Out) | Done in `282747338` and `407d4459b`; each file passes 25 in-file shuffle seeds, and the full suite passed shuffled |
| D7 (2026-09-28): fix the `offlineDownloads` byte assertion now; the SDK's `BigInt.prototype.toJSON` patch is a follow-up | Decided by Afo | Test fixed in `7f1c0b7c7`; the SDK patch is a product question in the resolution report's open items |
| D8 (2026-09-28): fix the three CI routing gaps now | Decided by Afo | Done in `ba6feb9b2`, `77cf70b55` and `268bb138f`, each with a guard against drift |
| D9 (2026-09-28): prune CodeQL's unreachable overlay-base databases hourly; keep overlay analysis on | Decided by Afo, from three options | Pull-request analyses restore only the newest database, and overlay keeps them near 2 minutes instead of 7 while the rulesets wait for CodeQL. The free org plan cannot buy more cache. The 21 unreachable databases were deleted by hand; the workflow is PR #945 |
| D10 (2026-09-28): address snapshot 08's items 2, 3, 5, 6 and 7 with the page's recommendations | Decided by Afo | Dispatch the CodeQL prune by hand; speed up what Admin's tests import rather than add a Shared shard; add the vault history's exactly-full page; finish the helper codemod; fix `canonicalJobPayload` instead of the SDK, end the Data Saver override with its session, and move the import-seam case into `check-source-structure.js` |
| D11 (2026-09-29): happy-dom for Admin, and remove MSW | Decided by Afo | Admin's DOM project moves to happy-dom, already a root dev dependency, with the same bar as D2; the unused MSW server, its Shared export and the root `msw` pin go, which changes the lockfile |
| D12 (2026-09-29): happy-dom for Client | Decided by Afo | Client, the last package on jsdom, moves to happy-dom with the same bar as D2 and D11; happy-dom is already a root dev dependency |
| D13 (2026-09-29): harden the test lease and record why a worktree gate skipped it | Decided by Afo (options B and C) | A local `CI=true` run takes the lease, and a leased run waits for Vitest runs that hold none. Catching old worktree branches up with `develop` (option A) stays with each branch's owner |
| D14 (2026-09-29): record the post-release plan in this hub and start it after the 2.0.0 release | Decided by Afo | A review of scorecard version 22 found four items still open, two closed items the page still shows as open and two open items with no row. The ten-row plan is in § After the release, with the evidence in `reports/2026-09-29-post-release-plan.md`; the restart, the worktree removal and the setup-debt row need Afo, Dependabot #948 needs dependency approval, and the Linear sync needs authorization |

## Ordered work

Each row is a reviewable slice or a series of independently reviewed slices, not one large PR. Split package work further when it cannot be understood and verified in one session.

| Done | Order | Original items | Work and acceptance |
|---|---|---|---|
| [x] | 0 | Preparation | Refresh targets, local branch/PR overlap, inventory, recent Shared timing, nightly coverage, and representative push plan. See the dated report; no current-head full-suite claim. |
| [x] | 1 | 1 | Add test budget to testing.md, excess-proof review lens, and one root agent-guide pointer. Coordinate September 22 checkpoint and PRs #795/#802. Guidance checks pass; semantic evaluation only if trigger wording changes. |
| [x] | 2 | 4 | Presented both designs; user selected ordinary automated push with manual browser proof pending for readiness. Implemented exact browser-only deferral and negative proof for automated failure, missing automated capability, and critical/readiness requirements. Actual hook passed in a disposable checkout; see eval.md. |
| [x] | 3 | 3 | Two Shared shards implemented. Current-head CI at `8e05497f6`: Test (1/2) 168 s and Test (2/2) 146 s, Vitest 128.9 s and 116.7 s, 730.7 worker-seconds against 1,039.8 in Snapshot 06. One run; the job median waits for the seven-day window. See the closeout report. |
| [x] | 4 | 11 | Added informational source/test changed-line and file-count summary to the existing Supply Chain Guardrails change-detection job. The step is explicitly non-blocking, adds no required check or threshold, and handles zero-source changes. |
| [ ] | 5 | 2 | Shared, Client and Admin sub-slices implemented: eight measured aggregate glob floors and three measured exact-file floors (Cookie Jar and image compression), parity proof, deliberate below-floor failure, and full coverage enforcement. Global floors unchanged (D3 closed the ratchet). Coverage Nightly, dispatched at `627149a4d`, passed every floor: statements Shared 74.05%, Client 72.6%, Admin 69.06%. See the closeout report. |
| [x] | 6 | 7 | Added direct proof for Cookie Jar hooks, connectivity background work, queued-upload chain/cancellation, image compression, login messaging and timeframe boundaries; paired Cookie Jar and image compression with measured file floors. Preserved the flagged-upload toast proof. All focused/selected local checks passed; current-SHA CI remains in step 5. |
| [x] | 7 | 7 | Admin excessive-withdrawal rejection, Client claim confirmation and garden-join argument/failure proof passed. Cached #802 head showed no claim test; fresh PR status/head remains network-unverified. No runtime defect was exposed. |
| [x] | 8 | 5 | Expanded helpers to 29 Shared and two Admin files. All 301 Shared test names/results match baseline; 30 focused Admin tests pass. Batch-approval cache behavior, Client persistence and custom-provider/cache/network fixtures retain their necessary setup. Existing guard passes. |
| [x] | 9 | 8 | Removed six caller-free settlement exports and their exclusive tests; retained live recognition/delivery/authority code. Eight common Agent cases run on memory and SQLite, including cap, withdrawal, sweep and revision boundaries; adapter encryption/restart proof remains. |
| [x] | 10 | 9, 10, 6b | Removed five stale WithdrawModal mocks and consolidated the PostHog throttle file without deleting its case. Retained named layout/CSS guards: current browser checks do not detect the same faults. No speculative broad file merge. |
| [x] | 11 | 12 | Local Snapshot 06 saved with inventory, recent shard timing/worker buckets and one defined fault check. Shared coverage and local proof recorded; the Client whole-suite timeouts are resolved (velocity slice 5). Post-merge publication, controlled timings and the unrecovered original fault panel remain explicit limits. |
| [x] | Deferred | 6a | Adopted for mock-free Shared Node files in velocity slice 6, which Afo approved, on three local A B B A pairs with identical results; comparable CI timing comes with current-head CI. |

## Velocity follow-through (2026-09-28)

Afo approved these slices and decisions D1–D5 on September 28 as follow-through on Velocity
Scorecard snapshot 06. Each slice is a local commit on `develop` from `d7cf681ec`; evidence lives in
the [follow-through report](reports/2026-09-28-velocity-follow-through.md).

| Done | Slice | Work | Evidence |
|---|---|---|---|
| [x] | 0 | Preflight and baseline: critical push 263 s cold / 57 s warm (`useWorkApprovals.ts`); read-only `useFilteredGardens.ts` 360 s cold (contended) / 73 s warm | Report § Slice 0 |
| [x] | 1 | Machine-wide test lease in the package test path: the second full run waits, names the holder and never times out; timing bound (both within twice one quiet run) not met in contended samples | Report § Slice 1 |
| [x] | 2 | Critical scope matches D1: 52 read-only hooks left the tier, 60 uncovered mutation files entered it; the selector escalates new ones from their code; CI Gate guards the list | Report § Slice 2 |
| [x] | 3 | Critical push 274 s cold (twice) and 3 s on a rerun; read-only hook 6–8 s cold; estimate 267 s instead of 965 s | Report § Slice 3 |
| [x] | 4 | Push gate routes `test-quality`, `docs-generated`, `docs-authority`: 37 of 39 CI red pairs now select their check (19 own paths, 18 branch diff); 2 were base drift whose introducer now selects it | Report § Slice 4 |
| [x] | 5 | DetailsGate table already landed in `ee5c8a147`; `--maxWorkers` was ignored, now passed as `VITEST_MAX_WORKERS`; full Client suite passes at one worker (104 s) | Report § Slice 5 |
| [x] | 6 | Shared Node project split: 145 mock-free files share one graph, 67 stay isolated, lean Node setup; Node files −51% to −54% wall at four workers, full suite −8% to −13%; identical names and results; four leak classes found and fenced (registry resets, IndexedDB, a built-in patched by `@hypercerts-org/sdk`, direct global assignment); Check 7 in `test-quality` checks the resolved membership | Report § Slice 6 |
| [x] | 7 | happy-dom adopted for the Shared DOM project (D2): DOM wall −21%, −28%, −26% in three A B B A pairs; three full runs identical to jsdom; five files pinned to jsdom with reasons; `offlineDownloads` found asserting jsdom's `[object Blob]` size; Client and Admin stay on jsdom | Report § Slice 7 |
| [x] | 8 | Three budget rules in `testing.md`; Check 8 fails a new test file below four cases without a reason; ten small Shared files folded into their subject files (549 → 540 files, identical names and results); 102 candidates listed | Report § Slice 8 |
| [x] | 9 | Contracts gas gate: develop PRs reuse a production tree restored under an exact key over every build input; pushes, release PRs, the local release gate and a new nightly step rebuild from scratch; local unit command 71–72 s fresh, 18 s cached; CI hit unverified until a PR runs | Report § Slice 9 |
| [x] | 10 | Test-utils barrel: three A B B A pairs over its 55 importers showed −16% to −18% duration and −27% to −29% import, so Shared tests now import leaves (`render-helpers.tsx` split out; 60 files moved); Check 9 rejects the barrel in Shared tests; Admin and Client keep `@green-goods/shared/testing` | Report § Slice 10 |
| [x] | 11 | Behaviour tests for the six near-zero files (lines now 60%, 85%, 65%, 100%, 80%, 77% from the new tests alone); each caught one injected fault | Report § Slice 11 |
| [x] | 12 | Ratchet closed (D3): `testing.md` states the decision; the architecture hub records decision 11 and closes `coverage_ratchet`; global floors and parity arrays unchanged | Report § Slice 12 |
| [x] | 13 | Hub updated for this pass; Astra's review handoff written | [handoffs/astra-review.md](handoffs/astra-review.md) |
| [x] | 14 | Astra's review resolved: receipts fingerprint the effective environment and never serve the strict gates, the mutation analyzer follows references and fails closed on unreadable imports, shared-graph admission follows helpers under a fresh-module and globals guard, the Seed leaf imports, a real small-file reason; then D6–D8 | [Resolution report](reports/2026-09-28-astra-review-resolution.md) |
| [x] | 15 | Closeout push: three pushes; two gate fixes found while measuring (`627149a4d` lets the hook reuse a manual pass under Husky's `NVM_DIR`; `fca76d585` gives manual runs the package binaries the hook has); critical plan 461 s cold and 2.1 s warm; every workflow green; Coverage Nightly passed; lease sample on a quiet machine; snapshot 07 | [Closeout report](reports/2026-09-28-closeout-push.md) |

## Snapshot 08 follow-up (2026-09-28)

Afo chose these on September 28 (D10). Each is a local commit on `develop` from `1a3afcb52`;
evidence lives in the [follow-up report](reports/2026-09-28-snapshot-08-follow-up.md).

| Done | Item | Work | Evidence |
|---|---|---|---|
| [x] | 2 | CodeQL prune dispatched by hand: 3 unreachable databases (1,364 MB) deleted, one left; the hourly schedule is still to be confirmed | Report § Item 2 |
| [x] | 3 | Admin tests: viem external, AppKit's React entry and wagmi adapter mocked, MSW no longer started, FormWizard off the Shared hooks barrel | Report § Item 3 |
| [x] | 3, later | Client and Shared: AppKit aliased to stubs in all three packages, which also makes Admin's adapter stand-in take effect; Shared leaves viem external; Client's viem stays external. Instructions: Shared −19%, Client −8.2%, Admin −3.2%, identical results | Report § Client and Shared imports |
| [x] | 5 | Vault history paging covers an exactly-full last page; fault f3 now fails 1 of 55 related tests | Report § Item 5 |
| [x] | 6 | Helper codemod: 45 Shared test files converted with identical names and results, 18 kept with reasons | Report § Item 6 |
| [x] | 7 | `canonicalJobPayload` reads raw values; the Data Saver override ends with its session; import seams checked by `check-source-structure.js` | Report § Item 7 |

## Admin happy-dom and MSW removal (2026-09-29)

Afo chose both follow-ups on September 29 (D11). Two commits on `develop` after `3fc9f132f`;
evidence in the [follow-up report](reports/2026-09-28-snapshot-08-follow-up.md) § happy-dom for
Admin and MSW removal.

| Done | Work | Evidence |
|---|---|---|
| [x] | Admin's DOM project runs in happy-dom (`9703b5402`); two files that assert authored inline styles stay on jsdom. Instructions −29% and Vitest time −29% in A B B A, identical names and results in all six runs, coverage unchanged | Report § happy-dom for Admin |
| [x] | MSW removed (`1c6948d50`): the unused GraphQL mock server and its Shared export, unused imports in the Playwright Pimlico mocks, and the root `msw` pin. Every other lockfile edge keeps its version; four seam fingerprints re-certified because they hash Shared's manifest | Report § MSW removal |

The D11 evidence went into the dated 2026-09-28 report in `30bfcf9fb`, against the plan skill's
rule that dated reports are immutable, and CI's Guidance integrity job failed on that head. It
stays there: restoring the report would be a second edit, which the same check rejects on the next
push. The local push gate did not select `immutable-plan-reports` for the edit; it has since `57916fed7`.

## Client happy-dom (2026-09-29)

Afo chose it after D11 (D12). One commit on `develop`; evidence in
[its report](reports/2026-09-29-client-happy-dom.md).

| Done | Work | Evidence |
|---|---|---|
| [x] | Client's DOM project runs in happy-dom (`46be0573a`); three files stay on jsdom, one for a `Storage.prototype` spy and two for accessible names joined from adjacent inline elements. Instructions −31% and Vitest time −28% in A B B A, identical names and results in all six runs, coverage unchanged | Report |

## Test lease gaps (2026-09-29)

Afo asked why a worktree's push gate ran without the lease, then chose to harden the lease and
record the answer (D13). Evidence in [its report](reports/2026-09-29-test-lease-gaps.md).

| Done | Work | Evidence |
|---|---|---|
| [x] | Diagnosed: the worktree's branch predates the lease (`d1bc5d86e`), so its gate and suites carry no lease code; 33 of 34 worktrees were in that state on September 29 | Report § Why |
| [x] | A local `CI=true` run takes the lease; only a GitHub runner skips it (`e0046ac17`) | Report § Fixes |
| [x] | A leased run waits up to five minutes for Vitest runs that hold no lease, naming them, then starts on half the machine (`09ada5970`) | Report § Fixes |

## After the release (planned 2026-09-29)

Afo asked for a review of the Velocity Scorecard (version 22) and a plan for what it still lists as
open, then chose to record the plan here and start it after the 2.0.0 release (D14). The
[post-release plan report](reports/2026-09-29-post-release-plan.md) holds the evidence, read on
September 29 at `22592595d`, including the worktree lists; this table is the checklist. Snapshot 09
goes first because its reading decides row 7. Rows marked *call* need Afo before anyone builds them.

| Done | Order | Work | Who | Proof |
|---|---|---|---|---|
| [ ] | 1 | Snapshot 09 on October 5: fill the fourteen pending CI fields on snapshots 07 and 08 from the September 28 to October 5 window; job medians for Admin · Test, Client · Test, both Shared shards, Storybook and Admin Playwright, divided by the test-body bucket; recheck the Actions cache total, the prune's cadence and the lease bound | a session | Snapshot 09 published; no `pending` field left on 07 or 08 |
| [ ] | 2 | Restart the laptop, then the worker test: on an idle machine, four full Shared runs at the default worker count and four at `VITEST_MAX_WORKERS=5`, recording Vitest `Duration` and the `tests` bucket; size the lease's worker cap from the result | Afo restarts (*call*); a session measures | The fourth run within 20% of the first at one of the two counts |
| [ ] | 3 | Worktree cleanup: `git worktree prune` for the three dead registrations; remove the 26 merged, idle worktrees the report lists, after a fresh `lsof` check; the four branches with unmerged work merge `develop` from their owning sessions, `feature/agent-reporting-core` first | Afo authorizes (*call*); a session and the branch owners | `git merge-base --is-ancestor d1bc5d86e <head>` holds for every worktree left |
| [ ] | 4 | Scorecard version 23: mark the order-flaky test closed and CodeQL holding, give the contracts row its new reason, replace the worktree line with the report's split, add rows for the setup debt and for Storybook and Admin Playwright | a session | The page matches the report |
| [ ] | 5 | Dependabot #948 (js-yaml in `packages/contracts`): regenerate `bun.lock` on its branch or close it and bump by hand within the release-age gate. It cannot prove the production-tree cache, because `bun.lock` is one of the cache key's inputs | needs approval as a dependency change | PR green and merged, or closed with the bump landed |
| [ ] | 6 | Contracts pull-request path: read the Unit Tests log of the next contracts pull request that changes none of the cache key's inputs | waits for such a PR | `Cache restored` for `foundry-release-production-*` |
| [ ] | 7 | After snapshot 09: if Storybook or Admin Playwright lead the gate, measure them next; if the Shared shards lead, stop optimising the gate | decide after 09 | Job p50 of the leader |
| [ ] | 8 | Setup debt (183 `toHaveClass` assertions, 152 heavy-mock files): leave for the December re-measure unless a batch rides along with feature work; no new rule | Afo (*call*) | Counts in December |
| [ ] | 9 | `linear-sync` for PRD-835 (architecture hub) | needs Linear write authorization | Hub and Linear agree |
| [ ] | 10 | December: redraw the 36-file sample and rerun the nineteen faults | a session | A new snapshot |

## Agentic development follow-up (proposed 2026-10-04)

The user requested a comparison of the independent Fable and Astra/Codex audits and a
comprehensive update plan. The
[reconciled report](reports/2026-10-04-software-factory-comparison.md) records the verified
findings, corrections, candidate designs, and evidence limits. This section is the canonical
checklist for that proposal. The authorization updates below track the selected slices; completed historical slices stay closed.

**Authorization update (2026-10-04):** Afo selected SF01–SF04 with “Go ahead and implement
the first batch.” This authorizes these four local slices to start now, superseding D14's timing
for this batch only. SF05–SF13 and unrelated post-release work remain unselected. No dependency
installation, Git publication, Linear write, or browser-policy change is included. The start-gate
manifest is parent-only and proposes creating a Linear parent; external sync remains deferred
under the existing local-only scope.

**Implementation checkpoint:** SF01, SF02 and SF04 meet their local acceptance checks. SF03 is
implemented but remains open: final Admin readiness checks fail, including in an original-source
control. The [batch handoff](handoffs/software-factory-batch-1.md) records all passes, failures
and the remaining qualification work. No full Admin-green or merge-readiness claim is made.

**Second-batch authorization:** Afo selected the next batch. Following the report's independent
constraint sequence, SF10–SF11 are selected for local implementation now. SF03 remains open;
SF05–SF09 and SF12–SF13 remain unselected. This batch diagnoses worktree hook chains without
repairing other checkouts, and repairs only a reproduced Address type boundary with consumer
probes. No dependency installation, branch change, publication or external write is included.

**Historical second-batch checkpoint:** The local SF10 diagnostics and disposable Git/Husky dispatch proof
pass; live agent hook loading remains pending in the architecture hub's existing pilot. SF11
adds a passing Client guard and traces the Admin widening. The Admin repair awaits explicit
approval to declare `abitype@1.2.3` and fix the seven exposed caller boundaries. Both rows stay
open for their remaining acceptance criteria. See the [second-batch handoff](handoffs/software-factory-batch-2.md).

**Selected first scope:** SF01–SF04. They improve existing evidence before adding more
automation. SF10–SF11 can follow as separately bounded constraint work. SF05–SF08 expand proof
only after its baseline is trustworthy. SF09 and SF12 depend on observed operator cost;
SF13 evaluates the result and the already-configured outer-loop handoff.

**Third-batch authorization:** Afo explicitly approved dependency changes and continuation.
Finish SF11 with exact `abitype@1.2.3`, one Admin registration, real consumer guards, and the seven
exposed caller boundaries. Then implement SF09's reporting checkpoint in the existing local
validation runner. The observed sandbox blocks, test-lease waits, and readiness failures supply
its concrete cases. Preserve first failures, distinguish lease/capability blocks from failed tests,
and report selected scope and unfinished proof. PR-text export is a later checkpoint; no retries,
policy weakening, publication, or external writes are included. SF05–SF08 stay behind their
existing qualification prerequisites; live hook loading remains with the architecture pilot.

**Third-batch checkpoint:** SF11 and the selected SF09 reporting checkpoint meet local acceptance.
The 15-check QA plan passes, followed by focused validation of the final fixture adjustment.
SF11 adds only Admin's exact ABIType dependency; Shared's package exports are unchanged.
The [third-batch handoff](handoffs/software-factory-batch-3.md) records scope, failures, final
checks and evidence limits. Checkmarks mean local acceptance, not a commit or publication.
SF03 remains open after an isolated Admin browser run with one pass and one readiness failure.
SF10's live pilot and SF05–SF08/SF12–SF13 remain outstanding.

**Fourth-batch authorization:** Afo selected the next batch: qualify SF03's Admin browser
journeys and complete the available SF10 live hook-loading observations. Diagnose the actual
rendered readiness failure before changing runtime or test code. Keep zero-retry proof and
existing outcome assertions. Codex session evidence belongs in the existing architecture
pilot; Claude Desktop Code evidence requires that actual session. Publication and the later
SF07/SF08 exploration rollout remain separate checkpoints.

**Fourth-batch checkpoint:** SF03 meets local acceptance: full Admin browser project 12 passed,
one declared fork-only skip, zero retries. A smoke fixture now shares its garden identity across
indexer and RPC responses. The earlier hydration-loader timeout did not recur and is not claimed
fixed. SF10 has actual Codex session/edit-hook observations; Claude Desktop Code is still pending.
The [fourth-batch handoff](handoffs/software-factory-batch-4.md) preserves the exact RED/GREEN
commands, scope and limits. No runtime, dependency, hook or CI configuration changed this batch.

**Remaining-work authorization:** Afo selected all remaining local Software Factory implementation.
Proceed serially through SF05–SF08 and SF12, retaining the existing reporting for SF09.
Dependency changes remain authorized if needed. SF10 and SF13 require actual session/task
observations; do not manufacture them. No publication, branch change, or external write is included.

**Implementation boundaries:** Reuse the existing E2E runner, Playwright configuration and strict
backend fixtures. The passkey spec owns a real virtual-authenticator ceremony with a deterministic
server rejection; it cannot certify a production identity provider. The PWA case uses an anonymous
production login shell, preserving production auth restrictions. The work-review pilot owns seeded
read/recovery actions, with no signing or dispatch. These capabilities are missing from the current
permissive passkey spec, development-worker proof and fixed work-review examples respectively.
Only locally qualified scenarios enter the validation policy. Owner-local CLI guards address
observed empty/scoped/retried proof and replay mistakes; no application rules are changed.

**Remaining-work checkpoint:** SF05–SF08 and SF12 meet local acceptance. Seven selected QA
checks passed, including 378 tooling tests, 333 fixture tests and four Chromium browser scenarios
with zero skips/retries. The final selector/runner suite passed 115 tests; final fixture and style
checks passed after the profile/routing closeout. Qualified checks are wired into the existing
Client browser job, with matching workflow triggers and required-workflow selection. The
[fifth-batch handoff](handoffs/software-factory-batch-5.md) records failures, final source identity,
commands, fork assessment and proof limits. SF10 and SF13 remain open for actual Claude Desktop,
ordinary-task and live-dispatch evidence. Current-head GitHub CI remains unrun for these local changes.

### Workstream A — Make a passing check meaningful

| Done | ID | Bounded change and likely owning files | Depends on | Acceptance evidence |
|---|---|---|---|---|
| [x] | SF01 | Align local smoke/verification startup with the CI test profile. Reuse `scripts/dev/test-e2e.js`, `playwright.config.ts`, and `scripts/dev/command-runners.test.mjs`; change `scripts/dev/stack.js` only if a narrow explicit profile is needed. Preserve normal live-development defaults and ownership cleanup. | Selected; start-now exception to D14 | RED reproduces test-profile replacement by development/42161. GREEN uses the same intended chain/fixtures locally and in CI, rejects mismatched existing servers, and stops only its owned processes. |
| [x] | SF02 | Make `tests/helpers/mock-backend.ts` reject unsupported requests and validate scenario arguments. Extend its owning fixture tests and `tests/helpers/test-utils.ts` only where callers need request accounting. Keep legitimate empty results explicit. | SF01 for rendered proof | Unsupported GraphQL operation, wrong RPC method/selector/address, and missing required request fail with useful traces. Existing supported smoke and offline scenarios pass. |
| [x] | SF03 | Strengthen approval and admin journey outcomes in `tests/specs/client.work-approval.ci.spec.ts` and `tests/specs/admin.production-flows.ci.spec.ts`, using the shared fixtures. One subject per checkpoint: approval first, then the selected admin flow. Keep independently useful smoke coverage. | SF02 | A shell-only response, disabled dispatch, unexpected request, and endless loader fail. Assert the selected result and visible recovery from injected rejection; retain the stronger offline-queue test. |
| [x] | SF04 | Extend the existing required-job map in `scripts/quality/ci-gate.mjs` and its tests to the Client/Admin browser jobs. Read their current workflow job names before editing; do not add a second aggregate gate. | Can follow scope selection independently | Missing, skipped, cancelled, and failed required jobs fail; both successful jobs pass. Existing terminal-workflow and current-head behavior remains intact. |

### Workstream B — Extend active verification with reproducible evidence

| Done | ID | Bounded change and likely owning files | Depends on | Acceptance evidence |
|---|---|---|---|---|
| [x] | SF05 | Qualify the passkey browser scenario in `tests/specs/client.passkey.spec.ts`, its helpers, and `tests/mocks/pimlico-handlers.ts` before promoting the project. Separately assess `tests/specs/client.fork.spec.ts` for faithful browser/chain/indexer wiring; do not attach the entire fork suite to every critical edit. | SF01–SF03; capability inventory | Remaining on login, missing expected input, unfinished registration, and silent auth fallback fail. One registration/session-restoration or rejection outcome completes with a virtual authenticator. Record which real-wallet/device claims this cannot prove. Fork gaps get a separate selected checkpoint before execution. |
| [x] | SF06 | Add a bounded production-PWA-preview case using the existing browser lifecycle, `playwright.config.ts`, `tests/specs/client.offline-sync.ci.spec.ts`, and a direct runner fixture. Design authentication without enabling a production bypass. Add CI wiring as a separate checkpoint after local proof. | SF01 and explicit preview-auth design | Production app shell reloads offline after controlled installation; removing navigation cache fails. Test worker update/recovery where the selected change warrants it. Record clean-room and installed/authenticated proof separately. |
| [x] | SF07 | Pilot bounded role/data/viewport interaction through the existing browser CLI and scenario helpers. A proposed browser subcommand may be added; it is not an existing runnable interface. Start with one data-rich journey and one recovery variant, reusing route-proof error/overflow checks and current mock-role identifiers. | SF02–SF03; one scenario selected | Seed and action log replay the same failure; fresh context/reset prevents cross-case contamination; required outcome asserts completion. Unknown network operations and out-of-scope navigation fail. No blind click-all or real-wallet signing. |
| [x] | SF08 | Register only qualified proof in `scripts/data/validation-policy.json` and `scripts/quality/select-validation.mjs`, with its direct tests. Connect scenario artifacts to existing runner evidence, adding `scripts/dev/ci-local.js` changes only when necessary. Keep each registration independently reviewable. | The relevant SF05/SF06/SF07 proof; measured cost | Relevant changed paths select the check, unrelated edits do not; critical overrides survive. Missing capability is BLOCKED, missing/failed required scenario is not a pass, and source/fixture/profile/toolchain drift invalidates reuse. |

SF07 exploration runs only against an owned disposable profile. Route actions must be allowlisted
for the scenario; effects use strict substitutes or an explicitly selected local fork with
disposable accounts. A proposed pilot budget is at most two exploration/repair attempts within
five minutes after startup, adjusted from measurement. Repair still requires implementation
scope. Deterministic replay becomes ordinary regression proof; stochastic exploration never
silently turns a failure into green. A dedicated accessibility package or property-test library
requires separate dependency approval. Use the installed stack for initial proof where faithful.

### Workstream C — Reduce repeated operating judgment

| Done | ID | Bounded change and likely owning files | Depends on | Acceptance evidence |
|---|---|---|---|---|
| [x] | SF09 | Extend `scripts/dev/ci-local.js` and its owning tests with concise outcome diagnostics derived from observed evidence. Reporting is locally complete; optional PR validation text remains deferred. Capture bounded load/lease context without secrets. Start with reporting; do not add automatic retries or broad regeneration. | Representative failures and actual workflow needs | Deterministic failure, budget exhaustion, capability block, cancellation, and suspected contention remain distinct. Output preserves the first failure, exact scope, pending proof, and an actionable next command. Focused proof never claims an unrun full gate. |
| [ ] | SF10 | Extend `scripts/dev/doctor.js` and its existing shared helpers/tests to diagnose missing effective worktree hook chains and point to the owning setup path. Complete live hook-loading evidence in the architecture hub's existing pilot. Setup repair, if selected, is a separate checkpoint. | Scope selection; coordinate current worktree owners | Fixture matrix covers relative/absolute paths, missing dispatcher or target, inactive checkout, and differing branch tooling. A selected disposable worktree proves dispatch end-to-end. Doctor performs no install, Git-config edit, cleanup, or broad retargeting. |
| [x] | SF11 | Establish source-controlled negative Address type probes for Client/Admin using the owning typecheck/test entrypoints, then trace and repair the augmentation or package boundary causing widening. Choose at most one owning declaration/config plus its consumer probes per checkpoint. | Scope selection; current compiler baseline | Non-hex string assignment fails under each actual project graph; valid address use passes. Preserve runtime validation and public type compatibility. Record unrelated baseline diagnostics; do not hide them with assertions or broad suppressions. |
| [x] | SF12 | Mine a small authorized sample of repeated interventions; choose at most three reproduced failure classes. Add each guard or property check beside its owner, and link the superseded guidance only after proof. Candidate areas: message IDs, provider composition, codec round-trips, time boundaries, and indexed access in a bounded leaf. | Evidence sampling; separate selection per rule/property | Each rule has an offending and valid case; each property has an explicit invariant and deterministic replay/seed where needed. Demonstrate reduced repeated work. No memory deletion quotas, blanket regex bans, blanket compiler flip, or dependency install. |
| [ ] | SF13 | Evaluate the selected changes in five ordinary authorized tasks and verify the existing routine-to-Codex handoff operationally when access/authorization is available. Reuse the architecture pilot and existing scorecard; record only missing measurements here. | Implemented selected slices; read access or separate dispatch authorization | Report intervention categories, replay success, missed regressions, and comparable p50/p90 costs. Verify configured delegation through an actual linked outcome before proposing another dispatcher. Decide adoption from evidence, not elapsed calendar time. |

### Execution and test strategy

Keep each checkpoint to one failure class and about three or four owning files. Split any slice
that exceeds one session or combines fixture repair, runner integration, and workflow rollout.
Do not parallelize edits to the selector, runner, or shared browser fixtures. Implementation
starts only after scope selection, the applicable release gate, fresh ownership checks, and the
plan skill's normal start procedure; this request did not authorize Linear writes.

Before each selected implementation, read the nearest guide, the testing contract, the relevant
runtime callers, and the selector's `selectedBy` reasons. Record a failing behavioral proof first
for confirmed defects; preserve a passing control. Use direct fixture tests for tooling and
rendered proof for browser assertions. Qualification of one proof class never certifies another.

Use repository commands after rendering the actual plan:

```sh
bun run check --plan -- --intent qa
# Run the selected subject's direct test/observable proof.
# For the matching established CI browser projects, when their prerequisites are ready:
PLAYWRIGHT_APP=client APP_ENV=test bunx playwright test --project=client-ci
PLAYWRIGHT_APP=admin APP_ENV=test bunx playwright test --project=admin-ci
```

Contracts continue through Bun wrappers, and new checks retain the full selected critical
override. A coherent cross-package checkpoint uses the existing Quick Gate. A later authorized
push uses the push intent; live current-head CI is still required for merge readiness.

Artifacts record the source fingerprint (including dirty inputs), scenario/fixture version,
profile, browser engine/session class, attempted/completed cases, failures/skips, commands,
exit status, and private artifact paths. Only exact passing evidence may be reused. The receipt
store must not become a source of implicit authorization for edits, retries, publication, or merge.

### Scope decisions and deferred recommendations

The [proposal constraints](spec.md#agentic-development-proposal-2026-10-04) and
[acceptance matrix](eval.md#agentic-development-proposal-2026-10-04) govern this follow-up.
Keep advisory completion hooks and current authenticated-browser policy. Reconsider either only
through an explicit policy decision backed by the pilot. Keep native sandbox/permission posture.

Do not implement Fable's suggested worktree deletion inside `dev:clean`, mass memory reduction,
automatic post-edit regeneration, universal retry-on-load, or receipts-in-commit-trailers as proof
of trustworthy execution. Fresh scope-specific artifact generation and dry-run codemods can be
proposed once repeated demand and a durable caller are demonstrated. Existing contract fork
push lanes remain; a scheduled fork campaign is optional, separate work, not a missing baseline.

## Current handoff

The snapshot 08 follow-up reached `develop` at `23a8d1ffb`, and D11 in `9703b5402` and
`1c6948d50`, D12 in `46be0573a`, and D13 in `e0046ac17` and `09ada5970`, which reached `origin`
inside another session's push at `58d442042`. On September 29 Afo reviewed the scorecard's open
items and chose to park the rest until after the 2.0.0 release (D14): the checklist is in
§ After the release and the evidence in the
[post-release plan report](reports/2026-09-29-post-release-plan.md). Next, in order:

- snapshot 09 on 2026-10-05: the seven-day CI window from 2026-09-28, which fills the fourteen
  fields snapshots 07 and 08 leave pending; Admin · Test runs happy-dom from D11's push on and
  Client · Test from D12's, so the window also shows whether they dropped on the runner. Recheck
  the CodeQL prune there: its hourly schedule (`37 * * * *`) fired at 02:42, 10:06 and 16:36 UTC
  on September 29 and 00:43 UTC on September 30, and its push trigger runs on each `develop` push;
- the laptop restart and worker test, then the worktree cleanup, both Afo's calls; the report
  lists the 26 removable worktrees and the four branches whose owners merge `develop`;
- `linear-sync` for PRD-835 (architecture hub), in a pass that may write to Linear.

The earlier instructions below are historical.

Resolve or explicitly disposition the Client validation blocker after scope approval; exact local results are in Snapshot 06 and eval.md. Preserve the serial scope and current branch. Do not repeat completed September 19–20 slices or treat their historical local failures as live findings. Subsequent publication, current-SHA CI acceptance and any external scorecard/Linear update require their own authorization. Existing architecture and onboarding ownership stays with the hubs below.

## Follow-on order and ownership

1. After representative test improvements, reassess the Work/Agent import paths with the [architecture hub](../../active/codebase-architecture-skills/plan.todo.md). Avoid mechanically migrating setup in a subject already selected for dependency refactoring. Runtime changes remain outside this test-only scope.
2. Deliver one local write → index → displayed-result journey before expanding OrbStack concurrency. Reuse the first-run obligations from the `developer-onboarding` hub, archived on 2026-09-21 — see the [archive ledger](../../ARCHIVE.md); its Node-pin gap is named there and the hub itself lives only in Git history. Select the environment design separately.
3. Reconcile [builder docs PR #795](https://github.com/greenpill-dev-guild/green-goods/pull/795) as commands and policies settle. Update guidance beside its owning change; broader agent evaluations belong with architecture governance.
4. Prune verified unused forwarding files, replaced runners, and completed plans after caller/closeout checks. No root-folder purge or unresolved-plan deletion is selected here.

## Validation status

Current focused evidence and final-check results are maintained in [Snapshot 06](reports/2026-09-26-snapshot-06.md) and the latest eval.md entry. Plan-file validation establishes hub consistency only. Earlier sections below preserve dated commands and results for traceability.

## Historical evidence

The September 19–20 slice commands, RED/GREEN results, coverage counters and limitations remain in [eval.md](eval.md), the [preparation report](reports/2026-09-19-preparation.md), and `status.json#history`. Their implementation is committed in `9a0a5ac18960730f00d4dff0125286c41f23cb98`. This live checklist replaces the duplicated historical next-step instructions; it does not erase or supersede the dated evidence.

## Current validation blocker (resolved 2026-09-28)

Resolved by slice 5 of the velocity follow-through: the table refactor landed in `ee5c8a147`, and the full Client suite passes at one worker. The original diagnosis below ran at full width, because `--maxWorkers` did not reach Vitest; the report has the measurements.

### Original record (2026-09-27)

Full Client runs with two and one workers hit `DetailsGate.test.tsx`'s unchanged 10-second deadline (one and two failing cases respectively). A focused run passed with both original and restored runtime source, so this is timing-sensitive rather than a consistently reproduced behavioral regression. The proposed repair parameterizes the existing 23-template loop while preserving assertions and the deadline. This file is outside the accepted target list: scope expansion was requested and no Client edit has been made. Do not mark the Client gate or this hub complete while that obligation remains.
