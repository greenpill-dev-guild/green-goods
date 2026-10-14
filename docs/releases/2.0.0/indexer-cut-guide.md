# Final indexer and environment cut

Operator: Afo. Follow this after the verified #1057 merge into main. The final endpoint does
not exist until the selected indexer deployment is built and synced. Do not invent its URL.

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
5. **Align the checked-in fallbacks.** PRD-1122 also owns all seven source fallback locations
   and the PM2 hosted-indexer fallback. Update them through the established PR workflow,
   using the now-verified endpoint, before closing that issue. A production environment
   override alone does not complete its source acceptance criteria.
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
This guide does not claim a deployment, environment update, promotion or tag has been performed.
