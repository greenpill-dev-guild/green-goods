// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {
    IRegistryFactory,
    IRegistryCommunity,
    INFTPowerRegistry,
    INFTPowerRegistryFactory,
    NFTPowerSource
} from "../interfaces/IGardensV2.sol";

/// @title MockNFTPowerRegistry
/// @notice Mock NFTPowerRegistry for testing
contract MockNFTPowerRegistry is INFTPowerRegistry {
    NFTPowerSource[] public sources;
    mapping(address member => uint256 power) public mockPower;

    constructor(NFTPowerSource[] memory _sources) {
        for (uint256 i = 0; i < _sources.length; i++) {
            sources.push(_sources[i]);
        }
    }

    function getVotingPower(address member) external view override returns (uint256) {
        return mockPower[member];
    }

    function getSourceCount() external view override returns (uint256) {
        return sources.length;
    }

    function setMockPower(address member, uint256 power) external {
        mockPower[member] = power;
    }

    function getSource(uint256 index) external view returns (NFTPowerSource memory) {
        return sources[index];
    }
}

/// @title MockNFTPowerRegistryFactory
/// @notice Mock factory for deploying NFTPowerRegistry instances
contract MockNFTPowerRegistryFactory is INFTPowerRegistryFactory {
    address[] public deployedRegistries;

    function deploy(NFTPowerSource[] calldata _sources) external override returns (address registry) {
        // Convert calldata to memory for constructor
        NFTPowerSource[] memory memSources = new NFTPowerSource[](_sources.length);
        for (uint256 i = 0; i < _sources.length; i++) {
            memSources[i] = _sources[i];
        }
        MockNFTPowerRegistry mock = new MockNFTPowerRegistry(memSources);
        registry = address(mock);
        deployedRegistries.push(registry);
    }

    function getDeployedCount() external view returns (uint256) {
        return deployedRegistries.length;
    }

    function getDeployedRegistry(uint256 index) external view returns (address) {
        return deployedRegistries[index];
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

    constructor(address _gardenToken, address _councilSafe) {
        gardenToken = _gardenToken;
        councilSafe = _councilSafe;
    }

    function createPool(CreatePoolParams calldata params) external override returns (uint256 poolId, address strategy) {
        poolId = nextPoolId++;

        // Deploy a dummy strategy address (unique per pool)
        strategy = address(uint160(uint256(keccak256(abi.encodePacked(poolId, block.timestamp, msg.sender)))));

        pools.push(
            PoolRecord({
                poolId: poolId,
                strategy: strategy,
                pointSystem: params.pointSystem,
                votingPowerRegistry: params.votingPowerRegistry,
                metadata: params.metadata
            })
        );
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

    function createRegistryCommunity(CreateCommunityParams calldata params) external override returns (address community) {
        MockRegistryCommunity mock = new MockRegistryCommunity(params.gardenToken, params.councilSafe);
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
