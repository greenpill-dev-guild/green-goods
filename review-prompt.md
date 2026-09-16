# Review task: the offline foundation on `fix/offline-foundation`

## Objective

Review the branch `fix/offline-foundation` against `origin/develop` and return a verdict on whether
it is safe to merge into `develop`. Judge the architecture as designed and as implemented, not just
the diff hygiene. Read-only: do not edit files unless the reviewer explicitly asks for `--fix`.

Use the repository's `/review` skill conventions for lenses, finding format and the output contract.
Treat `.claude/context/codebase-architecture.md` as the vocabulary for structural findings.

## Present state

- Branch: `fix/offline-foundation`, 18 commits, base `origin/develop`. **Not pushed.** The branch is
  local only, so use `git log origin/develop..HEAD` and `git diff origin/develop...HEAD`.
- Size: 167 files, +5134 / -3903. This is well over the 800 LOC single-pass limit, so declare review
  batches and keep a coverage ledger of reviewed versus remaining files. Do not imply completeness
  for files you did not open.
- Working tree is clean. `pr-body.md` and `session-state.md` at the repo root are untracked handoff
  notes, not part of the change.
- The plan hub under `.plans/` is deliberately untouched. Do not report its absence as a gap.

Origin of the work: an architecture audit of the client PWA's offline behaviour on 2026-09-14, after
a steward hit the browser's own error page opening a garden offline. The audit concluded the weak
layer was everything that runs *before* content: shell install, service worker hand-over and session
restore. Decisions D4 through D7 from that audit were all resolved to option A and are implemented
here.

## The architecture, before and after

### Foundation fixes (commits `99b6f5a24`, `507de022a`)

| Area | Before | After |
|---|---|---|
| Passkey restore | Called `toKernelSmartAccount` without an address, forcing an `eth_call` on cold boot; offline that landed on Login | Passes the stored smart-account address, so restore is local |
| Wallet restore | 15 s clock ran only while `navigator.onLine`; offline users were signed out | Session stays mounted read-only; the clock advances only while the page is visible and the store is not offline, and one retry fires on reconnect |
| Shell install | 287 files fetched in series, digest-verified, whole cache deleted on any failure | Split into a critical set and a tail; four-way concurrency, three retries per file, reuse of unchanged content-addressed files; tail installs on idle after activation and pauses under Data Saver (D6-A) |
| Update hand-over | Settled only when `controller === worker`, unreachable for a non-claiming worker, so every Restart timed out | Settles on `worker.state === "activated"`; the page first asks the old worker to quiet its background media work (D5-A) |
| Connectivity | Components read `navigator.onLine` in many places | One store with `online \| degraded \| offline`; only `offline` pauses queries (D7-A) |
| Offline indicators | Six signals across 66 sites | Two while online: the banner and the Settings row (D4-A) |
| Error screens | "Return to Garden" navigated to `/`, outside the worker's `/home` scope, which is the best-fit cause of the original browser error page | Navigates to `/home` |

### Move 1: the reading cache persists per query (`c2cce7662`)

`packages/shared/src/config/query-persistence.ts` (+395 / -266) replaces a whole-snapshot persister
with `createQueryPersistence(options)`, built on TanStack's `experimental_createQueryPersister` from
`@tanstack/query-persist-client-core`. One IndexedDB record per query instead of one document for the
whole cache, so a single garden write no longer rewrites everything, and each query ages on its own
`dataUpdatedAt` rather than a shared snapshot timestamp.

- Storage tiers: idb-keyval store, then web storage with a `gg-` prefix, then memory.
- The policy runs inside `storage.setItem`, not as a dehydrate predicate, because the predicate was
  evaluated before the fetch resolved.
- The old `__rq_pc__` snapshot is migrated once on first restore and then deleted.
- New provider `packages/shared/src/providers/QueryPersistence.tsx` wraps `QueryClientProvider` with
  `IsRestoringProvider`. Client and admin each pass their own database name.
- Restore races a 1500 ms timeout.

### Move 2: the garden read is paged (`baebb3bd0`)

Before: `getWorks` paged through *every* work attestation of a garden, and a *second* query read
every work approval on the chain; the two were joined in memory in `useWorks`.

