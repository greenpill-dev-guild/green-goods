# Gardens Protocol: NFT-Based Conviction Voting Integration

**Status**: Implementation Spec (Pending Corantin Review)
**Created**: 2026-02-05
**Updated**: 2026-02-06 (Revised with meeting decisions & streaming-pool branch analysis)
**Branch**: `streaming-pool` on `upstream/1Hive/gardens-v2`
**Context**: Integrating NFT voting power, delegation, and sync power into Gardens V2 conviction voting

---

## Meeting Decisions (Feb 6, 2026)

These decisions from the Afolabi + Corantin call drive every architectural choice below:

### Aligned (Implementation Required)

| # | Decision | Impact |
|---|----------|--------|
| 1 | **NFT Voting Power via Power Registry** | New `powerRegistry` field on pool config. Defaults to community registry. NFT addresses derive voting power. |
| 2 | **Delegate Function for Conviction** | Add `delegate()` so a smart account (Garden contract) can control conviction updates on behalf of members. |
| 3 | **Sync Power Facet** | New facet called by Hats registry module to update conviction on NFT revocation/minting. |
| 4 | **Make Covenant Optional** | Remove covenant as a requirement for community creation. |
| 5 | **Eliminate Initial Staking Requirement** | Joining a community no longer requires staking tokens. |
| 6 | **Move Configuration to Pool Level** | Pool-level config replaces community-level staking config. |
| 7 | **Voting Weight from Balance (Not Staking)** | Check wallet `balanceOf()` instead of requiring token lock. Avoids decreasing voting weight in other DAOs. |
| 8 | **Batch Join + Activate via Multicall** | Consolidate join + activate governance into a single transaction for UX. |
| 9 | **Test via Community Upgrade** | Test new facets by upgrading existing Green Pill community or a test community on Sepolia. |

### Needs Further Discussion

| # | Decision | Notes |
|---|----------|-------|
| A | Target Gen Z at university/civic level | UX must be "receive link → vote in 1 tx" |
| B | Compound voting protections | Chain Passport score + allowlists + NFT checks |
| C | Reduce audit surface | Cut staking from V2 main codebase entirely |
| D | Governance token optionality | Conviction pools based solely on NFT membership (no ERC-20 required) |

---

## 1. Architecture: How It Works Today (streaming-pool branch)

### 1.1 Diamond Facet Structure

Both `CVStrategy` and `RegistryCommunity` are **EIP-2535 Diamond proxies**:

```
CVStrategy Diamond (streaming-pool branch)
├── DiamondCutFacet          # Upgrade logic
├── DiamondLoupeFacet        # Introspection
├── OwnershipFacet           # Ownership
├── CVAdminFacet             # Pool params, Superfluid GDA, allowlist
├── CVAllocationFacet        # allocate() — apply conviction to proposals
├── CVDisputeFacet           # Dispute resolution
├── CVPauseFacet             # Pause/unpause
├── CVPowerFacet             # activatePoints, increasePower, decreasePower  ← MODIFY
├── CVProposalFacet          # Proposal lifecycle
└── CVStreamingFacet         # Superfluid rebalance (WIP)

RegistryCommunity Diamond
├── CommunityAdminFacet      # Council safe, fees, templates
├── CommunityMemberFacet     # stakeAndRegisterMember, unregister, kick
├── CommunityPoolFacet       # createPool (creates Allo pool + CVStrategy)
├── CommunityPowerFacet      # increasePower, decreasePower, activate/deactivate  ← MODIFY
├── CommunityStrategyFacet   # Add/remove strategies
└── CommunityPauseFacet      # Pause control
```

### 1.2 Current Power Flow (Staking-Based)

```
Member stakes gardenToken → CommunityPowerFacet.increasePower(amount)
    → gardenToken.transferFrom(member, community, amount)
    → for each activated strategy:
        CVPowerFacet.increasePower(member, amount) via delegatecall
            → PowerManagementUtils.increasePower() — compute points
            → totalPointsActivated += points
        community.memberPowerInStrategy[member][strategy] += points
```

