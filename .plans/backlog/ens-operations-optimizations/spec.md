# ENS Operations Optimizations Spec

## Summary

This backlog hub captures future ENS reliability and operations work after the core Green Goods ENS integration is deployable. The immediate production path should stay focused on garden migration, passkey-sponsored claim/release, sponsor top-up tooling, and the one-time claim notification. Future work should deepen observability and resilience around CCIP delivery, receiver state, and user-facing recovery.

## Users

- Primary: Green Goods operators responsible for deploys, migrations, and sponsor balance.
- Primary: protocol members claiming or changing their `greengoods.eth` username.
- Secondary: support contributors diagnosing delayed or failed ENS registrations.

## Functional Requirements

1. Provide an admin/ops ENS dashboard that shows sponsor balance, estimated sponsored actions covered, pending refunds, L1 receiver address, and recent claim/release sends.
2. Add live post-deploy smoke checks that verify Arbitrum `GreenGoodsENS`, Ethereum `GreenGoodsENSReceiver`, and resolver state for a small sample set.
3. Add indexer-backed ENS history so registration/release sends, CCIP message ids, and final receiver state can be correlated without manual log scans.
4. Improve user-facing cooldown and retry UX after release, including a clear "when can I claim a new name?" state.
5. Harden RPC failover for ENS migration/status scripts so rate limiting does not block normal operations.
6. Add alerting around sponsor runway and stale CCIP settlement beyond the expected delivery window.

## Non-Functional Constraints

- Keep hooks and shared ENS logic in `packages/shared`.
- Keep operational scripts under durable package or root package scripts; do not add one-off root scripts.
- Avoid a parallel source of truth for ENS state. Prefer contract reads plus indexer/event-derived projections.
- Do not introduce centralized username custody or backend-only registration state.
- Any new user-facing copy ships in `en`, `es`, and `pt`.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Ops dashboard and alerts | `ui` / `state_api` | Admin or ops-facing visibility |
| ENS event projection | `indexer` | Claim/release history and settlement correlation |
| Contract smoke checks | `contracts` | Live status, post-deploy verification, RPC fallback |
| User cooldown/retry UX | `client` / `shared` | Reuse existing ENS hooks and query keys |

## Risks

- CCIP delivery timing can vary; alert thresholds need enough tolerance to avoid noisy false positives.
- RPC providers can rate-limit log scans; fallback providers should be explicit and observable.
- Indexer-derived state must remain subordinate to onchain receiver state for final truth.
