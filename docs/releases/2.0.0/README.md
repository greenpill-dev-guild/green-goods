# Green Goods 2.0.0 release pack

Originally scheduled: release Sunday, October 11, 2026; announcement Monday, October 12.
Preparation refreshed October 13, 2026. The production cut and announcement have not occurred;
their replacement dates and times remain owner decisions. Dates use America/Los_Angeles.
Release owner and rollback operator: Afo, confirmed in the October 13 release conversation.

This pack prepares the cut. It does not record a completed production release.

## Approved app scope — October 13

Afo narrowed 2.0.0 to Garden promises, documented Work and review, the steward workspace,
Profile/access requests, passkey continuity, and installed-app recovery/update behavior.
The owner reports passkey, request and installed-PWA acceptance complete on October 13.
Record the tested build in the private release record and bind it to the final scoped candidate;
this report is owner-provided acceptance, not an agent-observed browser attestation.

G$ settlement writes, contributor delivery, settlement-account/recovery configuration, and new
G$ reward promises are deferred. The app must block those actions before promotion, even when
the contracts report active settlement. Existing settlement records may remain readable.
This decision does not pause live contracts, reverse completed payouts, or resolve contract
ownership. KarmaGAP remains an independent authority disposition where included Work flows
invoke that integration; excluding settlement alone does not remove that boundary.

Keep receipt recovery, phase-aware live verifier work, settlement/indexer release-hash binding,
KarmaGAP ownership, and dedicated production passkey/contributor payout evidence in the existing
[release operations handoff](../../../.plans/active/commitment-pooling/handoffs/human-release-ops.md).
They gate a later settlement rollout. Do not repeat the accepted Garden payout or replay the old
ownership batch. Required app indexer and contract compatibility checks remain in this cut.

## Materials

- [Deployment runbook](deployment-runbook.md): prerequisites, rollout, verification, and rollback.
- [Release notes](release-notes.md): curated copy for the GitHub Release.
- [Announcement](announcement.md): English and Spanish copy, links, and publishing checks.
- [Media brief](media-brief.md): screenshots and a short demo sequence.