**Key functions** (from actual code review):

| Contract | Function | Signature | Role |
|----------|----------|-----------|------|
| `CVPowerFacet` | `increasePower(address, uint256)` | `0x782aadff` | Strategy receives power update |
| `CVPowerFacet` | `decreasePower(address, uint256)` | `0x2ed04b2b` | Strategy decreases power, rebalances proposals |
| `CVPowerFacet` | `activatePoints()` | `0x814516ad` | Member activates in strategy |
| `CVPowerFacet` | `deactivatePoints()` | `0x1ddf1e23` | Member deactivates, withdraws all support |
| `CommunityPowerFacet` | `increasePower(uint256)` | `0x559de05d` | Member stakes more tokens |
| `CommunityPowerFacet` | `decreasePower(uint256)` | `0x5ecf71c5` | Member unstakes tokens |
| `PowerManagementUtils` | `increasePower(...)` | library | Computes points (Unlimited/Capped/Quadratic) |

### 1.3 Storage Layout (CVStrategyBaseFacet)

```
Slots 0-50:    Initializable
Slots 51-100:  OwnableUpgradeable
Slots 101-105: BaseStrategyUpgradeable (allo, strategyId, poolActive, poolId, poolAmount)
Slots 106-131: CVStrategy custom storage
    106: collateralVaultTemplate
    107: surpressStateMutabilityWarning
    108: cloneNonce
    109: disputeCount
    110: proposalCounter
    111: currentArbitrableConfigVersion
    112: totalStaked
    113: totalPointsActivated
    114-117: cvParams (CVParams struct)
    118: proposalType
    119: pointSystem
    120: pointConfig
    121: registryCommunity
    122: collateralVault
    123: sybilScorer
    124: proposals mapping
    125: totalVoterStakePct mapping
    126: voterStakedProposals mapping
    127: disputeIdToProposalId mapping
    128: arbitrableConfigs mapping
    129: superfluidToken
    130: superfluidGDA
    131: streamingRatePerSecond
    132-178: __gap (47 slots reserved)
```

### 1.4 Point System Types

```solidity
enum PointSystem {
    Fixed,      // Equal power for all members (registerStakeAmount)
    Capped,     // Power capped at pointConfig.maxAmount
    Unlimited,  // Direct 1:1 token → power
    Quadratic   // sqrt(stake * 10^decimals) for diminishing returns
}
```

---

## 2. Proposed Architecture: NFT Power + Delegation + Sync

### 2.1 Design Principles (From Meeting)

1. **No Staking Required** — Voting weight derived from `balanceOf()` not locked tokens
2. **Pool-Level Configuration** — Each pool specifies its own power registry
3. **NFT-First** — Pools can run entirely on NFT membership (no ERC-20 needed)
4. **Instant Revocation** — When a Hat/NFT is revoked, conviction updates immediately
5. **Single-Transaction UX** — Join + activate in one multicall
6. **Delegation** — Smart accounts (Garden contracts) can manage conviction on behalf of members

### 2.2 New Components Overview

```
CVStrategy Diamond (Extended)
├── ... (existing facets unchanged)
├── CVPowerFacet             (MODIFIED — calls power registry)
└── CVSyncPowerFacet         (NEW — sync power on NFT revocation)

RegistryCommunity Diamond (Extended)
├── ... (existing facets unchanged)
├── CommunityMemberFacet     (MODIFIED — optional staking)
└── CommunityPowerFacet      (MODIFIED — balance-based power)

New Interfaces:
├── IPowerRegistry           (NEW — abstract power source)
└── INFTPowerRegistry        (NEW — NFT-specific power)
```

### 2.3 Power Registry Interface

The meeting decided each pool gets a `powerRegistry` field that defaults to the community registry. This abstracts the power source:

