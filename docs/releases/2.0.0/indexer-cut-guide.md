---
audience: builder
owner: docs
status: prepared
source_of_truth:
  - packages/indexer/config.yaml
  - packages/indexer/package.json
  - env.schema
  - docs/releases/2.0.0/deployment-runbook.md
---

# Final indexer and environment cut

Operator: Afo. The #1057 merge, indexer switch and production environment updates have
occurred. The verified endpoint is `https://indexer.hyperindex.xyz/de3e5df/v1/graphql`;
both app projects were rebuilt against it. This closeout aligns all eight fallbacks.
The [hosting receipt](https://envio.dev/app/greenpill-dev-guild/green-goods/d96e941) was
observed in authenticated Brave on October 14: active at released main `d96e941`, Envio
3.6.1, Arbitrum and Celo each 100% synced. The older static production alias is unchanged;
both apps use the direct `de3e5df` endpoint. The procedure below remains the rollback-aware authority.

1. **Pin the source.** Record the merged main SHA from #1057. In the existing Green Goods
   Envio Cloud indexer, verify the repository is `greenpill-dev-guild/green-goods`, the
   deployment branch is `main`, the indexer directory is `packages/indexer` and the config
   is `config.yaml` relative to that directory. Keep the pinned Envio version and the
   checked-in chain addresses/start blocks. Confirm the actual existing settings before
   changing them. Select the exact merged commit if a deployment did not start automatically.
   [Envio deployment guide](https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment).
2. **Wait for both chains.** Inspect the deployment logs and dashboard until Arbitrum
   `42161` and Celo `42220` have completed historical sync and continue processing current
   blocks. Compare sampled indexed blocks with current RPC heads. Keep the previous
   deployment available. Record the deployment ID, source SHA and the full GraphQL URL.
   [Envio monitoring guide](https://docs.envio.dev/docs/HyperIndex/hosted-service-monitoring).
3. **Verify the schema and records.** Check representative Gardens, commitments, cycles,
   claims and contributor records, including `chainId` and the consumer-required fields.
   The indexer owns protocol events, not EAS Work attestations. Verify Work and review
   separately through the application's EAS data layer. A responding GraphQL endpoint
   or a dashboard's running badge alone is insufficient. Save the schema and block-sample
   receipts in PRD-1122.
4. **Update production configuration.** In the Greenpill Dev Guild Vercel team, open the
   Client project `green-goods` and Admin project `green-goods-admin`. Set
   `VITE_ENVIO_INDEXER_URL` to the verified final GraphQL URL in **Production** for both.
   Keep Preview/Development and unrelated secrets unchanged. Check project and team-level
   overrides. Environment changes apply only to new builds; existing deployments keep
   their old values. [Vercel environment variables](https://vercel.com/docs/environment-variables).
5. **Align the checked-in fallbacks.** PRD-1122 also owns the complete inventory below.
   Update these through the established PR workflow, using the now-verified endpoint,
   before closing the issue. A production environment override alone does not complete it.
6. **Build, verify and promote.** Rebuild Client and Admin from the verified source after
   the environment update. Check the actual bundled endpoint, app reads and settlement
   containment before promotion. Record both deployment IDs, SHAs and production domain
   assignments. An automatically started pre-configuration build is not the final receipt.
   Use the last verified compatible serving build until these checks pass.
7. **Complete the cut.** Verify the compatible Agent API, Docs routes, source-map uploads
   and continuity of the owner's completed passkey, request and installed-PWA acceptance.
   Record the backup/restore and rollback evidence. Then sign/tag the merged main SHA,
   verify the GitHub Release and curated notes, and follow the established back-merge procedure.
8. **Announce.** Check production links and cleared media, then publish the approved channel
   copy at Afo's selected time. Keep the pilot invitation and deferred settlement boundary.

If the new endpoint is unsynced, has missing fields or produces incompatible reads, stop the
switch. Retain the old indexer and frontend pairing. Do not delete an older deployment to make
space without first confirming its rollback purpose.

Operational authority and stop conditions remain in [deployment-runbook.md](deployment-runbook.md).
The observed app deployment and environment receipts are in [the release pack](README.md).
No tag, GitHub Release or community publication is claimed by this guide.

## Fallback inventory

| Source | Role |
|---|---|
| [Shared chain configuration](../../../packages/shared/src/config/blockchain.ts) | Runtime protocol-read fallback |
| [Client Vite configuration](../../../packages/client/vite.config.ts) | Client build fallback |
| [Admin Vite configuration](../../../packages/admin/vite.config.ts) | Admin build fallback |
| [IPFS repinning](../../../scripts/ops/ipfs-repin.ts) | Operational read fallback |
| [Production smoke](../../../scripts/dev/smoke-prod.js) | Smoke-check endpoint |
| [Service coordinator](../../../scripts/dev/stack.js) | Production-backed local service endpoint |
| [Doctor](../../../scripts/dev/doctor.js) | Reported production configuration endpoint |
| [PM2 configuration](../../../ecosystem.config.cjs) | Hosted-indexer fallback for external service mode |

These are seven source references and the separate PM2 reference. The doctor entry is part
of the inventory even though it reports configuration rather than making a GraphQL request.