After, in `packages/shared/src/modules/data/eas.ts` and the new
`packages/shared/src/modules/work/work-list.ts`:

- `getWorkListPage(garden, { chainId, take, skip })` — one bounded request, `orderBy` timeCreated
  desc then id asc, default `take` 50.
- `getWorkApprovalsForWorks(workUIDs, chainId)` — approvals for a known set of works, batched 50 at a
  time as an `OR` of `decodedDataJson contains <uid>`, then filtered on the parsed `workUID`.
- `readWorkList({ garden, chainId, take })` composes them into `EASWorkListRow[]`, each row carrying
  its own latest `approval`. A failed approvals read returns the works with the field *absent*, which
  the hook reads as "unknown" rather than "no approval".
- `useWorks` holds the window in component state, exposes `hasOlderWork`, `loadOlderWork` and
  `isLoadingOlder`, and never shrinks a window a background refresh already widened
  (`Math.max(takeRef.current, cached?.length ?? 0)`).
- The garden list component renders every row it is given; the "Show older work" control is driven by
  the read state and hidden offline.
- The offline scheduler lost its separate approvals task; its port is now `fetchWorks(garden, take)`.

### Move 3: the service worker is built from TypeScript (`9131211d0`)

Before: vite-plugin-pwa `generateSW` produced a Workbox script that pulled in a 981-line hand-written
`packages/client/public/sw-custom.js` through `importScripts`. Untyped, and its message names were
duplicated by hand on the page side.

After: `packages/client/src/sw/` with `strategies: "injectManifest"`, `srcDir: "src/sw"`,
`filename: "sw.ts"`, `rollupFormat: "iife"`.

| File | Role |
|---|---|
| `sw.ts` | Entry. Installs the Green Goods listeners first, then Workbox precache, navigation fallback, image cache and background-sync routes |
| `worker.ts` | Wires the scope: install, activate, one fetch dispatcher, messages, notificationclick, sync |
| `shell.ts` | `PwaShell`: critical install, tail download, activation and cache retention |
| `media.ts` | `MediaCache`: the sized photo cache, answer-first then store |
| `shareTarget.ts` | Web Share Target intake into the share inbox |
| `messages.ts` | The page message protocol handler |
| `runtime.ts` | JS module shim, client notification, background sync registration |
| `backgroundWork.ts` | Tracks in-flight background work so a hand-over can quiet it |

- `packages/shared/src/modules/app/service-worker-protocol.ts` is the single contract for message
  names, reply shapes and cache names. Both sides import it; it is a declared shared export.
- `packages/client/tsconfig.sw.json` is the worker's own WebWorker TypeScript project, referenced by
  the client solution, so `tsc -b` and the client `typecheck` both cover it.
- The dead public-navigation handler and `navigateFallbackDenylist` are gone: the worker is scoped to
  `/home` and never receives those requests.
- `MediaCache` keeps a running byte total between writes instead of rescanning the whole cache before
  each admission.
- The dev worker is served as an ES module at `/dev-sw.js?dev-sw` and registered with `type: "module"`.

### Move 4: the queue and draft stores are Dexie (`c56a59007`)

Before: hand-written `idb` upgrade callbacks; the schema lived in imperative branching.

After: typed Dexie databases whose version history *is* the schema.

| Database | Dexie version | IndexedDB version | Opens in place over |
|---|---|---|---|
| `green-goods-job-queue` | 8 | 80 | the `idb`-era version 7 |
| `green-goods-drafts` | 4 | 40 | the `idb`-era version 3 |

Dexie stores a declared version multiplied by ten, which is what lets these adopt the existing
databases without a data migration. Every store and row is kept. The address-lowercasing migration and
the draft-kind migration re-run idempotently. The boolean `synced` and `kind_synced` indexes are
dropped on the claim that IndexedDB cannot index a boolean, so they never held a row.

- Every read-modify-write now runs inside one transaction.
- `jobQueueDB.observeJobs` / `observeStats` expose Dexie `liveQuery` observables.
- `packages/shared/src/hooks/utils/useLiveQuery.ts` subscribes to one for the component's lifetime.
- `usePendingWorksCount` and `useQueueStatistics` are live views instead of TanStack queries, so a job
  added or synced in any tab updates the app bar without an event round trip.

