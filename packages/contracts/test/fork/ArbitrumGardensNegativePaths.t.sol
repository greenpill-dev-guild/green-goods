// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { GardensModule } from "../../src/modules/Gardens.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IRegistryFactory, RegistryCommunityInitializeParamsV2, Metadata } from "../../src/interfaces/IGardensV2.sol";
import { GardensV2Addresses } from "./helpers/GardensV2Addresses.sol";

/// @title MockGOODSForNegative
/// @notice Simple ERC20 mock for GOODS token
contract MockGOODSForNegative is ERC20 {
    constructor() ERC20("GOODS", "GOODS") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockHatsModuleForNegative
/// @notice Minimal mock implementing IHatsModule for fork testing
contract MockHatsModuleForNegative is IHatsModule {
    struct GardenHats {
        uint256 ownerHatId;
        uint256 operatorHatId;
        uint256 evaluatorHatId;
        uint256 gardenerHatId;
        uint256 funderHatId;
        uint256 communityHatId;
        uint256 adminHatId;
        bool configured;
    }

    mapping(address garden => GardenHats config) public gardenHats;
    mapping(address garden => mapping(address account => bool isOp)) public operators;

    function setGardenHats(
        address garden,
        uint256 ownerHatId,
        uint256 operatorHatId,
        uint256 evaluatorHatId,
        uint256 gardenerHatId,
        uint256 funderHatId,
        uint256 communityHatId,
        uint256 adminHatId
    )
        external
    {
        gardenHats[garden] = GardenHats({
            ownerHatId: ownerHatId,
            operatorHatId: operatorHatId,
            evaluatorHatId: evaluatorHatId,
            gardenerHatId: gardenerHatId,
            funderHatId: funderHatId,
            communityHatId: communityHatId,
            adminHatId: adminHatId,
            configured: true
        });
    }

    function setOperator(address garden, address account, bool value) external {
        operators[garden][account] = value;
    }

    // ═══ IHatsModule stubs ═══
    function createGardenHatTree(address, string calldata, address) external pure returns (uint256) {
        return 1;
    }

    function grantRole(address, address, GardenRole) external { }
    function revokeRole(address, address, GardenRole) external { }
    function grantRoles(address, address[] calldata, GardenRole[] calldata) external { }
    function revokeRoles(address, address[] calldata, GardenRole[] calldata) external { }
    function setConvictionStrategies(address, address[] calldata) external { }

    function getConvictionStrategies(address) external pure returns (address[] memory) {
        return new address[](0);
    }

    function isGardenerOf(address, address) external pure returns (bool) {
        return false;
    }

    function isEvaluatorOf(address, address) external pure returns (bool) {
        return false;
    }

    function isOperatorOf(address garden, address account) external view returns (bool) {
        return operators[garden][account];
    }

    function isOwnerOf(address, address) external pure returns (bool) {
        return false;
    }

    function isFunderOf(address, address) external pure returns (bool) {
        return false;
    }

    function isCommunityOf(address, address) external pure returns (bool) {
        return false;
    }

    function getGardenHatIds(address garden)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)
    {
        GardenHats storage config = gardenHats[garden];
        return (
            config.ownerHatId,
            config.operatorHatId,
            config.evaluatorHatId,
            config.gardenerHatId,
            config.funderHatId,
            config.communityHatId,
            config.adminHatId,
            config.configured
        );
    }
}

