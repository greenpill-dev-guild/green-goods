// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { AaveV3ERC4626 } from "../../src/strategies/AaveV3ERC4626.sol";
import { MockAavePool, MockAToken, MockPoolDataProvider } from "../../src/mocks/AavePool.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";

contract AaveV3ERC4626Test is Test {
    AaveV3ERC4626 internal strategy;
    MockERC20 internal asset;
    MockAToken internal aToken;
    MockAavePool internal pool;
    MockPoolDataProvider internal dataProvider;

    address internal owner = address(this);
    address internal depositor = address(0xBEEF);
    address internal receiver = address(0xCAFE);
    address internal donation = address(0xD0);
    address internal vaultAddr = address(0xFACE);

    function setUp() public {
        asset = new MockERC20();
        aToken = new MockAToken();
        pool = new MockAavePool(address(aToken));
        dataProvider = new MockPoolDataProvider(address(aToken));

        strategy = new AaveV3ERC4626(
            address(asset), "Green Goods Aave MOCK", "ggaMOCK", address(pool), address(aToken), address(dataProvider), owner
        );

        // Wire vault address for access-controlled deposits
        strategy.setVault(vaultAddr);

        // Fund vault and approve strategy (vault is the deposit caller)
        asset.mint(vaultAddr, 1000 ether);
        vm.prank(vaultAddr);
        asset.approve(address(strategy), type(uint256).max);

        // Keep depositor funding for withdraw tests (depositor owns shares, calls withdraw directly)
        asset.mint(depositor, 1000 ether);
        vm.prank(depositor);
        asset.approve(address(strategy), type(uint256).max);

        // Pre-fund aToken contract with liquidity (matches real Aave V3 where aToken holds underlying)
        asset.mint(address(aToken), 5000 ether);
        // aToken approves pool to pull underlying during withdrawals
        aToken.approveUnderlying(address(asset), address(pool));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════

    function test_constructor_setsCoreConfiguration() public {
        assertEq(strategy.asset(), address(asset));
        assertEq(address(strategy.aavePool()), address(pool));
        assertEq(address(strategy.aToken()), address(aToken));
        assertEq(address(strategy.dataProvider()), address(dataProvider));
        assertEq(strategy.owner(), owner);
        assertFalse(strategy.depositsPaused());
    }

    function test_constructor_revertsForZeroAddressInputs() public {
        vm.expectRevert(AaveV3ERC4626.ZeroAddress.selector);
        new AaveV3ERC4626(address(0), "Name", "SYM", address(pool), address(aToken), address(dataProvider), owner);

        vm.expectRevert();
        new AaveV3ERC4626(address(asset), "Name", "SYM", address(pool), address(aToken), address(dataProvider), address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Vault Access Control
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setVault_setsVaultAddress() public {
        assertEq(strategy.vault(), vaultAddr, "vault should be set during setUp");
    }

    function test_setVault_revertsOnSecondCall() public {
        vm.expectRevert(AaveV3ERC4626.VaultAlreadySet.selector);
        strategy.setVault(address(0xBBBB));
    }

    function test_setVault_revertsForZeroAddress() public {
        // Deploy a fresh strategy without vault set
        AaveV3ERC4626 fresh =
            new AaveV3ERC4626(address(asset), "Fresh", "FRSH", address(pool), address(aToken), address(dataProvider), owner);
        vm.expectRevert(AaveV3ERC4626.ZeroAddress.selector);
        fresh.setVault(address(0));
    }

    function test_setVault_revertsForNonOwner() public {
        AaveV3ERC4626 fresh =
            new AaveV3ERC4626(address(asset), "Fresh", "FRSH", address(pool), address(aToken), address(dataProvider), owner);
        vm.prank(depositor);
        vm.expectRevert();
        fresh.setVault(vaultAddr);
    }

    function test_deposit_revertsForNonVaultCaller() public {
        vm.prank(depositor);
        vm.expectRevert(AaveV3ERC4626.OnlyVault.selector);
        strategy.deposit(100 ether, depositor);
    }

    function test_mint_revertsForNonVaultCaller() public {
        vm.prank(depositor);
        vm.expectRevert(AaveV3ERC4626.OnlyVault.selector);
        strategy.mint(100 ether, depositor);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Deposits (via vault)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_deposit_mintsSharesAndSuppliesToAave() public {
        vm.prank(vaultAddr);
        uint256 shares = strategy.deposit(100 ether, depositor);

        assertEq(shares, 100 ether, "deposit should mint 1:1 shares");
        assertEq(strategy.balanceOf(depositor), 100 ether, "depositor should receive shares");
        assertEq(asset.balanceOf(address(strategy)), 0, "strategy should not keep idle assets after deposit");
        // In real Aave V3 (and our mock), underlying goes to aToken contract
        assertEq(asset.balanceOf(address(aToken)), 5100 ether, "aToken contract should hold supplied assets");
        assertEq(aToken.balanceOf(address(strategy)), 100 ether, "strategy should hold matching aTokens");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Withdrawals
    // ═══════════════════════════════════════════════════════════════════════════

    function test_withdraw_pullsFromAaveWhenIdleIsInsufficient() public {
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        vm.prank(depositor);
        uint256 burnedShares = strategy.withdraw(40 ether, receiver, depositor);

        assertEq(burnedShares, 40 ether, "withdraw should burn shares 1:1");
        assertEq(asset.balanceOf(receiver), 40 ether, "receiver should receive withdrawn assets");
        assertEq(strategy.balanceOf(depositor), 60 ether, "remaining shares should stay with depositor");
        assertEq(aToken.balanceOf(address(strategy)), 60 ether, "aToken balance should decrease");
    }

    function test_withdraw_revertsWhenAaveReturnsLessThanRequested() public {
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        // Simulate Aave returning less than requested (high utilization)
        pool.setPartialWithdrawLimit(10 ether);

        vm.prank(depositor);
        vm.expectRevert(abi.encodeWithSignature("InsufficientLiquidity(uint256,uint256)", 10 ether, 50 ether));
        strategy.withdraw(50 ether, receiver, depositor);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Total Assets & Reporting
    // ═══════════════════════════════════════════════════════════════════════════

    function test_totalAssets_reportsIdleAndATokenBalances() public {
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        asset.mint(address(strategy), 25 ether);
        aToken.mint(address(strategy), 10 ether);

        assertEq(strategy.totalAssets(), 135 ether, "totalAssets should include idle and deployed funds");
    }

    function test_report_returnsTotalAssets() public {
        vm.prank(vaultAddr);
        strategy.deposit(80 ether, depositor);
        aToken.mint(address(strategy), 20 ether);

        assertEq(strategy.report(), 100 ether, "report should expose total managed assets");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setDonationAddress_updatesAddress() public {
        strategy.setDonationAddress(donation);
        assertEq(strategy.donationAddress(), donation);
    }

    function test_shutdown_pausesDeposits() public {
        strategy.shutdown();
        assertTrue(strategy.depositsPaused(), "shutdown should pause deposits");
        assertEq(strategy.maxDeposit(depositor), 0, "paused strategy should reject new deposits");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Max Deposit
    // ═══════════════════════════════════════════════════════════════════════════

    function test_maxDeposit_returnsZeroWhenStrategyPaused() public {
        strategy.setDepositsPaused(true);
        assertEq(strategy.maxDeposit(depositor), 0);
    }

    function test_maxDeposit_returnsZeroWhenReserveIsNotAvailable() public {
        dataProvider.setReserveState(false, false, false);
        assertEq(strategy.maxDeposit(depositor), 0, "inactive reserve should block deposits");

        dataProvider.setReserveState(true, true, false);
        assertEq(strategy.maxDeposit(depositor), 0, "frozen reserve should block deposits");

        dataProvider.setReserveState(true, false, true);
        assertEq(strategy.maxDeposit(depositor), 0, "paused reserve should block deposits");
    }

    function test_maxDeposit_returnsUnlimitedWhenSupplyCapIsZero() public {
        assertEq(strategy.maxDeposit(depositor), type(uint256).max, "zero cap should mean unlimited capacity");
    }

    function test_maxDeposit_returnsRemainingCapacityWhenCapPartiallyUsed() public {
        dataProvider.setReserveCaps(100);
        aToken.mint(address(strategy), 40 ether);

        assertEq(
            strategy.maxDeposit(depositor), 60 ether, "remaining capacity should be supply cap minus outstanding aTokens"
        );
    }

    function test_maxDeposit_returnsZeroWhenCapIsFullyUsed() public {
        dataProvider.setReserveCaps(100);
        aToken.mint(address(strategy), 100 ether);

        assertEq(strategy.maxDeposit(depositor), 0, "full supply cap should block deposits");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Max Withdraw / Redeem
    // ═══════════════════════════════════════════════════════════════════════════

    function test_maxWithdraw_respectsAaveLiquidity() public {
        // Vault deposits 100 ether, shares go to depositor
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        // aToken contract now has 5100 ether (5000 initial + 100 from deposit).
        // Drain aToken to only 30 ether to simulate high Aave utilization.
        uint256 aTokenBalance = asset.balanceOf(address(aToken));
        uint256 drainAmount = aTokenBalance - 30 ether;
        vm.prank(address(aToken));
        asset.transfer(address(0xDEAD), drainAmount);

        // Strategy has 0 idle + aToken has 30 ether liquidity = 30 ether available
        uint256 maxW = strategy.maxWithdraw(depositor);
        assertLe(maxW, 30 ether, "maxWithdraw should be capped by available aToken liquidity");
        assertEq(maxW, 30 ether, "maxWithdraw should equal aToken liquidity when it is less than owner assets");
    }

    function test_maxRedeem_respectsAaveLiquidity() public {
        // Vault deposits 100 ether, shares go to depositor
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        // Drain aToken to only 30 ether
        uint256 aTokenBalance = asset.balanceOf(address(aToken));
        uint256 drainAmount = aTokenBalance - 30 ether;
        vm.prank(address(aToken));
        asset.transfer(address(0xDEAD), drainAmount);

        // maxRedeem should be capped proportionally to 30 ether worth of shares
        uint256 maxR = strategy.maxRedeem(depositor);
        uint256 expectedShares = strategy.convertToShares(30 ether);
        assertEq(maxR, expectedShares, "maxRedeem should return shares equivalent to capped maxWithdraw");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Interest Accrual (non-1:1 share prices)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_interestAccrual_sharesWorthMoreAfterYield() public {
        // Vault deposits 100 ether, shares go to depositor
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        // Simulate yield: mint extra aTokens to strategy (like Aave interest)
        aToken.mint(address(strategy), 10 ether);

        // totalAssets = 0 idle + 110 aTokens = 110 ether
        // totalSupply = 100 ether (shares)
        assertEq(strategy.totalAssets(), 110 ether, "total assets should include accrued yield");
        // OZ ERC4626 virtual offset: convertToAssets = shares*(totalAssets+1)/(totalSupply+1),
        // which rounds down by up to 1 wei
        assertApproxEqAbs(
            strategy.convertToAssets(100 ether),
            110 ether,
            1,
            "100 shares should be worth ~110 assets after yield (1 wei rounding from ERC4626 virtual offset)"
        );
    }

    function test_redeem_afterInterestAccrual_returnsCorrectAssets() public {
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        // Simulate yield
        aToken.mint(address(strategy), 10 ether);

        // Redeem all shares — should get back ~110 ether (deposit + yield)
        // OZ ERC4626 virtual offset causes up to 1 wei rounding loss on conversion
        vm.prank(depositor);
        uint256 assets = strategy.redeem(100 ether, receiver, depositor);

        assertApproxEqAbs(assets, 110 ether, 1, "redeem should return deposit + yield (1 wei ERC4626 rounding)");
        assertApproxEqAbs(
            asset.balanceOf(receiver), 110 ether, 1, "receiver should hold redeemed assets (1 wei ERC4626 rounding)"
        );
        assertEq(strategy.balanceOf(depositor), 0, "depositor should have 0 shares after full redeem");
    }

    function test_multiDepositor_differentSharePrices() public {
        // First deposit: 100 ether at 1:1 → 100 shares
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);
        assertEq(strategy.balanceOf(depositor), 100 ether, "first depositor gets 1:1 shares");

        // Simulate yield: 10 ether
        aToken.mint(address(strategy), 10 ether);
        // Now: totalAssets=110, totalSupply=100 → 1 share ≈ 1.1 assets

        // Second deposit: 110 ether → should get ~100 shares (at 1.1:1 ratio)
        // OZ ERC4626 virtual offset: shares = assets*(totalSupply+1)/(totalAssets+1)
        // = 110e18 * (100e18+1) / (110e18+1) ≈ 100e18 (within 1 wei)
        // Fund vault with more tokens for second deposit
        asset.mint(vaultAddr, 1000 ether);
        vm.prank(vaultAddr);
        uint256 secondDepositShares = strategy.deposit(110 ether, receiver);
        assertApproxEqAbs(
            secondDepositShares, 100 ether, 1, "second depositor should get shares at higher price (1 wei ERC4626 rounding)"
        );

        // Both redeem all shares — total assets ≈ 220, total shares ≈ 200
        // Each 100 shares should redeem to ≈ 110 ether
        // Cache balances before prank (vm.prank is consumed by the next external call)
        uint256 depositorShares = strategy.balanceOf(depositor);
        uint256 receiverShares = strategy.balanceOf(receiver);

        vm.prank(depositor);
        uint256 depositorAssets = strategy.redeem(depositorShares, depositor, depositor);

        vm.prank(receiver);
        uint256 receiverAssets = strategy.redeem(receiverShares, receiver, receiver);

        // Both should get approximately equal assets (~110 ether each, within ERC4626 rounding)
        assertApproxEqAbs(depositorAssets, 110 ether, 2, "first depositor should receive proportional share");
        assertApproxEqAbs(receiverAssets, 110 ether, 2, "second depositor should receive proportional share");
        // Verify total redemption accounts for all assets (no assets lost beyond dust)
        assertApproxEqAbs(
            depositorAssets + receiverAssets, 220 ether, 2, "total redemptions should account for all deposited assets"
        );
    }

    function test_deposit_revertsWhenMaxDepositIsZero() public {
        // Pause strategy so maxDeposit returns 0
        strategy.setDepositsPaused(true);
        assertEq(strategy.maxDeposit(vaultAddr), 0, "precondition: maxDeposit should be 0 when paused");

        // Attempt to deposit via vault — ERC4626 checks maxDeposit internally
        // and reverts with ERC4626ExceededMaxDeposit(receiver, assets, maxDeposit).
        // This confirms that when the vault's _updateDebt calls strategy.deposit() while
        // the Aave reserve is paused/frozen, the call reverts gracefully and the vault
        // keeps deposited funds as idle balance rather than deploying them.
        vm.prank(vaultAddr);
        vm.expectRevert();
        strategy.deposit(1 ether, depositor);
    }

    function test_maxWithdraw_respectsLiquidityAtNon1to1SharePrice() public {
        vm.prank(vaultAddr);
        strategy.deposit(100 ether, depositor);

        // Simulate yield
        aToken.mint(address(strategy), 10 ether);
        // Now depositor's 100 shares are worth 110 ether

        // Drain aToken liquidity to simulate high utilization
        // aToken currently has: 5000 (pre-funded) + 100 (deposit) + 10 (yield) = 5110
        // Drain to only 50 ether available
        uint256 aTokenBalance = asset.balanceOf(address(aToken));
        uint256 drainAmount = aTokenBalance - 50 ether;
        vm.prank(address(aToken));
        asset.transfer(address(0xDEAD), drainAmount);

        // maxWithdraw should be capped by liquidity (50) not owner assets (110)
        uint256 maxW = strategy.maxWithdraw(depositor);
        assertEq(maxW, 50 ether, "maxWithdraw should be capped by available liquidity at non-1:1 ratio");
    }
}