The [release project](https://linear.app/greenpill-dev-guild/project/green-goods-v200-qa-and-release-021c9249a1ef) owns the tracked QA milestone. The source candidate is `release/october-2-0-0`. [CONTRIBUTING.md](../../../CONTRIBUTING.md#releases-and-hotfixes) owns the branch and tag procedure.

## Candidate acceptance

- [x] All eight release version markers match 2.0.0.
- [x] Preserve the appended messaging milestone update in a separate dated report; restore the historical report.
- [x] Merge the confirmed-revert Work retry repair in [PR #1054](https://github.com/greenpill-dev-guild/green-goods/pull/1054) (October 9).
- [x] Merge the builder and community documentation in [#795](https://github.com/greenpill-dev-guild/green-goods/pull/795) and [#896](https://github.com/greenpill-dev-guild/green-goods/pull/896). Community docs merged October 13 at `f98a3543acba084e997ebfa4f92f879cc8df3d0a`; its published-head CI and develop push checks passed.
- [x] Defer settlement procedures and the 45-second demo from this cut.
- [ ] Complete or disposition PRD-1156/PRD-727 procedures needed by the included promise/review flows.
- [x] Publish the source integration at `56dfefd76ea2ef135226d60806e8c9861caeced6`; #1057 remains draft against `main` at `946dbc71d83606fac89ee343e4cac83f442b1ac1`. Its current-head CI passed; CodeQL #142 is fixed by #1093.
- [x] Prepare the scope patch: block settlement writes and new G$ reward creation/edits, hide their app controls, and preserve queued reward jobs and submitted-job reconciliation. Local critical QA passed all 13 selected checks fresh; the Admin CI Playwright project passed 12 cases with one skipped. That browser proof is clean-room evidence.
- [ ] Publish the scope patch into develop, sync the release candidate, and obtain fresh current-head CI. The published `56dfefd76ea2ef135226d60806e8c9861caeced6` does not include these local edits.
- [ ] Complete the full main-based release gate on the final published candidate, including mined-log indexer proof and authenticated attestation. Resolve or record an accepted disposition for the historical main-range source findings; the passing scope-patch QA gate does not replace that cut gate.
- [ ] Verify contract/schema compatibility and record the KarmaGAP authority disposition for included Work flows. No ownership transfer, bridge disable or other onchain action is authorized by this app scope decision.
- [x] Serve the October 13 develop integration on beta Client and Admin: both deployment records are READY at `f98a3543acba084e997ebfa4f92f879cc8df3d0a`.
- [x] Owner reports passkey, request and installed-PWA acceptance complete on October 13. Keep the detailed observations private.
- [ ] Match beta to the final scoped candidate and verify the settlement containment delta. Bind the owner's acceptance record to the tested build; do not repeat the completed acceptance suite by default. The last observed beta build was `f98a3543acba084e997ebfa4f92f879cc8df3d0a`.
- [ ] After the approved production merge, deploy the final indexer, verify schema/sync, update production environment variables, rebuild Client/Admin and verify their production reads. This is a post-merge cut gate, not a prerequisite for the develop PR or release sync.
- [x] Verify the live Agent's compiled JavaScript and complete Shared source match the published `56dfefd76ea2ef135226d60806e8c9861caeced6` inputs. Read-only checks confirm SQLite v8, pending-request uniqueness on `(gardenAddress, accountAddressKey, kind)`, and advertised `garden_membership`/`steward_access` support. No request lifecycle or restore rehearsal is claimed.
- [x] Owner reports live request acceptance complete.
- [x] Record Afo as rollback operator and complete the October 13 backup/restore rehearsal.
  A consistent SQLite backup was restored into a separate encrypted volume and opened read-only
  on a temporary machine with no services. The restored checksum matched, integrity was OK,
  schema v8 and the per-kind pending-request index were intact. The temporary resources were
  removed; the backup and volume snapshot are retained privately. This proves restoration of
  the database copy, not a live application failover or a blind rollback of later writes.

The checked-in `e6edffd` fallback serves pooling schema and representative Garden/promise records;
the October 13 simultaneous sample was current within two blocks of the Arbitrum/Celo RPC reads.
PRD-1122 remains In Progress. The owner selected production merge first, then indexer deployment
and environment updates. Final endpoint selection, included Work/claim read-back and rebuilt
production configuration must pass before the cut is declared complete.

The release PR is [#1057](https://github.com/greenpill-dev-guild/green-goods/pull/1057), targeting
`main`. Its published head is the source integration recorded above; local scope edits are not
a new published candidate or passing CI receipt. The documentation's CI
Playwright and Storybook evidence does not complete authenticated, physical-device, owner-visual,
or unfamiliar-reader acceptance. The local closeout/archive preserves those limits.

Authenticated acceptance must cover no-access Profile/address copy/sign-out, garden selection, signed steward request, status and withdrawal, and account-change cleanup. Garden role assignment is a separate onchain write and needs a named target and explicit authorization. Record private identities and observations in the private QA store or gitignored session artifacts, never in this pack.

The owner's completed acceptance is accepted as human evidence. The agent has not independently
observed those authenticated actions and must not invent a release attestation. Preserve the
existing read-only agent QA boundary; retain the tested build, engine/session, date and concrete
observations in the private receipt before using it for the formal release gate.

## Cut and announcement

At the approved cut: merge the verified release PR into `main`, deploy the final indexer, verify
its schema and sync, update production environment variables, rebuild/promote Client and Admin,
and verify production domains, API compatibility and source maps. Then sign and tag the merged
`main` commit, verify the GitHub Release, add the curated notes, and merge `main` back into `develop`.

After production verification: Afo publishes the approved [Telegram/WhatsApp, public-social and
X-thread copy](announcement.md), with em dashes removed. The Spanish community translation
needs localization review. Confirm production links, the posting time and cleared screenshots
before sending. [MAR-42](https://linear.app/greenpill-dev-guild/issue/MAR-42/publish-the-green-goods-20-pilot-announcement)
owns publication, [MAR-43](https://linear.app/greenpill-dev-guild/issue/MAR-43/clear-screenshots-for-the-green-goods-20-announcement)
owns screenshot clearance and [MAR-44](https://linear.app/greenpill-dev-guild/issue/MAR-44/prepare-pilot-focused-social-preview-assets-for-green-goods)
owns preview artwork and copy. The demo is optional follow-up material.

Use [the indexer cut guide](indexer-cut-guide.md) for the post-main deployment and environment
sequence, and [social preview readiness](social-preview-readiness.md) before sharing automatic
link cards. Naming the rollback operator does not establish a completed backup/restore rehearsal.