```solidity
/// @title IPowerRegistry
/// @notice Abstract interface for voting power sources
/// @dev Pools use this to determine member voting power.
///      Default: RegistryCommunity (token balance-based).
///      Custom: NFTPowerRegistry (NFT ownership-based).
interface IPowerRegistry {
    /// @notice Get the voting power of a member for a given strategy
    /// @param _member The member address
    /// @param _strategy The strategy (pool) address
    /// @return power The voting power (scaled to 18 decimals)
    function getMemberPower(address _member, address _strategy) external view returns (uint256 power);

    /// @notice Check if a member is registered
    /// @param _member The member address
    /// @return True if member has power > 0
    function isMember(address _member) external view returns (bool);
}
```

### 2.4 NFT Power Registry

For NFT-only pools, a new `NFTPowerRegistry` contract replaces the community registry:

```solidity
/// @title NFTPowerRegistry
/// @notice Derives voting power from NFT ownership + Hats Protocol roles
/// @dev Implements IPowerRegistry. Configured per-pool at creation time.
contract NFTPowerRegistry is IPowerRegistry {

    struct NFTPowerSource {
        address token;           // NFT contract address
        NFTType nftType;         // ERC721, ERC1155, HAT
        uint256 weight;          // Weight multiplier (basis points, 10000 = 1x)
        uint256 tokenId;         // For ERC1155 only
        uint256 hatId;           // For HAT type only
    }

    enum NFTType {
        ERC721,     // balanceOf() count
        ERC1155,    // balanceOf(tokenId) count
        HAT         // isWearerOfHat() binary (0 or 1)
    }

    /// @notice Power sources configured for this registry
    NFTPowerSource[] public powerSources;

    /// @notice Hats Protocol address (immutable)
    address public immutable hatsProtocol;

    /// @notice Get member power by summing all NFT power sources
    function getMemberPower(address _member, address /*_strategy*/)
        external view override returns (uint256 power)
    {
        for (uint256 i = 0; i < powerSources.length; i++) {
            NFTPowerSource storage source = powerSources[i];
            uint256 balance;

            if (source.nftType == NFTType.ERC721) {
                balance = IERC721(source.token).balanceOf(_member);
            } else if (source.nftType == NFTType.ERC1155) {
                balance = IERC1155(source.token).balanceOf(_member, source.tokenId);
            } else if (source.nftType == NFTType.HAT) {
                balance = IHats(hatsProtocol).isWearerOfHat(_member, source.hatId) ? 1 : 0;
            }

            // Apply weight (basis points: 10000 = 1x)
            power += (balance * source.weight) / 10000;
        }
    }

    function isMember(address _member) external view override returns (bool) {
        return this.getMemberPower(_member, address(0)) > 0;
    }
}
```

### 2.5 Pool Configuration Changes

Add `powerRegistry` to init params:

```solidity
struct CVStrategyInitializeParamsV0_4 {
    CVParams cvParams;
    ProposalType proposalType;
    PointSystem pointSystem;
    PointSystemConfig pointConfig;
    ArbitrableConfig arbitrableConfig;
    address registryCommunity;
    address sybilScorer;
    uint256 sybilScorerThreshold;
    address[] initialAllowlist;
    address superfluidToken;
    uint256 streamingRatePerSecond;
    address powerRegistry;          // NEW — defaults to registryCommunity if address(0)
}
```

**Storage extension** (uses __gap slots):

```solidity
// In CVStrategyBaseFacet, consume 1 gap slot:
// Slot 132 (was __gap[0]):
IPowerRegistry public powerRegistry;

// Remaining gap: uint256[46] private __gap;
```

### 2.6 Delegation Function

From the meeting: _"Add delegate function for conviction. Function allows smart account (Garden contract) control over conviction updating."_

This is **not** vote-delegation (like ERC20Votes). It's **conviction management delegation** — allowing a trusted contract (the Garden account, Hats module) to call `syncPower()` on behalf of a member when their NFT status changes.

