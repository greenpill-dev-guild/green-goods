// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ICookieJar } from "../../src/interfaces/ICookieJar.sol";
import { ICookieJarFactory } from "../../src/interfaces/ICookieJarFactory.sol";
import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { AaveOctantForkBase, IWETH9 } from "./helpers/AaveOctantForkBase.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";

interface IArbitrumCookieJarLike {
    function deposit(uint256 amount) external payable;
    function withdraw(uint256 amount, string calldata purpose) external;
    function maxWithdrawal() external view returns (uint256);
    function currencyHeldByJar() external view returns (uint256);
}

interface IRecurringCampaignJar is ICookieJar {
    error NotAuthorized();
    error WithdrawalAmountNotAllowed(uint256 requested, uint256 allowed);
    error WithdrawalTooSoon(uint256 nextAllowed);

    function withdraw(uint256 amount, string calldata purpose) external;
    function grantJarAllowlistRole(address[] calldata users) external;
    function revokeJarAllowlistRole(address[] calldata users) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
    function currencyHeldByJar() external view returns (uint256);
}

interface ICampaignJarOwnerSafe {
    function getThreshold() external view returns (uint256);
}

contract ArbitrumCookieJarForkTest is AaveOctantForkBase {
    address internal cookieGarden;

    function setUp() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnForkWithAssets(WETH, WETH);

        cookieJarModule.addSupportedAsset(WETH);
        cookieGarden = _mintTestGarden("CookieJar Arbitrum WETH Garden", 0x0F);
    }

    function test_fork_createsJarWithRealFactoryAndWethAsset() public {
        address jar = _requireWethJar();

        assertEq(address(cookieJarModule.cookieJarFactory()), _getCookieJarFactoryForChain(42_161), "factory mismatch");
        assertGt(address(cookieJarModule.cookieJarFactory()).code.length, 0, "factory must be live Arbitrum code");
        assertGt(WETH.code.length, 0, "WETH must be live Arbitrum code");
        assertGt(jar.code.length, 0, "jar must be deployed by live CookieJar factory");
    }

    function test_fork_depositAndHatsGatedWithdrawalUsesRealWethJar() public {
        address jar = _requireWethJar();
        uint256 amount = 0.1 ether;

        _depositWethIntoJar(jar, amount);

        vm.prank(forkGardener);
        (bool withdrawOk,) =
            jar.call(abi.encodeWithSelector(IArbitrumCookieJarLike.withdraw.selector, 0.01 ether, "gated-withdrawal"));
        assertFalse(withdrawOk, "non-member withdrawal should revert through the jar's Hats gate");

        _grantGardenRole(cookieGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(cookieGarden, forkGardener), "gardener should have role");

        uint256 beforeBal = IERC20(WETH).balanceOf(forkGardener);
        vm.prank(forkGardener);
        IArbitrumCookieJarLike(jar).withdraw(0.01 ether, "gated-withdrawal");
        assertEq(IERC20(WETH).balanceOf(forkGardener) - beforeBal, 0.01 ether, "hats wearer should withdraw WETH");
    }

    /// @dev 0.01 WETH is a fair claim and 0.01 DAI is a cent, so each asset carries its own limit
    ///      into the jars the live factory deploys.
    function testForkArbitrum_newJarsTakeTheirAssetsOwnClaimLimit() public {
        cookieJarModule.addSupportedAsset(DAI);
        cookieJarModule.setDefaultMaxWithdrawal(0.01 ether);
        cookieJarModule.setAssetMaxWithdrawal(DAI, 10 ether);

        address garden = _mintTestGarden("CookieJar Arbitrum Per-Asset Limits", 0x0F);

        address daiJar = cookieJarModule.getGardenJar(garden, DAI);
        address wethJar = cookieJarModule.getGardenJar(garden, WETH);
        assertEq(IArbitrumCookieJarLike(daiJar).maxWithdrawal(), 10 ether, "DAI jar should allow 10 DAI per claim");
        assertEq(IArbitrumCookieJarLike(wethJar).maxWithdrawal(), 0.01 ether, "WETH jar should fall back to the default");
    }

    function test_fork_emptyPurposeRevertsOnLiveCookieJar() public {
        address jar = _requireWethJar();
        _depositWethIntoJar(jar, 0.1 ether);
        _grantGardenRole(cookieGarden, forkGardener, IHatsModule.GardenRole.Gardener);

        uint256 beforeBal = IERC20(WETH).balanceOf(forkGardener);
        vm.prank(forkGardener);
        IArbitrumCookieJarLike(jar).withdraw(0.01 ether, "weekly groceries");
        assertEq(IERC20(WETH).balanceOf(forkGardener) - beforeBal, 0.01 ether, "purpose withdrawal should transfer");

        uint256 beforeEmptyPurpose = IERC20(WETH).balanceOf(forkGardener);
        vm.prank(forkGardener);
        (bool emptyPurposeOk,) = jar.call(abi.encodeWithSelector(IArbitrumCookieJarLike.withdraw.selector, 0.01 ether, ""));
        assertFalse(emptyPurposeOk, "empty purpose withdrawal should revert on live CookieJar");
        assertEq(IERC20(WETH).balanceOf(forkGardener), beforeEmptyPurpose, "empty purpose should not transfer");
    }

    function testForkArbitrum_routedAaveYieldCanBeWithdrawnFromRealDaiJar() public {
        cookieJarModule.addSupportedAsset(DAI);
        address daiGarden = _mintTestGarden("CookieJar Arbitrum DAI Yield Garden", 0x0F);

        _configureAaveVaultSupportForAsset(DAI, ADAI, "CookieJar Arbitrum Vaults", "CookieJar Arbitrum DAI", "ggaCJDAI");

        address vault = octantModule.getVaultForAsset(daiGarden, DAI);
        if (vault == address(0)) {
            vault = octantModule.createVaultForAsset(daiGarden, DAI);
        }
        assertGt(vault.code.length, 0, "vault should be deployed");
        assertEq(IOctantVault(vault).asset(), DAI, "vault should use live Arbitrum DAI");

        uint256 amount = 1 ether;
        _depositLiveAaveAssetIntoVault(vault, DAI, ADAI, amount);
        _assertLiveAaveDepositAccounted(vault, DAI, ADAI, amount, "deposit should remain fully accounted");

        _warpForHarvestWindow();
        _harvestRegistersSharesWhenAaveHasYieldAsset(daiGarden, DAI, vault);

        address jar = cookieJarModule.getGardenJar(daiGarden, DAI);
        assertTrue(jar != address(0), "DAI jar should be created");
        assertGt(jar.code.length, 0, "DAI jar should be deployed code");
        yieldSplitter.setCookieJar(daiGarden, jar);
        yieldSplitter.setGardenTreasury(daiGarden, makeAddr("cookieJarTreasury"));
        yieldSplitter.setMinYieldThreshold(0);

        uint256 jarBefore = IERC20(DAI).balanceOf(jar);
        yieldSplitter.splitYield(daiGarden, DAI, vault);
        uint256 jarDelta = IERC20(DAI).balanceOf(jar) - jarBefore;

        assertGt(jarDelta, 0, "live DAI jar should receive yield");
        assertEq(yieldSplitter.gardenShares(daiGarden, vault), 0, "all garden shares should be redeemed");
        assertEq(IArbitrumCookieJarLike(jar).currencyHeldByJar(), jarDelta, "live DAI jar should book the yield");

        _grantGardenRole(daiGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        uint256 beforeBal = IERC20(DAI).balanceOf(forkGardener);
        vm.prank(forkGardener);
        IArbitrumCookieJarLike(jar).withdraw(jarDelta, "routed-yield");
        assertEq(IERC20(DAI).balanceOf(forkGardener) - beforeBal, jarDelta, "hats wearer should withdraw the routed yield");
    }

    function _requireWethJar() internal returns (address jar) {
        jar = cookieJarModule.getGardenJar(cookieGarden, WETH);
        assertTrue(jar != address(0), "WETH jar should be created");
        assertGt(jar.code.length, 0, "WETH jar should be deployed code");
    }

    function _depositWethIntoJar(address jar, uint256 amount) internal {
        vm.deal(address(this), amount);
        IWETH9(WETH).deposit{ value: amount }();
        IERC20(WETH).approve(jar, amount);
        IArbitrumCookieJarLike(jar).deposit(amount);
        assertEq(IERC20(WETH).balanceOf(jar), amount, "jar should hold deposited WETH");
    }
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
        vm.expectRevert(IRecurringCampaignJar.NotAuthorized.selector);
        jar.withdraw(1e6, PURPOSE);

        vm.prank(steward);
        vm.expectRevert(
            abi.encodeWithSelector(IRecurringCampaignJar.WithdrawalAmountNotAllowed.selector, MAX_CLAIM + 1, MAX_CLAIM)
        );
        jar.withdraw(MAX_CLAIM + 1, PURPOSE);
        vm.prank(steward);
        jar.withdraw(1e6, PURPOSE);
        uint256 nextClaimAt = block.timestamp + COOLDOWN;

        vm.warp(nextClaimAt - 1);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(IRecurringCampaignJar.WithdrawalTooSoon.selector, nextClaimAt));
        jar.withdraw(1e6, PURPOSE);
        vm.warp(nextClaimAt);
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
        vm.expectRevert(IRecurringCampaignJar.NotAuthorized.selector);
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
