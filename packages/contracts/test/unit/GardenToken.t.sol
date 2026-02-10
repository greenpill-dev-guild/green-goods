// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockNonERC20 } from "../../src/mocks/NonERC20.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";

contract MockHatsModule is IHatsModule {
    function createGardenHatTree(address, string calldata, address) external pure returns (uint256 adminHatId) {
        return 1;
    }

    function grantRole(address, address, GardenRole) external { }

    function revokeRole(address, address, GardenRole) external { }

    function grantRoles(address, address[] calldata, GardenRole[] calldata) external { }

    function revokeRoles(address, address[] calldata, GardenRole[] calldata) external { }

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
}

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
}
