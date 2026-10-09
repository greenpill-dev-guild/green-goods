# Green Goods 2.0.0 deployment runbook

Prepared for October 11, 2026. Owner: Afo. This is an operator checklist, not broadcast authorization or a record of live deployment.

## Freeze and preflight

1. Record the release PR URL, candidate SHA, comparison bases, and passing current-head CI. Do not merge a moved head using an older receipt. Keep draft research, deferred recovery, and dependency upgrades outside the candidate unless explicitly selected.
2. Confirm the release project's **QA complete** milestone and its child issues are closed. The tracked milestone is clear; the newly added steward flow still needs candidate-specific authenticated acceptance.
3. Run the uncached release gate on the final candidate. The attestation must describe real observations of that candidate, not fixtures:

   ```sh
   node scripts/ops/bump-version.mjs --check 2.0.0
   node scripts/quality/check-immutable-plan-reports.mjs --base origin/develop
   node scripts/dev/ci-local.js --intent release --base origin/develop \
     --attest browser-proof="authenticated Brave, YYYY-MM-DD, actual candidate observations"
   ```

   Replace the example date and observations before execution. Start the local fork with `bun run --cwd packages/contracts dev:arbitrum-fork` when required. The mined-log check also needs a working Docker daemon. Use the existing dependency versions and repository wrappers.
4. Save the last known good Client/Admin/Docs deployment IDs, Fly image reference, volume snapshot ID, indexer URL/configuration, and contract verification receipts in the private operational record. Confirm the backup/rollback operator before changing production.
5. Check the trusted `main` source-map upload jobs separately from the PR CI Gate. Confirm Sentry's release SHA matches the production build.

## Contracts and indexer

The app release does not authorize contract upgrades, settlement activation, Safe permissions, or value transfers. Checked-in nonzero addresses do not prove live activation.

- Compare `packages/contracts/deployments/42161-latest.json`, `42220-latest.json`, and `packages/indexer/config.yaml` with `main`. Confirm the exact proxy implementations, schemas, indexed addresses/start blocks, owners, and pause states against live receipts.
- Use the existing [Commitment Pooling release operations handoff](../../../.plans/active/commitment-pooling/handoffs/human-release-ops.md) and [contract phase/tier rules](../../../packages/contracts/AGENTS.md#mainnet-requirements-by-activation-risk) for any remaining ceremony. Use `bun run contracts -- help` to select supported read-only verification commands. Retired broadcast orchestrators must not be replayed.
- Keep settlement/value capabilities unavailable until their independent owner, authority, canary, and acknowledgement gates pass. Do not advertise a successful cross-chain payout from a dispatch or pending receipt.
- [PRD-1122](https://linear.app/greenpill-dev-guild/issue/PRD-1122/point-every-indexer-url-at-the-final-deployment-when-it-goes-live) owns the final indexer switch. At preparation time the app fallback is `e6edffd`; three dev/smoke fallbacks still use `0bf0e0f`. Neither is asserted here as the final deployment.
- Confirm the final indexer is fully synced, has the expected pooling schema, and reads representative Gardens, Work, commitments, claims, and both chain records. Set the production `VITE_ENVIO_INDEXER_URL` for Client and Admin, update every remaining fallback required by PRD-1122, then rebuild. Environment changes do not change an already-built app.
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

3. Take a fresh volume snapshot, retain a consistent SQLite backup, and rehearse restoration into a separate volume before the cut. Supply the verified volume ID:

   ```sh
   flyctl volumes snapshots create <volume-id> --app green-goods
   flyctl volumes snapshots list <volume-id>
   ```

   Do not copy only a live SQLite main file while its WAL is active. The recovery record must include the matching encryption keys in the existing secret store; never print or commit them. Production restore rehearsal is still an operator gate, not claimed complete by unit tests.
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

Merge the verified release PR into `main` on Sunday. The Git integrations deploy the production builds. Confirm Client/Admin/Docs deployment metadata points to that merged SHA and the intended production environment; a READY preview is not a production receipt.

Check public routes, Garden reads, passkey sign-in/recovery, no-access Profile/address copy/sign-out, steward request/status/withdrawal, and the existing Work confirmation/retry journey. Walk an installed-device update with queued work preserved. Use two real identities for any independent approval. Stop before onchain sends that are outside the agreed test boundary.

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
git tag -a v2.0.0 <verified-merged-main-sha> -m 'October 2026'
git push origin v2.0.0
```

Verify the tag-triggered Release workflow creates **October 2026 — v2.0.0**. Add [the curated notes](release-notes.md) alongside generated PR notes. Merge `main` back into `develop` using the established procedure; never use `main` as the head of a back-merge PR because automatic branch deletion is enabled.

Record production deployment IDs, the merged SHA/tag, source-map result, indexer sync, API/migration checks, authenticated acceptance, and rollback receipts. Release is complete only after those checks; announcement waits until Monday.
