// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { GoodsToken } from "../../src/tokens/Goods.sol";

/// @title GoodsTokenTest
/// @notice Unit tests for GoodsToken contract (standalone ERC-20)
contract GoodsTokenTest is Test {
    GoodsToken public goodsToken;

    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    uint256 public constant INITIAL_SUPPLY = 1_000_000e18;
    uint256 public constant MAX_SUPPLY = 100_000_000e18; // 100M cap

    function setUp() public {
        goodsToken = new GoodsToken("Green Goods", "GOODS", owner, INITIAL_SUPPLY, MAX_SUPPLY);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════

    function test_constructor_setsName() public {
        assertEq(goodsToken.name(), "Green Goods", "Name should be 'Green Goods'");
    }

    function test_constructor_setsSymbol() public {
        assertEq(goodsToken.symbol(), "GOODS", "Symbol should be 'GOODS'");
    }

    function test_constructor_setsOwner() public {
        assertEq(goodsToken.owner(), owner, "Owner should be set");
    }

    function test_constructor_mintsInitialSupplyToOwner() public {
        assertEq(goodsToken.balanceOf(owner), INITIAL_SUPPLY, "Owner should receive initial supply");
    }

    function test_constructor_totalSupplyMatchesInitial() public {
        assertEq(goodsToken.totalSupply(), INITIAL_SUPPLY, "Total supply should match initial supply");
    }

    function test_constructor_decimalsIs18() public {
        assertEq(goodsToken.decimals(), 18, "Decimals should be 18");
    }

    function test_constructor_zeroInitialSupply() public {
        GoodsToken zeroToken = new GoodsToken("Zero", "ZERO", owner, 0, MAX_SUPPLY);
        assertEq(zeroToken.totalSupply(), 0, "Total supply should be 0");
        assertEq(zeroToken.balanceOf(owner), 0, "Owner balance should be 0");
    }

    function test_constructor_customNameAndSymbol() public {
        GoodsToken custom = new GoodsToken("Custom Token", "CSTM", owner, 100e18, MAX_SUPPLY);
        assertEq(custom.name(), "Custom Token", "Custom name should be set");
        assertEq(custom.symbol(), "CSTM", "Custom symbol should be set");
    }

    function test_constructor_setsMaxSupply() public {
        assertEq(goodsToken.maxSupply(), MAX_SUPPLY, "Max supply should be set");
    }

    function test_constructor_revertsOnZeroMaxSupply() public {
        vm.expectRevert(GoodsToken.MaxSupplyZero.selector);
        new GoodsToken("Bad", "BAD", owner, 0, 0);
    }

    function test_constructor_revertsOnInitialExceedingMax() public {
        vm.expectRevert(abi.encodeWithSelector(GoodsToken.ExceedsMaxSupply.selector, 200e18, 100e18));
        new GoodsToken("Bad", "BAD", owner, 200e18, 100e18);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Minting — Access Control
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_ownerCanMint() public {
        vm.prank(owner);
        goodsToken.mint(user1, 1000e18);

        assertEq(goodsToken.balanceOf(user1), 1000e18, "User1 should receive minted tokens");
        assertEq(goodsToken.totalSupply(), INITIAL_SUPPLY + 1000e18, "Total supply should increase");
    }

    function test_mint_nonOwnerCannotMint() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        goodsToken.mint(user2, 1000e18);
    }

    function test_mint_zeroAmount() public {
        vm.prank(owner);
        goodsToken.mint(user1, 0);

        assertEq(goodsToken.balanceOf(user1), 0, "Balance should remain 0 after minting 0");
        assertEq(goodsToken.totalSupply(), INITIAL_SUPPLY, "Total supply should not change");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Minting — Supply Cap Enforcement
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_upToMaxSupply() public {
        uint256 remaining = MAX_SUPPLY - INITIAL_SUPPLY;
        vm.prank(owner);
        goodsToken.mint(user1, remaining);

        assertEq(goodsToken.totalSupply(), MAX_SUPPLY, "Total supply should equal max supply");
    }

    function test_mint_revertsExceedingMaxSupply() public {
        uint256 remaining = MAX_SUPPLY - INITIAL_SUPPLY;
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(GoodsToken.ExceedsMaxSupply.selector, remaining + 1, remaining));
        goodsToken.mint(user1, remaining + 1);
    }

    function test_mint_multipleMints() public {
        vm.startPrank(owner);
        goodsToken.mint(user1, 100e18);
        goodsToken.mint(user1, 200e18);
        goodsToken.mint(user2, 300e18);
        vm.stopPrank();

        assertEq(goodsToken.balanceOf(user1), 300e18, "User1 should have cumulative balance");
        assertEq(goodsToken.balanceOf(user2), 300e18, "User2 should have balance");
        assertEq(goodsToken.totalSupply(), INITIAL_SUPPLY + 600e18, "Total supply should reflect all mints");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Burning (ERC20Burnable)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_burn_holderCanBurnOwn() public {
        // Give user1 some tokens
        vm.prank(owner);
        goodsToken.mint(user1, 1000e18);

        vm.prank(user1);
        goodsToken.burn(500e18);

        assertEq(goodsToken.balanceOf(user1), 500e18, "User1 balance should decrease after burn");
        assertEq(goodsToken.totalSupply(), INITIAL_SUPPLY + 500e18, "Total supply should decrease after burn");
    }

    function test_burn_cannotBurnMoreThanBalance() public {
        vm.prank(owner);
        goodsToken.mint(user1, 100e18);

        vm.prank(user1);
        vm.expectRevert("ERC20: burn amount exceeds balance");
        goodsToken.burn(200e18);
    }

    function test_burnFrom_withApproval() public {
        vm.prank(owner);
        goodsToken.mint(user1, 1000e18);

        // User1 approves user2 to burn
        vm.prank(user1);
        goodsToken.approve(user2, 500e18);

        // User2 burns from user1's balance
        vm.prank(user2);
        goodsToken.burnFrom(user1, 500e18);

        assertEq(goodsToken.balanceOf(user1), 500e18, "User1 balance should decrease");
        assertEq(goodsToken.totalSupply(), INITIAL_SUPPLY + 500e18, "Total supply should decrease");
    }

    function test_burnFrom_revertsWithoutApproval() public {
        vm.prank(owner);
        goodsToken.mint(user1, 1000e18);

        vm.prank(user2);
        vm.expectRevert("ERC20: insufficient allowance");
        goodsToken.burnFrom(user1, 500e18);
    }

    function test_burn_entireBalance() public {
        vm.prank(owner);
        goodsToken.mint(user1, 1000e18);

        vm.prank(user1);
        goodsToken.burn(1000e18);

        assertEq(goodsToken.balanceOf(user1), 0, "User1 balance should be 0 after burning all");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Standard ERC-20 Transfers
    // ═══════════════════════════════════════════════════════════════════════════

    function test_transfer_basic() public {
        vm.prank(owner);
        goodsToken.transfer(user1, 500e18);

        assertEq(goodsToken.balanceOf(user1), 500e18, "User1 should receive transfer");
        assertEq(goodsToken.balanceOf(owner), INITIAL_SUPPLY - 500e18, "Owner balance should decrease");
    }

    function test_transfer_revertsOnInsufficientBalance() public {
        vm.prank(user1); // user1 has 0 balance
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        goodsToken.transfer(user2, 100e18);
    }

    function test_transferFrom_withApproval() public {
        vm.prank(owner);
        goodsToken.approve(user1, 500e18);

        vm.prank(user1);
        goodsToken.transferFrom(owner, user2, 500e18);

        assertEq(goodsToken.balanceOf(user2), 500e18, "User2 should receive transferred tokens");
    }

    function test_transferFrom_revertsWithoutApproval() public {
        vm.prank(user1);
        vm.expectRevert("ERC20: insufficient allowance");
        goodsToken.transferFrom(owner, user2, 500e18);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Ownership
    // ═══════════════════════════════════════════════════════════════════════════

    function test_transferOwnership() public {
        vm.prank(owner);
        goodsToken.transferOwnership(user1);

        assertEq(goodsToken.owner(), user1, "Ownership should transfer to user1");

        // New owner can mint
        vm.prank(user1);
        goodsToken.mint(user2, 100e18);
        assertEq(goodsToken.balanceOf(user2), 100e18, "New owner should be able to mint");

        // Old owner can no longer mint
        vm.prank(owner);
        vm.expectRevert("Ownable: caller is not the owner");
        goodsToken.mint(user2, 100e18);
    }

    function test_renounceOwnership() public {
        vm.prank(owner);
        goodsToken.renounceOwnership();

        assertEq(goodsToken.owner(), address(0), "Owner should be zero after renounce");

        // No one can mint after renouncing
        vm.prank(owner);
        vm.expectRevert("Ownable: caller is not the owner");
        goodsToken.mint(user1, 100e18);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Integration — GardensModule Pattern
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mint_gardensModulePattern() public {
        // Simulate GardensModule seeding: 100 GOODS per garden
        uint256 stakeAmountPerMember = 1e18;
        uint256 INITIAL_MEMBER_SLOTS = 100;
        uint256 seedAmount = stakeAmountPerMember * INITIAL_MEMBER_SLOTS;

        address gardenAddress = address(0x100);

        vm.prank(owner);
        goodsToken.mint(gardenAddress, seedAmount);

        assertEq(goodsToken.balanceOf(gardenAddress), 100e18, "Garden should receive 100 GOODS");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fuzz Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_mint_upToMaxSupplyByOwner(uint256 amount) public {
        // Bound to max remaining supply
        amount = bound(amount, 0, MAX_SUPPLY - INITIAL_SUPPLY);

        vm.prank(owner);
        goodsToken.mint(user1, amount);

        assertEq(goodsToken.balanceOf(user1), amount, "User should receive fuzzed amount");
        assertEq(goodsToken.totalSupply(), INITIAL_SUPPLY + amount, "Total supply should increase by fuzzed amount");
    }

    function testFuzz_burn_upToBalance(uint256 mintAmount, uint256 burnAmount) public {
        mintAmount = bound(mintAmount, 1, MAX_SUPPLY - INITIAL_SUPPLY);
        burnAmount = bound(burnAmount, 0, mintAmount);

        vm.prank(owner);
        goodsToken.mint(user1, mintAmount);

        vm.prank(user1);
        goodsToken.burn(burnAmount);

        assertEq(goodsToken.balanceOf(user1), mintAmount - burnAmount, "Balance should reflect burn");
    }
}
