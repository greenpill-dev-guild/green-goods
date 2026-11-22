// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { RewardPayer } from "../../src/modules/RewardPayer.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";

/// @dev A token that answers a refused transfer with false instead of reverting.
contract FalseReturningToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

/// @dev A token whose transferFrom returns nothing, as USDT's does.
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

/// @dev A token that keeps 1% of every transfer, so the gardener would get less than the share.
contract FeeOnTransferToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount - amount / 100;
        return true;
    }
}

/// @dev A token that, mid-transfer, asks the payer to pay the same share again.
contract ReenteringToken {
    mapping(address => uint256) public balanceOf;
    RewardPayer internal payer;
    RewardPayer.Share internal replay;

    function arm(RewardPayer payer_, RewardPayer.Share memory share) external {
        payer = payer_;
        replay = share;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        payer.pay(replay);
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract RewardPayerTest is Test {
    RewardPayer internal payer;
    MockERC20 internal usdc;

    address internal constant MODULE = address(0x9001);
    address internal steward = makeAddr("steward");
    address internal gardener = makeAddr("gardener");
    address internal otherGardener = makeAddr("otherGardener");

    event RewardSharePaid(
        bytes32 indexed shareId,
        uint256 indexed commitmentId,
        address indexed recipient,
        address payer,
        address token,
        uint256 amount,
        uint256 promiseChainId,
        address promiseModule
    );

    function setUp() public {
        payer = new RewardPayer();
        usdc = new MockERC20();
        usdc.mint(steward, 1000e6);
        vm.prank(steward);
        usdc.approve(address(payer), type(uint256).max);
    }

    function _share(address recipient, uint256 amount) internal view returns (RewardPayer.Share memory) {
        return RewardPayer.Share({
            promiseChainId: 42_161,
            promiseModule: MODULE,
            commitmentId: 19,
            token: address(usdc),
            recipient: recipient,
            amount: amount
        });
    }

    function testRewardPayer_paysTheExactShareFromTheCallerAndRecordsWhoPaid() public {
        RewardPayer.Share memory share = _share(gardener, 20e6);
        bytes32 id = payer.shareIdOf(share);

        vm.expectEmit(true, true, true, true, address(payer));
        emit RewardSharePaid(id, 19, gardener, steward, address(usdc), 20e6, 42_161, MODULE);
        vm.prank(steward);
        assertEq(payer.pay(share), id);

        assertEq(usdc.balanceOf(gardener), 20e6);
        assertEq(usdc.balanceOf(steward), 980e6);
        assertEq(usdc.balanceOf(address(payer)), 0, "the payer never holds funds");
        assertEq(payer.paidBy(id), steward);
    }

    function testRewardPayer_revertsWhenAShareIsPaidTwice() public {
        RewardPayer.Share memory share = _share(gardener, 20e6);
        vm.startPrank(steward);
        bytes32 id = payer.pay(share);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareAlreadyPaid.selector, id));
        payer.pay(share);
        vm.stopPrank();

        // Another payer can't pay it again either.
        usdc.mint(otherGardener, 100e6);
        vm.startPrank(otherGardener);
        usdc.approve(address(payer), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareAlreadyPaid.selector, id));
        payer.pay(share);
        vm.stopPrank();
        assertEq(usdc.balanceOf(gardener), 20e6);
    }

    function testRewardPayer_namesEveryFieldInTheShareId() public {
        RewardPayer.Share memory share = _share(gardener, 20e6);
        bytes32 id = payer.shareIdOf(share);
        RewardPayer.Share memory changed = share;
        changed.amount = 21e6;
        assertTrue(payer.shareIdOf(changed) != id, "amount");
        changed = share;
        changed.recipient = otherGardener;
        assertTrue(payer.shareIdOf(changed) != id, "recipient");
        changed = share;
        changed.commitmentId = 20;
        assertTrue(payer.shareIdOf(changed) != id, "commitment");
        changed = share;
        changed.promiseChainId = 11_155_111;
        assertTrue(payer.shareIdOf(changed) != id, "promise chain");
        changed = share;
        changed.promiseModule = address(0x9002);
        assertTrue(payer.shareIdOf(changed) != id, "promise module");
        changed = share;
        changed.token = address(0xdead);
        assertTrue(payer.shareIdOf(changed) != id, "token");
    }

    /// @dev The app computes the same id (`rewardPayerShareId` in Shared) to find a share's receipt.
    function testRewardPayer_matchesTheAppsShareIdVector() public {
        RewardPayer.Share memory share = RewardPayer.Share({
            promiseChainId: 42_161,
            promiseModule: 0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a,
            commitmentId: 19,
            token: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831,
            recipient: 0x1111111111111111111111111111111111111111,
            amount: 20e6
        });
        assertEq(payer.shareIdOf(share), 0xb0ba81695077bb82d2c1990efdcfc726ae170fd74c321b6f46c8e51581fca378);
    }

    function testRewardPayer_revertsWhenAShareNamesNothingPayable() public {
        RewardPayer.Share memory share = _share(gardener, 20e6);
        RewardPayer.Share[6] memory invalid;
        for (uint256 i = 0; i < 6; ++i) {
            invalid[i] = share;
        }
        invalid[0].promiseChainId = 0;
        invalid[1].promiseModule = address(0);
        invalid[2].commitmentId = 0;
        invalid[3].token = address(0xdead); // no code
        invalid[4].recipient = address(0);
        invalid[5].amount = 0;
        vm.startPrank(steward);
        for (uint256 i = 0; i < 6; ++i) {
            vm.expectRevert(RewardPayer.InvalidShare.selector);
            payer.pay(invalid[i]);
        }
        vm.expectRevert(RewardPayer.SelfPayment.selector);
        payer.pay(_share(steward, 20e6));
        vm.stopPrank();
    }

    function testRewardPayer_revertsWhenTheGardenerWouldNotReceiveTheWholeShare() public {
        FeeOnTransferToken fee = new FeeOnTransferToken();
        FalseReturningToken refusing = new FalseReturningToken();
        fee.mint(steward, 100e6);
        refusing.mint(steward, 100e6);
        RewardPayer.Share memory share = _share(gardener, 20e6);

        share.token = address(fee);
        bytes32 feeId = payer.shareIdOf(share);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareNotDelivered.selector, feeId));
        payer.pay(share);
        assertEq(payer.paidBy(feeId), address(0), "a refused share stays unpaid");

        share.token = address(refusing);
        bytes32 refusedId = payer.shareIdOf(share);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareNotDelivered.selector, refusedId));
        payer.pay(share);

        // Not enough allowance: the token reverts, and the share stays unpaid.
        RewardPayer.Share memory tooMuch = _share(gardener, 2000e6);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareNotDelivered.selector, payer.shareIdOf(tooMuch)));
        payer.pay(tooMuch);
    }

    function testRewardPayer_paysWithATokenThatReturnsNothing() public {
        NoReturnToken token = new NoReturnToken();
        token.mint(steward, 100e6);
        RewardPayer.Share memory share = _share(gardener, 20e6);
        share.token = address(token);
        vm.prank(steward);
        payer.pay(share);
        assertEq(token.balanceOf(gardener), 20e6);
    }

    function testRewardPayer_revertsWhenATokenTriesToPayTheSameShareMidTransfer() public {
        ReenteringToken token = new ReenteringToken();
        token.mint(steward, 100e6);
        RewardPayer.Share memory share = _share(gardener, 20e6);
        share.token = address(token);
        token.arm(payer, share);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareNotDelivered.selector, payer.shareIdOf(share)));
        payer.pay(share);
        assertEq(token.balanceOf(gardener), 0);
        assertEq(payer.paidBy(payer.shareIdOf(share)), address(0));
    }

    function testRewardPayer_paysEveryShareInOneTransactionOrNone() public {
        RewardPayer.Share[] memory shares = new RewardPayer.Share[](2);
        shares[0] = _share(gardener, 12e6);
        shares[1] = _share(otherGardener, 8e6);
        vm.prank(steward);
        bytes32[] memory ids = payer.payAll(shares);
        assertEq(ids.length, 2);
        assertEq(usdc.balanceOf(gardener), 12e6);
        assertEq(usdc.balanceOf(otherGardener), 8e6);

        // One already-paid share sends the whole batch back, the new one included.
        shares[1] = _share(otherGardener, 9e6);
        vm.prank(steward);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareAlreadyPaid.selector, ids[0]));
        payer.payAll(shares);
        assertEq(payer.paidBy(payer.shareIdOf(shares[1])), address(0));
        assertEq(usdc.balanceOf(otherGardener), 8e6);

        vm.prank(steward);
        vm.expectRevert(RewardPayer.NoShares.selector);
        payer.payAll(new RewardPayer.Share[](0));
    }

    function testFuzz_RewardPayer_paysAnyShareOnceAndMovesExactlyItsAmount(
        uint256 commitmentId,
        address recipient,
        uint256 amount
    )
        public
    {
        vm.assume(recipient != address(0) && recipient != steward && recipient != address(payer));
        commitmentId = bound(commitmentId, 1, type(uint128).max);
        amount = bound(amount, 1, 1000e6);
        RewardPayer.Share memory share = _share(recipient, amount);
        share.commitmentId = commitmentId;
        uint256 before = usdc.balanceOf(recipient);

        vm.startPrank(steward);
        bytes32 id = payer.pay(share);
        vm.expectRevert(abi.encodeWithSelector(RewardPayer.ShareAlreadyPaid.selector, id));
        payer.pay(share);
        vm.stopPrank();

        assertEq(usdc.balanceOf(recipient) - before, amount);
        assertEq(payer.paidBy(id), steward);
    }
}
