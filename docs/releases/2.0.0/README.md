# Green Goods 2.0.0 release pack

Originally scheduled: release Sunday, October 11, 2026; announcement Monday, October 12.
Released October 14, 2026. Production serves main `1b138dfba804d9db019a96d05675bbaa1a4162bc`,
the signed `v2.0.0` tag and its [GitHub Release](https://github.com/greenpill-dev-guild/green-goods/releases/tag/v2.0.0)
are published, and develop carries the production tree. The announcement is still pending.
Dates use America/Los_Angeles.
Release owner and rollback operator: Afo, confirmed in the October 13 release conversation.

This pack records observed rollout evidence and the limits of that evidence.

## Observed production rollout

The owner merged #1057 at `d96e94143934a1db2655f3d2e9ba45837be41c46`, then
[#1096](https://github.com/greenpill-dev-guild/green-goods/pull/1096) at
`377aba5e1590f47290d51095e2d18b363d130f49`. All eleven main workflows succeeded at
the latter commit, including both trusted-main source-map uploads.

Production deployments, checked with `vercel inspect` on October 14. The serving ones come from
the closeout at the tagged commit `1b138dfba` (below); the `377aba5e` ones are the prior
production deployments.

| Surface | Serving deployment at `1b138dfba` | Prior production deployment at `377aba5e` |
|---|---|---|
| Client | [GYnja7YfLJkLVzwjDKC9yrChCmbC](https://vercel.com/greenpilldevguild/green-goods/GYnja7YfLJkLVzwjDKC9yrChCmbC): READY, `greengoods.app` and `www.greengoods.app` | [DrfkyGdbhhtumXpgdjWcLgrqhcpD](https://vercel.com/greenpilldevguild/green-goods/DrfkyGdbhhtumXpgdjWcLgrqhcpD) |
| Admin | [Ac4jrxrv7jXvHCV9J8JhNbz4WGdX](https://vercel.com/greenpilldevguild/green-goods-admin/Ac4jrxrv7jXvHCV9J8JhNbz4WGdX): READY, `admin.greengoods.app` | [4aXkCBjFjTVs7Qp1CroeLgRbqoTA](https://vercel.com/greenpilldevguild/green-goods-admin/4aXkCBjFjTVs7Qp1CroeLgRbqoTA) |
| Docs | [GzMnwj789BH53sRSJJWVxbkCaTMP](https://vercel.com/greenpilldevguild/green-goods-docs/GzMnwj789BH53sRSJJWVxbkCaTMP): READY, `docs.greengoods.app` | [FYK1wwUY5eBECPhA5y5Dxx7pXt45](https://vercel.com/greenpilldevguild/green-goods-docs/FYK1wwUY5eBECPhA5y5Dxx7pXt45) |

Both production app projects now use `https://indexer.hyperindex.xyz/de3e5df/v1/graphql`
and were rebuilt after the environment update. The endpoint exposes the required pooling
schema, representative records and Arbitrum/Celo sync metadata without GraphQL errors.
The [Envio deployment receipt](https://envio.dev/app/greenpill-dev-guild/green-goods/d96e941)
was observed in authenticated Brave on October 14: active at released main `d96e941`,
Envio 3.6.1, with both production chains at 100% sync. Apps use this direct deployment
endpoint; the older static production alias was not promoted or changed by this check.
The Agent v427 supports legacy membership and steward-access requests and accepts both app
origins. Five compiled request/schema modules match the candidate artifacts; read-only SQLite
metadata confirms schema v8 and distinct per-kind pending-request uniqueness. This is bounded
module proof, not an exact whole-image source SHA attestation.
The production Docs evaluator route and legacy assessment redirect respond successfully.
App and Docs observations are deployment/HTTP checks; their rendered browser proof is **none**.
The separate Envio source receipt uses authenticated Brave and does not attest app acceptance.

The closeout [#1098](https://github.com/greenpill-dev-guild/green-goods/pull/1098) merged at
the tagged commit `1b138dfba804d9db019a96d05675bbaa1a4162bc`. Every main workflow that ran there
passed, including the trusted-main [Client](https://github.com/greenpill-dev-guild/green-goods/actions/runs/38620548598/job/116047516958)
and [Admin](https://github.com/greenpill-dev-guild/green-goods/actions/runs/38620548487/job/116047434762)
source-map uploads. The serving deployments in the table above come from that commit, and the
production bundles carry `green-goods-client@1b138dfba804` and
`green-goods-admin@1b138dfba804`; these are deployment/HTTP checks. A read-only authenticated
Brave check on October 14 rendered the production Client landing page, a public Garden with an
active pooling season and an approved Work detail, and the Admin Hub. Nothing was signed and no
private identities were recorded. No production error canary was run.

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

The [release project](https://linear.app/greenpill-dev-guild/project/green-goods-v200-qa-and-release-021c9249a1ef) owns the tracked QA milestone. The original release branch was deleted after merge. Tag the final verified main commit, not the old release head. [CONTRIBUTING.md](../../../CONTRIBUTING.md#releases-and-hotfixes) owns the branch and tag procedure.

## Candidate acceptance

- [x] All eight release version markers match 2.0.0.
- [x] Preserve the appended messaging milestone update in a separate dated report; restore the historical report.
- [x] Merge the confirmed-revert Work retry repair in [PR #1054](https://github.com/greenpill-dev-guild/green-goods/pull/1054) (October 9).
- [x] Merge the builder and community documentation in [#795](https://github.com/greenpill-dev-guild/green-goods/pull/795) and [#896](https://github.com/greenpill-dev-guild/green-goods/pull/896). Community docs merged October 13 at `f98a3543acba084e997ebfa4f92f879cc8df3d0a`; its published-head CI and develop push checks passed.
- [x] Defer settlement procedures and the 45-second demo from this cut.
- [x] Disposition PRD-1156/PRD-727 for this cut: included app guidance is deployed. Both issues remain open for broader documentation, settlement/recovery procedures and follow-up videos; this app cut does not claim those issues complete.
- [x] Merge #1057 into main at `d96e94143934a1db2655f3d2e9ba45837be41c46`. CodeQL #142 is fixed by #1093. The earlier `56dfefd` and `c7d67eab` preparation heads are superseded.
- [x] Prepare the scope patch: block settlement writes and new G$ reward creation/edits, hide their app controls, and preserve queued reward jobs and submitted-job reconciliation. Local critical QA passed all 13 selected checks fresh; the Admin CI Playwright project passed 12 cases with one skipped. That browser proof is clean-room evidence.
- [x] Merge the scope patch through #1094 into develop at `1de48f900352498c802f0debeeb3ed23b89db2ff`, sync release to `c7d67eab891058fea10d423fa1a2928969e0bebd`, and obtain current-head CI.
- [x] Merge #1095 into develop at `7a2ec010e1673f4b3f5b36e021649b83488f6631`, sync release to `b34dad5c` and integrate its copy, public API proof and restoration receipt through #1057.
- [x] Merge #1096's source/guidance validation repair and obtain green main CI at `377aba5e`.
- [x] Run the uncached release gate on the final candidate. [#1098](https://github.com/greenpill-dev-guild/green-goods/pull/1098) records the run: 27 selected checks passed fresh, with no receipt reuse, at `077a951f58ab44536c756fe64763ea104306a365`, whose tree matches production main. The local qualified PWA preview could not launch, so the full local command has not passed. Afo accepted the unchanged qualified PWA test passing in [current-head CI](https://github.com/greenpill-dev-guild/green-goods/actions/runs/38618962276/job/116041209424) as the only exception for this cut. Owner acceptance keeps its provenance; no agent-observed signing is claimed.
- [x] Verify included Work/review read compatibility on production's default Arbitrum chain:
  both EAS schema strings and resolver bindings match the app configuration, and three Work
  plus three review records decode with the expected fields. Retain existing contract and
  KarmaGAP authority for the app cut; no upgrade, transfer, bridge disable or activation is
  authorized. Celo review activation and settlement ceremonies remain outside this proof.
- [x] Serve the scoped develop integration on beta Client and Admin: both deployment records are READY at `1de48f900352498c802f0debeeb3ed23b89db2ff`, rechecked October 14.
- [x] Owner reports passkey, request and installed-PWA acceptance complete on October 13. Keep the detailed observations private.
- [x] Retain the owner's Android/Brave acceptance dated October 13 on beta `1de48f900`.
  Auth, queue, Work-provider and contract inputs are unchanged through observed main
  `377aba5e`; the containment scope is merged and CI-tested. No new signed acceptance or
  agent-observed installed-PWA proof is claimed by this source comparison.
- [x] After the production merge, verify the final indexer schema/sync, update both production app environments and rebuild Client/Admin. Preserve the previous indexer for rollback.
- [x] Bind the hosted indexer source/deployment receipt to released main `d96e941` and confirm both production chains are synced in the authenticated Brave Envio dashboard.
- [x] Integrate the eight-reference indexer alignment through [#1098](https://github.com/greenpill-dev-guild/green-goods/pull/1098), carried into develop by [#1099](https://github.com/greenpill-dev-guild/green-goods/pull/1099), and read back the included records. PRD-1122 closed on October 14 without a separate read-back comment, so the read-back below is the receipt.
- [x] Verify live Agent request compatibility. The v427 feature endpoint advertises both request kinds, five compiled request/schema modules match the candidate artifacts, and live read-only metadata confirms SQLite v8 plus pending uniqueness on `(gardenAddress, accountAddressKey, kind)`. Retain the owner's acceptance and separate restoration receipt for lifecycle/recovery proof; no whole-image source SHA or new signed action is claimed.
- [x] Owner reports live request acceptance complete.
- [x] Record Afo as rollback operator and complete the October 13 backup/restore rehearsal.
  A consistent SQLite backup was restored into a separate encrypted volume and opened read-only
  on a temporary machine with no services. The restored checksum matched, integrity was OK,
  schema v8 and the per-kind pending-request index were intact. The [operational receipt](operations-receipt.md)
  records the observed checks and their limits. The temporary resources were
  removed; the backup and volume snapshot are retained privately. This proves restoration of
  the database copy, not a live application failover or a blind rollback of later writes.

The final endpoint is `de3e5df`, bound in Envio to released main `d96e941`. #1098 aligned
all eight checked-in references with the verified production configuration. The previous
`e6edffd` deployment remains a rollback input, not the final fallback. PRD-1122 is Done;
the broader Work read-back uses EAS rather than the protocol indexer.

Read-back, October 14 at 23:21 UTC, against `https://indexer.hyperindex.xyz/de3e5df/v1/graphql`
with the app's field lists for pools, cycles, commitments and claim requests: no GraphQL errors
and no missing fields. It
returned 18 Gardens, 18 commitment pools, 3 cycles, 42 commitments, 7 claim requests (5 accepted,
2 declined) and 9 active contributor records, all on Arbitrum `42161`. Arbitrum's latest
processed block was 4 behind its public RPC head, and Celo `42220` was level with its head.
Only counts were recorded, no addresses.

The release PR [#1057](https://github.com/greenpill-dev-guild/green-goods/pull/1057) and
preparation follow-up #1095 are merged. The documentation's CI
Playwright and Storybook evidence does not complete authenticated, physical-device, owner-visual,
or unfamiliar-reader acceptance. The local closeout/archive preserves those limits.

Authenticated acceptance must cover no-access Profile/address copy/sign-out, garden selection, signed steward request, status and withdrawal, and account-change cleanup. Garden role assignment is a separate onchain write and needs a named target and explicit authorization. Record private identities and observations in the private QA store or gitignored session artifacts, never in this pack.

The owner's completed acceptance is accepted as human evidence. The agent has not independently
observed those authenticated actions and must not invent a release attestation. Preserve the
existing read-only agent QA boundary; retain the tested build, engine/session, date and concrete
observations in the private receipt before using it for the formal release gate.

## Cut and announcement

- [x] Sign and push `v2.0.0` at the verified final main SHA, then verify the tag-triggered
  GitHub Release and add the curated notes. The annotated tag object
  `532e6553d990a8971f8ed14ae5f01a77fbf84c24` points to `1b138dfba804d9db019a96d05675bbaa1a4162bc`,
  and GitHub reports its signature as valid. The [Release workflow](https://github.com/greenpill-dev-guild/green-goods/actions/runs/38647023237)
  published the [GitHub Release](https://github.com/greenpill-dev-guild/green-goods/releases/tag/v2.0.0)
  as Latest, not a draft or prerelease, with the [curated notes](release-notes.md) above the
  generated PR notes and contributor credits.
- [x] Back-merge final main into develop using a temporary head branch, never main itself.
  [#1099](https://github.com/greenpill-dev-guild/green-goods/pull/1099) merged
  `chore/backmerge-main-2026-10-14` at `6572b87357a839e4722ec455aedca26ecdb7abeb`, which keeps
  production main as a parent and has the identical tree.
- [ ] Check publishing links and cleared media, then announce at Afo's selected time.

At the cut, the verified release PR merged into `main`, the final indexer was deployed and
verified, both production app environments were updated, and Client and Admin were rebuilt.
The merged `main` commit was then signed and tagged, the GitHub Release received the curated
notes, and `main` merged back into `develop`. The checklists above hold the receipts; do not
repeat these steps for 2.0.0.

After production verification: Afo publishes the approved [Telegram/WhatsApp, public-social and
X-thread copy](announcement.md), with em dashes removed. The Spanish community translation
needs localization review. Confirm production links, the posting time and cleared screenshots
before sending. [MAR-42](https://linear.app/greenpill-dev-guild/issue/MAR-42/publish-the-green-goods-20-pilot-announcement)
owns publication, [MAR-43](https://linear.app/greenpill-dev-guild/issue/MAR-43/clear-screenshots-for-the-green-goods-20-announcement)
owns screenshot clearance and [MAR-44](https://linear.app/greenpill-dev-guild/issue/MAR-44/prepare-pilot-focused-social-preview-assets-for-green-goods)
owns preview artwork and copy. The demo is optional follow-up material.

[The indexer cut guide](indexer-cut-guide.md) describes the post-main deployment and environment
sequence this cut followed. Check [social preview readiness](social-preview-readiness.md) before
sharing automatic link cards. Naming the rollback operator does not establish a completed
backup/restore rehearsal.
