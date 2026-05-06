// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ForkTestBase } from "./ForkTestBase.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";

/// @notice Minimal interface for CookieJar deposit/withdraw interactions.
interface ICookieJarLike {
    function deposit(uint256 amount) external payable;
    function withdraw(uint256 amount, string calldata purpose) external;
}

/// @title CookieJarForkTestBase
/// @notice Shared base for fork tests validating CookieJar creation, Hats-gated withdrawal,
///         and protocol-token deposits through the stack deployed via ForkTestBase.
/// @dev Extends ForkTestBase. Subclasses override _chainName() to specify the fork target.
abstract contract CookieJarForkTestBase is ForkTestBase {
    /// @notice The chain name used for fork resolution, e.g. "sepolia" or "arbitrum".
    function _chainName() internal pure virtual returns (string memory);

    /// @notice Protocol ERC20 used as the CookieJar asset.
    IERC20 internal cookieToken;

    /// @notice Garden account minted for CookieJar tests.
    address internal cookieGarden;

    function setUp() public {
        if (!_tryChainFork(_chainName())) return;
        _deployFullStackOnFork();

        address token = address(goodsTokenContract);
        if (token == address(0) || token.code.length == 0) {
            revert ForkUnavailable("cookie jar token missing");
        }

        cookieToken = IERC20(token);
        cookieJarModule.addSupportedAsset(token);

        // Mint a garden and trigger CookieJarModule.onGardenMinted through GardenToken.
        cookieGarden = _mintTestGarden("CookieJar Fork Test Garden", 0x0F);
    }

    /// @notice Create jar, deposit a live fork token, verify non-member cannot withdraw,
    ///         grant gardener role via real HatsModule, verify gardener CAN withdraw.
    function test_fork_createsJar_deposit_and_hatsGatedWithdrawal() public {
        if (!forkActive || cookieGarden == address(0)) return;

        address jar = cookieJarModule.getGardenJar(cookieGarden, address(cookieToken));
        assertTrue(jar != address(0), "jar should be created");
        assertGt(jar.code.length, 0, "jar should be deployed code");

        uint256 depositAmount = 100 ether;
        _mintCookieToken(address(this), depositAmount);
        cookieToken.approve(jar, depositAmount);
        ICookieJarLike(jar).deposit(depositAmount);
        assertEq(cookieToken.balanceOf(jar), depositAmount, "jar should hold deposited token");

        vm.prank(forkGardener);
        (bool withdrawOk,) =
            jar.call(abi.encodeWithSelector(ICookieJarLike.withdraw.selector, 10 ether, "gated-withdrawal"));
        assertFalse(withdrawOk, "non-member withdrawal should revert through the jar's Hats gate");

        _grantGardenRole(cookieGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(cookieGarden, forkGardener), "gardener should have role");

        uint256 beforeBal = cookieToken.balanceOf(forkGardener);
        vm.prank(forkGardener);
        ICookieJarLike(jar).withdraw(10 ether, "gated-withdrawal");
        assertEq(cookieToken.balanceOf(forkGardener) - beforeBal, 10 ether, "hats wearer should withdraw");
    }

    /// @notice Withdrawal with a purpose string succeeds; live CookieJar rejects empty purposes.
    function test_fork_withdrawal_with_purpose_string() public {
        if (!forkActive || cookieGarden == address(0)) return;

        address jar = cookieJarModule.getGardenJar(cookieGarden, address(cookieToken));
        assertTrue(jar != address(0), "jar should exist");
        assertGt(jar.code.length, 0, "jar should be deployed code");

        uint256 depositAmount = 100 ether;
        _mintCookieToken(address(this), depositAmount);
        cookieToken.approve(jar, depositAmount);
        ICookieJarLike(jar).deposit(depositAmount);

        _grantGardenRole(cookieGarden, forkGardener, IHatsModule.GardenRole.Gardener);

        uint256 balBefore = cookieToken.balanceOf(forkGardener);
        vm.prank(forkGardener);
        ICookieJarLike(jar).withdraw(5 ether, "weekly groceries");
        assertEq(cookieToken.balanceOf(forkGardener) - balBefore, 5 ether, "purpose withdrawal should transfer");

        uint256 balBefore2 = cookieToken.balanceOf(forkGardener);
        vm.prank(forkGardener);
        (bool emptyPurposeOk,) = jar.call(abi.encodeWithSelector(ICookieJarLike.withdraw.selector, 5 ether, ""));
        assertFalse(emptyPurposeOk, "empty purpose withdrawal should revert on live CookieJar");
        assertEq(cookieToken.balanceOf(forkGardener), balBefore2, "empty purpose should not transfer");
    }

    function _mintCookieToken(address to, uint256 amount) internal {
        vm.prank(address(gardensModule));
        goodsTokenContract.mint(to, amount);
    }
}
