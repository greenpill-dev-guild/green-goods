// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { MockHats } from "../../src/mocks/Hats.sol";

contract HatsProtocolDelegationTest is Test {
    HatsModule private module;
    MockHats private hats;
    address private team = address(0xA11);
    address private member = address(0xB22);
    uint256 private teamHat;
    uint256 private productLeadHat;
    uint256 private agentsHat;
    uint256 private deployerHat;

    function setUp() public {
        hats = new MockHats();
        module = HatsModule(
            address(
                new ERC1967Proxy(
                    address(new HatsModule()), abi.encodeCall(HatsModule.initialize, (address(this), address(hats)))
                )
            )
        );
        uint256 root = hats.mintTopHat(address(this), "Green Goods", "");
        teamHat = hats.createHat(root, "Team", 7, address(hats), address(hats), true, "");
        productLeadHat = hats.createHat(root, "Product Lead", 1, address(hats), address(hats), true, "");
        agentsHat = hats.createHat(root, "Agents", 1, address(hats), address(hats), true, "");
        deployerHat = hats.createHat(root, "Deployer", 1, address(hats), address(hats), true, "");
        uint256 gardensHat = hats.createHat(root, "Gardens", 1, address(hats), address(hats), true, "");
        module.setProtocolHatIds(root, gardensHat, 0);
        module.setProtocolRoleHats(teamHat, productLeadHat, agentsHat, deployerHat);
        hats.mintHat(teamHat, team);
        for (uint256 i = 0; i < 18; i++) {
            address garden = address(uint160(0x1000 + i));
            uint256 start = (i + 1) * 10;
            for (uint256 j = 0; j < 6; j++) {
                hats.setHatActive(start + j, true);
            }
            module.configureGarden(garden, start, start + 1, start + 2, start + 3, start + 4, start + 5);
        }
    }

    function testIntegration_Hats_teamManagesStewardsAcrossAllEighteenGardens() public {
        vm.startPrank(team);
        for (uint256 i = 0; i < 18; i++) {
            address garden = address(uint160(0x1000 + i));
            module.grantRole(garden, member, IHatsModule.GardenRole.Steward);
            assertTrue(module.isStewardOf(garden, member));
            assertTrue(module.isGardenerOf(garden, member));
            assertTrue(module.isEvaluatorOf(garden, member));
            module.revokeRole(garden, member, IHatsModule.GardenRole.Steward);
            assertFalse(module.isStewardOf(garden, member));
            assertTrue(module.isGardenerOf(garden, member), "Steward removal is not complete offboarding");
        }
        vm.stopPrank();
    }

    function testIntegration_Hats_teamCannotGrantOtherRolesOrRemapGardens() public {
        vm.startPrank(team);
        for (uint256 i = 0; i < 6; i++) {
            if (i == uint256(IHatsModule.GardenRole.Steward)) continue;
            vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
            module.grantRole(address(0x1000), member, IHatsModule.GardenRole(i));
        }
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
        module.configureGarden(address(0x1000), 1, 2, 3, 4, 5, 6);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
        module.deconfigureGarden(address(0x1000));
        vm.stopPrank();
    }

    function testIntegration_Hats_mixedBatchRevertsWithoutPartialStewardGrant() public {
        address[] memory accounts = new address[](2);
        accounts[0] = member;
        accounts[1] = member;
        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](2);
        roles[0] = IHatsModule.GardenRole.Steward;
        roles[1] = IHatsModule.GardenRole.Owner;
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
        module.grantRoles(address(0x1000), accounts, roles);
        assertFalse(module.isStewardOf(address(0x1000), member));
        assertFalse(module.isOwnerOf(address(0x1000), member));
    }

    function testIntegration_Hats_teamAppointedStewardCannotEscalateToOwnerOrUseGardenBypass() public {
        vm.prank(team);
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Steward);
        vm.prank(member);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, member, address(0x1000)));
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Owner);
        vm.prank(address(0x1000));
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, address(0x1000), address(0x1000)));
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Owner);
    }

    function testIntegration_Hats_roleRevocationAndToggleInvalidateTeamAtExecution() public {
        hats.setEligibility(teamHat, team, false);
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Steward);
        hats.setEligibility(teamHat, team, true);
        hats.setHatActive(teamHat, false);
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Steward);
        hats.setHatActive(teamHat, true);
        hats.setWearer(teamHat, team, false);
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Steward);
    }

    function testIntegration_Hats_otherProtocolRolesDoNotInheritTeamAuthority() public {
        hats.setWearer(teamHat, team, false);
        hats.mintHat(productLeadHat, team);
        hats.mintHat(agentsHat, team);
        hats.mintHat(deployerHat, team);
        vm.prank(team);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, team, address(0x1000)));
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Steward);
    }

    function testIntegration_Hats_teamCannotChangeProtocolRoleConfiguration() public {
        vm.prank(team);
        vm.expectRevert("Ownable: caller is not the owner");
        module.setProtocolRoleHats(0, 0, 0, 0);
        module.setProtocolRoleHats(0, productLeadHat, agentsHat, deployerHat);
        assertFalse(module.isProtocolTeam(team));
    }

    function testIntegration_Hats_onlyGovernanceCanTakeGardensToggleControl() public {
        vm.prank(team);
        vm.expectRevert("Ownable: caller is not the owner");
        module.configureProtocolAdministration(teamHat, productLeadHat, agentsHat, deployerHat);
        module.configureProtocolAdministration(teamHat, productLeadHat, agentsHat, deployerHat);
        (,,,, address toggle,,,, bool active) = hats.viewHat(module.gardensHatId());
        assertEq(toggle, address(this));
        assertTrue(active);
        assertTrue(module.isProtocolTeam(team));
    }

    function testIntegration_Hats_stewardRemovalKeepsOwnerAuthorityExplicit() public {
        module.grantRole(address(0x1000), member, IHatsModule.GardenRole.Owner);
        vm.prank(team);
        module.revokeRole(address(0x1000), member, IHatsModule.GardenRole.Steward);
        assertTrue(module.isOwnerOf(address(0x1000), member));
        assertFalse(module.isStewardOf(address(0x1000), member));
    }
}
