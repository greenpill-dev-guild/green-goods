# Wave 5 — Web3 and Observability

**Checkpoint**: `7a2c66966`
**Branch**: `chore/dependency-upgrades`
**TDD**: source adaptation covered by focused fork-fixture regression tests

## Applied

- AppKit and the Wagmi adapter are exact-pinned at `1.8.22`.
- Viem is exact-pinned at `2.55.0`, Ethers at `6.17.0`, and Thirdweb at `5.120.1`.
- Sentry SDKs are aligned at `10.65.0` and the Vite plugin at `5.4.0`.
- PostHog JS is `1.399.2`, Node is `5.41.0`, and the CLI is `0.7.11`.
- Pino is exact-pinned at `10.3.1`.
- The existing Wagmi 2 and multiformats/uint8arrays compatibility strategy remains intact.
- Fork helpers now preserve deployed-code and pool-recovery behavior through focused regression tests.

## Validation

- Frozen install and the Wave 5 targeted tests/builds passed before checkpointing.
- Wallet/fork helper regressions are covered by `tests/fixtures/contract-helpers.test.ts` and the affected client fork specification.
- No public shared hook, query-key, persisted-state, ABI, schema, or deployment-artifact contract changed.

## Proof limitation

The refreshed Bun audit is not recorded as green. Bun 1.3.14 reaches the audit endpoint from the
sanitized verification mirror, but the registry returns HTTP 403. The last supplied audit snapshot
was taken before the compatible transitive remediations, so it cannot certify the checkpoint's
current residual high count. Wave 5 therefore remains checkpointed with its security refresh open.
