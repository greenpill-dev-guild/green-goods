// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { KarmaGAPModule } from "../../src/modules/Karma.sol";

/// @notice Exact pre-repair Karma storage shell used to prove proxy upgrade compatibility.
contract LegacyKarmaGAPModuleFixture is OwnableUpgradeable, UUPSUpgradeable {
    address public gardenToken;
    address public workApprovalResolver;
    address public assessmentResolver;
    address public hatsModule;
    mapping(address garden => bytes32 projectUID) public gardenProjects;
    uint256[45] private __gap;

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner_,
        address gardenToken_,
        address workApprovalResolver_,
        address assessmentResolver_
    )
        external
        initializer
    {
        __Ownable_init();
        _transferOwnership(owner_);
        gardenToken = gardenToken_;
        workApprovalResolver = workApprovalResolver_;
        assessmentResolver = assessmentResolver_;
    }

    function seed(address hatsModule_, address garden, bytes32 projectUID) external onlyOwner {
        hatsModule = hatsModule_;
        gardenProjects[garden] = projectUID;
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}

contract KarmaGAPUpgradeTest is Test {
    address internal constant OWNER = address(0xA11CE);
    address internal constant GARDEN_TOKEN = address(0xB01);
    address internal constant WORK_APPROVAL = address(0xB02);
    address internal constant ASSESSMENT = address(0xB03);
    address internal constant HATS = address(0xB04);
    address internal constant GARDEN = address(0xB05);
    bytes32 internal constant PROJECT_UID = bytes32(uint256(0xB06));

    function testUpgrade_Karma_preservesLegacyStorageAndInitializesNewSlotsEmpty() public {
        LegacyKarmaGAPModuleFixture legacyImplementation = new LegacyKarmaGAPModuleFixture();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(legacyImplementation),
            abi.encodeCall(LegacyKarmaGAPModuleFixture.initialize, (OWNER, GARDEN_TOKEN, WORK_APPROVAL, ASSESSMENT))
        );
        LegacyKarmaGAPModuleFixture legacy = LegacyKarmaGAPModuleFixture(address(proxy));
        vm.prank(OWNER);
        legacy.seed(HATS, GARDEN, PROJECT_UID);

        KarmaGAPModule newImplementation = new KarmaGAPModule();
        vm.prank(OWNER);
        legacy.upgradeTo(address(newImplementation));

        KarmaGAPModule upgraded = KarmaGAPModule(address(proxy));
        assertEq(upgraded.owner(), OWNER);
        assertEq(upgraded.gardenToken(), GARDEN_TOKEN);
        assertEq(upgraded.workApprovalResolver(), WORK_APPROVAL);
        assertEq(upgraded.assessmentResolver(), ASSESSMENT);
        assertEq(upgraded.hatsModule(), HATS);
        assertEq(upgraded.gardenProjects(GARDEN), PROJECT_UID);
        assertEq(upgraded.gardenDetailsHashes(GARDEN), bytes32(0));
        assertEq(upgraded.gardenMemberOfUIDs(GARDEN, OWNER), bytes32(0));
        assertEq(upgraded.projectUpdateUIDs(bytes32(uint256(1))), bytes32(0));
        assertFalse(upgraded.projectUpdateMigrationComplete());
    }

    function testUpgrade_Karma_blocksProjectUpdatesUntilLegacyUIDsAreSeeded() public {
        vm.chainId(11_155_111);
        LegacyKarmaGAPModuleFixture legacyImplementation = new LegacyKarmaGAPModuleFixture();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(legacyImplementation),
            abi.encodeCall(LegacyKarmaGAPModuleFixture.initialize, (OWNER, GARDEN_TOKEN, WORK_APPROVAL, ASSESSMENT))
        );
        LegacyKarmaGAPModuleFixture legacy = LegacyKarmaGAPModuleFixture(address(proxy));
        vm.prank(OWNER);
        legacy.seed(HATS, GARDEN, PROJECT_UID);

        KarmaGAPModule newImplementation = new KarmaGAPModule();
        vm.prank(OWNER);
        legacy.upgradeTo(address(newImplementation));

        KarmaGAPModule upgraded = KarmaGAPModule(address(proxy));
        bytes32 workUID = bytes32(uint256(0xCAFE));
        bytes32 updateUID = bytes32(uint256(0xBEEF));
        vm.prank(WORK_APPROVAL);
        assertEq(upgraded.createProjectUpdate(GARDEN, "Work", "Update", "proof", workUID, "metadata"), bytes32(0));

        bytes32[] memory workUIDs = new bytes32[](1);
        workUIDs[0] = workUID;
        bytes32[] memory updateUIDs = new bytes32[](1);
        updateUIDs[0] = updateUID;
        vm.prank(OWNER);
        upgraded.migrateProjectUpdates(workUIDs, updateUIDs);

        assertTrue(upgraded.projectUpdateMigrationComplete());
        assertEq(upgraded.projectUpdateUIDs(workUID), updateUID);
        vm.prank(WORK_APPROVAL);
        assertEq(upgraded.createProjectUpdate(GARDEN, "Work", "Update", "proof", workUID, "metadata"), updateUID);
    }
}
