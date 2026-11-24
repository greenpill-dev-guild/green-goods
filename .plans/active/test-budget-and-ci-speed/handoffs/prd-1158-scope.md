# PRD-1158 implementation and evidence

**Issue:** [Replace tautological tests with meaningful regression coverage](https://linear.app/greenpill-dev-guild/issue/PRD-1158/replace-tautological-tests-with-meaningful-regression-coverage)
**Status:** Local implementation verified; branch/commit/push/draft PR explicitly authorized. Post-commit verification and required current-head CI are pending; the issue is not Done.
**Measurement base:** develop `7a2ec010e1673f4b3f5b36e021649b83488f6631`.
**Publication base:** develop `6be1e3729b4127ccb669bda5e57adc4b2100ce93`; scoped tests, guidance and owning identity/route implementations are unchanged between bases.
**Updated:** 2026-10-14T23:16:15Z.

The user approved implementation after reviewing the revised outline and required a net decrease in test and support code. The three changed test files shrink from 913 to 648 lines: **265 fewer lines (29.0%)**. Application behavior is unchanged. This is working-copy evidence, not a commit-attributed validation receipt.

## Before and after

| Test file | Before | After | Change |
|---|---:|---:|---:|
| `useRole.test.ts` | 265 | 163 | -102 |
| `route-folding.test.ts` | 258 | 101 | -157 |
| `runtime-navigation.test.tsx` | 390 | 384 | -6 |
| **Total test and inline support code** | **913** | **648** | **−265** |

Counts include blank lines, comments, inline fixtures, mocks and helpers. Nonblank lines fall from 787 to 580 (−207). There are no new test, fixture or helper files, no support-code extraction, and no changed shared test helper. Guidance, generated metadata and this plan are reported separately from code counts.

The role suite removes four module mocks (nine → five), including mocked React Query, primary-address selection and stale query-key/configuration mocks. The recursive route-stubbing helper is removed, and duplicated create-action tables become one table. Runtime routing mocks increase from two to ten because eight distinct view modules now stand in for external page content while the actual production lazy loaders execute. This costs less total code and detects incorrect module selection; it is routing integration proof, not real-view proof.

Route-folding cases decrease from 18 to 10 (eight removed/consolidated). The existing runtime suite expands from 16 to 42 independently resolved scenarios; role cases remain at nine. The targeted total changes from 43 to 61 scenarios. The maintenance requirement concerns net test/support code, not a test-count quota. Existing view, financial, queue, restoration and authorization suites remain intact.

## Removal and surviving-proof map

| Original subject | Final disposition and proof |
|---|---|
| Five pure index-redirect examples | Retained in route-folding, including garden overview and legacy membership edge cases. Runtime index tests separately protect wiring and context. |
| One index-redirect component | Source architecture check retained; route resolution alone cannot enforce one composition point. |
| Two retired top-level route-family checks | Consolidated into one root-composition source guard. Three runtime `matchRoutes` cases separately inspect the real canvas route tree. A restored assessment route was detected. |
| Work view assessment keyword | Removed; runtime assessment/detail cases resolve the actual Hub loader. Existing Hub detail/assessment-inspector and Hub workbench-model proof remains. A comment keyword never established rendered content. |
| Hub deep-link source strings and ordering | Replaced by actual lazy-loader selection for work detail, assessment index/detail, certification index, creation flows and legacy assessment/history redirects; route params and garden context are observed. |
| Hub inspector descriptor ownership | Existing source architecture guard retained. `HubDetail.test.tsx` and sheet-registry tests protect real inspector/restoration behavior. |
| Global right-sheet wiring | Existing source composition guard retained; routing module markers do not replace it. |
| Hub builder implementation strings | Removed in favor of existing `admin-routes.test.ts` and action-target runtime navigation. Public context shape and retired-helper constraints remain in a narrower source guard. |
| Community endowment keyword | Removed; runtime deposit/withdraw routes resolve the Community loader, and existing Community navigation/workspace tests protect view composition. No new financial-transaction claim. |
| Strategy nesting strings | Runtime rejects the retired `/gardens` family; strategy/signal-pool paths exercise the configured governance behavior, including legacy aliases. No claim that both feature-flag states were executed. |
| Garden/Community controller import strings | Runtime hypercert and vault landing/deposit/withdraw cases observe the selected module and garden context; deep-link route cases also assert exact params. |
| Profile route count and source existence | Runtime profile case selects the actual lazy import; the applicable TypeScript graph checks module resolution. This proves route/module resolution and makes no profile-content claim. |
| Mocked smart-account role result | Rewritten using real `useRole`, `usePrimaryAddress` and React Query with controlled Auth/wagmi/registry/GraphQL boundaries. Wrong identity, chain, normalization and stale cache now change the observed role. |
| Existing role precedence, loading and permissions | Retained/consolidated into actual query lifecycle and capability tests, including deployers with and without stewardship, denied permissions, complete garden lists, and denied capability for empty-user results. Genuine empty results remain distinguishable from indexer failures; refetch recovery is exercised. |

## Deliberate fault proof

All temporary mutations were restored. `git diff --exit-code -- packages/shared/src/hooks/gardener/useRole.ts packages/admin/src/routes/views.tsx` returns no differences.

Each Shared fault used `bun run --cwd packages/shared test -- src/__tests__/hooks/useRole.test.ts --maxWorkers 1 --testNamePattern <pattern>`; Admin faults used the same wrapper against `src/__tests__/routing/runtime-navigation.test.tsx`. These were isolated expected failures, followed by restored-source passing runs.

| Temporary fault | Test pattern | Observed failure |
|---|---|---|
| Force useRole to use the connected EOA | `normalized smart` | Role is user instead of steward. The old `uses the address` case still passed under the same fault. |
| Send chain 1 instead of the configured chain | `normalized smart` | Role is user instead of steward. |
| Remove both address normalization points | `normalized smart` | Mixed-case request no longer resolves stewardship. |
| Omit identity from the query key | `cached stewardship` | Another identity retains the first identity's steward result. |
| Return an empty list instead of throwing query errors | `indexer outage` | gardensError remains false instead of exposing a retryable outage. |
| Point the Hub lazy import at Garden | `resolves /hub/work/work-7` | Expected Hub, received Garden. |
| Rename the Submit Work route | `mounts Hub create-flow` | Expected Submit Work, received the Hub work-detail match. |
| Drop index-redirect search context | `redirects /hub to canonical` | Expected garden/sort query, received an empty query. |
| Add a retired assessments route to the canvas tree | `retired /assessments` | Expected no route match, received a mounted route. |
| Require stewardship for deployment capability | `keeps deployer rights` | Deployer without gardens becomes user. |
| Grant every deployment permission | `normalized smart` | Denied permission fields become true. |
| Truncate the returned garden list | `normalized smart` | Second steward garden disappears. |
| Remove vault landing routes | `keeps /community/endowment/vault under` | Expected route target is absent. The earlier replacement stayed green; the original source guard failed. |
| Reintroduce a `/gardens` canvas route | `retired /gardens` | Expected no match, received a mounted route. The earlier replacement stayed green; the original source guard failed. |

The original smart-account case still passed under the wrong-identity fault. For each of the five review findings, the prior candidate stayed green while its original baseline guard failed; the final replacement must reject that fault. All 14 deliberate faults (eight role, six route) fail on the exact final test source identities listed below. Each temporary fault is restored before the next experiment. Earlier scratch-run interruption and a typecheck against a temporary mutation were discarded; they are not passing validation receipts.

## Validation

- Final changed suites: **61 passed** (Shared 9; Admin 52), twice on the final source with no skipped cases in either full focused run.
- Retained owner-level proof: **64 passed** (Shared identity/URL builders 21; Admin sheet registry, Hub detail, Hub workbench model, Community view/workspace and RequireRole 43).
- `bun run --cwd packages/shared typecheck --scope tests` and `bun run --cwd packages/admin typecheck --scope tests`: passed on restored final sources.
- Final selected push gate: **passed — 9 fresh checks, 0 reused, 0 unrun**. This includes changed-path format/lint, all 389 validation-tool tests, test-quality, both changed suites, 73 documentation tests plus authority/generated checks, 15 skill scenarios/15 task routes, 91 guidance files and 17 generated projections. The lint command has no applicable files under the current configuration; test typing and test-quality provide the relevant code checks. No gate was omitted or weakened.
- `node scripts/harness/plan-hub.mjs validate`: 28 hubs valid after the final evidence record. Final diff/JSON/state checks pass; test, guidance and generated source identities remain unchanged.
- Generic skill quick_validate rejects the repository's existing `argument-hint` and `user-invocable` frontmatter on both unchanged HEAD and candidate. Canonical repository guidance checks own compatibility; no routing keys were removed.

The selector reports ready, sensitive risk, 132 seconds estimated against a 180-second limit. It selects format, lint, validation-system-test, test-quality, Shared/Admin focused tests, docs-authority, agent-guidance and docs-generated. Format/lint are automatic hygiene; validation tooling, quality and guidance checks are conditional; both package suites are explicitly focused; docs authority also covers the owning documentation surface. No critical override or floor was changed.

Commands for the retained proof and required local gate:

```bash
bun run --cwd packages/shared test -- src/__tests__/hooks/auth/usePrimaryAddress.test.ts src/__tests__/utils/admin-routes.test.ts --maxWorkers 1
bun run --cwd packages/admin test -- src/__tests__/routes/sheet-registry.test.ts src/__tests__/views/HubDetail.test.tsx src/__tests__/views/Community.test.tsx src/views/Community/components/CommunityWorkspaceContent.test.tsx src/__tests__/components/RequireRole.test.tsx src/views/Hub/hub.workbenchModel.test.ts --maxWorkers 1
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/hooks/useRole.test.ts --test-path admin:src/__tests__/routing/runtime-navigation.test.tsx --test-path admin:src/__tests__/routing/route-folding.test.ts
```

## Runtime comparison

A = unchanged base tests, B = final candidate. Commands are the two focused wrappers above, limited to the changed files, each with `--maxWorkers 1`. Run order is A–B–B–A, serially Shared then Admin, on the same machine and installed toolchain: Bun 1.4.2, Node 22.22.1, Vitest 4.1.11, happy-dom, coverage off, existing warm caches preserved.

| Pair / source | Package | Wrapper wall (s) | Vitest duration (s) | Passed scenarios |
|---|---|---:|---:|---:|
| 1 / A | shared | 3.363 | 1.12 | 9 |
| 1 / A | admin | 6.291 | 4.60 | 34 |
| 2 / B | shared | 4.731 | 2.12 | 9 |
| 2 / B | admin | 5.140 | 3.49 | 52 |
| 3 / B | shared | 4.103 | 1.92 | 9 |
| 3 / B | admin | 5.225 | 3.67 | 52 |
| 4 / A | shared | 3.516 | 1.23 | 9 |
| 4 / A | admin | 5.706 | 4.05 | 34 |

Combined median Vitest duration: **5.50 → 5.60 seconds**. Combined wrapper-wall median: **9.44 → 9.60 seconds**. There is no demonstrated speedup; the candidate exercises more scenarios and the real query lifecycle. Two samples per version, shared-machine contention, warm caches and the dependency reuse below limit interpretation. This final comparison supersedes both earlier samples.

The worktree reuses installed dependencies through ignored links; workspace links point into this checkout. No installation was performed. Shared/Admin package manifests match the installed-tree source; its root sharp override is 0.35.4 while this base requests 0.35.5. This limits environment reproducibility and must be resolved by clean-install CI, not by changing this task's lockfile.

Source identities for the final measured A/B pair (SHA-256 of UTF-8 file bytes; A is the unchanged base):

| File | A | B (final candidate) |
|---|---|---|
| `useRole.test.ts` | `8708179b59c823d55f0e526077390097c824149819c22840e12cbc5dce2b9b31` | `e428fb06ff246a4a47101055404cfff1e05d1c2d955207c9b8eb4b1c7af19181` |
| `route-folding.test.ts` | `c21d36ac0ce2e32d0d3ded855c3e62f2e7c14b4b6075b623c35d53d2c06d0733` | `abca577ff1d810e0fc1dd8c5fb4319c3436ea96192d9270e6202b2342815ac42` |
| `runtime-navigation.test.tsx` | `d0975e7fb9e91fa367e0de87adc6ff11836ce3d6a934ccf83c2186cb6534c8f3` | `27d17b734158456cc3a96b96dd531c71ae25a38ee99b9fe453af7a2e5a84c88c` |

## State and boundaries

Testing/review guidance now explicitly rejects assertions of mocked behavior and redundant layers, and points valuable isolated regressions to the existing small-file exception. The review skill's two generated source digests were refreshed. Coverage floors, isolation policy, manifests, lockfiles, workflows and production sources have no task changes. Browser proof: **none**, because this is test/guidance-only work.

The legacy hub's read-only Linear manifest proposes creating a broader roadmap. That is outside PRD-1158; no new umbrella is created and existing Linear ownership is preserved. The live issue was In Progress when read again during follow-up review; no Linear write was made. This slice is recorded independently with sync disabled. Remote develop advanced during this pass, with no changes to the scoped tests and guidance in that range; this proof remains for the pinned base above. The user now explicitly authorizes a branch, commit, push and draft PR against develop; required current-head CI remains pending. No merge/readiness or issue-Done claim is made.

## Task and phase record

Task: PRD-1158 | Type: test cleanup and review correction | Outcome: corrected local implementation and selected verification complete; authorized publication/current-head CI pending.
Agent/model: Codex / GPT-6. Times are observed UTC boundaries, not active-effort measurements.

| Segment / phase | Start → end (UTC) | Result |
|---|---|---|
| Scope / investigate | unknown → 2026-10-14T15:03:55Z | Issue, hub, source and failure boundaries inspected. |
| Scope / verify | unknown → 2026-10-14T15:06:15Z | Draft path references resolved. |
| Workspace / implement (plan only) | 2026-10-14T15:23:51Z → 2026-10-14T15:26:25Z | Approved isolated develop worktree and saved plan. |
| Workspace / verify | 2026-10-14T15:26:25Z → 2026-10-14T15:26:52Z | 28 hubs valid; formatting and links passed. |
| Clarification / prepare | 2026-10-14T18:37:43Z → 2026-10-14T18:39:19Z | Prepared ignored dependency links and ran existing role baseline (9 pass, 1.12s). User clarified outline before implementation. No source edits then. |
| Accepted work / investigate | 2026-10-14T18:41:18Z → unknown | Verified checkout, scope, owning code and baseline Admin suites (34 pass). |
| Accepted work / implement | unknown → 2026-10-14T18:49:02Z | Test rewrites, retained architecture guards and concise guidance; subsequent final guard/name refinement before final measurement. |
| Accepted work / verify | unknown → 2026-10-14T18:56:55Z | Nine detected faults restored; A–B–B–A, types and 110 focused/surviving scenarios pass; all nine selected local checks pass. |

Human corrections: 1 observed (outline before implementation); none in the accepted implementation segment. Human attention: unknown. No wait interval is inferred from chat gaps.

## Follow-up review (2026-10-14)

The first local-completion report was premature: consolidation lost three distinct role protections and two route contracts (vault landing URLs and the retired `/gardens` family). Deliberately incorrect hooks confirmed each gap before correction. The fixes add the no-gardens deployer row to the existing table, assert denied permissions in the identity case, and use two returned gardens there while retaining a one-garden positive in the deployer table. Exact route params replace partial matching against empty objects, and an unused CreateGarden module mock is removed. Vault landing URLs join the existing money-route table; `/gardens` joins the existing retired-route table. Exact one-garden and denied-user result assertions are preserved. The final test/support reduction is 265 lines, versus 285 in the first pass.

Coverage ledger:

| Review batch | Inspected scope | Result |
|---|---|---|
| Test behavior | Every changed line in all three suites, owning role/address/query and route code, removed-case mapping and surviving owner suites | Five lost failure partitions corrected; final-source suites pass 61 scenarios, retained owner suites pass 64; all 14 deliberate faults detected on exact final test identities. No production edit remains. |
| Guidance, generated output and state | Testing contract, review skill, both generated digests, plan/status/handoff; thresholds, isolation, dependency and validation configuration | Narrow guidance changes; two generated source digests only; original canonical lanes and Linear ownership preserved. Final selected gate passes all nine checks. |

Review verdict: COMMENT_ONLY because required current-head CI is pending. The complete final-source selected local gate passes. No PR or merge-readiness claim. Browser proof: none; runtime/UI behavior is unchanged.

| Follow-up phase | Start → end (UTC) | Result |
|---|---|---|
| Review | 2026-10-14T22:47:04Z → unknown | Compared every removed case with surviving protection; confirmed five gaps with baseline/candidate fault controls. |
| Implement | unknown → unknown | Corrected existing tables and assertions, removed an unused mock; final test/support code is 648 lines. |
| Verify | unknown → 2026-10-14T23:16:15Z | 125 changed/retained scenarios, 14 exact-source fault failures, both test typechecks and all nine selected local checks pass. |

Human corrections: 1 observed in this review segment (the user challenged the earlier completion report); attention unknown. The earlier phase record is historical; its first-pass counts are superseded by this correction. These observed intervals do not measure active effort.

## Acceptance and remaining delivery

| Requirement | State |
|---|---|
| Same-failure removal map and real identity/query path | Complete locally; map above. |
| Deliberate identity/route faults and preserved independent contracts | Complete locally; 14 faults caught and restored, 64 retained-owner scenarios pass. |
| Testing/review guidance, small-file exception, unchanged floors/isolation | Complete locally; canonical guidance and quality checks pass. |
| Focused suites, applicable types, test-quality and selected push gate | Complete locally on the final source identities above. |
| Net test/support decrease and comparable timing evidence | 913 → 648 lines (−265, 29.0%); A–B–B–A recorded with limits. |
| Required current-head CI | Publication authorized; post-commit push gate and current-head CI pending. |

Final local result: `Outcome: passed; 9 fresh passes, 0 reused, 0 unrun of 9 selected checks (push).` The gate reports contention (33–36 load on 10 CPUs); no failure is waived. Docs audit retains two advisory hardcoded-endpoint warnings in unchanged anatomy/EAS pages. The only post-gate edits record evidence and maintain plan metadata; validated test/guidance/generated sources are unchanged. The execution sub-lane remains in_progress, with sync disabled and no commit-certified terminal claim.

## Authorized publication

The user authorized branch creation, commit, push and a draft PR against develop. The branch is `test/meaningful-regression-tests`, following the repository checker, which rejects agent and issue identifiers. The approved patch was carried forward without conflicts onto fresh develop `6be1e3729b4127ccb669bda5e57adc4b2100ce93`; original test counts and measured source identities remain unchanged. Post-commit proof and CI will be recorded in the PR and final chat so this committed evidence does not claim results from its own future SHA. No merge or Linear state mutation is authorized.

Publication phase: 2026-10-14T23:41:16Z → ongoing. Human corrections in this publication segment: 0; attention unknown.
