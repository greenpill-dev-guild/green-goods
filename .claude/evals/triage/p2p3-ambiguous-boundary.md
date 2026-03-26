# Triage Eval: P2/P3 Ambiguous Boundary (Stale Indexer Data)

## Issue Report

**Title**: Garden member count shows stale data after Hats Protocol role changes

**Reporter**: Admin operator via GitHub issue

**Body**:

After adding or removing a garden member through a Hats Protocol role change (e.g., granting or revoking a gardener hat), the member count displayed in the admin dashboard is occasionally off by 1-2 members. The count eventually self-corrects after approximately 30 minutes.

The issue appears to be in the Envio indexer's handling of Hats Protocol events. When a `TransferSingle` event fires for a hat token (indicating a role grant/revoke), the indexer's `HatTransfer` handler updates the `GardenMember` entity. However, if the Hats event and a garden-related event (like `ActionCreated` or `WorkSubmitted`) fire in the same block, the indexer sometimes processes them in an order that causes the member count to reflect the pre-transfer state.

The count self-corrects because the next block with any garden-related event triggers a re-query of the Hats state, which picks up the correct membership. The ~30 minute window corresponds to the average time between garden events on low-activity chains (Sepolia).

**No error is logged.** The indexer processes both events successfully — the order just causes a temporary inconsistency in the denormalized `memberCount` field on the `Garden` entity.

**Labels**: bug, indexer, hats

**Reproduction**:

1. In the admin dashboard, note the current member count for a garden
2. Grant a new gardener hat via Hats Protocol (directly on-chain or through the admin UI)
3. Wait for the transaction to confirm
4. Refresh the admin dashboard — member count may still show the old value
5. Wait ~30 minutes or trigger another garden event — count corrects itself

**Impact**: The stale count is cosmetic — it does not affect access control (the actual Hats check is done on-chain at transaction time, not from the indexed count). No user action is blocked. The only impact is that operators see a briefly inaccurate member count in the dashboard, which could cause confusion but not incorrect behavior.

## Expected Classification

### Classification
- **Severity**: `P2` or `P3` (both are defensible)
- **Type**: `bug`
- **Complexity**: `low`

### Affected Packages
- `indexer` (event processing order and denormalized count update)

### Rationale

**Case for P2**:
1. Data accuracy matters for operator trust — seeing wrong member counts erodes confidence in the system
2. The 30-minute stale window is significant for active gardens where operators are actively managing membership
3. This is a correctness bug in the indexer, even if it self-heals

**Case for P3**:
1. The stale data is cosmetic — no functionality is affected (on-chain access control is independent)
2. It self-corrects without intervention within ~30 minutes
3. No user action is blocked or degraded
4. The actual membership state is always correct on-chain; only the dashboard display lags

Both classifications are defensible. P2 is more appropriate if the team prioritizes data accuracy and operator trust. P3 is more appropriate if the team treats self-correcting cosmetic issues as low priority.

### Expected Route
- Entry point: `/debug` with `indexer` skill
- Fix involves adjusting the event handler ordering or re-querying Hats state after processing all events in a block

### Context for Next Agent
The Envio indexer's `HatTransfer` handler in `packages/indexer/src/EventHandlers/` processes Hats role changes and updates the denormalized `memberCount` on the `Garden` entity. When multiple events fire in the same block, processing order can cause the count to reflect stale state. The fix is either: (1) defer count updates to an end-of-block reconciliation step, or (2) re-query the Hats contract state after processing all events in a block rather than relying on event ordering. The `memberCount` field is denormalized for query performance — the authoritative membership is always the on-chain Hats state.

## Passing Criteria

- Severity MUST be either `P2` or `P3` (both are acceptable — this is an ambiguous boundary case)
- Type MUST be `bug`
- Must identify `indexer` as the affected package
- Must recognize that the issue self-corrects (this is key context for severity)
- Must note that on-chain access control is NOT affected (only the display count)
- Should provide reasoning for whichever severity is chosen (not just assert P2 or P3 without justification)
- Must NOT classify as P1 (no core feature is broken, no user is blocked)
- Must NOT classify as P4 (this is a real bug, not an enhancement request)

## Common Failure Modes

- Classifying as P1 (overweighting "data accuracy" without noting that it self-corrects and is cosmetic)
- Classifying as P4 (underweighting the impact — this IS a bug, and operators seeing wrong counts is a real problem)
- Identifying `shared` or `admin` as affected (the root cause is entirely in the indexer)
- Missing the self-correction behavior (treating it as a permanent data inconsistency)
- Missing that on-chain access control is independent of the indexed count
- Not providing rationale for the chosen severity (the ambiguity is the point of this eval — reasoning matters)