## Dependencies

Added:

| Package | Version | Where | Why |
|---|---|---|---|
| `dexie` | 4.4.6 | `packages/shared` dependencies | The typed store layer for both IndexedDB databases |
| `@tanstack/query-persist-client-core` | 5.101.4 | `packages/shared` dependencies | `experimental_createQueryPersister`, the per-query persister |
| `workbox-background-sync`, `workbox-cacheable-response`, `workbox-core`, `workbox-expiration`, `workbox-precaching`, `workbox-routing`, `workbox-strategies` | 7.4.1 | `packages/client` devDependencies | The worker source now imports Workbox directly instead of receiving a generated bundle. All were already in the lockfile as transitive dependencies of `workbox-build` at the same version |

Removed: `packages/client/public/sw-custom.js`, `packages/shared/src/components/Progress/SyncIndicator.tsx`
and its stories, and the shared export `./components/Progress/SyncIndicator`.

New shared exports: `./modules/app/service-worker-protocol`, `./providers/QueryPersistence`.

`bunfig.toml` enforces a three-day minimum release age; `dexie@4.4.6` was published 2026-09-10 and
passes the supply-chain check.

## What is already proven — do not spend the review redoing it

- Full suites pass on the branch head: shared 460 files / 4971 tests, client 135 / 1176, admin 114 / 862.
- Typecheck is clean for shared, client (app, worker and test projects) and admin.
- `bun run build` in `packages/client` passes; `check:pwa-precache` reports 23 precache entries
  (0.53 MiB raw), installed startup 0.94 MiB gzip, offline shell 9.70 MiB raw / 2.69 MiB gzip.
- The push gate passes every runnable check. `browser-proof` is declared `manual: true` with
  `command: null`, and `scripts/dev/ci-local.js` blocks any such check unconditionally, so the gate
  can never go green from an automated run. That is why the branch is unpushed. It is not a finding.
- Browser QA in Brave, signed in as a steward against the live Arbitrum indexer and EAS: a garden of
  18 works renders through the paged read in exactly two EAS requests with per-row approval statuses;
  the reading cache held 94 one-per-query records; the two IndexedDB databases were at versions 40 and
  80; the worker built from `src/sw` registered as a module, activated and controlled `/home`.

## What is not proven — the highest-value targets

1. **Offline behaviour itself was never exercised.** No cold offline launch, no offline banner, no
   airplane-mode restore, no update-during-session, no device. Every offline claim in this branch
   rests on unit tests and reasoning. Attack the reasoning.
2. **The IndexedDB upgrade on a real device with real data.** Tests cover the `idb`-era schemas with a
   handful of rows under `fake-indexeddb`.
3. **Storybook play functions** were not run.

## Specific risks I want challenged

These are my own doubts, stated so you can attack them rather than rediscover them. Confirm or refute
each with file-level evidence.

1. **Dexie version arithmetic is a one-way door.** If the ×10 claim is wrong for any engine, or if a
   future build declares a lower version, the database fails to open and a steward loses queued work.
   Check the upgrade paths, the `versionchange` and `blocked` handling in
   `job-queue/db.ts` and `job-queue/draft-connection.ts`, and what happens with two tabs open across
   the upgrade.
2. **The upgrade rewrites every job row** to lowercase its address, inside the version-change
   transaction. On a steward with a long queue on a slow phone, that work runs before the database
   opens. Judge the cost, and whether a partial failure leaves the database unopenable.
3. **Latest-approval selection is last-write-wins by `createdAt` ascending.** Two approvals for one
   work sharing a timestamp resolve in undefined order, and an approval and a rejection are not
   otherwise ranked. Check `readWorkList` against what the indexer can actually return.
4. **Dropping the `synced` and `kind_synced` indexes** rests on "IndexedDB cannot index a boolean, so
   they never held a row". If that is wrong for any engine, query behaviour changes silently.
5. **A 50-way `OR` of `decodedDataJson contains <uid>`** in `getWorkApprovalsForWorks` was verified in
   shape against live EAS but never with a full 50-clause batch. Consider query cost, provider limits
   and what happens when one batch fails midway through a multi-batch read.
