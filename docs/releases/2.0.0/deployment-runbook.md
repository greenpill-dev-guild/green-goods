# Green Goods 2.0.0 deployment runbook

Originally prepared for October 11, 2026; refreshed October 14. Owner: Afo. The production merge, app deployment, signed tag, GitHub Release and back-merge are complete; the [release pack](README.md) records them. The announcement remains pending. This runbook does not authorize onchain broadcasts.

Afo confirmed that he will handle rollback for this cut. The user authorized merging #1057
after the applicable gates pass; manual indexer deployment and environment updates remain
operator-guided steps. Follow [indexer-cut-guide.md](indexer-cut-guide.md) after that merge.

October 13 closeout: Afo reports today's latest-beta passkey, request and installed-PWA
acceptance passed on Android mobile and Brave desktop. Keep this as owner-reported evidence,
with the private build binding and observations; do not relabel it as agent-observed signing.
The consistent SQLite backup was restored into a separate encrypted volume on a temporary
machine with no services. Its checksum matched, integrity was OK, schema v8 and per-kind
pending-request uniqueness were preserved. Test resources were removed and the backup/snapshot
retained privately. A live failover and reconciliation of writes made after that backup are
not claimed.

## App-only scope and remaining gates

Afo approved deferring unverified settlement features on October 13. Retain Garden promises,
Work/review, steward navigation, Profile/access requests, passkeys and installed-app recovery,
subject to actual candidate acceptance. Block app settlement writes, configuration and new G$
reward promises before promotion. Existing settlement history may remain readable. Removing an
announcement claim alone is not containment, and this decision does not pause live contracts.

The containment patch, #1095 preparation and #1057 release are merged. #1096 is merged at
`377aba5e1590f47290d51095e2d18b363d130f49`; all main workflows pass, Client/Admin/Docs
are READY at that commit and both source-map uploads pass. Both production app environments
use the verified `de3e5df` indexer and were rebuilt. The closeout #1098 then merged at the
tagged commit `1b138dfba804d9db019a96d05675bbaa1a4162bc`. See [the observed rollout](README.md).

The remaining gates closed in this order on October 14; only the announcement is still open:

1. Done: #1098 integrated the eight-reference indexer alignment and reconciled the release
   record. The uncached release gate passed 27 selected checks fresh; the local qualified PWA
   preview could not launch, and the owner accepted the passing qualified PWA test in
   current-head CI in its place.
2. Done: the hosted indexer source/deployment receipt is bound to released main `d96e941`, and
   a read-only authenticated Brave check rendered the included Garden, pooling season and Work
   reads in production. The owner's October 13 Android/Brave acceptance and the restoration
   receipt are retained, not repeated. The observed default-Arbitrum Work/review schemas and
   resolver bindings match the app configuration, and sampled records decode. Retain existing
   authority for this app cut; Celo review activation and settlement ceremonies are outside
   that read proof.
3. Done: CI, the production deployments and both source-map uploads passed at `1b138dfba`,
   and the signed `v2.0.0` tag and its tag-triggered GitHub Release are published.
4. Done: the curated notes are on the Release, and #1099 back-merged final main into develop
   through the temporary head branch `chore/backmerge-main-2026-10-14`.
5. Open: check publishing links and cleared media, then announce at the owner's selected time.
   The demo, Spanish localization and new preview artwork can follow separately.

October 13 preparation evidence: the local scope patch passed the 13 selected critical QA checks
fresh, and Admin CI Playwright passed 12 cases with one skipped. This is local/clean-room proof,
not authenticated acceptance or current-head CI for the final release. Earlier Agent source
inspection matched `56dfefd` inputs; the later observed v426 runtime retains SQLite v8 and the
per-kind pending-request index. Its feature endpoint advertises both request kinds; no new runtime
source SHA is asserted here. The existing `e6edffd`
indexer serves pooling records and was current within the RPC sampling interval; final selection
and included Work/claim reads were post-merge PRD-1122 gates, and PRD-1122 closed on October 14.
The owner reports signed request
and installed-PWA acceptance complete. The [database-copy restoration](operations-receipt.md)
also passed. Live failover and reconciliation of writes made after the backup remain untested;
they are required safety steps if rollback becomes necessary, not a request to repeat this rehearsal.

## Freeze and preflight