```solidity
/// @notice In CVPowerFacet — allow delegated conviction management
/// @dev Callable by approved delegates (e.g., Garden smart accounts, Hats modules)
mapping(address => mapping(address => bool)) public convictionDelegates;
// member => delegate => approved

function setConvictionDelegate(address _delegate, bool _approved) external {
    convictionDelegates[msg.sender][_delegate] = _approved;
    emit ConvictionDelegateSet(msg.sender, _delegate, _approved);
}

modifier onlyMemberOrDelegate(address _member) {
    require(
        msg.sender == _member || convictionDelegates[_member][msg.sender],
        "Not member or delegate"
    );
    _;
}
```

### 2.7 Sync Power Facet (NEW)

The core innovation from the meeting: when a Hat/NFT is revoked, the Hats registry module calls this facet to instantly recompute conviction.

```solidity
/// @title CVSyncPowerFacet
/// @notice Syncs voting power when NFT ownership changes (mint/revoke)
/// @dev Called by external modules (Hats registry) to keep conviction accurate.
///      This is the "hook" discussed in the meeting for NFT revocation.
contract CVSyncPowerFacet is CVStrategyBaseFacet {

    event PowerSynced(address indexed member, uint256 oldPower, uint256 newPower);
    event MemberPowerRevoked(address indexed member, uint256 powerRemoved);

    /// @notice Addresses authorized to call syncPower (e.g., Hats modules)
    mapping(address => bool) public authorizedSyncCallers;

    /// @notice Authorize a caller (e.g., Green Goods HatsModule) to sync power
    function setAuthorizedSyncCaller(address _caller, bool _authorized) external {
        onlyCouncilSafe();
        authorizedSyncCallers[_caller] = _authorized;
    }

    /// @notice Sync a member's voting power from the power registry
    /// @dev Called when NFT ownership changes. Recomputes power and adjusts
    ///      conviction on all proposals the member has staked on.
    /// @param _member The member whose power changed
    function syncPower(address _member) external {
        require(authorizedSyncCallers[msg.sender], "Not authorized sync caller");

        uint256 oldPower = registryCommunity.getMemberPowerInStrategy(_member, address(this));
        uint256 newPower = powerRegistry.getMemberPower(_member, address(this));

        if (newPower == oldPower) return;

        if (newPower < oldPower) {
            // Power decreased (e.g., Hat revoked)
            uint256 decrease = oldPower - newPower;
            _handlePowerDecrease(_member, decrease);
            emit MemberPowerRevoked(_member, decrease);
        } else {
            // Power increased (e.g., Hat granted)
            uint256 increase = newPower - oldPower;
            _handlePowerIncrease(_member, increase);
        }

        emit PowerSynced(_member, oldPower, newPower);
    }

    /// @notice Batch sync power for multiple members
    /// @dev Useful when a role change affects multiple members simultaneously
    function batchSyncPower(address[] calldata _members) external {
        require(authorizedSyncCallers[msg.sender], "Not authorized sync caller");
        for (uint256 i = 0; i < _members.length; i++) {
            this.syncPower(_members[i]);
        }
    }

    /// @dev Handle power decrease — rebalance proposals proportionally
    ///      Mirrors the logic in CVPowerFacet.decreasePower()
    function _handlePowerDecrease(address _member, uint256 _decrease) internal {
        uint256 voterStake = totalVoterStakePct[_member];
        uint256 memberPower = registryCommunity.getMemberPowerInStrategy(_member, address(this));
        uint256 unusedPower = memberPower > voterStake ? memberPower - voterStake : 0;

        if (unusedPower < _decrease) {
            // Must reduce conviction on active proposals
            uint256 reductionNeeded = _decrease - unusedPower;
            uint256 balancingRatio = (reductionNeeded << 128) / voterStake;

            for (uint256 i = 0; i < voterStakedProposals[_member].length; i++) {
                uint256 proposalId = voterStakedProposals[_member][i];
                Proposal storage proposal = proposals[proposalId];
                uint256 stakedPoints = proposal.voterStakedPoints[_member];
                uint256 newStakedPoints = stakedPoints - ((stakedPoints * balancingRatio + (1 << 127)) >> 128);

                uint256 oldStake = proposal.stakedAmount;
                proposal.stakedAmount -= stakedPoints - newStakedPoints;
                proposal.voterStakedPoints[_member] = newStakedPoints;
                totalStaked -= stakedPoints - newStakedPoints;
                totalVoterStakePct[_member] -= stakedPoints - newStakedPoints;
                _calculateAndSetConviction(proposal, oldStake);
            }
        }

        totalPointsActivated -= _decrease;
    }

    /// @dev Handle power increase — just add to activated points
    function _handlePowerIncrease(address _member, uint256 _increase) internal {
        bool isActivated = registryCommunity.memberActivatedInStrategies(_member, address(this));
        if (isActivated) {
            totalPointsActivated += _increase;
        }
    }
}
```

