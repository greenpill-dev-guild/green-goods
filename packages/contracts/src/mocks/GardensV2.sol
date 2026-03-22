// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {
    IRegistryFactory,
    IRegistryCommunity,
    IUnifiedPowerRegistry,
    RegistryCommunityInitializeParamsV2,
    CVStrategyInitializeParamsV0_3,
    CVParams,
    PointSystem,
    Metadata,
    NFTPowerSource
} from "../interfaces/IGardensV2.sol";
import { IVotingPowerRegistry } from "../vendor/gardens/IVotingPowerRegistry.sol";
import { MockCVStrategy } from "./CVStrategy.sol";

error CommunityFunctionDoesNotExist(bytes4 selector);

/// @title MockUnifiedPowerRegistry
/// @notice Mock unified power registry for testing
contract MockUnifiedPowerRegistry is IUnifiedPowerRegistry, IVotingPowerRegistry {
    mapping(address garden => NFTPowerSource[] sources) internal _gardenSources;
    mapping(address pool => address garden) public poolGarden;
    mapping(address member => uint256 power) public mockPower;

    function registerGarden(address garden, NFTPowerSource[] calldata sources) external override {
        require(_gardenSources[garden].length == 0, "Garden already registered");
        for (uint256 i = 0; i < sources.length; i++) {
            _gardenSources[garden].push(sources[i]);
        }
    }

    function registerPool(address pool, address garden) external override {
        require(poolGarden[pool] == address(0), "Pool already registered");
        poolGarden[pool] = garden;
    }

    function getGardenSources(address garden) external view override returns (NFTPowerSource[] memory) {
        return _gardenSources[garden];
    }

    function getGardenSourceCount(address garden) external view override returns (uint256) {
        return _gardenSources[garden].length;
    }

    function getPoolGarden(address pool) external view override returns (address) {
        return poolGarden[pool];
    }

    function isGardenRegistered(address garden) external view override returns (bool) {
        return _gardenSources[garden].length > 0;
    }

    // IVotingPowerRegistry implementation
    function getMemberPowerInStrategy(address member, address /* strategy */ ) external view override returns (uint256) {
        return mockPower[member];
    }

    function getMemberStakedAmount(address /* member */ ) external pure override returns (uint256) {
        return 0;
    }

    function ercAddress() external pure override returns (address) {
        return address(0);
    }

    function isMember(address member) external view override returns (bool) {
        return mockPower[member] > 0;
    }

    function deregisterGarden(address garden, address[] calldata pools) external override {
        delete _gardenSources[garden];
        for (uint256 i = 0; i < pools.length; i++) {
            delete poolGarden[pools[i]];
        }
    }

    // Test helpers
    function setMockPower(address member, uint256 power) external {
        mockPower[member] = power;
    }
}

/// @title MockRegistryCommunity
/// @notice Mock RegistryCommunity for testing pool creation
contract MockRegistryCommunity is IRegistryCommunity {
    address public override gardenToken;
    address public override councilSafe;

    struct PoolRecord {
        uint256 poolId;
        address strategy;
        PointSystem pointSystem;
        address votingPowerRegistry;
        string metadata;
    }

    PoolRecord[] public pools;
    uint256 private nextPoolId = 1;

    /// @notice When true, createPool will revert (for testing failure scenarios)
    bool public shouldRevertPoolCreation;
    bool public disableAddressMembership;
    address public requiredPoolMember;

    constructor(address _gardenToken, address _councilSafe) {
        gardenToken = _gardenToken;
        councilSafe = _councilSafe;
    }

    /// @notice Toggle pool creation failure mode
    function setShouldRevertPoolCreation(bool _shouldRevert) external {
        shouldRevertPoolCreation = _shouldRevert;
    }

    function setDisableAddressMembership(bool disabled) external {
        disableAddressMembership = disabled;
    }

    function setRequiredPoolMember(address member) external {
        requiredPoolMember = member;
    }

    /// @notice 3-arg createPool matching real CommunityPoolFacet signature
    function createPool(
        address, /* _token */
        CVStrategyInitializeParamsV0_3 memory _params,
        Metadata memory _metadata
    )
        external
        override
        returns (uint256 poolId, address strategy)
    {
        if (shouldRevertPoolCreation) revert("Pool creation disabled");
        if (requiredPoolMember != address(0) && !registeredMembers[requiredPoolMember]) {
            revert("Required pool member missing");
        }

        poolId = nextPoolId++;

        // Deploy a real MockCVStrategy so pools have code (required by HatsModule.setConvictionStrategies)
        MockCVStrategy strat = new MockCVStrategy(
            _params.votingPowerRegistry,
            address(this),
            _params.cvParams.decay,
            _params.cvParams.maxRatio,
            _params.cvParams.weight,
            _params.cvParams.minThresholdPoints
        );
        strategy = address(strat);

        pools.push(
            PoolRecord({
                poolId: poolId,
                strategy: strategy,
                pointSystem: _params.pointSystem,
                votingPowerRegistry: _params.votingPowerRegistry,
                metadata: _metadata.pointer
            })
        );
    }

    /// @notice Mock stakeAndRegisterMember — records registration for testing
    mapping(address => bool) public registeredMembers;

    function stakeAndRegisterMember(address member) external override {
        if (disableAddressMembership) {
            revert CommunityFunctionDoesNotExist(bytes4(keccak256("stakeAndRegisterMember(address)")));
        }
        registeredMembers[member] = true;
    }

    function stakeAndRegisterMember(string calldata) external override {
        registeredMembers[msg.sender] = true;
    }

    function isRegisteredMember(address member) external view returns (bool) {
        return registeredMembers[member];
    }

    function getPoolCount() external view returns (uint256) {
        return pools.length;
    }

    function getPool(uint256 index)
        external
        view
        returns (uint256 poolId, address strategy, PointSystem pointSystem, address votingPowerRegistry)
    {
        PoolRecord storage p = pools[index];
        return (p.poolId, p.strategy, p.pointSystem, p.votingPowerRegistry);
    }
}

/// @title MockRegistryFactory
/// @notice Mock RegistryFactory for testing community creation
contract MockRegistryFactory is IRegistryFactory {
    address[] public createdCommunities;
    MockRegistryCommunity public lastCreated;

    /// @notice When true, newly created communities will revert on createPool
    bool public createFailingCommunities;

    /// @notice Toggle whether new communities should fail on pool creation
    function setCreateFailingCommunities(bool _shouldFail) external {
        createFailingCommunities = _shouldFail;
    }

    function createRegistry(RegistryCommunityInitializeParamsV2 memory params)
        external
        override
        returns (address community)
    {
        MockRegistryCommunity mock = new MockRegistryCommunity(params._gardenToken, params._councilSafe);
        if (createFailingCommunities) {
            mock.setShouldRevertPoolCreation(true);
        }
        community = address(mock);
        lastCreated = mock;
        createdCommunities.push(community);
    }

    function getCreatedCount() external view returns (uint256) {
        return createdCommunities.length;
    }

    function getCreatedCommunity(uint256 index) external view returns (address) {
        return createdCommunities[index];
    }
}
