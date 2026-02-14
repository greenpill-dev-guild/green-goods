// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { GardenToken } from "../../src/tokens/Garden.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { NotGardenOwner, NotGardenOperator, InvalidInvite, AlreadyGardener } from "../../src/accounts/Garden.sol";
import { IGardenAccount } from "../../src/interfaces/IGardenAccount.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IKarmaGAPModule } from "../../src/interfaces/IKarmaGAPModule.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";

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

    function createMilestone(address, string calldata, string calldata, string calldata) external pure returns (bytes32) {
        return bytes32(0);
    }

    function getProjectUID(address garden) external view returns (bytes32) {
        return projectUIDs[garden];
    }

    function isSupported() external pure returns (bool) {
        return true;
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
    event OpenJoiningUpdated(address indexed updater, bool openJoining);

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
            weightScheme: IGardensModule.WeightScheme.Linear
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
}