6. **Persisted rows written before this branch have no `approval` field.** `useMyWorks` reads
   `row.approval` from the downloaded garden lists. Work out what an offline steward sees on the first
   launch after updating, before any read refreshes.
7. **`hasOlderWork` is `rows.length >= take`.** A garden with exactly 50 works shows a control that,
   when pressed, reveals nothing. Judge whether that is acceptable.
8. **The read window is component state keyed by garden**, while the query key is shared. Two mounted
   consumers of `useWorks` for the same garden have independent windows over one cache entry.
9. **`MediaCache.knownBytes`** is a running total invalidated on a failed write. Writes are serialised
   through a tail promise; check that the invariant actually holds under an aborted fetch, a quota
   error and a concurrent sweep.
10. **The restore race has a 1500 ms timeout.** On a slow device with a large cache, restore is
    abandoned and the app starts cold. Decide whether that is the right failure.
11. **Fetch listener ordering.** The Green Goods dispatcher is registered before Workbox's routes and
    calls `stopImmediatePropagation?.()`. Verify that actually prevents Workbox from handling gateway
    media, the share target and the connectivity probe.
12. **The worker modules each carry `/// <reference lib="webworker" />`** because the client test
    project loads the DOM library and TypeScript 7 would not merge the two through `lib` alone.
    Judge whether that is the right seam or a workaround hiding a project-layout problem.

## Repository hygiene changes that need an explicit accept or reject

These were needed to get the push gate green and are not part of the offline work. Say plainly whether
each should stay.

- `tests/specs/*`: eleven governed skips carried `expiry:2026-09-15` and lapsed overnight, turning the
  gate red for every change in the repo. Re-dated to `2026-09-30`. No fixture landed. Another 28 skips
  expire 2026-09-17.
- `scripts/contracts/verify-production.sh`: it changed into the contracts package and then called the
  root-only validation runner, so the Foundry pin check and the Solidity lint both died with "Script
  not found" and the script reported a version mismatch that did not exist. Both calls now run from the
  root. This was broken on `develop` too.
- `scripts/data/module-seam-registry.json`: four certified seams needed their evidence fingerprint
  re-recorded. The structural seam checks pass unchanged.
- `scripts/data/design-token-usage-baseline.tsv`: dropped the entry for the deleted `SyncIndicator`.
- `scripts/quality/check-source-structure.js`: declares `src/sw` as a client source directory.
- `scripts/quality/workflow-performance-parity.test.mjs`: records the client's fourth TypeScript project.

## Method

- Resolve and state your batches before reading code. Suggested split: (1) the worker under
  `packages/client/src/sw` plus its Vite and TypeScript wiring, (2) the Dexie stores under
  `packages/shared/src/modules/job-queue`, (3) persistence and the paged read, (4) the foundation
  fixes and offline-content scheduler, (5) tests, (6) scripts and repository hygiene.
- Run only the non-mutating checks you need to prove or disprove a finding. Use
  `bun run check --plan -- --intent review` to render the plan. Never `bun test`; use `bun run test`.
- The job queue, work and auth providers are critical surfaces under the repository's criticality
  matrix, so read every touched line there and apply the mutation-reliability lens: no log-only failure
  handling, queue integrity, retry visibility.
- For a deep adversarial pass on the worker or the Dexie migration, prefer the built-in `/code-review`
  over hand-rolling depth.

## Output

Follow the `/review` output contract: summary with resolved scope and lenses, Must-Fix, Should-Fix,
Nice-to-Have, Remaining Gaps, Human Call-Outs, Verification, Verdict. Finding format is
`[Title] — severity · type · file:line · why it matters · next step`.

Verdict rules for this review: `APPROVE` only if every requirement is satisfied and the applicable
local proof passed. Any missing requirement is `REQUEST_CHANGES`. Blocked evidence, including the
unrunnable `browser-proof` and the unexercised offline paths, yields `COMMENT_ONLY` unless something
else already forces changes.

## Stop conditions

- Do not edit files. Report findings; the author applies them.
- Do not push the branch, open a pull request, or bypass the pre-push hook.
- Do not update `.plans/`.
- If a check cannot run in your environment, mark it `BLOCKED`, name the missing capability, and move
  on rather than substituting a different check and calling it equivalent.
