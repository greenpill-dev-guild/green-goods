// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import {
    NotGardenOwner, NotGardenOperator, InvalidInvite, AlreadyGardener, GardenFull
} from "../../src/accounts/Garden.sol";
import { IGardenAccount } from "../../src/interfaces/IGardenAccount.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../../src/interfaces/IKarmaGAPModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { MockRegistryCommunity } from "../../src/mocks/GardensV2.sol";

/// @notice Minimal KarmaGAP mock for testing GAP view delegation
contract MockKarmaGAPForAccount is IKarmaGAPModule {
    mapping(address garden => bytes32 uid) public projectUIDs;

    function setProjectUID(address garden, bytes32 uid) external {
        projectUIDs[garden] = uid;
    }

    function createProject(
        address,
        address,
        string calldata,
        string calldata,
        string calldata,
        string calldata
    )
        external
        pure
        returns (bytes32)
    {
        return bytes32(0);
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
        pure
        returns (bytes32)
    {
        return bytes32(0);
    }

    function createMilestone(
        address,
        string calldata,
        string calldata,
        uint256,
        uint256,
        uint8,
        string calldata,
        string calldata
    )
        external
        pure
        returns (bytes32)
    {
        return bytes32(0);
    }

    function getProjectUID(address garden) external view returns (bytes32) {
        return projectUIDs[garden];
    }

    function isSupported() external pure returns (bool) {
        return true;
    }
}

/// @notice Mock GardensModule for testing auto-registration in joinGarden
contract MockGardensModuleForAccount is IGardensModule {
    mapping(address => address) public gardenCommunities;
    uint256 public stakeAmountPerMember_;
    IERC20 public goodsToken_;

    function setGardenCommunity(address garden, address community) external {
        gardenCommunities[garden] = community;
    }

    function setStakeAmountPerMember(uint256 amount) external {
        stakeAmountPerMember_ = amount;
    }

    function setGoodsToken(address token_) external {
        goodsToken_ = IERC20(token_);
    }

    // IGardensModule interface implementations
    function onGardenMinted(address, WeightScheme) external pure returns (address, address[] memory) {
        return (address(0), new address[](0));
    }

    function createGardenPools(address) external pure returns (address[] memory) {
        return new address[](0);
    }

    function getGardenCommunity(address garden) external view returns (address) {
        return gardenCommunities[garden];
    }

    function getGardenSignalPools(address) external pure returns (address[] memory) {
        return new address[](0);
    }

    function getGardenWeightScheme(address) external pure returns (WeightScheme) {
        return WeightScheme.Linear;
    }

    function getGardenPowerRegistry(address) external pure returns (address) {
        return address(0);
    }

    function isGardenInitialized(address) external pure returns (bool) {
        return false;
    }

    function stakeAmountPerMember() external view returns (uint256) {
        return stakeAmountPerMember_;
    }

    function goodsToken() external view returns (IERC20) {
        return goodsToken_;
    }
}

/// @title GardenAccountTest
/// @notice Unit tests for GardenAccount — the token-bound account for gardens
/// @dev Mints a real garden via GardenToken to get a properly initialized TBA
contract GardenAccountTest is Test, ERC6551Helper {
    GardenToken private gardenToken;
    MockHatsModule private hatsModule;
    MockKarmaGAPForAccount private karmaModule;
    MockERC20 private communityToken;
    GardenAccount private gardenAccount;
    address private gardenAddress;

    address private multisig = address(0x123);
    address private operator = address(0x456);
    address private gardener = address(0x789);
    address private stranger = address(0x999);

    // Events
    event NameUpdated(address indexed updater, string newName);
    event DescriptionUpdated(address indexed updater, string newDescription);
    event LocationUpdated(address indexed updater, string newLocation);
    event BannerImageUpdated(address indexed updater, string newBannerImage);
    event MetadataUpdated(address indexed updater, string newMetadata);
    event OpenJoiningUpdated(address indexed updater, bool openJoining);
    event MemberAutoRegistered(address indexed member, address indexed community);

    function setUp() public {
        _deployERC6551Registry();

        GardenAccount impl = new GardenAccount(
            address(0x001), address(0x002), address(0x003), address(0x004), address(0x2001), address(0x2002)
        );

        GardenToken tokenImpl = new GardenToken(address(impl));
        bytes memory initData = abi.encodeWithSelector(GardenToken.initialize.selector, multisig, address(0));
        gardenToken = GardenToken(address(new ERC1967Proxy(address(tokenImpl), initData)));

        hatsModule = new MockHatsModule();
        karmaModule = new MockKarmaGAPForAccount();
        communityToken = new MockERC20();

        vm.startPrank(multisig);
        gardenToken.setHatsModule(address(hatsModule));
        gardenToken.setKarmaGAPModule(address(karmaModule));

        // Mint a garden to get a real, initialized GardenAccount TBA
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Test Garden",
            description: "A test garden",
            location: "Test Location",
            bannerImage: "test-banner.png",
            metadata: "ipfs://metadata",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0
        });
        gardenAddress = gardenToken.mintGarden(config);
        vm.stopPrank();

        gardenAccount = GardenAccount(payable(gardenAddress));

        // Configure roles in mock: multisig is owner, operator is operator
        hatsModule.setOwner(gardenAddress, multisig, true);
        hatsModule.setOperator(gardenAddress, operator, true);
        hatsModule.setGardener(gardenAddress, gardener, true);
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    function test_initialize_setsName() public {
        assertEq(gardenAccount.name(), "Test Garden", "Name should be set from config");
    }

    function test_initialize_setsDescription() public {
        assertEq(gardenAccount.description(), "A test garden", "Description should be set");
    }

    function test_initialize_setsLocation() public {
        assertEq(gardenAccount.location(), "Test Location", "Location should be set");
    }

    function test_initialize_setsBannerImage() public {
        assertEq(gardenAccount.bannerImage(), "test-banner.png", "Banner image should be set");
    }

    function test_initialize_setsMetadata() public {
        assertEq(gardenAccount.metadata(), "ipfs://metadata", "Metadata should be set");
    }

    function test_initialize_setsCommunityToken() public {
        assertEq(gardenAccount.communityToken(), address(communityToken), "Community token should be set");
    }

    function test_initialize_setsOpenJoining() public {
        assertFalse(gardenAccount.openJoining(), "Open joining should default to false");
    }

    function test_initialize_revertsOnDoubleInit() public {
        IGardenAccount.InitParams memory params = IGardenAccount.InitParams({
            communityToken: address(communityToken),
            name: "Re-init",
            description: "",
            location: "",
            bannerImage: "",
            metadata: "",
            openJoining: false
        });

        vm.expectRevert("Initializable: contract is already initialized");
        gardenAccount.initialize(params);
    }

    // =========================================================================
    // updateName Tests
    // =========================================================================

    function test_updateName_ownerCanUpdate() public {
        vm.prank(multisig);
        gardenAccount.updateName("New Name");
        assertEq(gardenAccount.name(), "New Name");
    }

    function test_updateName_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit NameUpdated(multisig, "New Name");

        vm.prank(multisig);
        gardenAccount.updateName("New Name");
    }

    function test_updateName_revertsForOperator() public {
        vm.prank(operator);
        vm.expectRevert(NotGardenOwner.selector);
        gardenAccount.updateName("Operator Name");
    }

    function test_updateName_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(NotGardenOwner.selector);
        gardenAccount.updateName("Stranger Name");
    }

    function test_updateName_allowsEmptyString() public {
        vm.prank(multisig);
        gardenAccount.updateName("");
        assertEq(gardenAccount.name(), "");
    }

    // =========================================================================
    // updateDescription Tests
    // =========================================================================

    function test_updateDescription_operatorCanUpdate() public {
        vm.prank(operator);
        gardenAccount.updateDescription("New Desc");
        assertEq(gardenAccount.description(), "New Desc");
    }

    function test_updateDescription_ownerCanUpdate() public {
        // Owner is also an operator (inclusive hierarchy)
        vm.prank(multisig);
        gardenAccount.updateDescription("Owner Desc");
        assertEq(gardenAccount.description(), "Owner Desc");
    }

    function test_updateDescription_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit DescriptionUpdated(operator, "New Desc");

        vm.prank(operator);
        gardenAccount.updateDescription("New Desc");
    }

    function test_updateDescription_revertsForGardener() public {
        vm.prank(gardener);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateDescription("Gardener Desc");
    }

    function test_updateDescription_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateDescription("Stranger Desc");
    }

    function test_updateDescription_allowsEmptyString() public {
        vm.prank(operator);
        gardenAccount.updateDescription("");
        assertEq(gardenAccount.description(), "");
    }

    // =========================================================================
    // updateLocation Tests
    // =========================================================================

    function test_updateLocation_operatorCanUpdate() public {
        vm.prank(operator);
        gardenAccount.updateLocation("New Location");
        assertEq(gardenAccount.location(), "New Location");
    }

    function test_updateLocation_ownerCanUpdate() public {
        vm.prank(multisig);
        gardenAccount.updateLocation("Owner Location");
        assertEq(gardenAccount.location(), "Owner Location");
    }

    function test_updateLocation_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit LocationUpdated(operator, "New Location");

        vm.prank(operator);
        gardenAccount.updateLocation("New Location");
    }

    function test_updateLocation_revertsForGardener() public {
        vm.prank(gardener);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateLocation("Gardener Location");
    }

    function test_updateLocation_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateLocation("Stranger Location");
    }

    // =========================================================================
    // updateBannerImage Tests
    // =========================================================================

    function test_updateBannerImage_operatorCanUpdate() public {
        vm.prank(operator);
        gardenAccount.updateBannerImage("new-banner.png");
        assertEq(gardenAccount.bannerImage(), "new-banner.png");
    }

    function test_updateBannerImage_ownerCanUpdate() public {
        vm.prank(multisig);
        gardenAccount.updateBannerImage("owner-banner.png");
        assertEq(gardenAccount.bannerImage(), "owner-banner.png");
    }

    function test_updateBannerImage_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit BannerImageUpdated(operator, "new-banner.png");

        vm.prank(operator);
        gardenAccount.updateBannerImage("new-banner.png");
    }

    function test_updateBannerImage_revertsForGardener() public {
        vm.prank(gardener);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateBannerImage("gardener-banner.png");
    }

    function test_updateBannerImage_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateBannerImage("stranger-banner.png");
    }

    // =========================================================================
    // updateMetadata Tests
    // =========================================================================

    function test_updateMetadata_operatorCanUpdate() public {
        vm.prank(operator);
        gardenAccount.updateMetadata("ipfs://new-metadata");
        assertEq(gardenAccount.metadata(), "ipfs://new-metadata");
    }

    function test_updateMetadata_ownerCanUpdate() public {
        vm.prank(multisig);
        gardenAccount.updateMetadata("ipfs://owner-metadata");
        assertEq(gardenAccount.metadata(), "ipfs://owner-metadata");
    }

    function test_updateMetadata_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit MetadataUpdated(operator, "ipfs://new-metadata");

        vm.prank(operator);
        gardenAccount.updateMetadata("ipfs://new-metadata");
    }

    function test_updateMetadata_revertsForGardener() public {
        vm.prank(gardener);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateMetadata("ipfs://gardener-metadata");
    }

    function test_updateMetadata_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateMetadata("ipfs://stranger-metadata");
    }

    // =========================================================================
    // joinGarden Tests
    // =========================================================================

    function test_joinGarden_revertsWhenNotOpen() public {
        vm.prank(stranger);
        vm.expectRevert(InvalidInvite.selector);
        gardenAccount.joinGarden();
    }

    function test_joinGarden_succeedsWhenOpen() public {
        // Enable open joining
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        vm.prank(stranger);
        gardenAccount.joinGarden();

        // Verify grantRole was called with Gardener role
        uint256 callCount = hatsModule.grantCallsLength();
        // GardenToken.mintGarden already made grant calls; the last one should be from joinGarden
        (, address lastAccount, IHatsModule.GardenRole lastRole) = hatsModule.grantCalls(callCount - 1);
        assertEq(lastAccount, stranger);
        assertEq(uint8(lastRole), uint8(IHatsModule.GardenRole.Gardener));
    }

    function test_joinGarden_revertsIfAlreadyGardener() public {
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        // gardener already has the role set in setUp
        vm.prank(gardener);
        vm.expectRevert(AlreadyGardener.selector);
        gardenAccount.joinGarden();
    }

    // =========================================================================
    // setOpenJoining Tests
    // =========================================================================

    function test_setOpenJoining_operatorCanEnable() public {
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);
        assertTrue(gardenAccount.openJoining());
    }

    function test_setOpenJoining_operatorCanDisable() public {
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        vm.prank(operator);
        gardenAccount.setOpenJoining(false);
        assertFalse(gardenAccount.openJoining());
    }

    function test_setOpenJoining_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit OpenJoiningUpdated(operator, true);

        vm.prank(operator);
        gardenAccount.setOpenJoining(true);
    }

    function test_setOpenJoining_revertsForGardener() public {
        vm.prank(gardener);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.setOpenJoining(true);
    }

    function test_setOpenJoining_revertsForStranger() public {
        vm.prank(stranger);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.setOpenJoining(true);
    }

    // =========================================================================
    // Role View Tests (IGardenAccessControl)
    // =========================================================================

    function test_isGardener_returnsTrueForGardener() public {
        assertTrue(gardenAccount.isGardener(gardener));
    }

    function test_isGardener_returnsTrueForOperator() public {
        // Inclusive hierarchy: operator is implicitly a gardener
        assertTrue(gardenAccount.isGardener(operator));
    }

    function test_isGardener_returnsTrueForOwner() public {
        assertTrue(gardenAccount.isGardener(multisig));
    }

    function test_isGardener_returnsFalseForStranger() public {
        assertFalse(gardenAccount.isGardener(stranger));
    }

    function test_isOperator_returnsTrueForOperator() public {
        assertTrue(gardenAccount.isOperator(operator));
    }

    function test_isOperator_returnsTrueForOwner() public {
        assertTrue(gardenAccount.isOperator(multisig));
    }

    function test_isOperator_returnsFalseForGardener() public {
        assertFalse(gardenAccount.isOperator(gardener));
    }

    function test_isOwner_returnsTrueForOwner() public {
        assertTrue(gardenAccount.isOwner(multisig));
    }

    function test_isOwner_returnsFalseForOperator() public {
        assertFalse(gardenAccount.isOwner(operator));
    }

    function test_isFunder_delegatesToHatsModule() public {
        hatsModule.setFunder(gardenAddress, stranger, true);
        assertTrue(gardenAccount.isFunder(stranger));
    }

    function test_isCommunity_delegatesToHatsModule() public {
        hatsModule.setCommunity(gardenAddress, stranger, true);
        assertTrue(gardenAccount.isCommunity(stranger));
    }

    function test_isEvaluator_returnsTrueForEvaluator() public {
        hatsModule.setEvaluator(gardenAddress, stranger, true);
        assertTrue(gardenAccount.isEvaluator(stranger));
    }

    function test_isEvaluator_returnsTrueForOperator() public {
        // Inclusive hierarchy
        assertTrue(gardenAccount.isEvaluator(operator));
    }

    function test_isEvaluator_returnsTrueForOwner() public {
        assertTrue(gardenAccount.isEvaluator(multisig));
    }

    // =========================================================================
    // GAP View Tests
    // =========================================================================

    function test_getGAPProjectUID_delegatesToKarmaModule() public {
        bytes32 expectedUID = bytes32(uint256(0xABCD));
        karmaModule.setProjectUID(gardenAddress, expectedUID);
        assertEq(gardenAccount.getGAPProjectUID(), expectedUID);
    }

    function test_gapProjectUID_aliasForGetGAPProjectUID() public {
        bytes32 expectedUID = bytes32(uint256(0x1234));
        karmaModule.setProjectUID(gardenAddress, expectedUID);
        assertEq(gardenAccount.gapProjectUID(), expectedUID);
        assertEq(gardenAccount.gapProjectUID(), gardenAccount.getGAPProjectUID());
    }

    function test_getGAPProjectUID_returnsZeroWhenNoKarmaModule() public {
        // Remove karma module
        vm.prank(multisig);
        gardenToken.setKarmaGAPModule(address(0));

        assertEq(gardenAccount.getGAPProjectUID(), bytes32(0));
    }

    // =========================================================================
    // Auto-Registration in Community (joinGarden + _autoRegisterInCommunity)
    // =========================================================================

    function test_joinGarden_succeedsWithoutGardensModule() public {
        // GardensModule not set — auto-registration silently skipped
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        vm.prank(stranger);
        gardenAccount.joinGarden();

        // Gardener role should still be granted
        assertTrue(hatsModule.isGardenerOf(gardenAddress, stranger));
    }

    function test_joinGarden_autoRegistersWhenFullyConfigured() public {
        // 1. Set up GardensModule mock
        MockGardensModuleForAccount gardensModuleMock = new MockGardensModuleForAccount();
        MockERC20 goodsToken_ = new MockERC20();
        MockRegistryCommunity community = new MockRegistryCommunity(address(goodsToken_), multisig);

        gardensModuleMock.setGardenCommunity(gardenAddress, address(community));
        gardensModuleMock.setStakeAmountPerMember(1e18);
        gardensModuleMock.setGoodsToken(address(goodsToken_));

        // 2. Wire GardensModule into GardenToken
        vm.prank(multisig);
        gardenToken.setGardensModule(address(gardensModuleMock));

        // 3. Fund garden TBA with GOODS
        goodsToken_.mint(gardenAddress, 100e18);

        // 4. Enable open joining
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        // 5. Join garden
        vm.prank(stranger);
        gardenAccount.joinGarden();

        // Gardener role granted
        assertTrue(hatsModule.isGardenerOf(gardenAddress, stranger));

        // Community registration happened
        assertTrue(community.isRegisteredMember(stranger));
    }

    function test_joinGarden_succeedsWhenGardenHasNoCommunity() public {
        // GardensModule set but no community for this garden
        MockGardensModuleForAccount gardensModuleMock = new MockGardensModuleForAccount();
        MockERC20 goodsToken_ = new MockERC20();
        gardensModuleMock.setGoodsToken(address(goodsToken_));
        gardensModuleMock.setStakeAmountPerMember(1e18);
        // Don't set community — defaults to address(0)

        vm.prank(multisig);
        gardenToken.setGardensModule(address(gardensModuleMock));

        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        vm.prank(stranger);
        gardenAccount.joinGarden();

        // Role still granted
        assertTrue(hatsModule.isGardenerOf(gardenAddress, stranger));
    }

    function test_joinGarden_emitsMemberAutoRegistered() public {
        // Full setup for auto-registration
        MockGardensModuleForAccount gardensModuleMock = new MockGardensModuleForAccount();
        MockERC20 goodsToken_ = new MockERC20();
        MockRegistryCommunity community = new MockRegistryCommunity(address(goodsToken_), multisig);

        gardensModuleMock.setGardenCommunity(gardenAddress, address(community));
        gardensModuleMock.setStakeAmountPerMember(1e18);
        gardensModuleMock.setGoodsToken(address(goodsToken_));

        vm.prank(multisig);
        gardenToken.setGardensModule(address(gardensModuleMock));

        goodsToken_.mint(gardenAddress, 100e18);

        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        // Expect MemberAutoRegistered event
        vm.expectEmit(true, true, false, false);
        emit MemberAutoRegistered(stranger, address(community));

        vm.prank(stranger);
        gardenAccount.joinGarden();
    }

    function test_joinGarden_succeedsWhenStakeAmountIsZero() public {
        MockGardensModuleForAccount gardensModuleMock = new MockGardensModuleForAccount();
        MockERC20 goodsToken_ = new MockERC20();
        MockRegistryCommunity community = new MockRegistryCommunity(address(goodsToken_), multisig);

        gardensModuleMock.setGardenCommunity(gardenAddress, address(community));
        gardensModuleMock.setStakeAmountPerMember(0); // zero stake
        gardensModuleMock.setGoodsToken(address(goodsToken_));

        vm.prank(multisig);
        gardenToken.setGardensModule(address(gardensModuleMock));

        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        vm.prank(stranger);
        gardenAccount.joinGarden();

        // Role granted, but no community registration (stakeAmount=0 → early return)
        assertTrue(hatsModule.isGardenerOf(gardenAddress, stranger));
        assertFalse(community.isRegisteredMember(stranger));
    }

    function test_joinGarden_succeedsWhenGoodsTokenIsZero() public {
        MockGardensModuleForAccount gardensModuleMock = new MockGardensModuleForAccount();
        MockRegistryCommunity community = new MockRegistryCommunity(address(communityToken), multisig);

        gardensModuleMock.setGardenCommunity(gardenAddress, address(community));
        gardensModuleMock.setStakeAmountPerMember(1e18);
        // Don't set goodsToken — defaults to address(0)

        vm.prank(multisig);
        gardenToken.setGardensModule(address(gardensModuleMock));

        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        vm.prank(stranger);
        gardenAccount.joinGarden();

        assertTrue(hatsModule.isGardenerOf(gardenAddress, stranger));
        assertFalse(community.isRegisteredMember(stranger));
    }

    function test_joinGarden_succeedsWhenInsufficientGOODS() public {
        // Full setup but garden TBA has no GOODS
        MockGardensModuleForAccount gardensModuleMock = new MockGardensModuleForAccount();
        MockERC20 goodsToken_ = new MockERC20();
        MockRegistryCommunity community = new MockRegistryCommunity(address(goodsToken_), multisig);

        gardensModuleMock.setGardenCommunity(gardenAddress, address(community));
        gardensModuleMock.setStakeAmountPerMember(1e18);
        gardensModuleMock.setGoodsToken(address(goodsToken_));
        // Don't mint GOODS to garden — balance = 0

        vm.prank(multisig);
        gardenToken.setGardensModule(address(gardensModuleMock));

        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        vm.prank(stranger);
        gardenAccount.joinGarden();

        // Role granted, community NOT registered (no GOODS)
        assertTrue(hatsModule.isGardenerOf(gardenAddress, stranger));
        assertFalse(community.isRegisteredMember(stranger));
    }

    // =========================================================================
    // executeAutoStake — Self-Only Access Control Tests
    // =========================================================================

    function test_executeAutoStake_revertsWhenCalledByOwner() public {
        vm.prank(multisig);
        vm.expectRevert("Only internal auto-stake");
        gardenAccount.executeAutoStake(address(communityToken), address(0x123), 1e18, stranger);
    }

    function test_executeAutoStake_revertsWhenCalledByOperator() public {
        vm.prank(operator);
        vm.expectRevert("Only internal auto-stake");
        gardenAccount.executeAutoStake(address(communityToken), address(0x123), 1e18, stranger);
    }

    function test_executeAutoStake_revertsWhenCalledByStranger() public {
        vm.prank(stranger);
        vm.expectRevert("Only internal auto-stake");
        gardenAccount.executeAutoStake(address(communityToken), address(0x123), 1e18, stranger);
    }

    function test_executeAutoStake_revertsWhenCalledByGardener() public {
        vm.prank(gardener);
        vm.expectRevert("Only internal auto-stake");
        gardenAccount.executeAutoStake(address(communityToken), address(0x123), 1e18, stranger);
    }

    // =========================================================================
    // joinGarden — Hierarchy-Inclusive Guard Tests (Critical Fix #2)
    // =========================================================================

    function test_joinGarden_revertsIfAlreadyOperator() public {
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        // operator is implicitly a gardener via hierarchy — should be blocked
        vm.prank(operator);
        vm.expectRevert(AlreadyGardener.selector);
        gardenAccount.joinGarden();
    }

    function test_joinGarden_revertsIfAlreadyOwner() public {
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        // owner is implicitly a gardener via hierarchy — should be blocked
        vm.prank(multisig);
        vm.expectRevert(AlreadyGardener.selector);
        gardenAccount.joinGarden();
    }

    // =========================================================================
    // Sequential Metadata Updates
    // =========================================================================

    function test_updateName_multipleTimes_lastValuePersists() public {
        vm.startPrank(multisig);
        gardenAccount.updateName("First");
        gardenAccount.updateName("Second");
        gardenAccount.updateName("Third");
        vm.stopPrank();

        assertEq(gardenAccount.name(), "Third", "Last name should persist");
    }

    function test_updateAllMetadata_sequentially() public {
        vm.startPrank(operator);
        gardenAccount.updateDescription("New Desc");
        gardenAccount.updateLocation("New Location");
        gardenAccount.updateBannerImage("new-banner.png");
        gardenAccount.updateMetadata("ipfs://new");
        vm.stopPrank();

        assertEq(gardenAccount.description(), "New Desc");
        assertEq(gardenAccount.location(), "New Location");
        assertEq(gardenAccount.bannerImage(), "new-banner.png");
        assertEq(gardenAccount.metadata(), "ipfs://new");

        // Original name is unchanged (requires owner, not operator)
        assertEq(gardenAccount.name(), "Test Garden");
    }

    // =========================================================================
    // Role Removal Edge Cases
    // =========================================================================

    function test_isGardener_returnsFalseAfterRoleRemoval() public {
        // gardener has role
        assertTrue(gardenAccount.isGardener(gardener));

        // Remove role in mock
        hatsModule.setGardener(gardenAddress, gardener, false);

        // Should reflect immediately
        assertFalse(gardenAccount.isGardener(gardener));
    }

    function test_isOperator_returnsFalseAfterRoleRemoval() public {
        assertTrue(gardenAccount.isOperator(operator));

        hatsModule.setOperator(gardenAddress, operator, false);

        assertFalse(gardenAccount.isOperator(operator));
    }

    function test_updateDescription_revertsAfterOperatorRoleRemoved() public {
        // operator can update initially
        vm.prank(operator);
        gardenAccount.updateDescription("Works");
        assertEq(gardenAccount.description(), "Works");

        // Remove operator role
        hatsModule.setOperator(gardenAddress, operator, false);

        // Now should revert
        vm.prank(operator);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.updateDescription("Should fail");
    }

    // =========================================================================
    // Max Gardener Cap Tests (GA-4 / GA-5)
    // =========================================================================

    function test_joinGarden_respectsMaxGardeners() public {
        // Enable open joining and set cap to 2
        vm.startPrank(operator);
        gardenAccount.setOpenJoining(true);
        gardenAccount.setMaxGardeners(2);
        vm.stopPrank();

        // First gardener joins
        address gardener1 = address(0xA01);
        vm.prank(gardener1);
        gardenAccount.joinGarden();
        assertEq(gardenAccount.gardenMemberCount(), 1);

        // Second gardener joins
        address gardener2 = address(0xA02);
        vm.prank(gardener2);
        gardenAccount.joinGarden();
        assertEq(gardenAccount.gardenMemberCount(), 2);

        // Third gardener should be rejected
        address gardener3 = address(0xA03);
        vm.prank(gardener3);
        vm.expectRevert(GardenFull.selector);
        gardenAccount.joinGarden();
    }

    function test_joinGarden_unlimitedWhenZero() public {
        // Enable open joining, maxGardeners defaults to 0 (unlimited)
        vm.prank(operator);
        gardenAccount.setOpenJoining(true);

        assertEq(gardenAccount.maxGardeners(), 0, "maxGardeners should default to 0");

        // Join at least 3 gardeners — all should succeed
        for (uint256 i = 0; i < 3; i++) {
            address newGardener = address(uint160(0xB00 + i));
            vm.prank(newGardener);
            gardenAccount.joinGarden();
        }

        assertEq(gardenAccount.gardenMemberCount(), 3, "All 3 gardeners should have joined");
    }

    function test_setMaxGardeners() public {
        // Operator can set the cap
        vm.prank(operator);
        gardenAccount.setMaxGardeners(50);
        assertEq(gardenAccount.maxGardeners(), 50, "Cap should be set to 50");

        // Owner can also set the cap (inclusive hierarchy)
        vm.prank(multisig);
        gardenAccount.setMaxGardeners(100);
        assertEq(gardenAccount.maxGardeners(), 100, "Cap should be set to 100");

        // Gardener cannot set the cap
        vm.prank(gardener);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.setMaxGardeners(5);

        // Stranger cannot set the cap
        vm.prank(stranger);
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.setMaxGardeners(5);
    }
}
