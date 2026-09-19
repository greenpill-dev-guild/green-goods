# Offline preparation made the online app slower

Audit of `develop` at `d3df1d3bc`, 2026-09-13, after installed-app QA reported that the Settings row
read "Retry" beside a spinner while downloading, gardens announced offline preparation while online,
and work photos stopped loading. No code was changed during the audit, and nothing was reproduced on
a device; each finding below is traced from source and the built service worker.

## Findings

1. **Every prepared record rewrote the whole reading cache.** `PreparedContentWriter.read()` called
   `evictPreparedContent`, which always ended with a full query-cache flush, then persisted the full
   cache again and wrote the download manifest. For a garden of 50 works with two photos each that
   was roughly 209 whole-cache writes and 156 manifest writes, all on the main thread.
2. **Every manifest write re-rendered the garden.** `useWorks` subscribed to the manifest through
   `useSyncExternalStore` only to compute an availability label. `useQueries` without `combine`
   returns a new array on every render (TanStack 5.101.4), so the works memo rebuilt and every card
   re-rendered on each write.
3. **Opening a garden started a download.** The Work tab recorded a visit and called `retry()`, which
   began a full run. A run in progress did not reorder to the garden in view, and gardens older than
   five minutes were prepared again from scratch.
4. **The photo path was replaced.** `sw-custom.js` is imported before Workbox registers its routes, so
   the new `<img>` handler pre-empted `ipfs-cache` (500 entries, one year). It waited for the network
   download, the cache write and an eviction pass before answering, and kept only 100 entries. The
   three-gateway race that predated the change then timed out into a placeholder.
5. **The query persister never coalesced writes.** `PersistQueryClientProvider` hands the persister a
   full snapshot on every cache event. The persister wrote each one, and the offline change queued
   them strictly one after another.
6. **Coverage was keyed by account.** Photos and metadata were shared by URL and query key, but garden
   coverage used chain, account and garden, so a second account repeated every list read and write.
7. **The same garden had two cache keys.** Garden screens used checksummed addresses from the gardens
   list, while links from work cards used the indexer's lowercase addresses.

## Decisions (2026-09-14)

- **One read model.** Background preparation fills the same queries the screens read. The separate
  prepared queries and the download manifest are removed.
- **Tiered preparation.** Work lists, approvals and details for every joined garden; photos for the
  garden in view and the account's own work. Other photos stay from browsing.
- **Photos on cellular.** One download at a time on cellular, two elsewhere; photos pause while Data
  Saver is on; the 150 MiB photo budget stays.
- **Settings copy.** A one-line title and exactly two status lines that truncate instead of wrapping
  at a 360 px screen, in English, Spanish and Portuguese. Retry appears only after a failure.