/// @title ArbitrumGardensNegativePathsForkTest
/// @notice Fork tests for GardensModule negative/error paths against Arbitrum mainnet.
/// @dev Standalone test (like ArbitrumGardensModule.t.sol). Tests error paths for:
/// 1. RegistryFactory rejecting invalid params
/// 2. Power registration assertions with zero hat IDs
/// 3. Pool creation with invalid strategy revert
/// Gracefully skips when ARBITRUM_RPC_URL is not set.
contract ArbitrumGardensNegativePathsForkTest is Test {
    /// @notice Hats Protocol on all chains
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    GardensModule public gardensModule;
    MockGOODSForNegative public goodsToken;
    MockHatsModuleForNegative public mockHatsModule;

    address public owner = address(0xA1);
    address public gardenTokenAddr = address(0xB1);
    address public garden = address(0xC1);
    address public operator = address(0xD1);

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Deploy helper
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy GardensModule with the real Arbitrum RegistryFactory address
    function _deployModuleWithRealFactory() internal {
        goodsToken = new MockGOODSForNegative();
        mockHatsModule = new MockHatsModuleForNegative();

        address realFactory = GardensV2Addresses.getRegistryFactory(block.chainid);

        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            realFactory, // Real RegistryFactory on Arbitrum
            address(0), // powerRegistry — not deployed yet
            address(goodsToken),
            HATS_PROTOCOL,
            address(mockHatsModule)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        gardensModule = GardensModule(address(proxy));

        // Authorize gardenToken
        vm.prank(owner);
        gardensModule.setGardenToken(gardenTokenAddr);

        // Set up operator
        mockHatsModule.setOperator(garden, operator, true);
    }

    /// @notice Deploy module with zero registryFactory (for power registration tests)
    function _deployModuleWithoutFactory() internal {
        goodsToken = new MockGOODSForNegative();
        mockHatsModule = new MockHatsModuleForNegative();

        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // No registryFactory
            address(0), // No powerRegistry
            address(goodsToken),
            HATS_PROTOCOL,
            address(mockHatsModule)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        gardensModule = GardensModule(address(proxy));

        vm.prank(owner);
        gardensModule.setGardenToken(gardenTokenAddr);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: RegistryFactory Rejects Invalid Params
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When onGardenMinted calls the real RegistryFactory with invalid params
    ///         (e.g., zero gardenToken in community creation), the factory call reverts but
    ///         GardensModule's try/catch handles it gracefully — garden still initializes
    ///         with partial state and emits CommunityCreationFailed.
    function testForkArbitrum_gardens_registryFactoryRejectsInvalidParams() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        // Verify real RegistryFactory is deployed
        address realFactory = GardensV2Addresses.getRegistryFactory(block.chainid);
        if (realFactory == address(0) || realFactory.code.length == 0) {
            emit log("SKIPPED: RegistryFactory not deployed on this fork chain");
            return;
        }

        _deployModuleWithRealFactory();

        // Set GOODS token to address(0) — this will cause the real RegistryFactory to
        // reject the createRegistry call (it requires a valid gardenToken/staking token)
        vm.prank(owner);
        gardensModule.setGoodsToken(address(1)); // Non-zero but non-contract address

        // Set up hat IDs for the garden
        mockHatsModule.setGardenHats(garden, 100, 101, 102, 103, 104, 105, 106);

        // onGardenMinted should NOT revert — the try/catch in _createCommunity catches the factory error
        vm.prank(gardenTokenAddr);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear);

        // Garden should be initialized (state persisted)
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized despite factory rejection");

        // Community should be zero (factory call failed gracefully)
        assertEq(community, address(0), "community should be zero when factory rejects params");

        // Pools should be empty (no community => no pools)
        assertEq(pools.length, 0, "pools should be empty when community creation fails");

        // Weight scheme should still be stored
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "weight scheme should be stored despite factory failure"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Power Registration With Zero Hat IDs
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice When onGardenMinted runs with hat IDs set to zero (unconfigured garden),
    ///         _registerGardenPower should gracefully skip registration and emit
    ///         CommunityCreationFailed. The garden should still initialize.
    function testForkArbitrum_gardens_powerRegistrationAsserted() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModuleWithoutFactory();

        // DO NOT set garden hat IDs — they remain at zero (default)
        // _registerGardenPower should detect zero hat IDs and return false early

        vm.prank(gardenTokenAddr);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Exponential);

        // Garden should still be initialized
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized with zero hat IDs");

        // Weight scheme should be stored
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "weight scheme should be stored with zero hat IDs"
        );

        // Community and pools empty (no factory, and power registration skipped)
        assertEq(community, address(0), "community should be zero without factory");
        assertEq(pools.length, 0, "pools should be empty without factory");

        // Power registry should return zero (not registered)
        assertEq(
            gardensModule.getGardenPowerRegistry(garden),
            address(0),
            "power registry should be zero for unconfigured garden"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Pool Creation With Invalid Strategy Reverts Gracefully
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The attemptPoolCreation external function (self-call pattern) should revert
    ///         when called by anyone other than the GardensModule itself.
    ///         Also tests that createGardenPools reverts for an uninitialized garden.
    function testForkArbitrum_gardens_poolCreationWithInvalidStrategy_reverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModuleWithRealFactory();
        mockHatsModule.setGardenHats(garden, 100, 101, 102, 103, 104, 105, 106);

        // Test 1: attemptPoolCreation called by external address should revert with OnlySelfCall
        vm.expectRevert(GardensModule.OnlySelfCall.selector);
        gardensModule.attemptPoolCreation(garden, address(0xDEAD), address(0));

        // Test 2: createGardenPools on uninitialized garden should revert
        address uninitGarden = address(0xF00D);
        mockHatsModule.setOperator(uninitGarden, operator, true);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenNotInitialized.selector, uninitGarden));
        gardensModule.createGardenPools(uninitGarden);

        // Test 3: Initialize garden, then try createGardenPools without community (should revert ZeroAddress)
        vm.prank(gardenTokenAddr);
        gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear);

        // Garden is initialized but community may be zero if factory failed
        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            // createGardenPools should revert with ZeroAddress because community is not set
            vm.prank(operator);
            vm.expectRevert(GardensModule.ZeroAddress.selector);
            gardensModule.createGardenPools(garden);
        }
    }
}
