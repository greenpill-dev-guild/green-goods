# Acceptance

Verify stale picker references, compression fallback, all-field/audio restart, resume without duplication, ordered writes, empty removals, failed migration/quota and draft cap preservation. Interrupt media/audio/metadata upload, reload and reuse confirmed CIDs; wallet cancellation/fallback and checkpoint write failure retain work. Verify video limits and photo minima, rounded location metadata and opt-out. Verify sheets in authenticated Brave and Android process termination after Saved. No clean-commit or device claims until observed.


## Reopened review acceptance

- [ ] Confirmation: direct/queue/batch timeouts, offline retry and restart never send a known broadcast again; success completes the same identity, revert requires explicit retry, checkpoint-write failure retains the in-memory guard.
- [ ] Lifecycle: dashboard deletion, in-flight autosave, failed deletion, unrelated deletion and account changes preserve the correct composer state.
- [ ] Previews: repeat refresh/text saves, replacement, removal, cleanup, teardown and remount keep resources bounded and never return a revoked cached URL.
- [ ] Legacy recovery: mixed readable/unreadable evidence, reload, replacement, removal, cleanup failure, quota and limit failure retain stable identities and source data.
- [ ] Authenticated Brave: pending confirmation, deletion, mounted previews and partial recovery.
- [ ] Physical Android Chrome/PWA: complete the original capture, media, restart and process termination matrix.

Automated evidence may close individual code checks in the repair report; live acceptance remains open until observed. Uncommitted working-tree results are not a commit-attributed readiness receipt.
