// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../../src/interfaces/IKarmaGAPModule.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";

contract MockKarmaGAPModule is IKarmaGAPModule {
    struct ProjectCall {
        address garden;
        address operator;
        string name;
        string description;
        string location;
        string bannerImage;
    }

    ProjectCall public lastProject;
    bool public created;

    function createProject(
        address garden,
        address operator,
        string calldata name,
        string calldata description,
        string calldata location,
        string calldata bannerImage
    )
        external
        returns (bytes32 projectUID)
    {
        lastProject = ProjectCall({
            garden: garden,
            operator: operator,
            name: name,
            description: description,
            location: location,
            bannerImage: bannerImage
        });
        created = true;
        return bytes32(uint256(0x1234));
    }

    function addProjectAdmin(address, address) external { }

    function removeProjectAdmin(address, address) external { }

    function createImpact(
        address,
        uint256,
        string calldata,
        string calldata,
        string calldata,
        bytes32
    )
        external
        returns (bytes32)
    {
        return bytes32(0);
    }

    function createMilestone(address, string calldata, string calldata, string calldata) external returns (bytes32) {
        return bytes32(0);
    }

    function getProjectUID(address) external pure returns (bytes32) {
        return bytes32(0);
    }

    function isSupported() external pure returns (bool) {
        return true;
    }
}

contract GardenMintingIntegrationTest is Test, ERC6551Helper {
    GardenToken private gardenToken;
    MockHatsModule private hatsModule;
    MockKarmaGAPModule private karmaModule;
    MockERC20 private communityToken;

    address private multisig = address(0x123);
    address private gardenAccountImplementation;

    function setUp() public {
        _deployERC6551Registry();

        GardenAccount impl = new GardenAccount(
            address(0x001), address(0x002), address(0x003), address(0x004), address(0x2001), address(0x2002)
        );
        gardenAccountImplementation = address(impl);

        GardenToken tokenImpl = new GardenToken(gardenAccountImplementation);
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        gardenToken = GardenToken(address(new ERC1967Proxy(address(tokenImpl), initData)));

        hatsModule = new MockHatsModule();
        karmaModule = new MockKarmaGAPModule();
        communityToken = new MockERC20();

        vm.prank(multisig);
        gardenToken.setHatsModule(address(hatsModule));
        vm.prank(multisig);
        gardenToken.setKarmaGAPModule(address(karmaModule));
    }

    function test_mintGarden_callsHatsAndGAP() public {
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Garden Alpha",
            description: "Desc",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear
        });

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(config);

        assertTrue(hatsModule.created(), "Hats module should be called");
        (address createdGarden, string memory createdName, address createdToken) = hatsModule.lastCreate();
        assertEq(createdGarden, gardenAccount, "Garden account should match");
        assertEq(createdName, "Garden Alpha", "Garden name should match");
        assertEq(createdToken, address(communityToken), "Community token should match");

        assertTrue(karmaModule.created(), "Karma module should be called");
        (
            address projectGarden,
            address projectOperator,
            string memory projectName,
            string memory projectDescription,
            string memory projectLocation,
            string memory projectBanner
        ) = karmaModule.lastProject();
        assertEq(projectGarden, gardenAccount, "Karma garden should match");
        assertEq(projectOperator, multisig, "Karma operator should match minter/owner");
        assertEq(projectName, "Garden Alpha", "Karma name should match");
        assertEq(projectDescription, "Desc", "Karma description should match");
        assertEq(projectLocation, "Location", "Karma location should match");
        assertEq(projectBanner, "Banner", "Karma banner should match");

        // Only initial owner grant should be recorded
        assertEq(hatsModule.grantCallsLength(), 1, "Expected owner grant only");

        (, address firstAccount, IHatsModule.GardenRole firstRole) = hatsModule.grantCalls(0);
        assertEq(firstAccount, multisig, "Owner grant should target minter");
        assertEq(uint8(firstRole), uint8(IHatsModule.GardenRole.Owner));
    }

    // =========================================================================
    // Revert: Unauthorized Caller
    // =========================================================================

    function test_mintGarden_revertsForUnauthorizedCaller() public {
        GardenToken.GardenConfig memory config = _defaultConfig();

        vm.prank(address(0x999));
        vm.expectRevert(GardenToken.DeploymentRegistryNotConfigured.selector);
        gardenToken.mintGarden(config);
    }

    // =========================================================================
    // Graceful Degradation: KarmaGAPModule not set
    // =========================================================================

    function test_mintGarden_succeedsWithoutKarmaModule() public {
        // Remove karma module
        vm.prank(multisig);
        gardenToken.setKarmaGAPModule(address(0));

        GardenToken.GardenConfig memory config = _defaultConfig();

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(config);

        assertTrue(gardenAccount != address(0), "Garden should mint without Karma module");
        assertTrue(hatsModule.created(), "Hats module should still be called");
        assertFalse(karmaModule.created(), "Karma module should NOT be called");
    }

    // =========================================================================
    // Batch Mint Integration
    // =========================================================================

    function test_batchMintGardens_callsHatsForEachGarden() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](2);
        configs[0] = _defaultConfig();
        configs[1] = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Garden Beta",
            description: "Desc2",
            location: "Location2",
            bannerImage: "Banner2",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear
        });

        vm.prank(multisig);
        address[] memory accounts = gardenToken.batchMintGardens(configs);

        assertEq(accounts.length, 2, "Should create 2 gardens");
        // 2 gardens x 1 owner grant each = 2 grant calls
        assertEq(hatsModule.grantCallsLength(), 2, "Should have 2 owner grants");
    }

    // =========================================================================
    // Event Emission
    // =========================================================================

    event GardenMinted(
        uint256 indexed tokenId,
        address indexed account,
        string name,
        string description,
        string location,
        string bannerImage,
        bool openJoining
    );

    function test_mintGarden_emitsGardenMintedEvent() public {
        GardenToken.GardenConfig memory config = _defaultConfig();

        vm.expectEmit(true, false, false, false);
        emit GardenMinted(0, address(0), "Garden Alpha", "Desc", "Location", "Banner", false);

        vm.prank(multisig);
        gardenToken.mintGarden(config);
    }

    // =========================================================================
    // Revert: Missing HatsModule (via unit test interaction)
    // =========================================================================

    function test_mintGarden_revertsWhenHatsModuleRemoved() public {
        // Remove hats module
        vm.prank(multisig);
        gardenToken.setHatsModule(address(0));

        GardenToken.GardenConfig memory config = _defaultConfig();

        vm.prank(multisig);
        vm.expectRevert(GardenToken.HatsModuleNotSet.selector);
        gardenToken.mintGarden(config);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _defaultConfig() internal view returns (GardenToken.GardenConfig memory) {
        return GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Garden Alpha",
            description: "Desc",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear
        });
    }
}
