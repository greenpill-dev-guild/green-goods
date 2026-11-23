// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { RewardPayer } from "../../src/modules/RewardPayer.sol";

interface IArbitrumUsdc {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// @notice The reward payer against live Arbitrum native USDC: a steward pays a gardener's share
/// from their own wallet, once (PRD-1556).
contract ArbitrumRewardPayerForkTest is Test {
    /// @dev Circle's native USDC on Arbitrum One, the token the pilot pays in.
    address internal constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    /// @dev The Arbitrum commitment pooling module that holds the promises (`42161-latest.json`).
    address internal constant POOLING_MODULE = 0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a;

    error ForkUnavailable(string chainName);

    RewardPayer internal payer;
    address internal steward = makeAddr("pilotSteward");
    address internal gardener = makeAddr("pilotGardener");

    function setUp() public {
        string memory rpc = _envString("ARBITRUM_FORK_RPC_URL");
        if (bytes(rpc).length == 0) rpc = _envString("ARBITRUM_RPC_URL");
        if (bytes(rpc).length == 0) revert ForkUnavailable("arbitrum");
        // The shard's pinned block when it sets one, so a CI run reads the same state each time.
        string memory block_ = _envString("ARBITRUM_FORK_BLOCK_NUMBER");
        if (bytes(block_).length == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, vm.parseUint(block_));
        assertEq(block.chainid, 42_161, "Arbitrum One fork");
        assertGt(USDC.code.length, 0, "USDC is live code");
        assertEq(IArbitrumUsdc(USDC).decimals(), 6);

        payer = new RewardPayer();
        deal(USDC, steward, 100e6);
    }

    function _envString(string memory name) internal view returns (string memory value) {
        try vm.envString(name) returns (string memory found) {
            value = found;
        } catch { }
    }

    function testIntegration_RewardPayer_paysAGardenersArbitrumUsdcShareOnce() public {
        RewardPayer.Share memory share = RewardPayer.Share({
            promiseChainId: 42_161,
            promiseModule: POOLING_MODULE,
            commitmentId: 19,
            token: USDC,
            recipient: gardener,
            amount: 20e6
        });

        vm.startPrank(steward);
        IArbitrumUsdc(USDC).approve(address(payer), 20e6);
        bytes32 id = payer.pay(share);

        assertEq(IArbitrumUsdc(USDC).balanceOf(gardener), 20e6, "the gardener holds the whole share");
        assertEq(IArbitrumUsdc(USDC).balanceOf(steward), 80e6, "it came from the steward's wallet");
        assertEq(IArbitrumUsdc(USDC).balanceOf(address(payer)), 0, "the payer holds nothing");
        assertEq(payer.paidBy(id), steward);

        // The approval is spent, and the share can't be paid again even with a fresh one.
        IArbitrumUsdc(USDC).approve(address(payer), 20e6);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareAlreadyPaid.selector, id));
        payer.pay(share);
        vm.stopPrank();
    }

    function testIntegration_RewardPayer_refusesAShareBeyondTheStewardsArbitrumApproval() public {
        RewardPayer.Share memory share = RewardPayer.Share({
            promiseChainId: 42_161,
            promiseModule: POOLING_MODULE,
            commitmentId: 20,
            token: USDC,
            recipient: gardener,
            amount: 20e6
        });
        vm.startPrank(steward);
        IArbitrumUsdc(USDC).approve(address(payer), 19e6);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareNotDelivered.selector, payer.shareIdOf(share)));
        payer.pay(share);
        vm.stopPrank();
        assertEq(payer.paidBy(payer.shareIdOf(share)), address(0));
        assertEq(IArbitrumUsdc(USDC).balanceOf(gardener), 0);
    }
}
