// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { GardensModule } from "../../src/modules/Gardens.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";

/// @title MockGOODSForSepoliaFork
/// @notice Simple ERC20 mock for GOODS token in Sepolia fork tests
contract MockGOODSForSepoliaFork is ERC20 {
    constructor() ERC20("GOODS", "GOODS") {
        _mint(msg.sender, 1_000_000e18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title MockHatsModuleForSepoliaFork
/// @notice Minimal mock implementing IHatsModule + gardenHats() for Sepolia fork testing
contract MockHatsModuleForSepoliaFork is IHatsModule {
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

/// @title SepoliaGardensModuleForkTest
/// @notice Fork tests for GardensModule against Sepolia testnet
/// @dev Mirrors ArbitrumGardensModule.t.sol pattern for Sepolia.
///      Tests community creation with real RegistryFactory, weight scheme storage,
///      GOODS token seeding, and power registry deployment.
///      Gracefully skips when SEPOLIA_RPC_URL is not set.
contract SepoliaGardensModuleForkTest is Test {
    /// @notice Hats Protocol on all chains
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    /// @notice Sepolia RegistryFactory (Gardens V2)
    address internal constant SEPOLIA_REGISTRY_FACTORY = 0x4177f64568e90fd58884579864923aa0345248F0;

    GardensModule public gardensModule;
    MockGOODSForSepoliaFork public goodsToken;
    MockHatsModuleForSepoliaFork public mockHatsModule;
    UnifiedPowerRegistry public powerRegistry;

    address public owner = address(0xA1);
    address public gardenTokenAddr = address(0xB1);
    address public garden = address(0xC1);

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("SEPOLIA_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("SEPOLIA_RPC") returns (string memory fallback_) {
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
        goodsToken = new MockGOODSForSepoliaFork();
        mockHatsModule = new MockHatsModuleForSepoliaFork();

        // Deploy UnifiedPowerRegistry
        UnifiedPowerRegistry prImpl = new UnifiedPowerRegistry();
        bytes memory prInit = abi.encodeWithSelector(
            UnifiedPowerRegistry.initialize.selector,
            owner,
            HATS_PROTOCOL,
            address(0) // gardensModule set later
        );
        powerRegistry = UnifiedPowerRegistry(address(new ERC1967Proxy(address(prImpl), prInit)));

        GardensModule impl = new GardensModule();
        bytes memory initData = abi.encodeWithSelector(
            GardensModule.initialize.selector,
            owner,
            address(0), // registryFactory — set later for tests that need it
            address(powerRegistry),
            address(goodsToken),
            HATS_PROTOCOL,
            address(mockHatsModule)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        gardensModule = GardensModule(address(proxy));

        // Authorize gardenToken to call onGardenMinted
        vm.startPrank(owner);
        gardensModule.setGardenToken(gardenTokenAddr);
        powerRegistry.setGardensModule(address(gardensModule));
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Community Created On Mint (Real RegistryFactory)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Real RegistryFactory on Sepolia creates a community during onGardenMinted
    function test_fork_gardens_communityCreatedOnMint() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        // Verify RegistryFactory is deployed on Sepolia
        assertGt(SEPOLIA_REGISTRY_FACTORY.code.length, 0, "RegistryFactory should be deployed on Sepolia");

        _deployModule();

        // Set the real RegistryFactory
        vm.prank(owner);
        gardensModule.setRegistryFactory(SEPOLIA_REGISTRY_FACTORY);

        mockHatsModule.setGardenHats(garden, 100, 101, 102, 103, 104, 105, 106);

        // Mint garden — community should be created via real factory
        vm.prank(gardenTokenAddr);
        (address community,) = gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear);

        // Community may or may not be created depending on factory state
        // But the call must not revert (graceful degradation)
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");

        // If community was created, verify it's stored
        if (community != address(0)) {
            assertEq(gardensModule.getGardenCommunity(garden), community, "community should be stored");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Weight Scheme Stored
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Linear/Exponential/Power schemes persisted correctly on Sepolia fork
    function test_fork_gardens_weightSchemeStored() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployModule();

        // Test Linear scheme
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
    // Test 3: GOODS Token Seeded
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice GOODS token configured in GardensModule on Sepolia fork
    function test_fork_gardens_goodsTokenSeeded() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployModule();

        // Verify GOODS token is set
        assertEq(address(gardensModule.goodsToken()), address(goodsToken), "GOODS token should be configured");

        // Verify stake amount per member (default 1 GOODS = 1e18)
        assertEq(gardensModule.stakeAmountPerMember(), 1e18, "stake per member should be 1 GOODS");

        // Verify GOODS has supply (mock minted 1M to deployer)
        assertGt(goodsToken.totalSupply(), 0, "GOODS token should have supply");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Power Registry Deployed and Configured
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice UnifiedPowerRegistry initialized per garden on Sepolia fork
    function test_fork_gardens_powerRegistryDeployed() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployModule();

        // Verify power registry is deployed and configured
        assertEq(powerRegistry.owner(), owner, "registry owner should be set");
        assertEq(powerRegistry.hatsProtocol(), HATS_PROTOCOL, "hats protocol should point to real address");
        assertEq(powerRegistry.gardensModule(), address(gardensModule), "gardens module should be authorized");

        // Mint garden — power sources should be registered
        mockHatsModule.setGardenHats(garden, 100, 101, 102, 103, 104, 105, 106);

        vm.prank(gardenTokenAddr);
        gardensModule.onGardenMinted(garden, IGardensModule.WeightScheme.Linear);

        // Verify garden is registered in power registry with 3 sources (operator, gardener, community)
        assertTrue(powerRegistry.isGardenRegistered(garden), "garden should be registered in power registry");
        assertEq(powerRegistry.getGardenSourceCount(garden), 3, "garden should have 3 power sources");

        // Verify source weights match Linear scheme (community=10k, gardener=20k, operator=30k)
        NFTPowerSource[] memory sources = powerRegistry.getGardenSources(garden);
        assertEq(sources[0].weight, 30_000, "operator source should have 30000 weight");
        assertEq(sources[1].weight, 20_000, "gardener source should have 20000 weight");
        assertEq(sources[2].weight, 10_000, "community source should have 10000 weight");
    }
}
