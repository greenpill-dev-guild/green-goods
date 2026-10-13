# Green Goods 2.0.0 release pack

Originally scheduled: release Sunday, October 11, 2026; announcement Monday, October 12.
Preparation refreshed October 13, 2026. The production cut and announcement have not occurred;
their replacement dates and times remain owner decisions. Dates use America/Los_Angeles.
Release owner: Afo.

This pack prepares the cut. It does not record a completed production release.

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
- [ ] Complete or explicitly disposition the separate release-essential pooling guides owned by PRD-1156; the merged community foundation supplies overview orientation.
- [ ] Publish the final candidate and record its exact SHA and required CI.
- [ ] Complete the fresh local critical gate, including mined-log indexer proof.
- [x] Serve the October 13 develop integration on beta Client and Admin: both deployment records are READY at `f98a3543acba084e997ebfa4f92f879cc8df3d0a`.
- [ ] Match beta to the final candidate and complete real passkey/no-access acceptance and installed-PWA update with queued work preserved.
- [ ] Confirm the production indexer cutover and deployment receipts in the runbook.
- [ ] Record API request-kind/migration/recovery acceptance, a consistent backup and restore rehearsal, and the rollback operator.

The release PR is [#1057](https://github.com/greenpill-dev-guild/green-goods/pull/1057), targeting
`main`. Its October 13 read still points to `d24601313ffb6d56825383fbc98627258358066b`;
passing CI on that older head does not certify the new integration. The documentation's CI
Playwright and Storybook evidence does not complete authenticated, physical-device, owner-visual,
or unfamiliar-reader acceptance. The local closeout/archive preserves those limits.

Authenticated acceptance must cover no-access Profile/address copy/sign-out, garden selection, signed steward request, status and withdrawal, and account-change cleanup. Garden role assignment is a separate onchain write and needs a named target and explicit authorization. Record private identities and observations in the private QA store or gitignored session artifacts, never in this pack.

## Cut and announcement

At the approved cut: merge the verified release PR into `main`, verify production and source maps, sign and tag the merged `main` commit, verify the GitHub Release, add the curated notes, and merge `main` back into `develop`.

After production verification: Afo publishes the announcement after confirming the production links and cleared media. English and Spanish draft copy is prepared; publishing channels, replacement posting time, cleared media and the short demo still need their final selection.
