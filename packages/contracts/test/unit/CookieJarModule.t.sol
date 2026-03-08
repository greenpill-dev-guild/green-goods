// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { CookieJarModule } from "../../src/modules/CookieJar.sol";
import { ICookieJarModule } from "../../src/interfaces/ICookieJarModule.sol";
import { ICookieJarFactory } from "../../src/interfaces/ICookieJarFactory.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";

// ═══════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════

/// @title MockHatsModuleForCookieJar
/// @notice Minimal mock that implements getGardenHatIds for CookieJarModule testing
contract MockHatsModuleForCookieJar is IHatsModule {
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
}

/// @title CapturingCookieJarFactory
/// @notice Mock factory that captures jar configs for assertions + emits events
contract CapturingCookieJarFactory {
    uint256 private _jarCount;

    // Captured data from the last createCookieJar call
    ICookieJarFactory.JarConfig public lastJarConfig;
    ICookieJarFactory.AccessConfig public lastAccessConfig;
    bool public wasCalled;

    // Track per-call data
    address[] public createdJarAddresses;

    event MockJarCreated(address indexed jarAddress, address indexed jarOwner, address indexed currency);

    function createCookieJar(
        ICookieJarFactory.JarConfig calldata params,
        ICookieJarFactory.AccessConfig calldata accessConfig,
        ICookieJarFactory.MultiTokenConfig calldata
    )
        external
        returns (address jarAddress)
    {
        _jarCount++;
        wasCalled = true;

        // Store config for assertions
        lastJarConfig = params;
        // Manual copy of AccessConfig (nested struct with dynamic array)
        delete lastAccessConfig;
        lastAccessConfig.nftRequirement = accessConfig.nftRequirement;
        for (uint256 i = 0; i < accessConfig.allowlist.length; i++) {
            lastAccessConfig.allowlist.push(accessConfig.allowlist[i]);
        }

        // Generate deterministic address
        jarAddress = address(uint160(uint256(keccak256(abi.encode(_jarCount, params.jarOwner, params.supportedCurrency)))));
        createdJarAddresses.push(jarAddress);

        emit MockJarCreated(jarAddress, params.jarOwner, params.supportedCurrency);
    }

    function getJarCount() external view returns (uint256) {
        return _jarCount;
    }

    function getLastNftRequirement() external view returns (ICookieJarFactory.NftRequirement memory) {
        return lastAccessConfig.nftRequirement;
    }

    function getLastJarOwner() external view returns (address) {
        return lastJarConfig.jarOwner;
    }

    function getLastCurrency() external view returns (address) {
        return lastJarConfig.supportedCurrency;
    }

    function getLastAccessType() external view returns (ICookieJarFactory.AccessType) {
        return lastJarConfig.accessType;
    }

    function getLastMaxWithdrawal() external view returns (uint256) {
        return lastJarConfig.maxWithdrawal;
    }

    function getLastWithdrawalInterval() external view returns (uint256) {
        return lastJarConfig.withdrawalInterval;
    }

    function getLastStrictPurpose() external view returns (bool) {
        return lastJarConfig.strictPurpose;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

/// @title CookieJarModuleTest
/// @notice Unit tests for CookieJarModule contract
contract CookieJarModuleTest is Test {
    CookieJarModule public cookieJarModule;
    MockHatsModuleForCookieJar public hatsModule;
    CapturingCookieJarFactory public factory;

    address public owner = address(0x1);
    address public gardenToken = address(0x2);
    address public yieldSplitter = address(0x3);
    address public garden1 = address(0x100);
    address public garden2 = address(0x200);
    address public asset1 = address(0xA1);
    address public asset2 = address(0xA2);

    address public constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    uint256 public constant GARDENER_HAT_ID_GARDEN1 = 1004;
    uint256 public constant GARDENER_HAT_ID_GARDEN2 = 2004;

    function setUp() public {
        // Deploy mocks
        hatsModule = new MockHatsModuleForCookieJar();
        factory = new CapturingCookieJarFactory();

        // Set up garden hat trees
        hatsModule.setGardenHats(garden1, 1001, 1002, 1003, GARDENER_HAT_ID_GARDEN1, 1005, 1006, 1000);
        hatsModule.setGardenHats(garden2, 2001, 2002, 2003, GARDENER_HAT_ID_GARDEN2, 2005, 2006, 2000);

        // Deploy CookieJarModule behind proxy with 2 supported assets
        address[] memory assets = new address[](2);
        assets[0] = asset1;
        assets[1] = asset2;

        CookieJarModule impl = new CookieJarModule();
        bytes memory initData = abi.encodeWithSelector(
            CookieJarModule.initialize.selector,
            owner,
            address(hatsModule),
            yieldSplitter,
            address(factory),
            HATS_PROTOCOL,
            assets
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        cookieJarModule = CookieJarModule(address(proxy));

        // Wire gardenToken
        vm.prank(owner);
        cookieJarModule.setGardenToken(gardenToken);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsOwner() public {
        assertEq(cookieJarModule.owner(), owner, "Owner should be set");
    }

    function test_initialize_setsHatsModule() public {
        assertEq(address(cookieJarModule.hatsModule()), address(hatsModule), "HatsModule should be set");
    }

    function test_initialize_setsYieldSplitter() public {
        assertEq(cookieJarModule.yieldSplitter(), yieldSplitter, "YieldResolver should be set");
    }

    function test_initialize_setsCookieJarFactory() public {
        assertEq(address(cookieJarModule.cookieJarFactory()), address(factory), "CookieJarFactory should be set");
    }

    function test_initialize_setsSupportedAssets() public {
        address[] memory assets = cookieJarModule.getSupportedAssets();
        assertEq(assets.length, 2, "Should have 2 supported assets");
        assertEq(assets[0], asset1, "First asset should be asset1");
        assertEq(assets[1], asset2, "Second asset should be asset2");
    }

    function test_initialize_revertsWithZeroOwner() public {
        CookieJarModule impl = new CookieJarModule();
        address[] memory assets = new address[](0);
        bytes memory initData = abi.encodeWithSelector(
            CookieJarModule.initialize.selector,
            address(0), // zero owner
            address(hatsModule),
            yieldSplitter,
            address(factory),
            HATS_PROTOCOL,
            assets
        );
        vm.expectRevert(ICookieJarModule.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_cannotBeCalledTwice() public {
        address[] memory assets = new address[](0);
        vm.expectRevert("Initializable: contract is already initialized");
        cookieJarModule.initialize(owner, address(hatsModule), yieldSplitter, address(factory), HATS_PROTOCOL, assets);
    }

    function test_initialize_worksWithEmptyAssets() public {
        CookieJarModule impl = new CookieJarModule();
        address[] memory emptyAssets = new address[](0);
        bytes memory initData = abi.encodeWithSelector(
            CookieJarModule.initialize.selector,
            owner,
            address(hatsModule),
            yieldSplitter,
            address(factory),
            HATS_PROTOCOL,
            emptyAssets
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        CookieJarModule module = CookieJarModule(address(proxy));

        address[] memory assets = module.getSupportedAssets();
        assertEq(assets.length, 0, "Should have no supported assets");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Access Control
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_revertsIfNotGardenToken() public {
        vm.prank(address(0x999));
        vm.expectRevert(abi.encodeWithSelector(ICookieJarModule.UnauthorizedCaller.selector, address(0x999)));
        cookieJarModule.onGardenMinted(garden1);
    }

    function test_onGardenMinted_revertsIfCalledByOwner() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ICookieJarModule.UnauthorizedCaller.selector, owner));
        cookieJarModule.onGardenMinted(garden1);
    }

    function test_setGardenToken_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setGardenToken(address(0x42));
    }

    function test_setYieldSplitter_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setYieldSplitter(address(0x42));
    }

    function test_setHatsModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setHatsModule(address(0x42));
    }

    function test_setCookieJarFactory_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setCookieJarFactory(address(0x42));
    }

    function test_addSupportedAsset_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.addSupportedAsset(address(0x42));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Zero Address Checks
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setGardenToken_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(ICookieJarModule.ZeroAddress.selector);
        cookieJarModule.setGardenToken(address(0));
    }

    function test_setCookieJarFactory_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(ICookieJarModule.ZeroAddress.selector);
        cookieJarModule.setCookieJarFactory(address(0));
    }

    function test_addSupportedAsset_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(ICookieJarModule.ZeroAddress.selector);
        cookieJarModule.addSupportedAsset(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Setters
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setGardenToken_updatesValue() public {
        vm.prank(owner);
        cookieJarModule.setGardenToken(address(0x42));
        assertEq(cookieJarModule.gardenToken(), address(0x42), "Garden token should be updated");
    }

    function test_setYieldSplitter_updatesValue() public {
        vm.prank(owner);
        cookieJarModule.setYieldSplitter(address(0x42));
        assertEq(cookieJarModule.yieldSplitter(), address(0x42), "YieldResolver should be updated");
    }

    function test_setYieldSplitter_acceptsZero() public {
        vm.prank(owner);
        cookieJarModule.setYieldSplitter(address(0));
        assertEq(cookieJarModule.yieldSplitter(), address(0), "YieldResolver can be set to zero (disabled)");
    }

    function test_setHatsModule_updatesValue() public {
        vm.prank(owner);
        cookieJarModule.setHatsModule(address(0x42));
        assertEq(address(cookieJarModule.hatsModule()), address(0x42), "HatsModule should be updated");
    }

    function test_setCookieJarFactory_updatesValue() public {
        CapturingCookieJarFactory newFactory = new CapturingCookieJarFactory();
        vm.prank(owner);
        cookieJarModule.setCookieJarFactory(address(newFactory));
        assertEq(address(cookieJarModule.cookieJarFactory()), address(newFactory), "Factory should be updated");
    }

    function test_addSupportedAsset_appendsToArray() public {
        address asset3 = address(0xA3);
        vm.prank(owner);
        cookieJarModule.addSupportedAsset(asset3);

        address[] memory assets = cookieJarModule.getSupportedAssets();
        assertEq(assets.length, 3, "Should have 3 supported assets");
        assertEq(assets[2], asset3, "Third asset should be asset3");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // onGardenMinted — Jar Creation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_createsJarsForEachAsset() public {
        vm.prank(gardenToken);
        address[] memory jars = cookieJarModule.onGardenMinted(garden1);

        assertEq(jars.length, 2, "Should create 2 jars (one per asset)");
        assertTrue(jars[0] != address(0), "First jar should be non-zero");
        assertTrue(jars[1] != address(0), "Second jar should be non-zero");
        assertTrue(jars[0] != jars[1], "Jars should be different addresses");
    }

    function test_onGardenMinted_storesJarsInMapping() public {
        vm.prank(gardenToken);
        address[] memory jars = cookieJarModule.onGardenMinted(garden1);

        assertEq(cookieJarModule.getGardenJar(garden1, asset1), jars[0], "gardenJars[garden1][asset1] should match");
        assertEq(cookieJarModule.getGardenJar(garden1, asset2), jars[1], "gardenJars[garden1][asset2] should match");
    }

    function test_onGardenMinted_storesJarsInList() public {
        vm.prank(gardenToken);
        address[] memory jars = cookieJarModule.onGardenMinted(garden1);

        address[] memory storedJars = cookieJarModule.getGardenJars(garden1);
        assertEq(storedJars.length, 2, "gardenJarList should have 2 entries");
        assertEq(storedJars[0], jars[0], "First stored jar should match");
        assertEq(storedJars[1], jars[1], "Second stored jar should match");
    }

    function test_onGardenMinted_emitsJarCreatedEvents() public {
        // We can't predict exact jar addresses, but we can check that events are emitted
        // with correct garden and asset indexed params
        vm.expectEmit(true, true, false, false);
        emit ICookieJarModule.JarCreated(garden1, asset1, address(0));

        vm.expectEmit(true, true, false, false);
        emit ICookieJarModule.JarCreated(garden1, asset2, address(0));

        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);
    }

    function test_onGardenMinted_callsFactoryForEachAsset() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        assertEq(factory.getJarCount(), 2, "Factory should have been called twice");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Jar Config Validation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_jarConfigUsesGardenAsOwner() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        assertEq(factory.getLastJarOwner(), garden1, "Jar owner should be the garden address");
    }

    function test_onGardenMinted_jarConfigUsesCorrectAsset() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        // Last call is for asset2 (second iteration)
        assertEq(factory.getLastCurrency(), asset2, "Last jar currency should be asset2");
    }

    function test_onGardenMinted_jarConfigUsesERC1155AccessType() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        assertEq(
            uint256(factory.getLastAccessType()),
            uint256(ICookieJarFactory.AccessType.ERC1155),
            "Access type should be ERC1155"
        );
    }

    function test_onGardenMinted_accessConfigUsesGardenerHatId() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        ICookieJarFactory.NftRequirement memory nftReq = factory.getLastNftRequirement();
        assertEq(nftReq.tokenId, GARDENER_HAT_ID_GARDEN1, "NFT token ID should be the garden's gardener hat ID");
        assertEq(nftReq.minBalance, 1, "Min balance should be 1");
        assertEq(nftReq.isPoapEventGate, false, "Should not be a POAP event gate");
    }

    function test_onGardenMinted_accessConfigUsesHatsProtocolAddress() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        ICookieJarFactory.NftRequirement memory nftReq = factory.getLastNftRequirement();
        assertEq(nftReq.nftContract, HATS_PROTOCOL, "NFT contract should be the configured Hats Protocol address");
    }

    function test_onGardenMinted_differentGardensUseDifferentGardenerHats() public {
        // Mint jars for garden1
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);
        ICookieJarFactory.NftRequirement memory nftReq1 = factory.getLastNftRequirement();

        // Mint jars for garden2
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden2);
        ICookieJarFactory.NftRequirement memory nftReq2 = factory.getLastNftRequirement();

        assertEq(nftReq1.tokenId, GARDENER_HAT_ID_GARDEN1, "Garden1 should use gardener hat 1004");
        assertEq(nftReq2.tokenId, GARDENER_HAT_ID_GARDEN2, "Garden2 should use gardener hat 2004");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Idempotency
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_idempotentForSameGarden() public {
        vm.prank(gardenToken);
        address[] memory jars1 = cookieJarModule.onGardenMinted(garden1);

        // Call again — should return existing jars without creating new ones
        vm.prank(gardenToken);
        address[] memory jars2 = cookieJarModule.onGardenMinted(garden1);

        assertEq(jars1[0], jars2[0], "First jar should be the same on second call");
        assertEq(jars1[1], jars2[1], "Second jar should be the same on second call");

        // Factory should only have been called 2 times (first call), not 4
        assertEq(factory.getJarCount(), 2, "Factory should only create jars once per asset");
    }

    function test_onGardenMinted_idempotentJarListDoesNotGrow() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        address[] memory storedJars = cookieJarModule.getGardenJars(garden1);
        assertEq(storedJars.length, 2, "Jar list should not grow on second call");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multiple Gardens
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_independentJarsPerGarden() public {
        vm.startPrank(gardenToken);
        address[] memory jars1 = cookieJarModule.onGardenMinted(garden1);
        address[] memory jars2 = cookieJarModule.onGardenMinted(garden2);
        vm.stopPrank();

        // Jars should be different per garden
        assertTrue(jars1[0] != jars2[0], "Garden1 and garden2 should have different jars for asset1");
        assertTrue(jars1[1] != jars2[1], "Garden1 and garden2 should have different jars for asset2");

        // Each garden's view functions return correct data
        assertEq(cookieJarModule.getGardenJar(garden1, asset1), jars1[0], "Garden1 jar for asset1 should match");
        assertEq(cookieJarModule.getGardenJar(garden2, asset1), jars2[0], "Garden2 jar for asset1 should match");

        assertEq(factory.getJarCount(), 4, "Factory should have created 4 jars total");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // No Supported Assets
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_noAssetsReturnsEmptyArray() public {
        // Deploy module with no assets
        CookieJarModule impl = new CookieJarModule();
        address[] memory emptyAssets = new address[](0);
        bytes memory initData = abi.encodeWithSelector(
            CookieJarModule.initialize.selector,
            owner,
            address(hatsModule),
            yieldSplitter,
            address(factory),
            HATS_PROTOCOL,
            emptyAssets
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        CookieJarModule emptyModule = CookieJarModule(address(proxy));

        vm.prank(owner);
        emptyModule.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        address[] memory jars = emptyModule.onGardenMinted(garden1);

        assertEq(jars.length, 0, "Should return empty array with no supported assets");
        assertEq(emptyModule.getGardenJars(garden1).length, 0, "Stored jar list should be empty");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // New Assets Added After Initial Deployment
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_newAssetCreatesAdditionalJar() public {
        // First mint with 2 assets
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);
        assertEq(cookieJarModule.getGardenJars(garden1).length, 2, "Should have 2 jars initially");

        // Admin adds a third asset
        address asset3 = address(0xA3);
        vm.prank(owner);
        cookieJarModule.addSupportedAsset(asset3);

        // Second mint for same garden picks up new asset
        vm.prank(gardenToken);
        address[] memory jars = cookieJarModule.onGardenMinted(garden1);

        assertEq(jars.length, 3, "Return array should have 3 entries");
        assertEq(cookieJarModule.getGardenJars(garden1).length, 3, "Stored jar list should have 3 entries");
        assertTrue(jars[2] != address(0), "Third jar should be created");
        assertEq(cookieJarModule.getGardenJar(garden1, asset3), jars[2], "Third jar should map to asset3");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions — Uninitialized
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getGardenJars_returnsEmptyForUnknownGarden() public {
        address[] memory jars = cookieJarModule.getGardenJars(address(0x999));
        assertEq(jars.length, 0, "Should return empty for unknown garden");
    }

    function test_getGardenJar_returnsZeroForUnknownGarden() public {
        assertEq(cookieJarModule.getGardenJar(address(0x999), asset1), address(0), "Should return zero for unknown garden");
    }

    function test_getGardenJar_returnsZeroForUnknownAsset() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        assertEq(cookieJarModule.getGardenJar(garden1, address(0x999)), address(0), "Should return zero for unknown asset");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade Authorization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_upgrade_onlyOwnerCanUpgrade() public {
        CookieJarModule newImpl = new CookieJarModule();

        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.upgradeTo(address(newImpl));
    }

    function test_upgrade_ownerCanUpgrade() public {
        CookieJarModule newImpl = new CookieJarModule();

        vm.prank(owner);
        cookieJarModule.upgradeTo(address(newImpl));
        // If we reach here without revert, upgrade succeeded
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage Gap
    // ═══════════════════════════════════════════════════════════════════════════

    function test_storageGap_totalSlots() public {
        // CookieJarModule has 11 explicit vars + 1 ReentrancyGuard slot + 38 gap = 50 total slots
        // This test just verifies the contract compiles with the gap annotation
        // The actual gap is verified by StorageLayout.t.sol
        assertTrue(true, "Storage gap compiles correctly");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialize — New Fields
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsHatsProtocol() public {
        assertEq(cookieJarModule.hatsProtocol(), HATS_PROTOCOL, "hatsProtocol should be set during init");
    }

    function test_initialize_setsDefaultMaxWithdrawal() public {
        assertEq(cookieJarModule.defaultMaxWithdrawal(), 100 ether, "defaultMaxWithdrawal should be 100 tokens");
    }

    function test_initialize_setsDefaultWithdrawalInterval() public {
        assertEq(cookieJarModule.defaultWithdrawalInterval(), 86_400, "defaultWithdrawalInterval should be 86400 (1 day)");
    }

    function test_initialize_setsDefaultStrictPurpose() public {
        assertEq(cookieJarModule.defaultStrictPurpose(), false, "defaultStrictPurpose should be false");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // setHatsProtocol
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setHatsProtocol_updatesValue() public {
        address newHats = address(0xBEEF);
        vm.prank(owner);
        cookieJarModule.setHatsProtocol(newHats);
        assertEq(cookieJarModule.hatsProtocol(), newHats, "hatsProtocol should be updated");
    }

    function test_setHatsProtocol_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setHatsProtocol(address(0xBEEF));
    }

    function test_setHatsProtocol_revertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert(ICookieJarModule.ZeroAddress.selector);
        cookieJarModule.setHatsProtocol(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // setDefaultMaxWithdrawal
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setDefaultMaxWithdrawal_updatesValue() public {
        vm.prank(owner);
        cookieJarModule.setDefaultMaxWithdrawal(1 ether);
        assertEq(cookieJarModule.defaultMaxWithdrawal(), 1 ether, "defaultMaxWithdrawal should be updated");
    }

    function test_setDefaultMaxWithdrawal_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setDefaultMaxWithdrawal(1 ether);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // setDefaultWithdrawalInterval
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setDefaultWithdrawalInterval_updatesValue() public {
        vm.prank(owner);
        cookieJarModule.setDefaultWithdrawalInterval(3600);
        assertEq(cookieJarModule.defaultWithdrawalInterval(), 3600, "defaultWithdrawalInterval should be updated");
    }

    function test_setDefaultWithdrawalInterval_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setDefaultWithdrawalInterval(3600);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // setDefaultStrictPurpose
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setDefaultStrictPurpose_updatesValue() public {
        vm.prank(owner);
        cookieJarModule.setDefaultStrictPurpose(true);
        assertEq(cookieJarModule.defaultStrictPurpose(), true, "defaultStrictPurpose should be updated");
    }

    function test_setDefaultStrictPurpose_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.setDefaultStrictPurpose(true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // removeSupportedAsset
    // ═══════════════════════════════════════════════════════════════════════════

    function test_removeSupportedAsset_removesExistingAsset() public {
        vm.prank(owner);
        cookieJarModule.removeSupportedAsset(asset1);

        address[] memory assets = cookieJarModule.getSupportedAssets();
        assertEq(assets.length, 1, "Should have 1 asset after removal");
        assertEq(assets[0], asset2, "Remaining asset should be asset2 (swapped from end)");
    }

    function test_removeSupportedAsset_removesLastAsset() public {
        vm.prank(owner);
        cookieJarModule.removeSupportedAsset(asset2);

        address[] memory assets = cookieJarModule.getSupportedAssets();
        assertEq(assets.length, 1, "Should have 1 asset after removal");
        assertEq(assets[0], asset1, "Remaining asset should be asset1");
    }

    function test_removeSupportedAsset_removesAllAssets() public {
        vm.startPrank(owner);
        cookieJarModule.removeSupportedAsset(asset1);
        cookieJarModule.removeSupportedAsset(asset2);
        vm.stopPrank();

        address[] memory assets = cookieJarModule.getSupportedAssets();
        assertEq(assets.length, 0, "Should have no assets after removing all");
    }

    function test_removeSupportedAsset_revertsIfNotFound() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ICookieJarModule.AssetNotFound.selector, address(0xDEAD)));
        cookieJarModule.removeSupportedAsset(address(0xDEAD));
    }

    function test_removeSupportedAsset_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        cookieJarModule.removeSupportedAsset(asset1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Jar Config — Withdrawal Defaults
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_jarConfigUsesDefaultWithdrawalSettings() public {
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        assertEq(factory.getLastMaxWithdrawal(), 100 ether, "maxWithdrawal should use default");
        assertEq(factory.getLastWithdrawalInterval(), 86_400, "withdrawalInterval should use default");
        assertEq(factory.getLastStrictPurpose(), false, "strictPurpose should use default");
    }

    function test_onGardenMinted_jarConfigReflectsUpdatedDefaults() public {
        // Update defaults
        vm.startPrank(owner);
        cookieJarModule.setDefaultMaxWithdrawal(5 ether);
        cookieJarModule.setDefaultWithdrawalInterval(7200);
        cookieJarModule.setDefaultStrictPurpose(true);
        vm.stopPrank();

        // Mint and verify
        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        assertEq(factory.getLastMaxWithdrawal(), 5 ether, "maxWithdrawal should reflect updated default");
        assertEq(factory.getLastWithdrawalInterval(), 7200, "withdrawalInterval should reflect updated default");
        assertEq(factory.getLastStrictPurpose(), true, "strictPurpose should reflect updated default");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Configurable Hats Protocol in jar creation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onGardenMinted_usesConfigurableHatsProtocol() public {
        // Update hatsProtocol to a different address
        address newHats = address(0xCAFE);
        vm.prank(owner);
        cookieJarModule.setHatsProtocol(newHats);

        vm.prank(gardenToken);
        cookieJarModule.onGardenMinted(garden1);

        ICookieJarFactory.NftRequirement memory nftReq = factory.getLastNftRequirement();
        assertEq(nftReq.nftContract, newHats, "NFT contract should use updated hatsProtocol");
    }
}
