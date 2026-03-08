# Task: Add Indexer Event Handler

## Trigger

A new smart contract event needs to be indexed, or an existing entity needs a new field derived from on-chain events. The Envio indexer handles Green Goods protocol events only — EAS attestations are queried from `easscan.org` (see EAS Architecture Boundary in `.claude/context/indexer.md`).

## Acceptance Criteria

The handler lives in `packages/indexer/src/EventHandlers.ts`. The entity is defined in `schema.graphql` with a `chainId: Int!` field. Composite IDs use the `{chainId}-{identifier}` pattern. Bidirectional relationships are updated on both sides. The handler gracefully degrades on errors (logs and creates minimal entity). `bun codegen` succeeds. `bun run test` passes. The GraphQL playground at `localhost:8080` returns correct data.

## Decomposition

### Step 1: Define Entity Schema
**Packages**: `indexer`
**Input**: Event ABI and desired entity fields
**Output**: Entity definition in `schema.graphql` with `chainId: Int!` and appropriate types. Run `bun codegen` to generate TypeScript types
**Verification**: `bun codegen` succeeds without errors
**Complexity**: S

### Step 2: Register Contract Event
**Packages**: `indexer`
**Input**: Contract address and event signature
**Output**: Contract and event added to `config.yaml` under the appropriate network section. Include ABI path, start block, and event list
**Verification**: `bun codegen` regenerates with new event bindings
**Complexity**: S

### Step 3: Write Failing Test
**Packages**: `indexer`
**Input**: Entity schema from Step 1, expected handler behavior
**Output**: Test in `test/test.ts` using `MockDb.createMockDb()` and `Contract.Event.createMockEvent()`. Test: entity creation, composite ID format, chainId field, bidirectional relationships, create-if-not-exists for update events
**Verification**: `bun run test` (must FAIL — handler not implemented yet)
**Complexity**: S-M

### Step 4: Implement Handler
**Packages**: `indexer`
**Input**: Failing test from Step 3
**Output**: Handler in `EventHandlers.ts` following the event handler pattern: extract event data, create composite ID, fetch additional data if needed, set entity with `context.EntityName.set()`. Wrap in try/catch with `console.error` fallback
**Verification**: `bun run test` (must PASS)
**On Failure**: If tests still fail, iterate on handler logic until passing (max 3 attempts before escalating)
**Complexity**: M

### Step 5: Shared Query Integration
**Packages**: `shared`
**Input**: Entity from Step 4
**Output**: If the entity is queried from the frontend, add a GraphQL query to the appropriate data module in `packages/shared/src/modules/data/`. Add a query key to `query-keys.ts`. Expose via a hook if needed (follow `add-shared-hook` spec)
**Verification**: `cd packages/shared && bun build`
**Complexity**: S-M

### Step 6: Full Stack Verification
**Packages**: `indexer`, `shared` (if Step 5 applies)
**Input**: All prior steps
**Output**: Full stack passes
**Verification**: `bun run test && bun lint && bun build`
**Complexity**: S

## Edge Cases

- **Composite ID collisions**: Same identifier on different chains must produce different entity IDs. Always prefix with `{chainId}-`.
- **Event ordering**: Update events may arrive before creation events. Use the create-if-not-exists pattern: check for existing entity, spread existing fields with defaults for missing ones.
- **Bidirectional relationships**: When an entity links to another (e.g., Garden has Gardeners), update BOTH sides. Forgetting the inverse creates orphaned references in GraphQL queries.
- **BigInt handling**: Event parameters that are `uint256` come as `bigint`. Use `.toString()` for IDs and string fields. Keep as `bigint` for numeric operations.
- **EAS boundary**: Do not index EAS `Attested` events. Attestation data (assessments, work, work approvals) is queried from EAS GraphQL. See `docs/docs/evaluator/query-eas.mdx`.

## Anti-Patterns

- Indexing EAS attestation events (violates EAS Architecture Boundary)
- Missing `chainId: Int!` on entities (breaks multi-chain support)
- Using simple IDs without chain prefix (causes cross-chain collisions)
- One-sided relationship updates (Garden adds Gardener but Gardener doesn't add Garden)
- Letting handler errors propagate uncaught (crashes the indexer)
- Hardcoding contract addresses (use `config.yaml`)
