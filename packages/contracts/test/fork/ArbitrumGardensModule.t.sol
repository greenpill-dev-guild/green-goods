// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { GardensModule } from "../../src/modules/Gardens.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IHats } from "../../src/interfaces/IHats.sol";

/// @title MockGOODSForFork
/// @notice Simple ERC20 mock for GOODS token in fork tests
contract MockGOODSForFork is ERC20 {
    constructor() ERC20("GOODS", "GOODS") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockHatsModuleForFork
/// @notice Minimal mock implementing IHatsModule + gardenHats() for fork testing
contract MockHatsModuleForFork is IHatsModule {
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

    function isOperatorOf(address, address) external pure returns (bool) {
        return false;
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

/// @title ArbitrumGardensModuleForkTest
/// @notice Fork tests for GardensModule against Arbitrum mainnet
/// @dev Gracefully skips when ARBITRUM_RPC_URL is not set
contract ArbitrumGardensModuleForkTest is Test {
    /// @notice Hats Protocol on all chains
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    GardensModule public gardensModule;
    MockGOODSForFork public goodsToken;
    MockHatsModuleForFork public mockHatsModule;

    address public owner = address(0xA1);
    address public gardenTokenAddr = address(0xB1);
    address public garden = address(0xC1);

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
    // Deploy helper (call after fork is active)
    // ═══════════════════════════════════════════════════════════════════════════

    function _deployModule() internal {
        goodsToken = new MockGOODSForFork();
        mockHatsModule = new MockHatsModuleForFork();

        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // registryFactory — not deployed on mainnet Arbitrum yet
            address(0), // powerRegistry — not deployed yet
            address(goodsToken),
            HATS_PROTOCOL,
            address(mockHatsModule)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        gardensModule = GardensModule(address(proxy));

        // Authorize gardenToken to call onGardenMinted
        vm.prank(owner);
        gardensModule.setGardenToken(gardenTokenAddr);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Deploy and verify initialization with real Hats Protocol
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_initializesWithRealHatsProtocol() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        // Verify Hats Protocol is deployed at the expected address
        assertGt(HATS_PROTOCOL.code.length, 0, "Hats Protocol should be deployed on Arbitrum");

        _deployModule();

        assertEq(gardensModule.owner(), owner, "owner should be set");
        assertEq(gardensModule.hatsProtocol(), HATS_PROTOCOL, "hats protocol should point to real address");
        assertEq(gardensModule.gardenToken(), gardenTokenAddr, "garden token should be authorized");
        assertEq(address(gardensModule.goodsToken()), address(goodsToken), "GOODS token should be set");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real Hats Protocol responds to queries
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_hatsProtocolIsQueryable() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();

        IHats hats = IHats(HATS_PROTOCOL);

        // Hats Protocol should report level 0 for a top hat (hat ID with only domain bits set)
        // Top hat for domain 1 = 0x0001000000000000000000000000000000000000000000000000000000000000
        uint256 topHatDomain1 = 1 << 224;
        uint32 level = hats.getHatLevel(topHatDomain1);
        assertEq(level, 0, "top hat should be level 0");

        // An invalid hat should return false for isActive
        bool active = hats.isActive(0);
        assertFalse(active, "hat 0 should not be active");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Weight scheme resolution (Linear, Exponential, Power)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_weightSchemesResolveCorrectly() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();

        // Set up mock hat IDs for the garden
        mockHatsModule.setGardenHats(
            garden,
            100, // ownerHatId
            101, // operatorHatId
            102, // evaluatorHatId
            103, // gardenerHatId
            104, // funderHatId
            105, // communityHatId
            106 // adminHatId
        );

        // Test Linear scheme via onGardenMinted — stores the weight scheme
        address linearGarden = address(0xC100);
        mockHatsModule.setGardenHats(linearGarden, 100, 101, 102, 103, 104, 105, 106);

        vm.prank(gardenTokenAddr);
        gardensModule.onGardenMinted(linearGarden, IGardensModule.WeightScheme.Linear);

        assertEq(
            uint256(gardensModule.getGardenWeightScheme(linearGarden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Linear weight scheme should be stored"
        );
        assertTrue(gardensModule.isGardenInitialized(linearGarden), "garden should be initialized");

        // Test Exponential scheme
        address expGarden = address(0xC200);
        mockHatsModule.setGardenHats(expGarden, 200, 201, 202, 203, 204, 205, 206);

        vm.prank(gardenTokenAddr);
        gardensModule.onGardenMinted(expGarden, IGardensModule.WeightScheme.Exponential);

        assertEq(
            uint256(gardensModule.getGardenWeightScheme(expGarden)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "Exponential weight scheme should be stored"
        );

        // Test Power scheme
        address powerGarden = address(0xC300);
        mockHatsModule.setGardenHats(powerGarden, 300, 301, 302, 303, 304, 305, 306);

        vm.prank(gardenTokenAddr);
        gardensModule.onGardenMinted(powerGarden, IGardensModule.WeightScheme.Power);

        assertEq(
            uint256(gardensModule.getGardenWeightScheme(powerGarden)),
            uint256(IGardensModule.WeightScheme.Power),
            "Power weight scheme should be stored"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: onGardenMinted stores state correctly
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_onGardenMintedStoresState() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();

        mockHatsModule.setGardenHats(garden, 100, 101, 102, 103, 104, 105, 106);

        // Before minting
        assertFalse(gardensModule.isGardenInitialized(garden), "garden should not be initialized before mint");
        assertEq(gardensModule.getGardenCommunity(garden), address(0), "community should be zero before mint");
        assertEq(gardensModule.getGardenPowerRegistry(garden), address(0), "registry should be zero before mint");

        // Mint (registryFactory and powerRegistry are address(0), so steps 1-3 gracefully return empty)
        vm.prank(gardenTokenAddr);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear);

        // After minting — state is persisted even though factories are not available
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized after mint");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "weight scheme should be Linear"
        );

        // Community and pools are empty because factories are not set (graceful degradation)
        assertEq(community, address(0), "community should be zero when factory is not set");
        assertEq(pools.length, 0, "pools should be empty when factory is not set");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Unauthorized caller reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_onGardenMintedRevertsForUnauthorized() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();

        address unauthorized = address(0xDEAD);

        vm.prank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.NotGardenToken.selector, unauthorized));
        gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Double initialization reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_onGardenMintedRevertsForDoubleInit() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();
        mockHatsModule.setGardenHats(garden, 100, 101, 102, 103, 104, 105, 106);

        // First mint succeeds
        vm.prank(gardenTokenAddr);
        gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear);

        // Second mint reverts
        vm.prank(gardenTokenAddr);
        vm.expectRevert(abi.encodeWithSelector(GardensModule.GardenAlreadyInitialized.selector, garden));
        gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Exponential);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Graceful degradation when external calls fail
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_gracefulDegradationWithoutFactories() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();
        mockHatsModule.setGardenHats(garden, 100, 101, 102, 103, 104, 105, 106);

        // Module has address(0) for registryFactory and powerRegistry
        // onGardenMinted should NOT revert — it should gracefully skip factory steps
        vm.prank(gardenTokenAddr);
        (address community, address[] memory pools) =
            gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Power);

        // State should still be persisted
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Power),
            "weight scheme should be Power"
        );

        // Factory-dependent results should be gracefully empty
        assertEq(community, address(0), "community should be zero without factory");
        assertEq(pools.length, 0, "pools should be empty without factory");
        assertEq(gardensModule.getGardenPowerRegistry(garden), address(0), "registry should be zero without factory");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Admin setters work correctly on fork
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_adminSettersWorkOnFork() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();

        address newHats = address(0xEE);
        address newRegistryFactory = address(0xFF);
        address newPowerFactory = address(0xDD);
        address newGoodsToken = address(0xCC);

        vm.startPrank(owner);
        gardensModule.setHatsProtocol(newHats);
        gardensModule.setRegistryFactory(newRegistryFactory);
        gardensModule.setPowerRegistry(newPowerFactory);
        gardensModule.setGoodsToken(newGoodsToken);
        vm.stopPrank();

        assertEq(gardensModule.hatsProtocol(), newHats, "hats protocol should be updated");
        assertEq(address(gardensModule.registryFactory()), newRegistryFactory, "registry factory should be updated");
        assertEq(address(gardensModule.powerRegistry()), newPowerFactory, "power registry should be updated");
        assertEq(address(gardensModule.goodsToken()), newGoodsToken, "goods token should be updated");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Constants are correct
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_constantsAreCorrect() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployModule();

        assertEq(gardensModule.DEFAULT_DECAY(), 9_999_799, "default decay should be 9999799");
        assertEq(gardensModule.DEFAULT_MAX_RATIO(), 2_000_000, "default max ratio should be 2000000");
        assertEq(gardensModule.DEFAULT_WEIGHT(), 10_000, "default weight should be 10000");
        assertEq(gardensModule.DEFAULT_MIN_THRESHOLD_POINTS(), 2_500_000, "default min threshold should be 2500000");
        assertEq(gardensModule.stakeAmountPerMember(), 1e18, "stake per member should be 1 GOODS");
        assertEq(gardensModule.D(), 10_000_000, "scaling factor D should be 10000000");
    }
}
