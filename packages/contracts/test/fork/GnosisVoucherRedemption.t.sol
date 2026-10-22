// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ICLCGiftableToken, ICLCERC1967Factory } from "../../src/interfaces/ICLCGiftableToken.sol";
import { VoucherRedemptionCodec as Codec } from "../../src/libraries/VoucherRedemptionCodec.sol";
import { VoucherRedemptionTransfers } from "../../src/libraries/VoucherRedemptionTransfers.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { VoucherRedemptionRouter } from "../helpers/VoucherRedemptionFixture.sol";

/// @dev Hand-written ownership interface; actual pinned deployed behavior is verified by this suite.
interface IGiftableOwnership {
    function transferOwnership(address newOwner) external;
}

/// @notice Actual pinned GiftableToken custody with fictional issuer inventory and service terms.
/// @dev Transport and Safe signers are labeled local stand-ins; no DON, live funds or passkey proof.
contract GnosisVoucherRedemptionForkTest is Test {
    uint256 private constant GNOSIS_BLOCK = 48_848_261;
    address private constant FACTORY = 0xB286994c648F98fD3a3BA6C43934828a5b88162b;
    address private constant GIFTABLE_IMPLEMENTATION = 0x34445d13F112A11f72C1d353a7dcdc407F3df2d8;
    address private constant WEBAUTHN_VALIDATOR = 0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd;
    uint64 private constant SOURCE_SELECTOR = 49_999;
    address private constant SOURCE_MODULE = address(0xAABB);
    address private issuer;
    address private holder;
    address private community;
    address private guardian;
    ICLCGiftableToken private voucher;
    GnosisVoucherEscrow private escrow;
    VoucherRedemptionRouter private router;
    bytes32 private id;
    bytes32 private payloadHash;

    function setUp() public {
        string memory rpc = "https://rpc.gnosischain.com";
        try vm.envString("GNOSIS_RPC_URL") returns (string memory configuredRpc) {
            rpc = configuredRpc;
        } catch { }
        vm.createSelectFork(rpc, GNOSIS_BLOCK);
        assertEq(block.chainid, 100);
        assertEq(block.number, GNOSIS_BLOCK);
        assertEq(FACTORY.codehash, 0x2e06e9a024d7bd35356833e6fcb9f34c1fbdae8bbd91da3bc55e4cc2ba4d1230);
        assertEq(GIFTABLE_IMPLEMENTATION.codehash, 0x074980d5e0e6bfb3afd2faa9f828cf65d65ae7ed568f65b2623fa61190e95d91);
        issuer = makeAddr("fictional-redemption-issuer-Safe-stand-in");
        holder = makeAddr("fictional-redemption-holder-Safe-stand-in");
        community = makeAddr("fictional-redemption-community-Safe-stand-in");
        guardian = makeAddr("fictional-redemption-emergency-guardian");
        address[] memory governors = new address[](1);
        governors[0] = issuer;
        TimelockController timelock = new TimelockController(48 hours, governors, governors, address(0));
        voucher = ICLCGiftableToken(
            ICLCERC1967Factory(FACTORY)
                .deployAndCall(
                    GIFTABLE_IMPLEMENTATION,
                    address(timelock),
                    abi.encodeCall(
                        ICLCGiftableToken.initialize,
                        ("Fictional voucher service redemption", "REDEEM", uint8(6), issuer, uint256(0))
                    )
                )
        );
        assertEq(ICLCERC1967Factory(FACTORY).adminOf(address(voucher)), address(timelock));
        router = new VoucherRedemptionRouter();
        escrow = GnosisVoucherEscrow(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherEscrow(address(router))),
                        abi.encodeCall(
                            GnosisVoucherEscrow.initialize,
                            (community, guardian, SOURCE_SELECTOR, uint256(42_161), SOURCE_MODULE)
                        )
                    )
                ))
        );
        vm.prank(community);
        escrow.unpause();
        vm.startPrank(issuer);
        voucher.mintTo(issuer, 100);
        voucher.transfer(holder, 100);
        vm.stopPrank();
        vm.prank(holder);
        voucher.approve(address(escrow), 100);
        assertFalse(voucher.isWriter(address(escrow)));
        Codec.Authorization memory authorization = _authorization();
        id = Codec.redemptionId(authorization);
        payloadHash = Codec.hash(authorization);
    }

    function testGnosisVoucherRedemption_realTokenPartialReleaseAndMutualReturnConserveInventory() public {
        _present();
        vm.prank(holder);
        escrow.approveDelivered(id, payloadHash, 2, 3, 40);
        _returnRemaining(60, 3);
        assertEq(voucher.balanceOf(issuer), 40);
        assertEq(voucher.balanceOf(holder), 60);
        assertEq(voucher.balanceOf(address(escrow)), 0);
        assertEq(voucher.totalSupply(), 100);
        assertEq(escrow.getExecutionResult(id).current.holderApprovedServiceUnits, 3);
        assertEq(escrow.getExecutionResult(id).current.releasedUnits, 40);
        assertEq(escrow.getExecutionResult(id).current.returnedUnits, 60);
    }

    function testGnosisVoucherRedemption_realFiniteAllowanceExhaustionRepairsSamePresentment() public {
        _open();
        vm.prank(holder);
        voucher.approve(address(escrow), 99);
        vm.prank(holder);
        escrow.present(id, payloadHash, 1);
        bytes32 actionHash = escrow.getExecutionResult(id).current.actionHash;
        assertFalse(escrow.getExecutionResult(id).current.actionSucceeded);
        assertEq(voucher.balanceOf(holder), 100);
        assertEq(voucher.balanceOf(address(escrow)), 0);
        vm.prank(holder);
        voucher.approve(address(escrow), 100);
        escrow.retry(id);
        assertEq(escrow.getExecutionResult(id).current.actionHash, actionHash);
        assertEq(escrow.getExecutionResult(id).current.escrowedUnits, 100);
        assertEq(voucher.allowance(holder, address(escrow)), 0);
    }

    function testGnosisVoucherRedemption_realHolderBalanceRepairNeverRepricesAuthorizedService() public {
        _open();
        vm.prank(holder);
        voucher.transfer(issuer, 1);
        vm.prank(holder);
        escrow.present(id, payloadHash, 1);
        assertFalse(escrow.getExecutionResult(id).current.actionSucceeded);
        vm.prank(issuer);
        voucher.transfer(holder, 1); // Explicit fictional reserve repair; no automatic mint or subsidy.
        escrow.retry(id);
        assertEq(escrow.getExecutionResult(id).current.payloadHash, payloadHash);
        assertEq(escrow.getExecutionResult(id).current.escrowedUnits, 100);
        assertEq(voucher.totalSupply(), 100);
    }

    function testGnosisVoucherRedemption_wrongIssuerCannotApproveAnotherIssuersActualToken() public {
        Codec.Authorization memory authorization = _authorization();
        authorization.issuer = community;
        _deliver(authorization, keccak256("wrong issuing owner"));
        vm.expectRevert(VoucherRedemptionTransfers.WrongVoucherIssuer.selector);
        vm.prank(community);
        escrow.approveAuthorization(id, Codec.hash(authorization));
        assertEq(voucher.owner(), issuer);
        assertEq(voucher.balanceOf(holder), 100);
    }

    function testGnosisVoucherRedemption_actualOwnershipRotationBeforePresentmentRejects() public {
        _open();
        vm.prank(issuer);
        IGiftableOwnership(address(voucher)).transferOwnership(community);
        assertEq(voucher.owner(), community);
        vm.expectRevert(VoucherRedemptionTransfers.WrongVoucherIssuer.selector);
        vm.prank(holder);
        escrow.present(id, payloadHash, 1);
        assertEq(voucher.balanceOf(holder), 100);
    }

    function testGnosisVoucherRedemption_actualOwnershipRotationAfterPresentmentDoesNotStrandRemedy() public {
        _present();
        vm.prank(issuer);
        IGiftableOwnership(address(voucher)).transferOwnership(community);
        assertEq(voucher.owner(), community);
        vm.prank(holder);
        escrow.approveDelivered(id, payloadHash, 2, 3, 40);
        _returnRemaining(60, 3);
        assertEq(voucher.balanceOf(issuer), 40, "accepted reserve remains immutable");
        assertEq(voucher.balanceOf(holder), 60);
        assertEq(voucher.balanceOf(community), 0);
    }

    function testGnosisVoucherRedemption_lostAcknowledgmentDoesNotRepeatActualVoucherDelivery() public {
        router.configure(0, true, false);
        _present();
        vm.prank(holder);
        escrow.approveDelivered(id, payloadHash, 2, 10, 100);
        assertEq(voucher.balanceOf(issuer), 100);
        uint64 sequence = escrow.getExecutionResult(id).current.resultSequence;
        router.configure(5, false, false);
        vm.deal(address(this), 10);
        escrow.retryAcknowledgment{ value: 5 }(id);
        _deliver(_authorization(), keccak256("duplicate after lost acknowledgment"));
        assertEq(voucher.balanceOf(issuer), 100);
        assertEq(voucher.totalSupply(), 100);
        assertEq(escrow.getExecutionResult(id).current.resultSequence, sequence);
        assertEq(escrow.getExecutionResult(id).acknowledgmentSequence, sequence);
    }

    function testGnosisVoucherRedemption_rechecksRecordedValidatorGapWithoutClaimingMemberSigning() public {
        assertEq(WEBAUTHN_VALIDATOR.code.length, 0, "pinned Gnosis validator gap must remain explicit");
        assertTrue(holder != issuer);
        assertEq(voucher.owner(), issuer);
    }

    function _open() private {
        _deliver(_authorization(), keccak256("fictional real-token service authorization"));
        vm.prank(issuer);
        escrow.approveAuthorization(id, payloadHash);
    }

    function _present() private {
        _open();
        vm.prank(holder);
        escrow.present(id, payloadHash, 1);
    }

    function _returnRemaining(uint256 units, uint64 nonce) private {
        vm.prank(issuer);
        escrow.authorizeReturn(id, payloadHash, units);
        vm.prank(holder);
        escrow.returnUndelivered(id, payloadHash, nonce, units);
    }

    function _deliver(Codec.Authorization memory authorization, bytes32 messageId) private {
        router.deliver(
            address(escrow),
            Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: SOURCE_SELECTOR,
                sender: abi.encode(SOURCE_MODULE),
                data: Codec.encodeAuthorization(authorization),
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            })
        );
    }

    function _authorization() private view returns (Codec.Authorization memory authorization) {
        authorization.version = 1;
        authorization.sourceChainId = 42_161;
        authorization.sourceModule = SOURCE_MODULE;
        authorization.commitmentId = 7;
        authorization.revision = 1;
        authorization.acceptedClaimHash = keccak256("fictional source accepted voucher claim");
        authorization.termsHash = keccak256("fictional accepted service terms revision one");
        authorization.buyer = address(0xB0B);
        authorization.holder = holder;
        authorization.buyerGarden = address(0xBA01);
        authorization.providerGarden = address(0xBA02);
        authorization.destinationChainId = 100;
        authorization.destinationEscrow = address(escrow);
        authorization.issuer = issuer;
        authorization.token = address(voucher);
        authorization.totalVoucherUnits = 100;
        authorization.totalServiceUnits = 10;
        authorization.serviceUnitLabelHash = keccak256("fictional lesson");
        authorization.serviceTermsRef = keccak256("fictional exact ten-lesson terms");
        authorization.remedyTermsRef = keccak256("fictional mutual financial-return remedy");
        authorization.remedyPolicy = 1;
    }
}
