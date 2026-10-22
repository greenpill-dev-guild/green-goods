// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { ICLCGiftableToken, ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { ICLCSwapPool } from "../../src/interfaces/ICLCSwapPool.sol";
import {
    ICLCPurchasePool,
    ICLCPurchaseIndex,
    ICLCPurchaseLimiter,
    ICLCPurchaseQuoter,
    ICLCPurchaseFeePolicy,
    ICLCPurchaseProtocolFee,
    IRehearsalWXDAI
} from "./CLCPurchaseInterfaces.sol";

/// @dev Fictional fixture using published CLC implementations, never upstream source imports.
///      All amounts and prices are rehearsal values, not real issuer terms or service capacity.
abstract contract CLCPurchaseFixture is Test {
    uint256 internal constant GNOSIS_BLOCK = 48_848_261;
    address internal constant CLC_FACTORY = 0xB286994c648F98fD3a3BA6C43934828a5b88162b;
    address internal constant GIFTABLE_IMPLEMENTATION = 0x34445d13F112A11f72C1d353a7dcdc407F3df2d8;
    address internal constant POOL_IMPLEMENTATION = 0x9e694D342Cab02e295262B2290b0E64A0334160D;
    address internal constant INDEX_IMPLEMENTATION = 0x0CEB18BA6562D3227717D98c044A5849bE8362EF;
    address internal constant LIMITER_IMPLEMENTATION = 0x258AAd6c933F70D7F071E112800a41Fb60434048;
    address internal constant QUOTER_IMPLEMENTATION = 0x0B0986c0E580377389337C453Cc65A3933511165;
    address internal constant FEE_IMPLEMENTATION = 0x1b97FfFAF2D2e16C8F7de6826F4F658dc898E5b6;
    address internal constant PROTOCOL_FEE_IMPLEMENTATION = 0x302E6d520e7D7AeFceA4813e456234B5daA23B4d;
    address internal constant REHEARSAL_WXDAI = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;
    uint256 internal constant INVENTORY = 1000e6;
    uint256 internal constant INPUT = 10 ether;
    uint256 internal constant GROSS = 5e6;
    uint256 internal constant POOL_FEE = 100_000;
    uint256 internal constant PROTOCOL_FEE = 10_000;
    uint256 internal constant OUTPUT = 4_890_000;

    struct PoolBundle {
        ICLCPurchasePool pool;
        ICLCPurchaseIndex index;
        ICLCPurchaseLimiter limiter;
        ICLCPurchaseQuoter quoter;
        ICLCPurchaseFeePolicy feePolicy;
        ICLCPurchaseProtocolFee protocolFee;
    }

    struct PurchaseBalances {
        uint256 payerPayment;
        uint256 poolPayment;
        uint256 learnerVouchers;
        uint256 poolVouchers;
        uint256 protocolVouchers;
        uint256 accruedPoolFee;
        uint256 allowance;
        uint256 voucherSupply;
    }

    address internal _issuerSafeStandIn;
    address internal _communitySafeStandIn;
    address internal _payer;
    address internal _learner;
    address internal _attacker;
    address internal _poolFeeRecipient;
    address internal _protocolFeeRecipient;
    TimelockController internal _issuerUpgradeTimelock;
    TimelockController internal _communityUpgradeTimelock;
    ICLCGiftableToken internal _voucher;
    IRehearsalWXDAI internal _wxdai;
    PoolBundle internal _primary;

    function _selectGnosisForkAndCheckImplementations() internal {
        // Process-provided public/provider RPC is optional; no dotenv file is loaded or printed.
        string memory rpc = "https://rpc.gnosischain.com";
        try vm.envString("GNOSIS_RPC_URL") returns (string memory configuredRpc) {
            rpc = configuredRpc;
        } catch { }
        vm.createSelectFork(rpc, GNOSIS_BLOCK);
        assertEq(block.chainid, 100, "expected Gnosis chain");
        assertEq(block.number, GNOSIS_BLOCK, "expected existing conformance pin");
        _assertPurchaseImplementations();
    }

    function _assertPurchaseImplementations() internal {
        assertEq(CLC_FACTORY.codehash, 0x2e06e9a024d7bd35356833e6fcb9f34c1fbdae8bbd91da3bc55e4cc2ba4d1230);
        assertEq(GIFTABLE_IMPLEMENTATION.codehash, 0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91);
        assertEq(POOL_IMPLEMENTATION.codehash, 0xc353aac7dd541d1c50c7eeb20a15a44ea9f93524f23a26217a557667ddd87847);
        assertEq(INDEX_IMPLEMENTATION.codehash, 0x7d87c5eb290d28f0961269d99ccb278992b7a1e1ad358abb35156a80bc7f3db5);
        assertEq(LIMITER_IMPLEMENTATION.codehash, 0x4703592f66925654d50872a319602d2ec144698515abc9e4df00c36d5b4a3d32);
        assertEq(QUOTER_IMPLEMENTATION.codehash, 0x6b1691764731912392f3c3c24121d3d3fc26e844fa464d93f323e4205f0ac273);
        assertEq(FEE_IMPLEMENTATION.codehash, 0x7fcdb49bc3a1a63a41a22e7646e46a17d347c2aa790dbc1f524f8c50ddc03b3c);
        assertEq(PROTOCOL_FEE_IMPLEMENTATION.codehash, 0xf441076998949ba0daa400a3b16613691260673679d12087fe39ddb19c62c1d9);
    }

    function _initializePurchaseFixture() internal {
        _issuerSafeStandIn = makeAddr("fictional-voucher-issuer-Safe-stand-in");
        _communitySafeStandIn = makeAddr("fictional-pool-community-Safe-stand-in");
        _payer = makeAddr("fictional-voucher-purchase-sponsor");
        _learner = makeAddr("fictional-named-learner");
        _attacker = makeAddr("fictional-unrelated-account");
        _poolFeeRecipient = makeAddr("fictional-pool-fee-recipient");
        _protocolFeeRecipient = makeAddr("fictional-protocol-fee-recipient");
        _issuerUpgradeTimelock = _timelock(_issuerSafeStandIn);
        _communityUpgradeTimelock = _timelock(_communitySafeStandIn);
        _wxdai = IRehearsalWXDAI(REHEARSAL_WXDAI);
        assertGt(REHEARSAL_WXDAI.code.length, 0, "actual rehearsal WXDAI must exist");
        assertEq(_wxdai.symbol(), "WXDAI");
        assertEq(_wxdai.decimals(), 18);
        _voucher = ICLCGiftableToken(
            ICLCERC1967Factory(CLC_FACTORY)
                .deployAndCall(
                    GIFTABLE_IMPLEMENTATION,
                    address(_issuerUpgradeTimelock),
                    abi.encodeCall(
                        ICLCGiftableToken.initialize,
                        (
                            "Fictional service voucher - rehearsal only",
                            "REHEARSAL",
                            uint8(6),
                            _issuerSafeStandIn,
                            uint256(0)
                        )
                    )
                )
        );
        _primary = _createPoolBundle("Fictional community pool", "REHEARSALP", 2_000_000);
        _fundBuyer(_payer, 100 ether);
    }

    function _createPoolBundle(
        string memory name,
        string memory symbol,
        uint256 voucherPriceIndex
    )
        internal
        returns (PoolBundle memory bundle)
    {
        bundle.index = ICLCPurchaseIndex(
            _deployCommunityProxy(
                INDEX_IMPLEMENTATION,
                abi.encodeCall(ICLCPurchaseIndex.initialize, (_communitySafeStandIn, new address[](0), new bytes32[](0)))
            )
        );
        bundle.limiter = ICLCPurchaseLimiter(
            _deployCommunityProxy(
                LIMITER_IMPLEMENTATION, abi.encodeCall(ICLCPurchaseLimiter.initialize, (_communitySafeStandIn))
            )
        );
        bundle.quoter = ICLCPurchaseQuoter(
            _deployCommunityProxy(
                QUOTER_IMPLEMENTATION, abi.encodeCall(ICLCPurchaseQuoter.initialize, (_communitySafeStandIn))
            )
        );
        bundle.feePolicy = ICLCPurchaseFeePolicy(
            _deployCommunityProxy(
                FEE_IMPLEMENTATION,
                abi.encodeCall(ICLCPurchaseFeePolicy.initialize, (_communitySafeStandIn, uint256(20_000)))
            )
        );
        bundle.protocolFee = ICLCPurchaseProtocolFee(
            _deployCommunityProxy(
                PROTOCOL_FEE_IMPLEMENTATION,
                abi.encodeCall(
                    ICLCPurchaseProtocolFee.initialize, (_communitySafeStandIn, uint256(100_000), _protocolFeeRecipient)
                )
            )
        );
        bundle.pool = ICLCPurchasePool(
            _deployCommunityProxy(
                POOL_IMPLEMENTATION,
                abi.encodeCall(
                    ICLCPurchasePool.initialize,
                    (
                        name,
                        symbol,
                        uint8(6),
                        _communitySafeStandIn,
                        address(bundle.feePolicy),
                        _poolFeeRecipient,
                        address(bundle.index),
                        address(bundle.limiter),
                        address(bundle.quoter),
                        true,
                        address(bundle.protocolFee)
                    )
                )
            )
        );

        vm.startPrank(_communitySafeStandIn);
        bundle.index.register(address(_voucher));
        bundle.index.register(address(_wxdai));
        bundle.limiter.setLimitFor(address(_wxdai), address(bundle.pool), 1000 ether);
        bundle.limiter.setLimitFor(address(_voucher), address(bundle.pool), 2000e6);
        bundle.quoter.setPriceIndexValue(address(_wxdai), 1_000_000);
        bundle.quoter.setPriceIndexValue(address(_voucher), voucherPriceIndex);
        bundle.pool.seal(31);
        vm.stopPrank();

        vm.prank(_issuerSafeStandIn);
        _voucher.mintTo(_issuerSafeStandIn, INVENTORY);
        _depositInventory(bundle.pool, INVENTORY);
    }

    function _timelock(address safeStandIn) private returns (TimelockController) {
        address[] memory governors = new address[](1);
        governors[0] = safeStandIn;
        return new TimelockController(48 hours, governors, governors, address(0));
    }

    function _deployCommunityProxy(address implementation, bytes memory initialization) private returns (address) {
        return
            ICLCERC1967Factory(CLC_FACTORY)
                .deployAndCall(implementation, address(_communityUpgradeTimelock), initialization);
    }

    function _fundBuyer(address buyer, uint256 amount) internal {
        vm.deal(buyer, amount);
        vm.prank(buyer);
        _wxdai.deposit{ value: amount }();
    }

    function _approvePurchase(ICLCPurchasePool pool, address buyer, uint256 amount) internal {
        vm.prank(buyer);
        _wxdai.approve(address(pool), amount);
    }

    function _depositInventory(ICLCPurchasePool pool, uint256 amount) internal {
        vm.startPrank(_issuerSafeStandIn);
        _voucher.approve(address(pool), amount);
        assertEq(pool.deposit(address(_voucher), amount), amount);
        vm.stopPrank();
        assertEq(_voucher.allowance(_issuerSafeStandIn, address(pool)), 0, "finite inventory deposit approval consumed");
    }

    function _purchase(
        ICLCPurchasePool pool,
        address buyer,
        address learner,
        uint256 amount,
        uint256 minimum,
        uint256 deadline
    )
        internal
        returns (uint256)
    {
        vm.prank(buyer);
        return ICLCSwapPool(address(pool)).withdraw(address(_voucher), address(_wxdai), amount, learner, minimum, deadline);
    }

    function _balances(
        ICLCPurchasePool pool,
        address buyer,
        address learner
    )
        internal
        view
        returns (PurchaseBalances memory)
    {
        return PurchaseBalances({
            payerPayment: _wxdai.balanceOf(buyer),
            poolPayment: _wxdai.balanceOf(address(pool)),
            learnerVouchers: _voucher.balanceOf(learner),
            poolVouchers: _voucher.balanceOf(address(pool)),
            protocolVouchers: _voucher.balanceOf(_protocolFeeRecipient),
            accruedPoolFee: pool.fees(address(_voucher)),
            allowance: _wxdai.allowance(buyer, address(pool)),
            voucherSupply: _voucher.totalSupply()
        });
    }

    function _assertUnchanged(
        PurchaseBalances memory beforeState,
        ICLCPurchasePool pool,
        address buyer,
        address learner
    )
        internal
    {
        PurchaseBalances memory afterState = _balances(pool, buyer, learner);
        assertEq(
            keccak256(abi.encode(afterState)), keccak256(abi.encode(beforeState)), "failed swap changed economic state"
        );
    }
}
