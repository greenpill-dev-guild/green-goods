# Voucher indexer rollout

Prepared on 2026-10-27 UTC. **Not deployed:** the operator asked to prepare the rollout and
leave production running unchanged.

## Candidate and current production

- Candidate: `67dc82ee77572476a0a74320ccddefc88066c280` on `develop`, with Envio `3.6.1`.
- Current production: `3228823`, deployed from `codex/indexer-rollout-3228823`.
- Project: [greenpill-dev-guild / green-goods](https://envio.dev/app/greenpill-dev-guild/green-goods).
- Indexer Directory: `packages/indexer`; Config File: `config.yaml`.
- Git Release Branch currently reads `main`; automatic deployment is disabled.
- Public GraphQL endpoint: `https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql`.

The current endpoint answers HTTP 200 but rejects `VoucherServiceSetup` as an unknown field.
The candidate already contains the voucher schema, event handlers and deployed endpoint pins.
Changing application types or restarting the existing old deployment cannot add those tables.

## Release steps requiring operator approval

1. Confirm the candidate SHA is still the intended release. If `develop` has advanced, validate
   the new candidate before selecting it. Keep automatic deployment disabled for this rollout.
2. Set Git Release Branch to `develop`, then select the exact candidate in Recent Commits.
   Deploy into a separate slot. Retain `3228823` for rollback; do not restart or delete production.
   Use the existing plan; no subscription change is part of this work.
3. Check build and runtime logs. The build must use Envio `3.6.1`, `config.yaml` and the committed
   `schema.graphql`. Envio Cloud uploads only the Indexer Directory and regenerates its code;
   do not depend on root environment files, sibling packages or committed generated output.
4. Let the new deployment replay its configured chain histories. In particular, preserve
   Arbitrum start block `433713812` and Gnosis start block `48925690`; moving these forward can
   lose deployment, configuration, consent and custody events. Sepolia and Celo remain configured.
5. Against the candidate's public endpoint, run the table probe below without an admin secret.
   A successful response may contain empty arrays. GraphQL errors, missing roots, or an
   administrative-only query do not pass this check.
6. Verify both Arbitrum (`42161`) and Gnosis (`100`) progress against independent live RPC heads.
   Read `envio_chains { id progress_block source_block events_processed ready_at }` for v3.
   If the hosted service exposes legacy metadata instead, read
   `chain_metadata { chain_id latest_processed_block }`. A fresh Arbitrum row alone does not
   establish Gnosis readiness. Check again after catch-up and inspect handler errors.
7. Compare core voucher configuration, source authority and destination peer records with
   `config.yaml` and the canonical deployment record in
   [service-access-live-config.ts](../shared/src/modules/commitment-pooling/service-access-live-config.ts) and the public pilot downstream deployment records.
   Distinguish an empty booking history from missing configuration or an unfinished replay.
8. Promote only after these checks pass. Verify the public alias now exposes the same tables
   and progress. Preserve the old deployment until the app walkthrough succeeds.
9. Publish the reviewed application changes separately. Walk one authorized booking through
   consent, setup dispatch, issuer Safe approval, deposit, acknowledgment, steward acceptance,
   activation, holder-approved final split, transfers and acknowledgment. A file download is
   not approval, a successful dispatch is not arrival, and work fulfillment is separate from
   financial completion. Use the existing retry actions for delayed legs and acknowledgments.

If the candidate fails validation, leave production unchanged. After promotion, roll back by
promoting the retained `3228823` deployment and restoring the previous application release;
that restores the previous schema, so voucher functionality must be considered unavailable.
No contract upgrade or Tech and Sun Safe finalization is part of this rollout.

## Public table probe

```graphql
query VoucherRolloutTables {
  ServiceOfferRevision(limit: 1) { id }
  ServiceClaimConsent(limit: 1) { id }
  VoucherCoreConfiguration(limit: 1) { id }
  VoucherEndpointConfiguration(limit: 1) { id }
  VoucherServiceAcceptance(limit: 1) { id }
  VoucherServiceSetup(limit: 1) { id }
  VoucherServiceCustody(limit: 1) { id }
  VoucherServiceSetupResult(limit: 1) { id }
  VoucherServiceSetupAction(limit: 1) { id }
  VoucherServiceFinalAllocation(limit: 1) { id }
  VoucherServiceFinalLegResult(limit: 1) { id }
  VoucherServiceFinalResult(limit: 1) { id }
  VoucherServiceAcknowledgment(limit: 1) { id }
  VoucherIssuerAuthority(limit: 1) { id }
  VoucherReserveAsset(limit: 1) { id }
  VoucherPoolExchange(limit: 1) { id }
  EarnedVoucherTerms(limit: 1) { id }
  EarnedVoucherConsent(limit: 1) { id }
  EarnedVoucherDistribution(limit: 1) { id }
  EarnedVoucherDispatch(limit: 1) { id }
  VoucherDistributionCommand(limit: 1) { id }
  VoucherDistributionAttempt(limit: 1) { id }
  VoucherDistributionAcknowledgment(limit: 1) { id }
}
```

## Local proof

Run from the repository root:

```sh
bun run --cwd packages/indexer check:indexing-boundary
bun run --cwd packages/indexer build
bun run --cwd packages/indexer test
```

The indexer files are unchanged from the previously validated `4b6834be1` candidate.
Candidate evidence: boundary checks passed for 24 contracts across four chains; codegen and
build passed; 374 tests passed and one existing test was pending. These are local checks,
not evidence of a hosted deployment or a signed end-to-end transaction.

Cloud packaging and deployment behavior: [Envio Cloud troubleshooting](https://docs.envio.dev/docs/HyperIndex/envio-cloud-troubleshooting).