### 2.8 Green Goods HatsModule Integration

The Green Goods `HatsModule` already manages hat minting/revocation. Add a callback to sync power:

```solidity
// In Green Goods HatsModule (packages/contracts/src/modules/Hats.sol)
// Add after hat revocation logic:

/// @notice Sync conviction voting power after hat change
/// @param _member The member whose hat changed
/// @param _strategies Array of CVStrategy addresses to sync
function _syncConvictionPower(address _member, address[] memory _strategies) internal {
    for (uint256 i = 0; i < _strategies.length; i++) {
        // Call the CVSyncPowerFacet on each relevant strategy
        ICVSyncPower(_strategies[i]).syncPower(_member);
    }
}
```

### 2.9 Revised Power Flow (NFT-Based)

```
Pool Creation:
    CommunityPoolFacet.createPool(params) where params.powerRegistry = NFTPowerRegistryAddress
    → CVStrategy initialized with powerRegistry = NFTPowerRegistry
    → CVSyncPowerFacet.setAuthorizedSyncCaller(hatsModuleAddress, true)

Member Joins (1 tx via multicall):
    multicall([
        registryCommunity.registerMember(),     // Join community (no staking required)
        cvStrategy.activatePoints()              // Activate in pool
    ])
    → activatePoints() reads powerRegistry.getMemberPower(member)
    → Sets member power from NFT balance, not staked tokens

Member Votes:
    CVAllocationFacet.allocate(proposalSupports)
    → Uses member power from powerRegistry

Hat Revoked (automatic conviction update):
    HatsModule.revokeHat(member)
    → HatsModule._syncConvictionPower(member, [strategy1, strategy2, ...])
    → CVSyncPowerFacet.syncPower(member)
    → Recomputes power from NFTPowerRegistry
    → Rebalances conviction on all proposals member voted on
```

---

## 3. Modifications to Existing Code

### 3.1 CVPowerFacet — Use Power Registry

**File**: `pkg/contracts/src/CVStrategy/facets/CVPowerFacet.sol`

The `activatePoints()` function currently reads from `registryCommunity`:

```solidity
// CURRENT (line 40):
totalPointsActivated += registryCommunity.getMemberPowerInStrategy(msg.sender, address(this));

// PROPOSED: Use powerRegistry if set, fallback to registryCommunity
uint256 power = address(powerRegistry) != address(0)
    ? powerRegistry.getMemberPower(msg.sender, address(this))
    : registryCommunity.getMemberPowerInStrategy(msg.sender, address(this));
totalPointsActivated += power;
```

Similarly, `increasePower()` and `decreasePower()` need a conditional path for NFT-based pools where power comes from the registry, not from staked amounts.

### 3.2 CommunityMemberFacet — Optional Staking

**File**: `pkg/contracts/src/RegistryCommunity/facets/CommunityMemberFacet.sol`

Currently `stakeAndRegisterMember()` requires transferring `registerStakeAmount` of `gardenToken`. Per meeting decision, staking should be optional:

