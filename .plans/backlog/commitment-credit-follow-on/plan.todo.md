# Commitment Credit Follow-on Plan

**Feature Slug**: `commitment-credit-follow-on`  
**Stage**: `backlog`  
**Status**: `BLOCKED FOLLOW-ON — explicit unlock required`  
**Last Updated**: `2026-07-19`

## Promotion gate

1. [ ] Commitment Pooling and settlement ABIs, events, permissions, and deployment paths are stable.
2. [ ] Revalidate every interface and path cited by [spec.md](spec.md) against current code.
3. [ ] Scope-lock the payment-rail verification, default/recovery policy, legal posture, and operator ownership.
4. [ ] Decide whether the product evidence still justifies a dedicated credit register.
5. [ ] Create current Linear routing and validation commands before moving to active.

## Implementation order after unlock

1. Contracts and storage/event tests.
2. Indexer entities, handlers, replay, and generated queries.
3. Shared types, selectors, jobs, and receipt verification.
4. Admin and member surfaces with mutual-aid language.
5. Two QA passes plus deployment-path and real-rail proof under separate authorization.

No lane should implement from the historical design before the promotion gate is complete.
