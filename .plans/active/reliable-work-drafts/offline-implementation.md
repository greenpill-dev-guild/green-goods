# Offline implementation and acceptance

This document records the 2026-09-12 implementation of the user-approved offline extension. It is working-tree evidence, not proof of a deployed build or a clean committed revision. The original review reports remain unchanged.

The implementation extends the existing queue, drafts, query storage and client worker. It adds no dependency or contract change. Existing shell, scrolling and passkey changes in the shared checkout are preserved. The coordinator stayed on `develop`; no commit, push, merge or deployment was performed.

## Implemented behavior

- Submission identity is admitted durably by account, chain and clientWorkId before transport selection. Immediate sends, background processing and batching share an execution claim. Compact completion records survive job/media cleanup.
- Passkey confirmation uses the UserOperation execution receipt. Missing receipts stay unresolved; proved failures retain evidence for explicit Retry. Ownership is checked across asynchronous boundaries.
- Canonical draft schema version 3 stores work and avatar drafts separately. Avatar migration copies and verifies records before conditional legacy removal; newer destinations and unresolved bytes survive failure. Blocked legacy opens cannot hide a saved canonical avatar.
- Shared connectivity subscriptions observe one lifecycle store. Resume checks use a bounded uncached origin probe; individual service errors do not prove device-wide disconnection.
- Work projection uses cached records, known approvals and account-scoped queue state independently of network completion. Queued previews are restored from local evidence, and submission identity replaces action/time guesses.
- Prepared reads and media follow the accepted 50/20/5/500 policy and 150 MiB budget. The manifest records actual local coverage, freshness, failures and eviction. Prepared content does not expire merely because seven days elapsed.
- Garden and settings surfaces distinguish missing, partial, empty, cached-refresh-failed and queued states. Originals require separate verified availability. New copy is localized in English, Spanish and Portuguese.

## Validation status

The working tree is ready for installed-device QA. This is local build evidence; a complete all-package test run and current-head CI are not claimed because the shared checkout is uncommitted and contains concurrent work.

Fresh checks passed: formatting, lint (with the repository's existing Solidity warnings), Shared source/test typechecks, Client test typecheck, source structure, generated documentation, module-seam certification, plan validation and supply-chain guards. `git diff --check` is clean.

The production Client PWA, Admin, Agent and Docs builds pass. The PWA contains 23 precache entries (0.51 MiB raw), 0.25 MiB public startup gzip, 0.92 MiB installed startup gzip and a 9.65 MiB raw / 2.67 MiB gzip offline shell, all within repository budgets. The generated Client artifact is `packages/client/dist`.

Focused offline and update coverage passes 47 tests; compatibility repairs pass 24 Shared tests, 19 Admin submission tests and 4 Client offline-garden tests. The direct critical seams pass 197 tests with 4 skips. Contract evidence passes 2,083 behavior tests, three release gas checks and 281 script tests. The broader Agent consumer run passed 320 tests with one skip. The complete Shared/Client/Admin aggregate suite was not rerun after the focused repairs.

The new offline hook/module entries are registered in Shared's module inventory. No dependency, agent-policy or contract source change was made. `packages/shared/package.json` adds explicit public exports so Client can import the offline and update-guard boundaries without pulling queue logic into the public startup bundle.

Repository Modern Web guidance, design/i18n, ontology, Storybook and documentation checks also passed during this work session.

Authenticated Brave rendered the current profile route after a fresh reload. A screenshot in this task shows the profile fallback, the preparation status, last-update context, Retry and installed-shell navigation. DOM geometry confirms the preparation status has a 32-pixel height, visible display and full opacity. The garden service failure renders a settled unavailable state with Retry. Local data services are unavailable, so this verifies partial-state presentation, not fully downloaded garden coverage, an actual offline banner or offline restart.

## Required installed-app acceptance

Record the exact build, Android version, installation wrapper/browser, active worker version and device storage state. Use both a fresh install and an upgraded install with existing work and avatar drafts.

1. Online, prepare joined gardens and a recently visited nonjoined garden. Confirm record limits, last-update labels, profile photo, display media and partial failures. Open one original explicitly and leave another unopened.
2. Enter actual airplane mode with Wi-Fi and mobile data disabled, both in the foreground and after backgrounding. Verify banner geometry within the safe area, no network spinner for missing collections, cached photos and the original-media distinction.
3. Complete every submission step offline with photo evidence. Terminate the process, relaunch offline and verify every field and attachment. Repeat with a legacy avatar draft and with storage pressure.
4. Reconnect separately with a wallet and passkey. Interrupt uploads and confirmation, switch accounts while an asynchronous operation is pending, cancel a prompt, and retry a proved failure. Verify exactly one correct Work attestation, durable identity and evidence retained until confirmation.
5. Repeat installed iOS storage, migration, process restart and safe-area checks. Keep unfinished drafts across a worker update; an active write/signing operation must defer activation.

Production readiness remains blocked until those installed Android and iOS checks and successful live reconnect flows are observed. Current-head CI is also required for release approval; local dirty-tree results cannot establish CI readiness.