```solidity
// Add a registerMember() function that doesn't require staking
function registerMember() external {
    // Mark as registered without staking
    addressToMemberInfo[msg.sender].isRegistered = true;
    emit MemberRegistered(msg.sender, 0); // 0 staked
}

// Keep stakeAndRegisterMember() for pools that want staking
function stakeAndRegisterMember() external {
    // ... existing logic
}
```

### 3.3 CommunityPowerFacet — Balance-Based Power

**File**: `pkg/contracts/src/RegistryCommunity/facets/CommunityPowerFacet.sol`

The meeting decided voting weight should come from `balanceOf()` not locked tokens. For the default (non-NFT) case:

```solidity
// NEW function for balance-based power (no staking)
function getMemberBalancePower(address _member) public view returns (uint256) {
    return gardenToken.balanceOf(_member);
}
```

### 3.4 PowerManagementUtils — New Balance Point System

**File**: `pkg/contracts/src/CVStrategy/PowerManagementUtils.sol`

Add a new point system that reads balance instead of staked amount:

```solidity
enum PointSystem {
    Fixed,      // Equal power for all members
    Capped,     // Power capped at maxAmount
    Unlimited,  // Direct 1:1 token → power
    Quadratic,  // sqrt(stake) for diminishing returns
    Balance     // NEW — reads balanceOf() instead of staked amount
}
```

---

## 4. Configuration Examples

### Example 1: NFT-Only Pool (Green Pill Community)

```javascript
// No ERC-20 required. Power from Hats roles only.
const nftPowerRegistry = {
    powerSources: [
        {
            token: HATS_PROTOCOL,
            nftType: "HAT",
            hatId: GARDENER_HAT_ID,
            weight: 10000          // 1x per gardener hat
        },
        {
            token: HATS_PROTOCOL,
            nftType: "HAT",
            hatId: EVALUATOR_HAT_ID,
            weight: 30000          // 3x per evaluator hat
        },
        {
            token: HATS_PROTOCOL,
            nftType: "HAT",
            hatId: OPERATOR_HAT_ID,
            weight: 50000          // 5x per operator hat
        }
    ]
};

const poolParams = {
    cvParams: { maxRatio: 2000, weight: 5000, decay: 9990000, minThresholdPoints: 1000 },
    proposalType: "Signaling",
    pointSystem: "Fixed",           // All NFT holders get power from registry
    registryCommunity: COMMUNITY_ADDRESS,
    powerRegistry: nftPowerRegistryAddress,  // NEW
    // No staking, no superfluid
};
```

### Example 2: Hybrid Pool (Balance + NFT Boost)

```javascript
// ERC-20 balance for base power, NFT for boost
const hybridRegistry = {
    powerSources: [
        {
            token: GARDEN_TOKEN,
            nftType: "ERC721",       // Actually reading ERC20 balanceOf
            weight: 10000            // 1x per token
        },
        {
            token: IMPACT_BADGE_NFT,
            nftType: "ERC721",
            weight: 50000            // 5x per impact badge
        }
    ]
};
```

### Example 3: Streaming + NFT Pool

```javascript
// Superfluid streaming proposals funded by conviction from NFT holders
const streamingNFTPool = {
    proposalType: "Streaming",
    powerRegistry: nftPowerRegistryAddress,
    superfluidToken: USDCx_ADDRESS,
    streamingRatePerSecond: ethers.parseEther("0.001"),
    // Members vote with NFT power, winning proposals receive streams
};
```

---

## 5. Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

**Goal**: NFT power registry + balance-based power + optional staking