1. Record the release PR URL, candidate SHA, comparison bases, and passing current-head CI. Do not merge a moved head using an older receipt. Review the accepted develop range, including integrated recovery fixes and dependency changes; keep unrelated draft research outside the candidate. Verify the release-branch signature rules before synchronizing. A verified merge tip does not establish that every newly introduced historical commit is signed, and a squash does not resolve that question.
2. Confirm the release project's **QA complete** milestone and its child issues are closed. The tracked milestone is clear; the owner reports the passkey, request and installed-PWA acceptance complete. Bind the private receipt to the tested build and verify only the scoped candidate delta.
3. Run the uncached release gate on the final candidate. The attestation must describe real observations of that candidate, not fixtures:

   ```sh
   node scripts/ops/bump-version.mjs --check 2.0.0
   bun run check --plan -- --intent release --base origin/main
   node scripts/quality/check-immutable-plan-reports.mjs --base origin/main
   node scripts/dev/ci-local.js --intent release --base origin/main \
     --attest browser-proof="authenticated Brave, YYYY-MM-DD, actual candidate observations"
   ```

   Resolve and record the exact live `main` SHA before these commands. Promotion CI normally compares with develop; retain the full production comparison here and inspect every `selectedBy` reason and critical override. Replace the example only with a receipt that identifies the actual candidate, accepted engine/session, date and concrete observations. The owner reports acceptance complete; do not substitute invented agent observations for that private human receipt. If its binding details are unavailable, run the independent gate without an attestation and report only the formal manual receipt as pending. Start the local fork with `bun run --cwd packages/contracts dev:arbitrum-fork` when required. The mined-log check also needs a working Docker daemon. Use the existing dependency versions and repository wrappers.
4. Save the last known good Client/Admin/Docs deployment IDs, Fly image reference, volume snapshot ID, indexer URL/configuration, and contract verification receipts in the private operational record. Confirm the backup/rollback operator before changing production.
5. Check the trusted `main` source-map upload jobs separately from the PR CI Gate. The Client and Admin jobs use the PostHog uploader; confirm both uploads use the verified production build SHA.

## Contracts and indexer

The app release does not authorize contract upgrades, settlement activation, Safe permissions, or value transfers. Checked-in nonzero addresses do not prove live activation.

