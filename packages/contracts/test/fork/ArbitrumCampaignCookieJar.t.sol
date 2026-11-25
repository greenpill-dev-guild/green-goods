// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ICookieJarFactory } from "../../src/interfaces/ICookieJarFactory.sol";
import { ICookieJar } from "../../src/interfaces/ICookieJar.sol";

interface IRecurringCampaignJar is ICookieJar {
    function withdraw(uint256 amount, string calldata purpose) external;
    function grantJarAllowlistRole(address[] calldata users) external;
    function revokeJarAllowlistRole(address[] calldata users) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
    function currencyHeldByJar() external view returns (uint256);
}

interface ICampaignJarOwnerSafe {
    function getThreshold() external view returns (uint256);
}

/// @dev Uses the live factory and USDC. Impersonation and funding are confined to the test VM.
contract ArbitrumCampaignCookieJarForkTest is Test {
    ICookieJarFactory private constant FACTORY = ICookieJarFactory(0x294d222eDE6DF6625B43544F1C634322467528Da);
    IERC20 private constant USDC = IERC20(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
    address private constant TEAM_SAFE = 0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19;
    uint256 private constant FORK_BLOCK = 527_220_082;
    uint256 private constant MAX_CLAIM = 120e6;
    uint256 private constant COOLDOWN = 30 days;
    string private constant PURPOSE = "Green Goods campaign cookie claim";

    function testForkArbitrum_recurringCampaignJarPaysOnlyApprovedStewardsOnSchedule() public {
        vm.createSelectFork(vm.envString("ARBITRUM_RPC_URL"), FORK_BLOCK);
        assertEq(block.chainid, 42_161);
        assertGe(ICampaignJarOwnerSafe(TEAM_SAFE).getThreshold(), 2);

        address steward = makeAddr("pilot steward");
        address nextSteward = makeAddr("next pilot steward");
        IRecurringCampaignJar jar = _createJar(steward);
        assertTrue(jar.hasRole(keccak256("JAR_OWNER"), TEAM_SAFE));

        deal(address(USDC), TEAM_SAFE, 2 * MAX_CLAIM);
        vm.startPrank(TEAM_SAFE);
        assertTrue(USDC.approve(address(jar), 2 * MAX_CLAIM));
        jar.deposit(2 * MAX_CLAIM);
        vm.stopPrank();
        assertEq(jar.currencyHeldByJar(), 2 * MAX_CLAIM);

        vm.prank(nextSteward);
        vm.expectRevert();
        jar.withdraw(1e6, PURPOSE);

        vm.prank(steward);
        vm.expectRevert();
        jar.withdraw(MAX_CLAIM + 1, PURPOSE);
        vm.prank(steward);
        jar.withdraw(1e6, PURPOSE);

        vm.warp(block.timestamp + COOLDOWN - 1);
        vm.prank(steward);
        vm.expectRevert();
        jar.withdraw(1e6, PURPOSE);
        vm.warp(block.timestamp + 1);
        vm.prank(steward);
        jar.withdraw(MAX_CLAIM, PURPOSE);
        assertEq(USDC.balanceOf(steward), 121e6);

        address[] memory changed = new address[](1);
        vm.startPrank(TEAM_SAFE);
        changed[0] = steward;
        jar.revokeJarAllowlistRole(changed);
        changed[0] = nextSteward;
        jar.grantJarAllowlistRole(changed);
        vm.stopPrank();

        vm.warp(block.timestamp + COOLDOWN);
        vm.prank(steward);
        vm.expectRevert();
        jar.withdraw(1e6, PURPOSE);
        vm.prank(nextSteward);
        jar.withdraw(1e6, PURPOSE);
        assertEq(USDC.balanceOf(nextSteward), 1e6);
        assertEq(jar.currencyHeldByJar(), 118e6);
        assertEq(USDC.balanceOf(address(jar)), 118e6);
    }

    function _createJar(address steward) private returns (IRecurringCampaignJar) {
        ICookieJarFactory.MultiTokenConfig memory multiToken;
        ICookieJarFactory.JarConfig memory config = ICookieJarFactory.JarConfig({
            jarOwner: TEAM_SAFE,
            supportedCurrency: address(USDC),
            feeCollector: address(0),
            accessType: ICookieJarFactory.AccessType.Allowlist,
            withdrawalOption: ICookieJarFactory.WithdrawalTypeOptions.Variable,
            strictPurpose: true,
            emergencyWithdrawalEnabled: false,
            oneTimeWithdrawal: false,
            fixedAmount: 0,
            maxWithdrawal: MAX_CLAIM,
            withdrawalInterval: COOLDOWN,
            minDeposit: 0,
            feePercentageOnDeposit: 0,
            maxWithdrawalPerPeriod: 0,
            metadata: "",
            multiTokenConfig: multiToken
        });
        ICookieJarFactory.AccessConfig memory access;
        access.allowlist = new address[](1);
        access.allowlist[0] = steward;
        return IRecurringCampaignJar(FACTORY.createCookieJar(config, access, multiToken));
    }
}