| Task | File(s) | Description |
|------|---------|-------------|
| 1.1 | `IPowerRegistry.sol` (NEW) | Define power registry interface |
| 1.2 | `NFTPowerRegistry.sol` (NEW) | Implement NFT/Hats power source |
| 1.3 | `ICVStrategy.sol` | Add `Balance` to `PointSystem` enum, add `V0_4` init params |
| 1.4 | `CVStrategyBaseFacet.sol` | Add `powerRegistry` storage slot (consume 1 __gap slot) |
| 1.5 | `CVStrategyDiamondInit.sol` | Initialize `powerRegistry` from V0_4 params |
| 1.6 | `CommunityMemberFacet.sol` | Add `registerMember()` (no staking) |
| 1.7 | Unit tests | `NFTPowerRegistry.t.sol`, `CVPowerFacet.t.sol` updates |

### Phase 2: Sync Power + Delegation (Week 3-4)

**Goal**: Real-time conviction updates on NFT changes + delegation

| Task | File(s) | Description |
|------|---------|-------------|
| 2.1 | `CVSyncPowerFacet.sol` (NEW) | Implement `syncPower()` and `batchSyncPower()` |
| 2.2 | `CVPowerFacet.sol` | Add `convictionDelegates` mapping + `setConvictionDelegate()` |
| 2.3 | `CVPowerFacet.sol` | Modify `activatePoints()` to use `powerRegistry` |
| 2.4 | `CVPowerFacet.sol` | Modify `increasePower()`/`decreasePower()` for NFT path |
| 2.5 | `CommunityPowerFacet.sol` | Add `getMemberBalancePower()` for balance-based weight |
| 2.6 | Integration tests | `CVSyncPowerFacet.t.sol`, delegation tests |

### Phase 3: Green Goods Integration (Week 5-6)

**Goal**: Connect Hats module to sync power + UX multicall

| Task | File(s) | Description |
|------|---------|-------------|
| 3.1 | `HatsModule.sol` (Green Goods) | Add `_syncConvictionPower()` callback on hat revocation |
| 3.2 | `IGardenHatsModule.sol` | Add sync power interface |
| 3.3 | Multicall helper | Create batch join+activate helper for frontend |
| 3.4 | `CVAdminFacet.sol` | Add `setPoolParams()` update for powerRegistry |
| 3.5 | Diamond cut scripts | Script to add `CVSyncPowerFacet` to existing strategies |
| 3.6 | E2E tests | Full flow: mint hat → vote → revoke hat → conviction updated |

### Phase 4: Testing & Deployment (Week 7-8)

**Goal**: Deploy to Sepolia, upgrade test community

| Task | Description |
|------|-------------|
| 4.1 | Fuzz tests for power calculations (overflow, edge cases) |
| 4.2 | Gas benchmarking (syncPower with N proposals) |
| 4.3 | Deploy NFTPowerRegistry to Base Sepolia |
| 4.4 | Upgrade Green Pill test community with new facets |
| 4.5 | Frontend integration (shared hooks for NFT power display) |
| 4.6 | Corantin review of all contract changes before mainnet |

---

## 6. Security Considerations

### 6.1 Authorized Sync Callers

Only whitelisted addresses (Hats modules) can call `syncPower()`. Set by council safe.

### 6.2 Flash Loan Protection

NFT-based power reads `balanceOf()` at call time. For ERC721, flash loans are impractical (non-fungible). For ERC20 balance mode, consider a snapshot mechanism:

```solidity
// Option: Use block.number - 1 for power snapshots
// This prevents same-block manipulation
function getMemberPower(address _member, address _strategy) external view returns (uint256) {
    // For ERC20 balance mode, could use checkpoints (ERC20Votes)
    // For NFT/Hat mode, flash loans are not a concern
}
```

### 6.3 Reentrancy

`syncPower()` modifies state (proposals, totalPointsActivated) and calls external contracts (powerRegistry). Use checks-effects-interactions pattern. All state updates happen before any external calls.

### 6.4 Storage Slot Safety

New `powerRegistry` slot at position 132 uses the first __gap slot. Remaining gap: 46 slots. No collision with existing storage.

### 6.5 Diamond Cut Safety

