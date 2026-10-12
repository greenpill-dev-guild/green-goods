# Green Goods 2.0.0 release pack

Release: Sunday, October 11, 2026. Announcement: Monday, October 12, 2026.
Release owner: Afo. Times are not yet set; dates use America/Los_Angeles.

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
- [ ] Resolve the confirmed reverted-confirmation finding on PR #1054 and merge it after current-head CI passes.
- [ ] Publish the final candidate and record its exact SHA and required CI.
- [ ] Complete the fresh local critical gate, including mined-log indexer proof.
- [ ] Serve that candidate on beta and complete real passkey/no-access acceptance.
- [ ] Confirm the production indexer cutover and deployment receipts in the runbook.

Authenticated acceptance must cover no-access Profile/address copy/sign-out, garden selection, signed steward request, status and withdrawal, and account-change cleanup. Garden role assignment is a separate onchain write and needs a named target and explicit authorization. Record private identities and observations in the private QA store or gitignored session artifacts, never in this pack.

## Cut and announcement

Sunday: merge the verified release PR into `main`, verify production and source maps, tag the merged `main` commit, verify the GitHub Release, add the curated notes, and merge `main` back into `develop`.

Monday: Afo publishes the announcement after confirming the production links and cleared media. Draft copy is ready below; publishing channels and the short demo still need their final selection.
