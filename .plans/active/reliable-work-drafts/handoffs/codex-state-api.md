# Reliable work drafts: implementation handoff

Implementation is committed locally as `7bb26ff86409b3312ad4f8b70f5d8a42c07b937b` on `develop`, based on `beb933e9727962fbbc448b99d5c673c7ed64318d`. The automated evidence below was collected before that commit, so no clean-commit validation receipt or PR is claimed. The pre-existing change to `packages/agent/Dockerfile` belongs to another session and was not edited.

Picker intake copies bytes before conversion. Failed compression retains the independent original within the same attachment limits. Draft snapshots commit fields and serialized media together, keep stable attachment identities, retain unreadable legacy records until explicit removal, and preserve all existing drafts at the limit. The account/chain pointer and workflow store own the active ID. Account changes and discard invalidate pending writes.

Upload checkpoints persist confirmed file and metadata CIDs. Wallet retries retain the original submission ID and reconcile a known transaction before sending. Queue records retain attachment order and identity, omit runtime files/URLs from the payload, and update checkpoint state both in memory and in IndexedDB. Queue admission deduplicates work by clientWorkId in the transaction. Once a passkey submission is durably queued, inline execution failure remains a queue retry rather than leaving a second editable submission. Completed queue mappings are checked before another work execution.

Photo, video, audio-total and location boundaries are shared. Approximate coordinates are rounded before form/draft storage and metadata encoding; legacy precise `_location` details are omitted. Draft continuation and discard use PwaSheet. Its Escape handler now receives keys from focused child controls.

Focused tests cover byte independence, compression fallback, draft atomicity/removals/cap, pending-save cancellation, account changes, repeated recovery, upload interruption and checkpoint failure, queue identity/order, transaction reconciliation, location consent, and sheet dismissal. Fresh full Shared, Client, Admin and Agent test results, builds, typechecks and guard results are recorded in `../validation.md`. These are working-tree results, not a clean-commit validation receipt.

Production acceptance is pending physical Android Chrome/PWA proof. No early pinning, automatic unpinning, dependency installs, Solidity changes, deployment, or global dialog rewrite was introduced.

## Review repair follow-up

The four approved repairs and current working-tree evidence are recorded in [repair-validation.md](../repair-validation.md). Earlier validation claims in this handoff predate those repairs. Authenticated Brave and physical Android proof remain pending; no production approval or clean-commit receipt is claimed.
