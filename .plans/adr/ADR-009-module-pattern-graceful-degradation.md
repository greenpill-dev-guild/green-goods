# ADR-009: Module Pattern with Graceful Degradation

**Date**: 2026-04-02
**Status**: Accepted

## Context

`GardenToken.mintGarden()` orchestrates 7+ external module calls (Hats Protocol, Karma GAP, Octant vaults, Gardens V2, CookieJar, ENS, ActionRegistry). If any single module call fails, the entire garden creation would revert -- losing gas and creating a poor user experience. Optional integrations should not block core garden creation, especially since external dependencies (CCIP, Karma, Octant APIs) have independent uptime characteristics.

## Decision

All optional module calls are wrapped in try/catch. Only `HatsModule.createGardenHatTree()` and the initial owner role grant are unwrapped (must succeed for a garden to be functional). The mint is split into two phases inside `GardenToken.mintGarden()`:

**Phase 1** -- `_initializeRoleAndGovernance()`:
- Hat tree creation (REQUIRED -- no try/catch)
- Owner role grant (REQUIRED -- no try/catch)
- Gardener/Operator role grants (TRY/CATCH -- best effort, roles can be granted later)
- KarmaGAPModule.createProject() (TRY/CATCH -- graceful degradation)
- OctantModule.onGardenMinted() (TRY/CATCH -- graceful degradation)
- GardensModule.onGardenMinted() (TRY/CATCH -- graceful degradation), which internally sub-orchestrates community creation, power registry registration, treasury seeding, and pool creation (the last via a self-call try/catch per ADR-015)

**Phase 2** -- `_initializeIntegrationsAndAccount()`:
- CookieJarModule.onGardenMinted() (TRY/CATCH)
- ActionRegistry.setGardenDomainsFromMint() (TRY/CATCH)
- ENS.registerGarden() (TRY/CATCH + refund on failure)
- GardenAccount.initialize() (REQUIRED)

Key files: `packages/contracts/src/tokens/Garden.sol` (lines 368-471)

Each module emits distinct failure events (e.g., `GardenPartiallyInitialized`, `ENSRegistrationFailed`) so operators can diagnose what failed. Recovery functions (`retryCreateCommunity()`, `retryCreatePools()`, `claimENSRefund()`) allow retrying failed integrations post-mint without re-minting the garden.

## C4 L3 Component Diagram -- mintGarden() Module Interaction

```mermaid
flowchart TD
    classDef required fill:#2d6a4f,stroke:#1b4332,color:#fff
    classDef tryCatch fill:#e9c46a,stroke:#f4a261,color:#000
    classDef external fill:#fff,stroke:#e63946,color:#e63946,stroke-dasharray: 5 5

    MINT["GardenToken.mintGarden()"]:::required

    subgraph CORE ["Core Mint (REQUIRED)"]
        SAFE["_safeMint()"]:::required
        TBA["TBALib.createAccount()"]:::required
    end

    subgraph PHASE1 ["Phase 1: _initializeRoleAndGovernance()"]
        HAT_TREE["HatsModule.createGardenHatTree()"]:::required
        GRANT_OWNER["HatsModule.grantRole(Owner)"]:::required
        GRANT_GARDENER["HatsModule.grantRole(Gardener) x N"]:::tryCatch
        GRANT_OPERATOR["HatsModule.grantRole(Operator) x N"]:::tryCatch
        KARMA["KarmaGAPModule.createProject()"]:::tryCatch
        OCTANT["OctantModule.onGardenMinted()"]:::tryCatch

        subgraph GARDENS_SUB ["GardensModule.onGardenMinted()"]
            direction TB
            CREATE_COMM["_createCommunity() -> RegistryFactory"]:::tryCatch
            REG_POWER["_registerGardenPower() -> UnifiedPowerRegistry"]:::tryCatch
            SEED["_seedGardenTreasury() -> GoodsToken.mint()"]:::tryCatch

            subgraph POOL_SELF ["this.attemptPoolCreation() (self-call try/catch)"]
                CREATE_POOLS["_createSignalPools() -> PoolFactory x 2"]:::tryCatch
                REG_POOLS_POWER["_registerPoolsInPowerRegistry()"]:::tryCatch
                REG_POOLS_HATS["_registerPoolsInHatsModule()"]:::tryCatch
            end
        end
    end

    subgraph PHASE2 ["Phase 2: _initializeIntegrationsAndAccount()"]
        COOKIE["CookieJarModule.onGardenMinted()"]:::tryCatch
        ACTION["ActionRegistry.setGardenDomainsFromMint()"]:::tryCatch
        ENS["ENS.registerGarden()"]:::tryCatch
        ENS_REFUND["failedENSRefunds mapping (on failure)"]:::tryCatch
        GARDEN_INIT["GardenAccount.initialize()"]:::required
    end

    subgraph EXT ["External Dependencies"]
        HATS_EXT["Hats Protocol"]:::external
        GARDENS_V2["Gardens V2 (RegistryCommunity, CVStrategy)"]:::external
        ALLO["Allo Protocol (pool allocation)"]:::external
        KARMA_EXT["Karma GAP (project/milestone tracking)"]:::external
        CCIP["Chainlink CCIP (ENS cross-chain)"]:::external
        TOKENBOUND["Tokenbound (ERC-6551)"]:::external
    end

    MINT --> SAFE --> TBA
    TBA --> HAT_TREE
    HAT_TREE --> GRANT_OWNER
    GRANT_OWNER --> GRANT_GARDENER
    GRANT_OWNER --> GRANT_OPERATOR
    GRANT_OWNER --> KARMA
    GRANT_OWNER --> OCTANT
    GRANT_OWNER --> CREATE_COMM
    CREATE_COMM --> REG_POWER --> SEED --> CREATE_POOLS
    CREATE_POOLS --> REG_POOLS_POWER --> REG_POOLS_HATS

    PHASE1 --> COOKIE
    COOKIE --> ACTION --> ENS
    ENS -->|failure| ENS_REFUND
    ENS --> GARDEN_INIT

    HAT_TREE -.-> HATS_EXT
    GRANT_OWNER -.-> HATS_EXT
    CREATE_COMM -.-> GARDENS_V2
    CREATE_POOLS -.-> ALLO
    KARMA -.-> KARMA_EXT
    ENS -.-> CCIP
    TBA -.-> TOKENBOUND
end
```

## Consequences

- **Enables**: Garden creation succeeds even if external dependencies (Karma GAP, Octant, CCIP, etc.) are down or rate-limited. Operators can monitor partial initialization events and retry specific modules without re-minting.
- **Constrains**: Every module integration must have a corresponding retry path. The two-phase initialization adds orchestration complexity, and every new module integration must decide which phase it belongs to.
- **Trade-off**: Partial initialization is a valid state -- a garden may exist without pools, without ENS registration, or without Karma tracking. The UI (admin and client) must handle these incomplete states gracefully, showing what succeeded and offering retry actions for what failed.
