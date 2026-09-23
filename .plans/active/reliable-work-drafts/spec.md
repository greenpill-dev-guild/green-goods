# Accepted behavior

Copy picker bytes before processing; persist serialized attachments with stable IDs and hashes. One account/chain-scoped active draft owns all fields, audio, tags, approximate location, revision and submission identity. Atomic serialized saves, immediate attachments/selections, 500 ms text debounce, and explicit failure state. Leaving the composer navigates immediately while its latest draft save continues in the shared lifecycle; a failed background save surfaces a persistent retry action outside the composer. Preserve 20 drafts and require explicit deletion at the cap. Migrate readable legacy data only with explicit recovery for the unscoped image key.

Upload at submit with durable per-file and metadata CIDs, reuse across wallet/queue/reload, retain transaction reconciliation. Videos: MP4/WebM, 30 seconds, 20 MiB each; photos 10 MiB, 10 visual attachments; all attachments 50 MiB. Location opt-in rounded to 3 decimals before persistence; clear on opt-out, publish via metadata. Draft and flow confirmation sheets use PwaSheet.


## Review repair decisions

A known broadcast is reconciled before another send in direct submission, ordinary queue execution and batch sync. Missing receipts, offline state and timeouts remain unresolved. The app automatically checks them while running and after reopening. Confirmed failure requires the member to press Retry; reusable media CIDs survive both outcomes. Broadcast callbacks are optional and awaited, and a failed checkpoint write retains the hash in memory. Batch hash writes are atomic and batch/ordinary processing share a job claim.

Dashboard deletion, Intro discard and submission retirement use the same serialized draft lifecycle. Deletion invalidates pending generations before its transaction, resets the live composer and form only after commit, and checks scope/generation before asynchronous completion. Unrelated drafts do not reset the active composer.

Draft lists return summaries. Mounted thumbnail, Media, Review and queue consumers own preview URLs; byte reads do not allocate URLs. Stable attachment ID/hash pairs reuse previews within an owner, and cleanup releases caches and file references.

Legacy recovery copies each entry independently and records named, ordered missing attachments. A durable marker maps original entries to the recovered draft, so reloads cannot re-import removed entries or overwrite replacements. Reselect retains identity/order and Remove explicitly resolves the missing entry. Original legacy data remains until every entry is resolved or recovery is explicitly discarded. The existing draft and storage caps never evict another draft.


## Accepted offline policy (2026-09-12)

Prepare shell/fallback assets, current profile/photo, actions and joined-garden information after a
successful online session. Prepare 50 newest work records per joined garden and 20 per recently
visited nonjoined garden (at most five), capped at 500 unique records. Prioritize the active garden,
joined gardens by recent use, then other recently visited gardens. Reads must be bounded and ordered
on the server. Include known approval status, metadata and display-sized photos. Original media,
audio and video download only when explicitly opened/requested, and availability must distinguish
previews from originals.

Managed reading content has a 150 MiB budget. It remains until space is needed and shows its last
successful update. Evict lower-priority least-recently-used reading content first. Protect the
current profile/fallback; shell assets, drafts, unsent evidence and submission checkpoints stay
separate. Only verified local records and media count as prepared. Failed writes, quota failures,
incomplete downloads or evictions make availability partial and remain retryable. Older snapshots
are opportunistic until checked; deployments must not discard all cached reads.

Preparation starts after restoration and verified connectivity, runs two downloads concurrently,
reuses existing content, pauses when hidden/offline and resumes unfinished work on return. Active
stale content refreshes first. Unrelated and Admin query expiration retain existing behavior.

Connectivity subscriptions never overwrite observations. Startup, pageshow, visibility restoration
and network events share one state source. A same-origin cache-bypassed probe times out at three
seconds with at most one immediate retry. Distinguish explicit offline, unavailable connection,
checking recovery and isolated service failure; do not infer global offline from one API failure.
Show recovery only after confirmation, and recheck unavailable connections while visible.

Work rendering combines cached records and local jobs without waiting for approvals. Stable client
identity or confirmed mappings deduplicate; uncertainty retains the local item. Offline views keep
prepared content, explain unavailable content without spinning, show partial photos/details and
reserve “No work yet” for a successfully fetched empty collection. Failed refresh retains data;
reconnect must preserve edits, scroll and submission identity. New copy ships in en/es/pt.

## Revised offline preparation (accepted 2026-09-14)

This revision replaces the preparation, retention and presentation parts of the 2026-09-12 policy;
submission, drafts and connectivity rules above are unchanged. The reasons are in
[the online regression report](reports/2026-09-14-online-regression.md).

Background preparation fills the queries the screens read: garden work lists, work approvals and
work details. There is no separate prepared copy and no download manifest. Every joined garden keeps
its lists, approvals and details; photos are kept for the garden in view, the account's own work and
the account's avatar. Content is keyed by chain, garden and URL, never by account, so another account
on the same phone reuses it.

Preparation never competes with the screen. It starts a few seconds after launch, on reconnect, when
a stale app becomes visible, when garden membership changes, and a few seconds after a garden opens.
Each task waits until no query or mutation is running and the browser is idle. The garden in view
moves to the front of the queue mid-run. Photos download one at a time on cellular and two otherwise,
pause under Data Saver unless the person resumes, and never bypass the HTTP cache. Lists already
fetched within 15 minutes are reused. The reading cache is written at most every five seconds during
a run and once at its end; the query persister writes only the newest snapshot, at most once a second,
and flushes when the page hides.

The service worker owns `ipfs-cache` for gateway media. It answers from the cache, then from photos
the previous worker prepared, then from the network with a CORS request, and stores a sized copy
without `Vary` after answering. It trims unprotected copies oldest-first above 150 MiB when asked and
after every 25 stores. Range requests and non-gateway images keep their existing paths.

A restored snapshot keeps the offline read model (gardens, actions, gardeners, profiles, ENS and the
work reads) whatever its age. Garden segments in work query keys are lowercase, and restore maps
older checksummed keys onto them.

Settings is the only place offline preparation is shown. The row title is one line ("Offline",
"Sin conexión"); the status is two truncated lines: Downloading with megabytes and percentage, Paused
with progress or No connection, Photos paused with Data Saver on, Ready with megabytes saved, or
Incomplete with photos missing or Storage full. The control is Pause, Resume, Refresh or Retry. The
garden list shows one line only when offline ("Offline · Saved 4:05 PM", "Not saved yet · Connect to
load it") or when a refresh failed ("Couldn’t refresh · Saved 4:05 PM"), renders the newest 50 cards,
and offers "Show older work" for the rest. Images request one gateway at a time, move on after a
failure or a six-second stall while visible, and retry on reconnect after an offline failure.
