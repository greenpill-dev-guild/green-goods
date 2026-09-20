# Preparation evidence — September 19, 2026

This report supports the test-budget-and-ci-speed plan. It refreshes the supplied execution brief; it is not a new repo-wide audit. Preparation changed no product source, tests, policy, workflow, dependency, environment or branch.

## Identity and method

Local baseline: `459ca0b904a46511e31293ef921dfc8c3af70496` on develop. Initial `git status --short` was empty. A later status showed only this new hub; HEAD was unchanged. The supplied test brief used `9180601ee`; the architecture assessment used `e00267d162` with working changes. Neither is current proof.

Evidence collected on September 19: tracked-file inventory, named source/test reads and consumer searches, GitHub PR/run/job/log GET requests, and validation-plan rendering. No full local suite, coverage run, mutation panel or authenticated product QA was run.

## Inventory

Method: `git ls-files packages`, select tracked files ending in `.test.[cm]?[jt]s(x)`, `.spec.[cm]?[jt]s(x)`, or `.t.sol`; exclude packages/contracts/lib and node_modules. Count physical lines including blank lines/comments. Stories and support files without those suffixes are excluded; colocated source-folder tests are included. These are inventory counts, not collected or passing tests.

| Package | Files | Test lines | Files declaring createWrapper | Files constructing QueryClient | QueryClient occurrences | Files with ≥10 vi.mock calls |
|---|---:|---:|---:|---:|---:|---:|
| shared | 499 | 113,903 | 60 | 85 | 159 | 29 |
| client | 140 | 33,880 | 0 | 2 | 15 | 29 |
| admin | 114 | 25,471 | 0 | 2 | 2 | 17 |
| agent | 29 | 9,257 | 0 | 0 | 0 | 0 |
| indexer | 36 | 10,708 | 0 | 0 | 0 | 0 |
| contracts | 176 | 63,877 | 0 | 0 | 0 | 0 |

Total: 994 files, 257,096 physical test lines. There are 89 files containing 176 QueryClient constructions; the brief's 88 was a historical file count, not an occurrence count. Counts nominate inspection, not deletion. Indexer/Contracts are context only and outside the refactor scope.

Reproduction: identify function createWrapper or const/let createWrapper declarations; count `new QueryClient(` and `vi.mock(` allowing whitespace. Keep file and occurrence counts separate. An initial scratch scan excluding every /lib/ was discarded because it omitted Shared's own src/lib tests; this table uses only the scoped vendor exclusion.

## Recent CI reference

