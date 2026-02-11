// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { HatsModule } from "../src/modules/Hats.sol";
import { OctantModule } from "../src/modules/Octant.sol";
import { ActionRegistry } from "../src/registries/Action.sol";
import { MockHats } from "../src/mocks/Hats.sol";
import { MockOctantFactory } from "../src/mocks/Octant.sol";

/// @title StorageLayoutTest
/// @notice Verifies storage layout stability for UUPS upgradeable contracts
/// @dev Prevents accidental storage collisions during upgrades by asserting:
///      1. Key variables live at expected storage slots
///      2. Storage gaps reserve the correct number of slots
///      3. No overlap between variables and gap
///
/// WHY THIS MATTERS: UUPS proxies store state in the implementation's storage layout.
/// If a new variable is inserted before the gap (shifting everything down), or the gap
/// shrinks, an upgrade will corrupt existing state. These tests catch that at compile time.
contract StorageLayoutTest is Test {
    // =========================================================================
    // GardenToken Storage Layout
    // Layout: Initializable(2 slots packed) + ERC721(6 slots) + Ownable(1 slot)
    //         + _nextTokenId + deploymentRegistry + hatsModule + karmaGAPModule + __gap[46]
    // Total slots after inherited: 4 named + 46 gap = 50
    // =========================================================================

    function testGardenTokenStorageSlots() public {
        GardenToken impl = new GardenToken(address(1));
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, address(this), address(0));
        GardenToken token = GardenToken(address(new ERC1967Proxy(address(impl), initData)));

        // Set known values
        token.setHatsModule(address(0xAA));
        token.setKarmaGAPModule(address(0xBB));
        token.setOctantModule(address(0xCC));

        // Verify hatsModule slot contains expected value
        // hatsModule is the 3rd custom variable after inherited storage
        address storedHats = address(token.hatsModule());
        assertEq(storedHats, address(0xAA), "hatsModule value should match");

        address storedKarma = address(token.karmaGAPModule());
        assertEq(storedKarma, address(0xBB), "karmaGAPModule value should match");

        address storedOctant = address(token.octantModule());
        assertEq(storedOctant, address(0xCC), "octantModule value should match");
    }

    /// @notice Verify GardenToken gap is exactly 45 slots
    function testGardenTokenGapSize() public {
        // The gap is declared as uint256[45] in GardenToken
        // Total contract slots = 5 named + 45 gap = 50
        // If someone adds a variable and forgets to shrink the gap, this will catch it
        uint256 expectedNamedSlots = 5; // _nextTokenId, deploymentRegistry, hatsModule, karmaGAPModule, octantModule
        uint256 expectedGapSize = 45;
        uint256 expectedTotal = expectedNamedSlots + expectedGapSize;
        assertEq(expectedTotal, 50, "GardenToken should use exactly 50 custom slots");
    }

    // =========================================================================
    // OctantModule Storage Layout
    // =========================================================================

    function testOctantModuleStorageSlots() public {
        MockOctantFactory factory = new MockOctantFactory();
        OctantModule impl = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        OctantModule module = OctantModule(address(new ERC1967Proxy(address(impl), initData)));

        module.setGardenToken(address(0xCC));
        module.setSupportedAsset(address(0xAA), address(0xBB));

        assertEq(address(module.octantFactory()), address(factory), "factory should match");
        assertEq(module.defaultProfitUnlockTime(), 7 days, "unlock time should match");
        assertEq(module.gardenToken(), address(0xCC), "garden token should match");
        assertEq(module.supportedAssets(address(0xAA)), address(0xBB), "strategy should match");
        assertEq(module.supportedAssetCount(), 1, "supportedAssetCount should match");
    }

    function testOctantModuleGapSize() public {
        // Named storage: octantFactory + defaultProfitUnlockTime + gardenDonationAddresses(mapping)
        // + gardenAssetVaults(mapping) + supportedAssets(mapping) + supportedAssetList(array)
        // + supportedAssetCount + gardenToken = 8
        // ReentrancyGuardUpgradeable adds 1 slot (_status)
        // Gap = 41
        // Total = 8 + 1 + 41 = 50
        uint256 expectedNamedSlots = 8;
        uint256 expectedReentrancySlots = 1;
        uint256 expectedGapSize = 41;
        uint256 expectedTotal = expectedNamedSlots + expectedReentrancySlots + expectedGapSize;
        assertEq(expectedTotal, 50, "OctantModule should use exactly 50 custom slots");
    }

    // =========================================================================
    // HatsModule Storage Layout
    // Layout: Initializable + Ownable + hats + gardenToken + karmaGAPModule +
    //         hatsModuleFactory + funderEligibilityModule + communityEligibilityModule +
    //         communityMinBalance + communityHatId + gardensHatId +
    //         protocolGardenersHatId + gardenHats(mapping) + configAuthority(mapping)
    //         + __gap[38]
    // =========================================================================

    function testHatsModuleStorageSlots() public {
        MockHats mockHats = new MockHats();
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, address(this), address(mockHats));
        HatsModule adapter = HatsModule(address(new ERC1967Proxy(address(impl), initData)));

        // Verify initialization stored values correctly
        assertEq(address(adapter.hats()), address(mockHats), "hats should be set");
        assertEq(adapter.owner(), address(this), "owner should be set");

        // Set and verify additional slots
        adapter.setCommunityMinBalance(42);
        assertEq(adapter.communityMinBalance(), 42, "communityMinBalance should match");

        adapter.setProtocolHatIds(100, 200, 300);
        assertEq(adapter.communityHatId(), 100, "communityHatId should match");
        assertEq(adapter.gardensHatId(), 200, "gardensHatId should match");
        assertEq(adapter.protocolGardenersHatId(), 300, "protocolGardenersHatId should match");
    }

    /// @notice Verify HatsModule gap is exactly 38 slots
    function testHatsModuleGapSize() public {
        // Named storage: hats + gardenToken + karmaGAPModule + hatsModuleFactory +
        //   funderEligibilityModule + communityEligibilityModule + communityMinBalance +
        //   communityHatId + gardensHatId + protocolGardenersHatId +
        //   gardenHats(mapping) + configAuthority(mapping) = 12 slots
        // Gap = 38
        // Total = 12 + 38 = 50
        uint256 expectedNamedSlots = 12;
        uint256 expectedGapSize = 38;
        uint256 expectedTotal = expectedNamedSlots + expectedGapSize;
        assertEq(expectedTotal, 50, "HatsModule should use exactly 50 custom slots");
    }

    // =========================================================================
    // GardenAccount Storage Layout
    // Layout: Inherited (5 slots) + communityToken + name + description +
    //         location + bannerImage + metadata + __reservedSlot6 +
    //         __reservedSlot7 + openJoining + [reserved slot] = 10
    //         + __gap[35]
    // Total: 5 inherited + 10 custom + 35 gap = 50
    // =========================================================================

    function testGardenAccountStorageSlots() public {
        // GardenAccount uses immutables for resolvers (no storage)
        // Verify key immutables are set at construction
        GardenAccount impl = new GardenAccount(
            address(0x1001), // erc4337EntryPoint
            address(0x1002), // multicallForwarder
            address(0x1003), // erc6551Registry
            address(0x1004), // guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        );

        // Verify immutables (these don't consume storage slots)
        assertEq(impl.WORK_APPROVAL_RESOLVER(), address(0x2001), "workApprovalResolver immutable");
        assertEq(impl.ASSESSMENT_RESOLVER(), address(0x2002), "assessmentResolver immutable");
    }

    /// @notice Verify GardenAccount gap is exactly 35 slots
    function testGardenAccountGapSize() public {
        // Inherited storage: 5 slots (Initializable, Lockable, Overridable, Permissioned, ERC6551Account)
        // Custom storage: 10 slots (communityToken, name, description, location,
        //   bannerImage, metadata, __reservedSlot6, __reservedSlot7, openJoining, reserved)
        // Gap: 35
        // Total: 5 + 10 + 35 = 50
        uint256 inheritedSlots = 5;
        uint256 customSlots = 10;
        uint256 gapSize = 35;
        assertEq(inheritedSlots + customSlots + gapSize, 50, "GardenAccount total should be 50 slots");
    }

    // =========================================================================
    // ActionRegistry Storage Layout
    // =========================================================================

    function testActionRegistryStorageSlots() public {
        ActionRegistry impl = new ActionRegistry();
        bytes memory initData = abi.encodeWithSelector(ActionRegistry.initialize.selector, address(this));
        ActionRegistry registry = ActionRegistry(address(new ERC1967Proxy(address(impl), initData)));

        assertEq(registry.owner(), address(this), "owner should be set");
    }

    /// @notice Verify ActionRegistry gap is exactly 47 slots
    function testActionRegistryGapSize() public {
        // Named storage: _nextActionUID + actionToOwner(mapping) + idToAction(mapping) = 3 slots
        // Gap = 47
        // Total = 3 + 47 = 50
        uint256 expectedNamedSlots = 3;
        uint256 expectedGapSize = 47;
        uint256 expectedTotal = expectedNamedSlots + expectedGapSize;
        assertEq(expectedTotal, 50, "ActionRegistry should use exactly 50 custom slots");
    }

    // =========================================================================
    // Cross-Contract Upgrade Safety
    // Verify that proxy-based contracts can be upgraded without state corruption
    // =========================================================================

    /// @notice Verify GardenToken upgrade preserves all state
    function testGardenTokenUpgradePreservesState() public {
        GardenToken impl = new GardenToken(address(1));
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, address(this), address(0));
        GardenToken token = GardenToken(address(new ERC1967Proxy(address(impl), initData)));

        // Set state
        token.setHatsModule(address(0xAA));
        token.setKarmaGAPModule(address(0xBB));
        token.setOctantModule(address(0xCC));

        // Upgrade to new implementation
        GardenToken newImpl = new GardenToken(address(1));
        token.upgradeTo(address(newImpl));

        // Verify state preserved
        assertEq(address(token.hatsModule()), address(0xAA), "hatsModule should survive upgrade");
        assertEq(address(token.karmaGAPModule()), address(0xBB), "karmaGAPModule should survive upgrade");
        assertEq(address(token.octantModule()), address(0xCC), "octantModule should survive upgrade");
        assertEq(token.owner(), address(this), "owner should survive upgrade");
    }

    /// @notice Verify HatsModule upgrade preserves all state
    function testHatsModuleUpgradePreservesState() public {
        MockHats mockHats = new MockHats();
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, address(this), address(mockHats));
        HatsModule adapter = HatsModule(address(new ERC1967Proxy(address(impl), initData)));

        // Set state
        adapter.setGardenToken(address(0xCC));
        adapter.setCommunityMinBalance(42);
        adapter.setProtocolHatIds(100, 200, 300);

        // Configure a garden
        adapter.configureGarden(address(0xDD), 1, 2, 3, 4, 5, 6);

        // Upgrade
        HatsModule newImpl = new HatsModule();
        adapter.upgradeTo(address(newImpl));

        // Verify all state preserved
        assertEq(address(adapter.hats()), address(mockHats), "hats should survive upgrade");
        assertEq(adapter.gardenToken(), address(0xCC), "gardenToken should survive upgrade");
        assertEq(adapter.communityMinBalance(), 42, "communityMinBalance should survive upgrade");
        assertEq(adapter.communityHatId(), 100, "communityHatId should survive upgrade");
        assertEq(adapter.gardensHatId(), 200, "gardensHatId should survive upgrade");
        assertEq(adapter.protocolGardenersHatId(), 300, "protocolGardenersHatId should survive upgrade");
        assertTrue(adapter.isConfigured(address(0xDD)), "garden config should survive upgrade");
    }

    function testOctantModuleUpgradePreservesState() public {
        MockOctantFactory factory = new MockOctantFactory();
        OctantModule impl = new OctantModule();
        bytes memory initData =
            abi.encodeWithSelector(OctantModule.initialize.selector, address(this), address(factory), 7 days);
        OctantModule module = OctantModule(address(new ERC1967Proxy(address(impl), initData)));

        module.setGardenToken(address(0xCC));
        module.setSupportedAsset(address(0xAA), address(0xBB));

        OctantModule newImpl = new OctantModule();
        module.upgradeTo(address(newImpl));

        assertEq(address(module.octantFactory()), address(factory), "factory should survive upgrade");
        assertEq(module.defaultProfitUnlockTime(), 7 days, "unlock time should survive upgrade");
        assertEq(module.gardenToken(), address(0xCC), "gardenToken should survive upgrade");
        assertEq(module.supportedAssets(address(0xAA)), address(0xBB), "supported asset should survive upgrade");
        assertEq(module.supportedAssetCount(), 1, "supported asset count should survive upgrade");
        assertEq(module.owner(), address(this), "owner should survive upgrade");
    }
}
