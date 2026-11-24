# Garden membership dates

## Accepted behavior

- Joined this garden is the first recorded grant of any garden role, not account creation or the first gardener role across gardens.
- Rejoined is the start of the current membership only when every role was removed before a later grant. A role change while another role remains does not reset membership.
- Each current role has its own date, reset only after that role is removed and granted again. Repeated grants while held do not reset it.
- Missing or unavailable history displays an explicit unknown state. Dates never authorize membership.
- PWA member details, profile garden cards, and Admin member management use one Shared dates component. Existing copy controls remain; Admin shows the full address.

## Ownership and reuse

`packages/indexer/src/handlers/hatsModule.ts` already owns role events and roster projection. Its existing Gardener.createdAt is global to the chain and cannot represent garden joins. Add immutable GardenRoleEvent facts to that handler; retain existing aggregates.

`packages/shared/src/modules/data/gardener-reader.ts` owns first-gardener reads. A separate garden-member-history reader owns the distinct garden membership timeline, reducing event facts in chain order. A query hook in Shared owns transport/caching. Existing gardens query invalidation refreshes its key.

`packages/shared/src/components/Cards/FactRow.tsx` owns fact presentation. GardenMembershipDates composes it to keep date meanings and unavailable states consistent across three consumers; it adds no new card or dialog.

## Data and rollout

GardenRoleEvent is keyed by chain, transaction hash, and log index. It records normalized garden/account, numeric role, GRANTED or REVOKED, block/log ordering, timestamp, and transaction hash. Reader pagination and validation must complete before returning history; incomplete reads fail visibly.

Publish the indexer schema and replay historical HatsModule events before publishing the UI. Verify known historical grants, removals and rejoin sequences and indexer catch-up. No deployment, replay, account removal, chain broadcast, commit, or push is authorized by this implementation scope.

## Proof

Indexer persistence and replay identity; Shared pagination, independent gardens, role overlap, departure/rejoin, malformed responses, chain/account cache separation, and unavailable schema; Client/Admin wiring; labeled Storybook or localhost rendered proof. Profile authenticated-session proof stays advisory and pending if inaccessible.
