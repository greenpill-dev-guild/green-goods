# Task: Add Contract Feature

## Trigger

A new capability that originates in the smart contract layer and propagates through the stack: new on-chain action, new module integration, new resolver behavior, new registry, or new EAS schema.

## Acceptance Criteria

The feature has a Solidity implementation with storage gaps, custom errors, and explicit visibility. Unit tests (including fuzz for mainnet targets) pass at >=80% coverage. Gas benchmarks stay within measurable bounds: `< 50k gas` for view/pure functions, `< 200k gas` for single-write mutations, `< 500k gas` for batch operations or multi-step flows (mint, deploy). The indexer handles new events with composite IDs and chainId fields. A shared hook exposes the data via `queryKeys` factory. At least one consumer (client or admin) renders the new state. `bun run test && bun lint && bun build` passes across all affected packages.

## Decomposition

### Step 1: Schema and Interface Design
**Packages**: `contracts`
**Input**: Feature requirements, existing `config/schemas.json` (READ ONLY)
**Output**: New/updated interface in `src/interfaces/`, new custom errors, event signatures with indexed params
**Verification**: `cd packages/contracts && bun build:target -- src/interfaces/INewFeature.sol`
**Complexity**: S

### Step 2: Contract Implementation
**Packages**: `contracts`
**Input**: Interface from Step 1, existing contract patterns (Cathedral Check: find most similar contract in `src/`)
**Output**: Implementation with storage gaps (`50 - N`), custom errors, explicit visibility, module isolation (try/catch for external calls), bounded loops
**Verification**: `cd packages/contracts && bun build:target -- src/NewFeature.sol`
**Complexity**: M-L

### Step 3: Unit and Fuzz Tests
**Packages**: `contracts`
**Input**: Implementation from Step 2
**Output**: Tests following `test[Contract]_[scenario]` naming. Happy path (`test_`), revert cases (`testRevert_`), fuzz tests (`testFuzz_` with `vm.assume` guards). Tests use tuple encode for EAS data (`abi.encode(val1, val2, ...)`, never `abi.encode(struct)`)
**Verification**: `cd packages/contracts && bun run test`
**On Failure**: If tests fail, iterate on implementation (Step 2) until tests pass (max 3 attempts before escalating)
**Complexity**: M

### Step 4: Deploy Script Update
**Packages**: `contracts`
**Input**: Compiled contract from Step 2
**Output**: Updated `script/deploy/core.ts` and `script/Deploy.s.sol` with CREATE2 deployment, `_isDeployed()` skip guard, and `deployments/{chainId}-latest.json` artifact shape
**Verification**: `cd packages/contracts && bun script/deploy.ts core --network sepolia` (dry run, no `--broadcast`)
**Complexity**: M

### Step 5: Indexer Handler
**Packages**: `indexer`
**Input**: Event signatures from Step 1, deployment artifacts from Step 4
**Output**: Updated `schema.graphql` (entity with `chainId: Int!`), updated `config.yaml`, new handler in `src/EventHandlers.ts` using composite ID pattern (`${chainId}-${identifier}`), create-if-not-exists for update events, bidirectional relationship updates
**Verification**: `cd packages/indexer && bun codegen && bun run test`
**Complexity**: M

### Step 6: Shared Hook
**Packages**: `shared`
**Input**: Indexer entity or EAS query shape from Step 5
**Output**: Query key in `hooks/query-keys.ts`, hook in `hooks/{domain}/useNewFeature.ts`, barrel export from `hooks/index.ts` and `src/index.ts`. Uses `queryKeys.domain.key()` pattern, supports cancellation (`{ signal }`), appropriate stale time constant
**Verification**: `cd packages/shared && bun run test`
**Complexity**: S-M

### Step 7: Consumer UI
**Packages**: `client` and/or `admin`
**Input**: Hook from Step 6
**Output**: View or component consuming the hook. Admin views check role permissions (`useRole`, `useGardenPermissions`). All user-facing strings use `intl.formatMessage()`. Dark mode compatible (no hardcoded colors). Route registered in `router.tsx` with lazy loading
**Verification**: `cd packages/{client,admin} && bun run test && bun build`
**Complexity**: M

### Step 8: Integration Verification
**Packages**: all affected
**Input**: All prior steps
**Output**: Full stack passes
**Verification**: `bun run test && bun lint && bun build`
**On Failure**: Fix issues in the originating step, then re-run this verification (max 3 attempts before escalating)
**Complexity**: S

## Edge Cases

- **UUPS storage gaps**: New state variables go at the end. Reduce `__gap` by the number of new slots. Run `forge inspect src/Contract.sol:Contract storage-layout` before and after to confirm no collisions.
- **EAS schema registration**: If the feature introduces a new attestation type, a new schema must be registered via `--update-schemas`. Never modify `config/schemas.json` directly.
- **ABI encoding mismatch**: EAS stores attestation data as flat tuples. Resolvers MUST use tuple decode (`(f1, f2) = abi.decode(data, (type1, type2))`). Tests MUST use tuple encode. Struct encode produces different bytes for dynamic types.
- **Gas regression**: Run `bun test:gas` after implementation. If a function exceeds its benchmark, check for unbounded loops or unnecessary storage reads.
- **Indexer event ordering**: Update events may arrive before creation events. Always use create-if-not-exists with sensible defaults.
- **Chain-specific constants**: Use `HatsLib.sol` constants, never hardcode hat IDs or tree numbers.
- **Module isolation**: External module calls must be wrapped in try/catch to prevent cascade failures.

## Anti-Patterns

- Adding a new contract without storage gaps (breaks future upgrades)
- Using `require` strings instead of custom errors (higher gas, worse debugging)
- Hardcoding addresses or schema UIDs instead of loading from `deployments/{chainId}-latest.json`
- Running `forge script` directly instead of `bun script/deploy.ts`
- Creating the shared hook before the contract and indexer are working (inverts dependency order)
- Writing integration tests that depend on mainnet state without fork test infrastructure
- Skipping fuzz tests for mainnet-targeted functions
- Using `abi.encode(struct)` in tests when the on-chain data uses tuple encoding
