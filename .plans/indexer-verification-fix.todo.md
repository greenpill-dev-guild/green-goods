# Local Indexer Verification Flow — Validation & Fix Plan

**Status**: IMPLEMENTED
**Created**: 2026-02-19
**Last Updated**: 2026-02-19

---

## Findings (severity ordered)

### CRITICAL: GraphQL query field names are wrong (`post-deploy-verify.ts:95-110`)

The `RUNTIME_INDEXER_QUERY` uses lowercase-plural Hasura conventions (`gardens`, `actions`, `gardenDomains`) but Envio generates PascalCase singular query roots (`Garden`, `Action`, `GardenDomains`).

**Evidence**:
```bash
# Actual Hasura schema introspection (running instance):
curl -s -X POST http://localhost:8080/v1/graphql \
  -H "content-type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}'
# Returns: Action, Garden, Gardener, Hypercert, HypercertClaim, WorkApproval, ...
# Does NOT contain: gardens, actions, gardenDomains

# Exact error from the runtime query:
# {"errors":[{"message":"field 'gardens' not found in type: 'query_root'"}]}
```

**Fix**: In `packages/contracts/script/utils/post-deploy-verify.ts:95-110`, change the query to:
- `gardens(...)` → `Garden(...)`
- `actions(...)` → `Action(...)`
- `gardenDomains(...)` → `GardenDomains(...)`

And update response parsing at lines 487-489:
- `result.data.gardens` → `result.data.Garden`
- `result.data.actions` → `result.data.Action`
- `result.data.gardenDomains` → `result.data.GardenDomains`

And the `RuntimeIndexerResponse` interface at line 83-86:
- `gardens?` → `Garden?`
- `actions?` → `Action?`
- `gardenDomains?` → `GardenDomains?`

### HIGH: `GardenDomains` entity missing from running Hasura schema

The schema introspection shows no `GardenDomains` query root, despite it being defined in `schema.graphql:50` and generated code. The running Docker containers (up 7 days) have a stale Hasura schema. This is an operational issue — a `codegen` + container restart would fix it — but the verification flow has no diagnostic for this condition.

