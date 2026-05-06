# ENS Operations Optimizations Evaluation

## Acceptance Criteria

- Operators can see whether the ENS sponsor balance covers the configured runway without running ad-hoc contract calls.
- A post-deploy check can verify at least one known Green Goods ENS registration path across L2 sender and L1 receiver state.
- ENS claim/release event history can be queried from an indexed read model and reconciled to receiver state.
- Users can understand whether a released username is pending release, cooling down, or eligible for a new claim.
- Status and migration commands report RPC fallback behavior clearly enough to diagnose provider rate limits.

## Manual QA

- Run the ENS sponsor monitor against Arbitrum with a healthy balance and an intentionally low threshold.
- Verify one active garden subdomain and one gardener subdomain through the UI and direct contract reads.
- Simulate a delayed CCIP delivery state and verify operator/user copy stays honest.
- Confirm indexer-derived ENS state never overrides direct receiver reads for final active/released status.

## Regression Checks

- Existing passkey-sponsored claim and release still submit through the smart account path.
- Wallet-funded claim and release still pay the estimated CCIP fee directly.
- Garden subdomains remain immutable.
- The `.greengoods.eth` suffix is not duplicated in compact username display.

## Out-of-Scope Proof

This plan does not require replacing CCIP, changing ENS parent ownership, or introducing a backend-only username registry. Those decisions need separate architecture review if the current CCIP path proves insufficient after production monitoring.