Adding `CVSyncPowerFacet` is a non-breaking `FacetCutAction.Add` — no existing selectors are replaced. Existing facets continue to work unchanged. Can be tested via the `UpgradeAllDiamonds.s.sol` pattern.

---

## 7. UX Simplifications (From Meeting)

### 7.1 "Gardens Light" — Single Transaction Voting

```
User receives link → Opens pool → System checks NFT/token balance → Vote in 1 tx
```

Implementation:
1. Frontend detects if user is registered in community
2. If not, multicall: `registerMember()` + `activatePoints()` + `allocate(support)`
3. If already registered, just `allocate(support)`

### 7.2 No Covenant, No Staking by Default

Pool creation UI removes:
- Covenant text field (optional/hidden)
- Staking amount field (optional/hidden, only for `PointSystem.Unlimited/Capped/Quadratic`)
- Shows "NFT Power" toggle that enables `powerRegistry` configuration

### 7.3 Balance-Based Weight Display

Frontend shows: "Your voting power: X" derived from:
- NFT count × weight for NFT pools
- Token balance for balance-based pools
- No "staked amount" UI for NFT pools

---

## 8. References

### Source Code (streaming-pool branch)

| File | Path | Purpose |
|------|------|---------|
| CVPowerFacet | `pkg/contracts/src/CVStrategy/facets/CVPowerFacet.sol` | Power management (modify) |
| CVStrategyBaseFacet | `pkg/contracts/src/CVStrategy/CVStrategyBaseFacet.sol` | Storage layout (extend) |
| ICVStrategy | `pkg/contracts/src/CVStrategy/ICVStrategy.sol` | Structs/enums (extend) |
| PowerManagementUtils | `pkg/contracts/src/CVStrategy/PowerManagementUtils.sol` | Point calculations (extend) |
| CommunityPowerFacet | `pkg/contracts/src/RegistryCommunity/facets/CommunityPowerFacet.sol` | Community power (modify) |
| CommunityMemberFacet | `pkg/contracts/src/RegistryCommunity/facets/CommunityMemberFacet.sol` | Membership (modify) |
| CVStreamingFacet | `pkg/contracts/src/CVStrategy/facets/CVStreamingFacet.sol` | Streaming rebalance (context) |
| CVStreamingStorage | `pkg/contracts/src/CVStrategy/CVStreamingStorage.sol` | Namespaced storage pattern |

### Green Goods Integration Points

| File | Path | Purpose |
|------|------|---------|
| HatsModule | `packages/contracts/src/modules/Hats.sol` | Add sync callback |
| IGardenHatsModule | `packages/contracts/src/interfaces/IGardenHatsModule.sol` | Add sync interface |

### Standards & Docs

- [EIP-2535: Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [Gardens V2 Docs](https://docs.gardens.fund/)
- [Conviction 101](https://docs.gardens.fund/conviction-voting/conviction-101)
- [Hats Protocol Docs](https://docs.hatsprotocol.xyz/)

---

## 9. Open Questions for Corantin

These need resolution before coding begins:

1. **Storage slot for powerRegistry**: Confirm slot 132 (first __gap slot) is safe. Any planned additions to the streaming branch that would conflict?

2. **PointSystem.Balance enum**: Adding a 5th enum value — does this break existing deployed strategies that use the current enum?

3. **CommunityPowerFacet changes**: Should `getMemberPowerInStrategy()` automatically fallback to `balanceOf()` when `stakedAmount == 0`? Or keep it explicit?

4. **Diamond cut ordering**: When upgrading an existing community, should `CVSyncPowerFacet` be added before or after modifying `CVPowerFacet`? (Order matters for storage consistency.)

5. **NFTPowerRegistry deployment**: Should it be deployed once per chain (shared) or once per pool (isolated)? Shared is gas-efficient but less flexible.

6. **Governance token optionality**: For pools with `powerRegistry` set, should `registryCommunity.gardenToken()` still be required? Meeting suggested it could be purely NFT-based.
