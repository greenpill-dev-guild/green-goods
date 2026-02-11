// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockNonERC20 } from "../../src/mocks/NonERC20.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";

contract GardenTokenTest is Test, ERC6551Helper {
    GardenToken private gardenToken;
    address private multisig = address(0x123);
    address private gardenAccountImplementation = address(
        new GardenAccount(
            address(0x001), // erc4337EntryPoint
            address(0x002), // multicallForwarder
            address(0x003), // erc6551Registry
            address(0x004), // guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        )
    );
    MockERC20 private mockToken;
    MockNonERC20 private mockNonERC20;
    MockHatsModule private mockHatsModule;

    // Events (mirrored from GardenToken for vm.expectEmit)
    event HatsModuleUpdated(address indexed oldModule, address indexed newModule);
    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);
    event OctantModuleUpdated(address indexed oldModule, address indexed newModule);
    event GardenMinted(
        uint256 indexed tokenId,
        address indexed account,
        string name,
        string description,
        string location,
        string bannerImage,
        bool openJoining
    );

    function setUp() public {
        _deployERC6551Registry();

        GardenToken implementation = new GardenToken(gardenAccountImplementation);
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        gardenToken = GardenToken(address(proxy));

        mockToken = new MockERC20();
        mockNonERC20 = new MockNonERC20();
        mockHatsModule = new MockHatsModule();
    }

    function _setHatsModule() internal {
        vm.prank(multisig);
        gardenToken.setHatsModule(address(mockHatsModule));
    }

    function _defaultConfig(address token) internal pure returns (GardenToken.GardenConfig memory) {
        return GardenToken.GardenConfig({
            communityToken: token,
            name: "Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "Banner",
            metadata: "",
            openJoining: false
        });
    }

    function testInitialize() public {
        assertEq(gardenToken.owner(), multisig, "Owner should be the multisig address");
    }

    function testMintGarden_RevertsWithZeroAddressToken() public {
        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidCommunityToken.selector);
        gardenToken.mintGarden(_defaultConfig(address(0)));
    }

    function testMintGarden_RevertsWithEOA() public {
        address eoa = address(0x999);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.CommunityTokenNotContract.selector);
        gardenToken.mintGarden(_defaultConfig(eoa));
    }

    function testMintGarden_RevertsWithNonERC20Contract() public {
        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidERC20Token.selector);
        gardenToken.mintGarden(_defaultConfig(address(mockNonERC20)));
    }

    function testMintGarden_RevertsWhenHatsModuleNotSet() public {
        vm.prank(multisig);
        vm.expectRevert(GardenToken.HatsModuleNotSet.selector);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));
    }

    function testMintGarden_SucceedsWithValidERC20AndHatsModuleSet() public {
        _setHatsModule();

        vm.prank(multisig);
        address gardenAccount = gardenToken.mintGarden(_defaultConfig(address(mockToken)));

        assertTrue(gardenAccount != address(0), "Garden account should be created");
        assertEq(gardenToken.ownerOf(0), multisig, "Token should be minted to multisig");
    }

    function testOnlyOwnerOrAllowlistCanMint() public {
        address notAuthorized = address(0x999);

        vm.prank(notAuthorized);
        vm.expectRevert(GardenToken.DeploymentRegistryNotConfigured.selector);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));
    }

    function testBatchMintGardensRevertsWithEmptyArray() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](0);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidBatchSize.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardensRevertsWithTooManyGardens() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](11);

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidBatchSize.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardens_RevertsWithInvalidToken() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](2);
        configs[0] = _defaultConfig(address(mockToken));
        configs[1] = _defaultConfig(address(0));

        vm.prank(multisig);
        vm.expectRevert(GardenToken.InvalidCommunityToken.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardens_RevertsWhenHatsModuleNotSet() public {
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](1);
        configs[0] = _defaultConfig(address(mockToken));

        vm.prank(multisig);
        vm.expectRevert(GardenToken.HatsModuleNotSet.selector);
        gardenToken.batchMintGardens(configs);
    }

    function testBatchMintGardens_SucceedsWithValidTokensAndHatsModuleSet() public {
        _setHatsModule();

        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](2);
        configs[0] = _defaultConfig(address(mockToken));
        configs[1] = GardenToken.GardenConfig({
            communityToken: address(mockToken),
            name: "Garden 2",
            description: "Description 2",
            location: "Location 2",
            bannerImage: "Banner 2",
            metadata: "",
            openJoining: true
        });

        vm.prank(multisig);
        address[] memory gardenAccounts = gardenToken.batchMintGardens(configs);

        assertEq(gardenAccounts.length, 2, "Should create 2 gardens");
        assertTrue(gardenAccounts[0] != address(0), "First garden should be created");
        assertTrue(gardenAccounts[1] != address(0), "Second garden should be created");
        assertEq(gardenToken.ownerOf(0), multisig, "First token should be minted");
        assertEq(gardenToken.ownerOf(1), multisig, "Second token should be minted");
    }

    // =========================================================================
    // Event Emission Tests
    // =========================================================================

    function test_setHatsModule_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit HatsModuleUpdated(address(0), address(mockHatsModule));

        vm.prank(multisig);
        gardenToken.setHatsModule(address(mockHatsModule));
    }

    function test_setKarmaGAPModule_emitsEvent() public {
        address module = address(0xCAFE);

        vm.expectEmit(true, true, false, false);
        emit KarmaGAPModuleUpdated(address(0), module);

        vm.prank(multisig);
        gardenToken.setKarmaGAPModule(module);
    }

    function test_setOctantModule_emitsEvent() public {
        address module = address(0xBEEF);

        vm.expectEmit(true, true, false, false);
        emit OctantModuleUpdated(address(0), module);

        vm.prank(multisig);
        gardenToken.setOctantModule(module);
    }

    function test_mintGarden_emitsGardenMintedEvent() public {
        _setHatsModule();

        // We can't predict the exact garden account address, so check topic matching only
        vm.expectEmit(true, false, false, false);
        emit GardenMinted(0, address(0), "Test Garden", "Description", "Location", "Banner", false);

        vm.prank(multisig);
        gardenToken.mintGarden(_defaultConfig(address(mockToken)));
    }

    // =========================================================================
    // Setter Access Control Tests
    // =========================================================================

    function test_setKarmaGAPModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setKarmaGAPModule(address(0xCAFE));
    }

    function test_setOctantModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setOctantModule(address(0xBEEF));
    }

    function test_setDeploymentRegistry_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.setDeploymentRegistry(address(0xDEAD));
    }

    // =========================================================================
    // Double Initialization Test
    // =========================================================================

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        gardenToken.initialize(address(0x999), address(0));
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        GardenToken newImpl = new GardenToken(gardenAccountImplementation);

        vm.prank(multisig);
        gardenToken.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        GardenToken newImpl = new GardenToken(gardenAccountImplementation);

        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        gardenToken.upgradeTo(address(newImpl));
    }
}
