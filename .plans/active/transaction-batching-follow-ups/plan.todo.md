# Transaction batching follow-ups

**Linear Issue:** PRD-1399 · **Status:** CLOSED — enabled passkey routes proven and fixes shipped · **Created:** 2026-11-07 · **Last Updated:** 2026-11-07

- [x] Consolidate capability reads and journal plain-wallet action edits.
- [x] Preserve group refusal text and fix Hub loaded-list, overlap, and transient status regressions where still reproducible.
- [x] Implement Octant atomic checkout and focused automated proof without enabling an unproven rail.
- [x] Refresh Add and Send automated proof and prepare live acceptance walkthrough.
- [x] Reconcile remaining rail, gas, keyboard, QA-case, and copy decisions against current evidence.
- [x] Run selected checks and inspect combined diff; keep live proof and publication pending. Checkpoint: 22 passes, two separate documentation failures, advisory authenticated proof pending; see continuation.
- [x] Restore locked dependencies after explicit approval and rerun docs checks. All 142 docs tests pass; only the unrelated API-index digest remains stale in the authority check.

Shared owns mutation rules and hooks; Admin owns Hub presentation; Client owns checkout presentation. Existing transaction service and journal remain authoritative. No contract edits or dependency changes.

## Closeout (2026-11-07)

Closed as `closed`. The maintainer accepted one recorded live beta proof for each enabled passkey route. PRD-1054 and PRD-1399 are Done. Some lanes still carry working-copy evidence and the additional proofs were deferred, so the hub does not claim full lane certification.

- [PR #1524](https://github.com/greenpill-dev-guild/green-goods/pull/1524) shipped and verified Add and Send on the regular Kernel 0.3.3 passkey on Arbitrum.
- [PR #1526](https://github.com/greenpill-dev-guild/green-goods/pull/1526) corrected the signature-count copy and removed the legacy Add and Send batch entry. Verified on beta at `d81a641141b4`.
- [PR #1528](https://github.com/greenpill-dev-guild/green-goods/pull/1528) shipped shared capability reads, plain-wallet action edit recovery, and the Hub fixes. Both beta apps served `da5e8889a231`. The acceptance matrix preserves the automated, Storybook Chromium, and authenticated Brave evidence.

The closed [PRD-1399 record](https://linear.app/green-goods/issue/PRD-1399/finish-the-remaining-transaction-batching-proofs-and-follow-ups) and [acceptance matrix](eval.md) preserve these dispositions.

- **Deferred passkey cases.** First pool setup and seeded-season opening need a suitable garden. The five-decision review needs confirmation of the hosted bundler limit or acceptance of the actual estimate before a live run. Edit Pool and two- and three-decision reviews already passed live.
- **Skipped connected-wallet checks.** The maintainer excluded capability and action edit replay, atomic and sequential wallet proofs, larger wallet groups, and wallet keyboard and timing checks. The shipped fixes retain their automated evidence.
- **Deferred expansions.** Octant and WETH deposits, the Kernel 0.3.3 pilot, and the four unlisted routes remain future listing work. Those four are atomic action edit, campaign jar sync, marketplace approvals, and Karma reconcile. The Octant handoff preserves its local implementation evidence.
- **Separate follow-ups.** PRD-1399 records the remaining copy refinements and the ADM-199 assertion about rewards on already-taken promises. The live passkey reward edit proof covers the edits to available promises.
