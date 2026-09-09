# Accepted behavior

Copy picker bytes before processing; persist serialized attachments with stable IDs and hashes. One account/chain-scoped active draft owns all fields, audio, tags, approximate location, revision and submission identity. Atomic serialized saves, immediate attachments/selections, 500 ms text debounce, explicit failure state and protected exits. Preserve 20 drafts and require explicit deletion at the cap. Migrate readable legacy data only with explicit recovery for the unscoped image key.

Upload at submit with durable per-file and metadata CIDs, reuse across wallet/queue/reload, retain transaction reconciliation. Videos: MP4/WebM, 30 seconds, 20 MiB each; photos 10 MiB, 10 visual attachments; all attachments 50 MiB. Location opt-in rounded to 3 decimals before persistence; clear on opt-out, publish via metadata. Draft and flow confirmation sheets use PwaSheet.


## Review repair decisions

A known broadcast is reconciled before another send in direct submission, ordinary queue execution and batch sync. Missing receipts, offline state and timeouts remain unresolved. The app automatically checks them while running and after reopening. Confirmed failure requires the member to press Retry; reusable media CIDs survive both outcomes. Broadcast callbacks are optional and awaited, and a failed checkpoint write retains the hash in memory. Batch hash writes are atomic and batch/ordinary processing share a job claim.

Dashboard deletion, Intro discard and submission retirement use the same serialized draft lifecycle. Deletion invalidates pending generations before its transaction, resets the live composer and form only after commit, and checks scope/generation before asynchronous completion. Unrelated drafts do not reset the active composer.

Draft lists return summaries. Mounted thumbnail, Media, Review and queue consumers own preview URLs; byte reads do not allocate URLs. Stable attachment ID/hash pairs reuse previews within an owner, and cleanup releases caches and file references.

Legacy recovery copies each entry independently and records named, ordered missing attachments. A durable marker maps original entries to the recovered draft, so reloads cannot re-import removed entries or overwrite replacements. Reselect retains identity/order and Remove explicitly resolves the missing entry. Original legacy data remains until every entry is resolved or recovery is explicitly discarded. The existing draft and storage caps never evict another draft.
