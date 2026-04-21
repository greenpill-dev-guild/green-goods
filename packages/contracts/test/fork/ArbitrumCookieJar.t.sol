// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IOctantVault } from "../../src/interfaces/IOctantFactory.sol";
import { AaveOctantForkBase, IWETH9 } from "./helpers/AaveOctantForkBase.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";

interface IArbitrumCookieJarLike {
    function deposit(uint256 amount) external payable;
    function withdraw(uint256 amount, string calldata purpose) external;
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

    function test_fork_routesLiveAaveYieldToRealDaiJar() public {
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
