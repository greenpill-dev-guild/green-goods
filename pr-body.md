## Summary

The offline foundation from the 2026-09-14 audit ([review page](https://claude.ai/artifact/YPWd1qZSkJaoEjZwqwNnrr), decisions D1 to D7), the review fixes, four architecture moves that follow from it, and the migration work that came out of auditing the upgrade path itself.

A steward hit the browser error page opening a garden offline. That was the starting point; most of this branch is the things that turned out to be behind it.

- **Start and restore without the network.** Passkey restore passes the stored smart-account address to `toKernelSmartAccount`, so a cold offline boot no longer runs an `eth_call` and lands on Login. A wallet session stays mounted read-only offline: the 15 s restore clock advances only while the page is visible and the store is not offline, and a reconnect retries once. "Return to Garden" on both error screens loads `/home`, inside the worker's scope.
- **Shell install that survives a dropped packet.** The manifest is split into tiers that install with four-way concurrency and three retries per file, reusing unchanged hashed files from the previous shell. Activation keeps the previous shell cache so an open page keeps its chunks, and shell metadata moves to a cache the prefix sweep cannot delete.
- **Updates that do not fight the old worker.** The page asks the old worker to quiet its media work before posting `SKIP_WAITING` (D5-A), and an update settles when the new worker reaches `activated`. The worker never claims open pages, so waiting for a controller change could never settle and every Restart ended in the timeout.
- **One connectivity signal.** `online | degraded | offline`; only offline pauses queries (D7-A). The job queue, toasts and telemetry read the store rather than `navigator.onLine`.
- **Two offline surfaces while online** (D4-A): the banner and the Settings row. The back-arrow tone, the dashboard spinner, dot and cloud glyph, the submission footer line and the online "Couldn't refresh" line are gone, along with the unrendered `SyncIndicator` and its three orphaned locale keys.
- **Reads keep unknown unknown.** ENS lookups pause offline instead of caching null; a partial indexer read is reconciled against cached rows; EAS reads reject malformed responses; a reinstall no longer empties the query cache.

## Architecture moves

- **The reading cache persists per query, not per snapshot.** `createQueryPersistence` writes one record per query through TanStack's `experimental_createQueryPersister`, so a single garden write no longer rewrites the whole cache and each query ages on its own `dataUpdatedAt`. The old whole-snapshot store migrates once on first restore and is then deleted.
- **The garden read is paged the way the screen consumes it.** It was every work attestation of a garden plus a second query for every approval on the chain, joined in memory. It is now one bounded request for the newest fifty works with each row carrying its latest approval, and "Show older work" widens the window by a page.
- **The service worker is built from TypeScript.** `packages/client/src/sw` replaces the generated script plus the hand-written `sw-custom.js` that rode in through `importScripts`. vite-plugin-pwa's `injectManifest` bundles it, its own WebWorker TypeScript project checks it, and the page and worker share one contract for message names, reply shapes and cache names.
- **The queue and draft stores are typed Dexie databases.** Their version history is the schema. Dexie stores a declared version ×10, so versions 8 and 4 open in place the databases earlier builds created. Every read-modify-write runs in one transaction, and the pending work count and queue statistics are live views over the jobs table.

## The offline-ready tier

The deferred half of the shell was cut by *when a module was first reached*, which put the HEIC decoder and the locales beside the attestation encoder. But a steward composes work with no signal and only ever sends with one, so those two halves want opposite timing.

| Tier | Contents | Gzip | When |
|---|---|---|---|
| Critical | the app itself | 1.53 MiB | first visit, any browser |
| Offline ready | HEIC decoder, es/pt catalogues | 0.90 MiB | on install, and every standalone launch |
| Tail | encoders, simulate, wallet submission | 0.26 MiB | on idle |

The offline-ready tier is budgeted on its own so growth there is caught. It is requested on `appinstalled` **and** on every launch in standalone mode: the event fires once and only in the installing tab, so the standalone check is what reaches anyone who installed on an older build. Data Saver pauses both tiers.

Reporting is one toast, shown only to someone who just installed or updated — a visitor browsing the public site sees nothing. After a restart it stays silent unless the wait is real, because a new shell reuses every unchanged file from the previous one.

**A HEIC photo picked before the decoder lands is now kept rather than refused**, and converted in the job executor at send time, where the network is. A conversion that still fails at send uploads the original: a steward's evidence is worth more as an awkward file than as a hole in the record.

## Migration findings

Auditing the upgrade path, rather than waiting for a test to fail, turned up four faults. Each is fixed with a regression test verified to fail without its fix.

- **The job queue could be bricked permanently.** `userAddress` arrived at database version 5 and that upgrade indexed it without backfilling, so an unsent job from an older build has none. The Dexie upgrade called `.toLowerCase()` on it unguarded. Dexie runs the callback inside the version-change transaction: the throw aborts the upgrade and rejects `open()`, and every later open fails identically. The queue and the steward's unsent work would be unreachable for good, and silently — the live query parks its error where no caller reads it. The `idb`-era upgrader survived the same row only because its cursor walk was a floating async call whose rejection went unhandled, so this was a regression, not an inherited bug.
- **A partial cache migration destroyed its own source.** Per-record write failures were swallowed, then the legacy snapshot was deleted unconditionally. Storage filling up partway through lost every record not yet rewritten, which for an offline reader is the read model gone with nothing to refetch from.
- **Metadata was trusted as proof its shell cache existed.** A rolled-back worker sweeps shell caches without touching the new metadata. On rolling forward, `install()` skipped on the stale record and `activate()` then swept the only shell that still worked.
- **The offline-ready toast could never settle after an update.** `registerServiceWorker` asks for the tier with no callback and `PwaUpdateNotifier` then asks with one; the module remembered a single callback per tier and dropped the second silently. Every request now carries a reply port and the outcome is fanned out.

Also closed: photos reported unavailable while sitting in the prepared cache, that cache never draining so every reopened photo was stored twice, a retired cache the page could not reclaim, a stale snapshot replayable over a fresher read, and the legacy cache database being recreated empty on every boot.

**The jobs database had no in-place upgrade test at all** — drafts had one, and drafts was fine. That asymmetry is how the first fault got here. It now has four, seeded from the real shipped shapes, and the drafts test gained production's actual version 1 shape (it started at 2). The existing "never deletes the active shell cache" test seeded metadata without the cache, so it was asserting the broken state was correct.

## Documentation

`docs/docs/community/gardener-guide/installing-and-updating.mdx` — install and update guidance the team can work from on a call. The Update row's states in a table, a symptom-to-action table, and the two facts that shape every one of those calls: an update never applies on its own, and the app shows no version number, so the only reliable check is the Update row itself. It also warns against clearing site data, which deletes unsent work and has stranded installed users before.

## Linear

Refs PRD-920

## Human call-outs

- **Rollback is not available as a mitigation.** A user on this branch cannot be moved back: the shipped builds have no `VersionError` recovery, and nothing here can fix code that already shipped. This is pre-existing (develop to main is already one-way) but it matters more for a change this size.
- **Installed-device acceptance is still required**, specifically on a device holding real queued work: the in-place IndexedDB upgrade is the one irreversible step. Also fresh and upgraded Android installs, airplane-mode cold launch for passkey and wallet, an update during a session, an error screen while offline, opening a lazy sheet after an update.
- Production (`main`) has no shell prefetch at all, so its users get no cache reuse on this update and download the full critical set. The app stays usable throughout, since critical installs before the restart is ever offered.

## Validation

- Shared 462 files / 4987 tests, client 135 / 1186, admin 114 / 862.
- Typecheck clean for shared, and for all four client projects and both admin projects. The client typechecks the service worker as its own project.
- `bun run build` in `packages/client` passes; `check:pwa-precache` reports 23 precache entries, installed startup 0.95 MiB gzip, offline shell 9.71 MiB raw / 2.69 MiB gzip.
- format, lint, source-structure, test-quality, docs-authority, docs-build, staged-modules, ontology, react-patterns and the design token and vocab checks all pass.

Rendered proof, signed in as a steward in Brave against the live Arbitrum indexer and EAS: a garden with eighteen works renders through the paged read in exactly two EAS requests; the reading cache holds ninety-four records, one per query; `green-goods-drafts` is at IndexedDB version 40 and `green-goods-job-queue` at 80, both opened in place; the worker built from `src/sw` registers as a module, activates, and controls the page at the `/home` scope.

**Not covered:** the offline banner and a cold offline launch, which need a device or a browser that can be put offline; Storybook play functions; physical devices. Both migration audits were source-level — nothing in the migration path has been observed in a real browser. One flake was seen in `Cookies.test.tsx` during a full run; it passes in isolation and in five subsequent full runs, and looks pre-existing.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