**Recommendation**: After fixing the query field names, the runtime check should distinguish between "field not found" (schema out of date) vs "empty results" (indexer hasn't synced yet). Currently both would produce the same timeout failure message.

### HIGH: Onchain failures gate indexer validation (`post-deploy-verify.ts:755-757`)

The indexer runtime check is gated behind `failures.length === 0`. Two stale onchain values block it:
- `marketplaceAdapter.exchange is zero`
- `marketplaceAdapter.hypercertMinter is zero`

This means `verify:post-deploy:indexer:local:sepolia` **never reaches** the indexer check on the current Sepolia deployment. The indexer validation is unreachable without a fresh deployment that wires the marketplace adapter.

**Recommendation**: Consider adding a `--skip-onchain` flag or running indexer config validation (`validateIndexerConfig`) regardless of onchain failures. The indexer config check at line 751-753 does run independently, but the runtime check at 755-757 is blocked.

### MEDIUM: `order_by` field mismatch in query (`post-deploy-verify.ts:105-106`)

The `gardenDomains` (should be `GardenDomains`) query uses `order_by: { updatedAt: desc }`, and `gardens` uses `order_by: { createdAt: desc }`. These field names must exactly match the Envio schema column names. In the current schema:
- `Garden.createdAt` ✅ exists
- `Action.createdAt` ✅ exists
- `GardenDomains.updatedAt` ✅ exists

Field names are correct (assuming the entity becomes available).

### LOW: `verify:post-deploy:indexer:local:*` scripts don't pass `--skip-local-indexer-start` or `--start-local-indexer`

The `package.json:69-71` scripts for `verify:post-deploy:indexer:local:*` are identical to `verify:post-deploy:indexer:*` (lines 66-68). Both just pass `--check-indexer-runtime`. The "local" variants don't have any special local-specific behavior baked in. Extra CLI flags (`--skip-local-indexer-start`, `--indexer-timeout-seconds`, etc.) must be passed manually via `--`.

This is not a bug per se (the flags work when passed), but the naming suggests the "local" variants should default to local behavior.

### INFO: Address sync is correct

All 11 contract addresses in `packages/indexer/config.yaml` for Sepolia (11155111) match `packages/contracts/deployments/11155111-latest.json` exactly. The `syncIndexerConfigFromDeployment()` function at `post-deploy-verify.ts:342-356` correctly shells out to `envio-integration.ts update <chainId>`.

### INFO: Docker lifecycle is correct

`startLocalIndexerStack()` at `post-deploy-verify.ts:358-372` correctly invokes `bun run dev:docker:detach` in the indexer package root. `stopLocalIndexerStack()` at `post-deploy-verify.ts:374-386` correctly invokes `bun run dev:docker:down`. Both map to `docker compose -f docker-compose.indexer.yaml up/down` in `packages/indexer/package.json:13,15`.

---

## Pass/Fail Verdict

**FAIL** — Local indexer validation flow is non-functional due to:
1. Wrong GraphQL field names (query always fails with "field not found")
2. Stale Hasura schema missing `GardenDomains` entity
3. Onchain failures block the runtime check from ever executing

---

## Commands That Demonstrate Failure

```bash
# Command 1: Fails at onchain checks, never reaches indexer runtime
bun --filter @green-goods/contracts verify:post-deploy:indexer:local:sepolia \
  -- --skip-local-indexer-start --indexer-timeout-seconds 30 --indexer-poll-seconds 5
# Output: "marketplaceAdapter.exchange is zero" + "marketplaceAdapter.hypercertMinter is zero"

# Command 2: Same result — blocked before indexer check
bun --filter @green-goods/contracts verify:post-deploy:indexer:local:sepolia \
  -- --indexer-timeout-seconds 120 --indexer-poll-seconds 10
# Output: Same onchain failures

# Direct GraphQL proof of wrong query field names:
curl -s -X POST http://localhost:8080/v1/graphql \
  -H "content-type: application/json" \
  -d '{"query":"{ gardens(limit:1) { id } }"}'
# Output: {"errors":[{"message":"field 'gardens' not found in type: 'query_root'"}]}

curl -s -X POST http://localhost:8080/v1/graphql \
  -H "content-type: application/json" \
  -d '{"query":"{ Garden(limit:1) { id } }"}'
# Output: {"data":{"Garden":[]}}  ← correct field name works
```

---

## Doc Drift in `.plans/contract-deployment.md`

**Line 168**: States `✅ local indexer query check passed (root garden, domain mask, and actions ingested)` as the expected success marker. This message exists in code (`post-deploy-verify.ts:499`) but can never be reached due to the query bug and onchain gating.

**Line 148/159**: Recommends `verify:post-deploy:indexer:local:sepolia` and `verify:post-deploy:indexer:local:arbitrum` but these have never successfully completed the indexer runtime check (the query field names have always been wrong for Envio's Hasura convention).

No other doc drift — the flag documentation at lines 110-117 is accurate.

---

## Minimal Patch Recommendations (indexer scope only)

### Step 1: Fix GraphQL query field names

**File**: `packages/contracts/script/utils/post-deploy-verify.ts`

1. Lines 67-86 — Rename `RuntimeIndexerResponse` fields:
   ```typescript
   interface RuntimeIndexerResponse {
     Garden?: RuntimeGarden[];
     Action?: RuntimeAction[];
     GardenDomains?: RuntimeGardenDomains[];
   }
   ```

2. Lines 95-110 — Fix `RUNTIME_INDEXER_QUERY`:
   ```typescript
   const RUNTIME_INDEXER_QUERY = `
     query PostDeployIndexerRuntime($chainId: Int!, $limit: Int!) {
       Garden(where: { chainId: { _eq: $chainId } }, limit: $limit, order_by: { createdAt: desc }) {
         id
         chainId
       }
       Action(where: { chainId: { _eq: $chainId } }, limit: 1, order_by: { createdAt: desc }) {
         id
         chainId
       }
       GardenDomains(where: { chainId: { _eq: $chainId } }, limit: $limit, order_by: { updatedAt: desc }) {
         garden
         domainMask
       }
     }
   `;
   ```

3. Lines 487-489 — Update response field access:
   ```typescript
   const gardens = result.data.Garden ?? [];
   const actions = result.data.Action ?? [];
   const gardenDomains = result.data.GardenDomains ?? [];
   ```

### Step 2: (Optional) Decouple indexer runtime from onchain failures

**File**: `packages/contracts/script/utils/post-deploy-verify.ts:755-757`

Move the indexer runtime check outside the `failures.length === 0` gate, or add a `--skip-onchain` flag. This allows testing the indexer independently of stale onchain state.

### Step 3: Rebuild local Hasura schema

```bash
cd packages/indexer
bun run dev:docker:down
bun run codegen
bun run dev:docker:detach
```

This is a one-time operational fix to get the `GardenDomains` entity tracked in Hasura.

---

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Fix query to PascalCase (Envio convention) | Introspection proves `Garden`/`Action` are the actual roots |
| 2 | Keep onchain gating as-is (optional decouple) | Changing the gate is a behavior change; recommend but don't require |
| 3 | No changes to envio-integration.ts | Address sync logic is correct, address match verified |
| 4 | No changes to config.yaml | All addresses already synced correctly |
