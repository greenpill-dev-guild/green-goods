# Snapshot 08 follow-up (2026-09-28)

Scorecard snapshot 08 listed eight open items. Afo chose five of them, 2, 3, 5, 6 and 7, with
the recommendations on the page (D10). This pass addresses them in eight local commits on
`develop` from `1a3afcb52`, one per root cause. Nothing is pushed yet.

## Item 2: the CodeQL cache prune

The prune workflow merged at 22:55 UTC (`1a3afcb52`), but its hourly schedule had not fired by
the 23:37 or 00:37 UTC slots. Dispatched by hand at 00:16 UTC (run 36502282807): the rule's tests
passed 5/5, and it found 4 overlay-base databases with 3 unreachable (1,364 MB) and deleted them.
The cache now holds one CodeQL database, the newest.

The 01:37 UTC slot passed without a run as well. GitHub starts this repository's schedules late:
Coverage Nightly, cron 03:17 UTC, started between 13:22 and 16:59 UTC on each of its last five
nights. So `42b6d4860` also runs the prune on every push to `develop`. Each push's CodeQL analysis
saves one database, and pruning at each push leaves at most that one and its predecessor. The
schedule stays as a backstop.

## Item 5: the vault history's exactly-full last page

Fault f3 turns `visibleCount < events.length` into `<=` in `VaultEventHistory.tsx`, so Load More
stays after a last page that is exactly full. All 54 related tests passed it: the paging case used
five events with a page of two, which never fills its last page. The case is now a table over five
and four events. With the fault it fails (1 of 55 related tests); without it, 55 pass.

## Item 7: the review's three product questions

Afo accepted the recommendation for each.

| Question | Decision | Change | Proof |
|---|---|---|---|
| `@hypercerts-org/sdk` 2.9.1 sets `BigInt.prototype.toJSON` on load (`dist/esm/index.mjs:4954`), so `canonicalJobPayload` received `"9"` for `9n` | Fix the comparison, not the SDK | The replacer reads each value from its holder, before `toJSON` applies | RED under a patched `toJSON`: `{"commitmentId":"9","requirementIds":["7"]}`. GREEN: 10/10, five shuffle seeds |
| `prepareNow()` left the Data Saver override in the page-lifetime snapshot, so the next person to sign in inherited it | The override lasts for the signed-in session, as its own doc said | `stop()`, which the hook calls when the session's preparation ends, clears it | RED without the fix: the next session prepared under Data Saver. GREEN: 13/13 with `useWorkUploads` 10/10, five shuffle seeds |
| The parity suite's production import-seam case never ran for source changes | Move it where source changes run | Its rules are in `check-source-structure.js`, which every package workflow and the push gate's `source-structure` check run for package source, tests included. Shared's `hooks` barrel joins the internal barrels. The parity suite keeps the public-contracts manifest check | RED on the real tree: FormWizard's old `../../hooks` import fails as `import-seam:…:internal-barrel`. Fixture tests for each rule; source-structure and parity suites 58/58 |

## Item 3: what Admin's tests import

A Vitest import-duration profile of the full Admin suite (135 files, `experimental.importDurations`)
ranked the dependencies by the time each file spent evaluating them:

| Dependency | Summed self time | Files | Why every file paid it |
|---|---|---|---|
| viem (inlined) | 107.9 s | most | the module runner evaluates viem per file; `viem/chains` alone took up to 4 s a file |
| Reown AppKit and its wagmi adapter | 49.1 s | 26 | Shared's `config/appkit` imports both at load, through the Auth provider and the chain guard; the setup mocked the unused `@reown/appkit` root instead |
| MSW | 33.3 s | 135 | the setup started it for every file; no test used its handlers |
| date-fns | 25.7 s | 4 | react-day-picker loads its whole index |
| permissionless | 14.1 s | 31 | the Auth provider's passkey adapters |

One file, `ProtocolFundingOperationsCard.test.tsx`, spent 32 s importing because
`components/Form/FormWizard.tsx` imported `useTimeout` from the Shared hooks barrel, the only
production file in Shared that did.

Changes: viem leaves Admin's inline list; the setup mocks `@reown/appkit/react` and
`@reown/appkit-adapter-wagmi` and no longer starts MSW; FormWizard imports its hook's leaf. The
full suite passes with all four (135 files, 1,109 tests).

viem A B B A, full suite, with the other changes in place, on a lightly loaded machine: inlined
60.4 and 56.9 s, external 53.2 and 53.6 s (−9%); import 234 and 213 s against 161 and 160 s
(−28%); transform −47%; identical results in all four runs.