- Compare `packages/contracts/deployments/42161-latest.json`, `42220-latest.json`, and `packages/indexer/config.yaml` with `main`. Confirm the exact proxy implementations, schemas, indexed addresses/start blocks, owners, and pause states against live receipts.
- Use the existing [Commitment Pooling release operations handoff](../../../.plans/active/commitment-pooling/handoffs/human-release-ops.md) and [contract phase/tier rules](../../../packages/contracts/AGENTS.md#mainnet-requirements-by-activation-risk) for any remaining ceremony. Use `bun run contracts -- help` to select supported read-only verification commands. Retired broadcast orchestrators must not be replayed.
- Keep settlement/value actions unavailable in the 2.0 app. Verify the shared send boundary rejects them without signing, and reward/funding/payout/delivery controls cannot invoke them. Do not advertise a successful cross-chain payout from a dispatch or pending receipt.
- Defer new settlement activation, contributor/passkey payout canaries, phase-aware live verifier tooling and the settlement release-hash reconciliation to the existing release-ops lane. Recover existing receipts there rather than repeating the accepted Garden payout. These are not new 2.0 rollout actions; live authority/compatibility issues affecting included app flows still require a disposition.
- [PRD-1122](https://linear.app/greenpill-dev-guild/issue/PRD-1122/point-every-indexer-url-at-the-final-deployment-when-it-goes-live) owns the final indexer switch. Production Client/Admin now use `https://indexer.hyperindex.xyz/de3e5df/v1/graphql` and were rebuilt after the update. This closeout aligns the eight source/configuration references with it. Retain `e6edffd` as a rollback input and bind the hosted source/deployment receipt before closing the issue.
- After the approved main merge, deploy the final indexer from that merged source. Confirm it is fully synced, has the expected pooling schema, and reads representative Gardens, commitments, claims, and both chain records. Verify Work and review separately through the application's EAS data layer. Then set the production `VITE_ENVIO_INDEXER_URL` for Client and Admin and rebuild/promote them. Environment changes do not change an already-built app. Follow [the indexer cut guide](indexer-cut-guide.md) and record the deployment, endpoint, schema and sampled block receipts in PRD-1122 before completing the cut.
- Keep the old indexer deployment available for rollback. Record its block/lag and schema limits. Never silently serve an older schema to a UI that requires new pooling fields.

## Agent API and SQLite migration

The new request flow requires the candidate Agent API before the requester UI is enabled. It uses `kind: "steward_access"`; omitted kind remains the legacy membership request. A gardener membership does not satisfy steward approval.

1. Confirm the production Fly app is `green-goods`, the mounted volume is `agent_data` at `/data`, and `DB_PATH=/data/agent.db`. Read `fly.toml` and [the Agent deployment guide](../../../packages/agent/README.md#deployment) before execution.
2. Record the running image and machine state:

   ```sh
   flyctl releases --app green-goods --image
   flyctl machines list --app green-goods
   flyctl volumes list --app green-goods
   ```

3. The consistent backup, volume snapshot and separate-volume restoration rehearsal are complete
   for this cut; use the [observed receipt](operations-receipt.md) and private recovery record.
   Before changing the API, confirm the retained recovery inputs and their image/key pairing are
   still available. Do not repeat the production-data rehearsal by default. If a new snapshot is
   needed because the retained one expired or the recovery inputs changed, supply the verified
   volume ID:

   ```sh
   flyctl volumes snapshots create <volume-id> --app green-goods
   flyctl volumes snapshots list <volume-id>
   ```

   Do not copy only a live SQLite main file while its WAL is active. The recovery record must
   retain the matching encryption keys in the existing secret store; never print or commit them.
   The completed restoration was observed on an isolated machine, not inferred from unit tests.
   An actual rollback must still quiesce, preserve and reconcile later writes as described below.
4. Confirm `JOIN_REQUESTS_ENCRYPTION_KEY`, `JOIN_REQUESTS_PRODUCTION_READY`, the expected origin allowlist/trusted proxy settings, and the existing passkey directory configuration are available. Preserve existing keys and passkey records. Do not rotate keys during this cut.
5. The candidate initializes SQLite schema version **8** at startup. Its transactional migration changes the pending-request uniqueness index to `(gardenAddress, accountAddressKey, kind)` and preserves existing encrypted rows and revisions. Verify the migration and idempotent restart using the SQLite test scope before deployment:

   ```sh
   bun run --cwd packages/agent test --scope sqlite
   bun run --cwd packages/agent build
   ```

6. A trusted `main` push normally deploys through the existing Fly GitHub integration. Wait for that result before initiating another deployment. Use `flyctl deploy --config fly.toml` only for an intentionally selected manual path.
7. Verify one `app` machine is `started`, checks show `1 total, 1 passing`, and `/health` returns HTTP 200 with `status: "ok"`:

   ```sh
   flyctl status --config fly.toml
   flyctl checks list --app green-goods
   curl -fsS https://agent.greengoods.app/health
   bun run dev:smoke -- prod
   ```

   `/ready` includes optional voice readiness and is not the Fly health gate. Health alone does not prove request-kind compatibility. Walk a legacy membership request and a new steward request with authorized test identities, and verify distinct queues, status/withdrawal, and confirmed-role resolution. An API rejection or missing signer must leave the request pending and the address-sharing fallback usable.

## Client, Admin, and Docs

Verify the running Agent API's compatibility before approving the production merge that starts the UI builds. Merge the verified release PR into `main` in the approved cut window. Follow the owner's sequence: deploy and verify the final indexer, update production environment variables, then rebuild Client/Admin. Git integrations may start an earlier build automatically; inspect its endpoint and domain assignment and use the approved promotion/rollback procedure to retain the last verified compatible serving build until final read-back passes. Confirm Client/Admin/Docs deployment metadata points to the merged SHA and intended production configuration; a READY preview or initial pre-configuration build is not a completed production receipt.

`docs.greengoods.app` is READY at `377aba5e`. The new evaluator route responds and the legacy
steward assessment URL redirects to it. Keep the client's existing link valid while any later
link correction is reviewed. Verify these routes again if the final serving deployment changes.

Verify public routes, Garden/Work reads, the containment delta and the existing Work confirmation/retry journey on production. Retain the owner's completed passkey, request and installed-PWA receipt and check continuity on the final build. Any new signed or onchain acceptance action still needs an agreed boundary; the agent's boundary remains read-only.

Keep `AGENT_REPORTING_SITE='beta'` as recorded unless a separate approved reporting rollout changes it. The 2.0 cut does not silently promote unfinished messaging work.

## Rollback and stop conditions

- Stop on failed current-head CI, required local proof, wrong identity/chain, unsynced indexer, failed migration, broken passkey continuity, or mismatched production SHA. Preserve evidence before restarting a failed service.
- **Frontend rollback first:** restore the last verified Client/Admin deployment while retaining the compatible candidate API. Confirm old membership/sign-in flows against that API. Recheck production domain assignment after rollback before allowing subsequent automatic promotion.
- **Agent rollback:** quiesce writes first. A pre-v8 runtime does not understand steward request kinds; do not attach it blindly to a v8 database containing mixed pending requests. Restore a rehearsed pre-cut database/image pair only after preserving and reconciling all post-backup registrations, requests, and other writes. If that cannot be done safely, keep writes stopped and repair forward. Do not delete passkey records or collapse the uniqueness index to make old code start.
- **Indexer rollback:** restore the prior app environment and rebuild the compatible frontend against the retained previous deployment. Keep the new indexer for diagnosis.
- **Contracts:** use the accountable owner's separately reviewed pause/rollback ceremony and verified authority. Application rollback cannot reverse a confirmed transaction.

## Tag, release notes, and back-merge

After production verification, tag the exact merged `main` SHA, not the release-branch head:

```sh
git fetch origin main develop
git tag -s v2.0.0 <verified-merged-main-sha> -m 'October 2026'
git push origin v2.0.0
```

Verify the tag-triggered Release workflow creates **October 2026 — v2.0.0**. Add [the curated notes](release-notes.md) alongside generated PR notes. Merge `main` back into `develop` using the established procedure; never use `main` as the head of a back-merge PR because automatic branch deletion is enabled.

Record production deployment IDs, the merged SHA/tag, source-map result, indexer sync, API/migration checks, authenticated acceptance, and rollback receipts. Release is complete only after those checks; announcement follows production verification at the owner's selected time.