[Shared run 35470694082](https://github.com/greenpill-dev-guild/green-goods/actions/runs/35470694082) succeeded for develop at `7813ca111228c87517339c198562244d980e175e`, created 2026-09-19T21:32:00Z.

- Test job 105971008084: 21:32:48–21:37:27 UTC, **279 seconds**.
- Run shared tests step: 21:33:27–21:37:24 UTC, **237 seconds**.
- Vitest: **235.88 seconds**; transform 35.91s, setup 90.94s, import 248.52s, tests 67.51s, environment 226.01s. Buckets aggregate workers and do not sum to wall time.
- Result: 497 files passed, 2 skipped; 5,323 tests passed, 17 skipped.

This is one reference, not p50 or a controlled comparison. The historical 341s/5.1min figures are not adoption benchmarks. The local baseline has later Shared and Client changes, including useFilteredGardens and its tests. GitHub's run query for the local baseline SHA returned no runs. Do not label this reference current-head CI.

The current Shared workflow still has a single Test job running bun run test, without a shard matrix. Coverage Nightly is a separate unsharded command. Collect comparable before/after runner evidence when implementing sharding.

## Coverage reference

[Coverage Nightly run 35443552892](https://github.com/greenpill-dev-guild/green-goods/actions/runs/35443552892) succeeded at `405d3996dc5dfd140a5cf648920cfbb34ec255f9`, created 2026-09-19T12:40:55Z. Admin job 105898503572, Client 105898503668 and Shared 105898503683 all succeeded. Values below are from their logs, in Vitest column order.

| Scope | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Shared all files | 70.73 | 63.24 | 69.04 | 72.56 |
| Client all files | 70.82 | 64.41 | 67.74 | 72.71 |
| Admin all files | 58.68 | 54.73 | 53.14 | 60.30 |
| Shared src/modules/work | 88.05 | 83.60 | 87.85 | 90.00 |
| Shared modules/job-queue directory row | 84.56 | 78.15 | 84.85 | 87.39 |
| Shared src/hooks/auth | 77.92 | 75.38 | 78.37 | 79.56 |
| Shared src/hooks/vault | 71.88 | 59.87 | 68.93 | 73.34 |

The log shows Cookie Jar deposit at 2.04% statements / 2.12% lines and campaign at 24.18% / 25.12%. Truncated filenames and directory aggregation mean exact file/glob totals must be obtained before enforcing floors. Do not average file percentages. These are references, not approved thresholds or fresh local coverage.

Among the inspected target directories/configs, the nightly-to-local diff includes useCookieJarAdmin.ts and useGardenCookieJars.ts. Refresh coverage for affected composition even where the named target itself is unchanged.

## Named-target refresh

Paths are repository-relative. A gap in a named suite does not prove the product is broken or no other suite provides coverage.

| Item | Source evidence | Disposition |
|---|---|---|
| 1 | .claude/context/testing.md:39 retains September 22 +2-point ratchet; no new test-budget section found. | Retain; coordinate checkpoint and PR overlap. |
| 2 | Global floors remain documented; critical-glob work needs measured implementation baseline. | Retain; historical near-zero percentages are not final thresholds. |
| 3 | .github/workflows/shared.yml has one Test job. | Retain with comparable timing. |
| 4 | Representative push plan is blocked on manual browser proof. | Retain; policy unresolved. |
| 5 | Shared package exports ./testing from src/__tests__/test-utils/index.ts. usePublicImpactEvidence.test.ts is a 77-line candidate with a local wrapper/client. | First candidate; compare helper defaults before conversion. |
| 6a | No controlled isolation experiment conducted. | Defer. |
| 6b | No first file pair selected. | Select only worthwhile same-subject pair after exact baseline/registry exclusions. |
| 7 deposit | useCookieJarDeposit.ts has production consumers in PublicFundingCard and CookieJarDepositModal; those component suites mock it. | Direct mutation proof remains a candidate. |
| 7 campaign | useCampaignCookieJar.test.ts has one metadata-read fallback test. | Retain behavioral gap investigation; nightly remains low. |
| 7 withdraw | Admin WithdrawModal.test.tsx:206–293 has two amount/Max cases, asserting absence of an error for valid input. | Add excessive-amount rejection/no-mutation proof. |
| 7 claim | Client CookieJarTab.test.tsx:35–38 still replaces ConfirmDialog with an empty element; withdraw mock has no call assertion. Production path is views/Home/WalletSheet/CookieJarTab.tsx. | Retain claim-confirmation proof; reconcile #802. |
| 7 join | GardensList.test.tsx resolves join for toast cases without asserting garden argument or rejection. | Retain. |
| 7 connectivity | confirmForBackgroundWork has production consumers; preparation test replaces it with a spy. Store tests exercise other probe methods. | Exercise this method itself. |
| 7 upload | upload-queued-work.test.ts covers declines and embedded failures but no explicit other-chain exclusion or embedded send-cancelled case. | Add those independent branches only. |
| 7 toast | modules/work/upload-outcome-toast.test.ts:29–33 covers uploaded + flagged → flagged message. Hook imports/calls real mapper; existing upload test asserts displayed toast. | Preserve existing proof; do not duplicate policy at hook level without an independent wiring risk. |
| 7 compression/login | Named modules still have consumers; tracked-path and consumer searches found no dedicated direct suite. | Retain; refresh exact coverage before floors. |
| 7 timeframe | Existing schema tests cover valid, negative and end=0; equal/reversed boundary table absent. | Retain; consolidate end=0 instead of duplicating. |
| 8 settlement | Package search finds six names only in implementation and settlement-selectors.test.ts. | Candidates, not deletion clearance: inspect wildcard barrels and active Commitment Pooling before removal. |
| 8 storage | Memory tests cover withdrawal/sweep/revision; SQLite has schema, ciphertext, expiry/welcome but lacks corresponding explicit withdrawal/sweep/stale-revision/cap cases. | Retain common-contract proposal; preserve encryption and restart proof. |
| 9 mocks | 75 files have ≥10 vi.mock calls; WithdrawModal is representative. | Analyze closure and run removals. No mock was removed or certified stale here. |
| 10 layout | GardensList has class assertions at 249–261; bootFallback has CSS regexes. bootFallbackGeometry.test.ts documents intentional pre-React parity. | Narrow review; preserve boot guarantees and establish equivalent proof before deleting. |
| 11 reporting | Not implemented by preparation. | Informational scheduling priority. |
| 12 snapshot | Full original page method and fault definitions were not recovered. | Retain comparability limitation; do not invent a twelve-fault score. |

## Representative push plan

Rendered only:

```sh
bun run check --plan -- --intent push --changed packages/client/src/views/Profile/GardensList.tsx --test-path client:src/__tests__/views/GardensList.test.tsx --json
```

At the local baseline, status was blocked with required-environment-unavailable. browser-proof was manual, command:null, requiring authenticatedBrave, with stopRule:block-readiness. The selector reported the capability false. This describes the selector, not live browser reachability.

Selected automated checks: format, lint, focused Client test, staged modules, source structure; estimated 85s within 90s. All remained pending because this was rendering, not execution. Rendering exited 0; the blocked plan status is the substantive result. No hook bypass was attempted or inferred.

The plan-only diagnose command for this hub returned ready and no selected checks; the hub validator remains direct acceptance per .plans/README.md.

## In-flight work

GitHub open-PR collection read September 19:

| PR | Checked head | Overlap |
|---|---|---|
| [#795](https://github.com/greenpill-dev-guild/green-goods/pull/795) | f3d4de6919819b8afbfe7c9cc01cc92823284a28 | Builder docs, testing.md, pre-push, onboarding and skill introductions |
| [#802](https://github.com/greenpill-dev-guild/green-goods/pull/802) | c825265a9698652f79b283d22f93527feb9b88d5 | Review/agent guidance, CookieJarTab tests and adjacent Shared ownership; stacked on #799 |
| [#799](https://github.com/greenpill-dev-guild/green-goods/pull/799) | 15e7970b0f746a435ffe9a8937a35806a5d44a6b | Wallet transfers; upstream of #802 |
| [#846](https://github.com/greenpill-dev-guild/green-goods/pull/846) | ed190b3bafca923d5d42cc949c812f01b8cfc373 | Messaging plan; no selected test work to adopt |
| [#640](https://github.com/greenpill-dev-guild/green-goods/pull/640) | e8ee6d314db3b9df17db564ba96b3dd35e4a9320 | ATProto docs; no selected test work to adopt |

No local or cached-origin refs match docs/test-budget-guidance, ci/shard-shared-tests or refactor/remove-test-only-code; none appears in open PRs. This does not rule out unpublished work in another checkout. The #795 file read covered its first 100 files, sufficient for these overlaps but not a full review.

The active architecture hub owns the September 22 checkpoint. Developer onboarding retains an unchecked first-run isolated-install/hosted-launch obligation. This hub links those owners and does not rewrite their state or Linear mirrors.

## Result and limits

Source refresh and accessible baseline collection are complete. Guidance is the first proposed implementation slice. Browser-proof policy, current-SHA full-suite proof, controlled timings, exact-glob floors, first representative conversions, original fault definitions and authenticated browser evidence remain decisions or implementation prerequisites. No product-success claim follows from this preparation.