All four changes together, A B B A, with a scratch config that served `1a3afcb52`'s setup, inlined
viem and restored FormWizard's barrel import: before 172.0 and 181.5 s, after 105.0 and 108.4 s
(−40%); import 652 and 693 s against 297 and 319 s (−54%); setup −49%; transform −68%. Other
sessions held the load at 42 to 56 on ten cores with 16 GB of swap, which inflates both arms and
favours the change, so the push's Admin · Test job gives the number to quote.

Left alone: date-fns through react-day-picker (4 files), permissionless through the Auth provider's
passkey adapters (31 files), and jsdom, which is 113 of Admin's 455 CI worker-seconds. happy-dom
would need a new Admin dev dependency, which is Afo's call.

## Item 6: the helper codemod

45 of the 63 Shared and Client test files that built a QueryClient or a wrapper by hand now use
`createTestQueryClient`, `renderHookWithQueryClient`, `renderHookWithProviders` or
`createTestWrapper`. Each batch of up to five files ran with the JSON reporter before and after,
and every file kept identical test names and results. No test was added and no assertion changed:
+790 and −1,865 lines. Files with `new QueryClient(` went from 58 to 18, and local `createWrapper`
definitions from 30 to 8.

The 18 kept files need what the helpers do not give:

- a cache that outlives its observers: `useENSReleaseName` (7 of 9 passed with `gcTime: 0`) and
  `useWorkApproval` (3 of 27) were converted and reverted; `saved-offers-hook` and
  `offline-content` passed but read back unobserved entries after an `await`, which `gcTime: 0`
  makes a race;
- other client options: persistence clients (four files), `usePoolConsoleController`
  (`gcTime: Infinity`), `useWorkMutation` (mutation `networkMode: "always"`);
- other providers or messages: `JobQueueProvider`, `Auth.wallet-login` (a stand-in for the app's
  singleton client), `useENSClaim` and `useCookieJarDeposit` (text asserted under empty messages;
  the latter carries an allow note), the three translation hooks (es and pt locales), and
  `usePageView` (a router wrapper).

`useBaseLists`, `offlineReads` and `useBatchWorkApproval` took the wrapper helper and kept their
own clients. The helpers accept no `gcTime` override; with one, five of the kept files could
convert.

## Commits

| Commit | Item | Subject |
|---|---|---|
| `42b6d4860` | 2 | ci: prune CodeQL databases on every push to develop |
| `e03f3ebb9` | 7 | fix(shared): keep the queued-job bigint marker under a patched toJSON |
| `e82d6d9c5` | 7 | fix(shared): end the Data Saver override with its session's preparation |
| `1edb10426` | 5 | test(admin): page the vault history onto an exactly full last page |
| `cc12989e9` | 3 | fix(shared): import useTimeout from its leaf in FormWizard |
| `b1c40eb3b` | 7 | ci(quality): check import seams where source changes run |
| `7a15afe76` | 3 | perf(admin): stop loading inlined viem, AppKit and MSW in every test |
| `f156aef6c` | 6 | test(shared): use the query helpers in 45 more test files |

## Verification

- Admin full suite: 135 files and 1,109 tests passed in each of the eight runs above.
- Shared full suite (`bun run test`) after the codemod: 545 files passed and 2 skipped, 6,100
  tests passed and 17 skipped, 121 s.
- Typechecks: Shared, Shared tests, Admin and Admin tests exit 0.
- `node --test` over the source-structure, parity, CI Gate and prune suites: 72/72.
  `node scripts/quality/check-source-structure.js` passes on the tree with the new rule.
- `node scripts/docs/generate.mjs --check`: 20 projections current.
- `check-test-quality.sh` fails on Check 5 only: `shared-commitment-pooling-public` and
  `shared-work-provider-command` have stale fingerprints because other sessions have uncommitted
  edits in `packages/client/src/views/Home/Garden/index.tsx` and
  `packages/shared/src/hooks/work/useWorkMutation.ts`. No file in these commits is in either
  seam. Checks 6, 7 and 9, which the codemod touches, pass.
- knip (`dead-code`) reports the same pre-existing findings as before and nothing in these
  commits.
- Not run: the push gate. It judges the working tree, which holds other sessions' uncommitted
  work, so it waits for the push, which waits for Afo.

## Open

- Push, once Afo says so.
- The CodeQL prune on the first develop push after these commits: expect one or two databases.
- The same viem and AppKit measurements for Client and Shared, which inline viem and mock the
  unused `@reown/appkit` root too.
- The MSW server and the `msw` dev dependency are unused now; removing the dependency changes the
  lockfile, so it waits for Afo.
