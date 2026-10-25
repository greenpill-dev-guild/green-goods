// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { VoucherServiceCodec as Codec } from "../../src/libraries/VoucherServiceCodec.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { VoucherRedemptionRouter, VoucherRedemptionToken } from "./VoucherRedemptionFixture.sol";

/// @dev Destination-only transport/accepted-receipt/account stand-ins, never actual CCIP or signing proof.
abstract contract VoucherServiceDestinationFixture is Test {
    address internal constant COMMUNITY = address(0x1000);
    address internal constant GUARDIAN = address(0x2000);
    address internal constant ISSUER = address(0x3000);
    address internal constant BUYER = address(0x4000);
    address internal constant HOLDER = address(0x5000);
    address internal constant SOURCE = address(0x6000);
    uint64 internal constant SOURCE_SELECTOR = 49_999;
    VoucherRedemptionRouter internal router;
    VoucherRedemptionToken internal token;
    GnosisVoucherEscrow internal escrow;
    bytes32 internal id;
    bytes32 internal payloadHash;
    uint256 internal messageNonce;
    uint64 internal acceptanceDeadline;

    function _setUpDestination() internal {
        vm.chainId(100);
        router = new VoucherRedemptionRouter();
        token = new VoucherRedemptionToken(ISSUER);
        escrow = GnosisVoucherEscrow(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherEscrow(address(router))),
                        abi.encodeCall(
                            GnosisVoucherEscrow.initialize, (COMMUNITY, GUARDIAN, SOURCE_SELECTOR, uint256(42_161), SOURCE)
                        )
                    )
                ))
        );
        vm.prank(COMMUNITY);
        escrow.unpause();
        token.mintFixture(HOLDER, 100);
        vm.prank(HOLDER);
        token.approve(address(escrow), 100);
        acceptanceDeadline = uint64(block.timestamp + 1 days);
        id = Codec.setupId(_authorization());
        payloadHash = Codec.hash(_authorization());
    }

    function _authorization() internal view returns (Codec.SetupAuthorization memory a) {
        a.version = 2;
        a.sourceChainId = 42_161;
        a.sourceModule = SOURCE;
        a.coreModule = address(0x7000);
        a.commitmentId = 7;
        a.termsRevision = 3;
        a.termsHash = keccak256("fictional exact terms");
        a.claimHash = keccak256("fictional pending consent");
        a.requestNonce = 1;
        a.buyer = BUYER;
        a.holder = HOLDER;
        a.buyerGarden = address(0x8000);
        a.providerGarden = address(0x9000);
        a.destinationChainId = 100;
        a.destinationEscrow = address(escrow);
        a.issuer = ISSUER;
        a.token = address(token);
        a.voucherUnits = 100;
        a.serviceUnits = 10;
        a.unitLabelHash = keccak256("fictional lessons");
        a.serviceTermsRef = keccak256("fictional ten lesson terms");
        a.remedyTermsRef = keccak256("fictional mutual return");
        a.acceptanceDeadline = acceptanceDeadline;
        a.remedyPolicy = 1;
    }

    function _message(bytes memory data, bytes32 messageId) internal pure returns (Client.Any2EVMMessage memory) {
        return Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: SOURCE_SELECTOR,
            sender: abi.encode(SOURCE),
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _deliver(bytes memory data) internal {
        router.deliver(address(escrow), _message(data, keccak256(abi.encode("fictional transport", ++messageNonce))));
    }

    function _open() internal {
        _deliver(Codec.encodeAuthorization(_authorization()));
        vm.prank(ISSUER);
        escrow.approveSetupAuthorization(id, payloadHash);
    }

    function _deposit() internal {
        _open();
        vm.prank(HOLDER);
        escrow.presentSetup(id, payloadHash);
    }

    function _command(Codec.SetupDecision decision) internal view returns (Codec.SetupDecisionCommand memory c) {
        c.version = 2;
        c.setupId = id;
        c.authorizationHash = payloadHash;
        c.decision = decision;
        if (decision == Codec.SetupDecision.Activate) {
            c.expectedDepositReceiptHash = Codec.depositReceiptHash(_authorization());
            c.coreAcceptanceHash = keccak256("fictional exact permanent core acceptance");
        } else {
            c.abortReason = Codec.AbortReason.BuyerRequest;
        }
    }

    function _activate() internal {
        _deliver(Codec.encodeDecision(_authorization(), _command(Codec.SetupDecision.Activate)));
    }

    function _active() internal {
        _deposit();
        _activate();
    }

    function _allowReturn(uint256 units) internal {
        vm.prank(ISSUER);
        escrow.authorizeReturn(id, payloadHash, units);
    }

    function _freeze(uint256 serviceUnits, uint256 releaseUnits, uint256 refundUnits) internal returns (bytes32) {
        vm.prank(HOLDER);
        return escrow.finalizeAllocation(id, payloadHash, Codec.FinalAllocation(serviceUnits, releaseUnits, refundUnits));
    }

    function _partial() internal returns (bytes32 decision) {
        _active();
        _allowReturn(60);
        return _freeze(3, 40, 60);
    }

    function _executeBoth(bytes32 decision, bool refundFirst) internal {
        escrow.executeFinalLeg(id, decision, refundFirst ? Codec.FinalLeg.RefundToHolder : Codec.FinalLeg.ReleaseToIssuer);
        escrow.executeFinalLeg(id, decision, refundFirst ? Codec.FinalLeg.ReleaseToIssuer : Codec.FinalLeg.RefundToHolder);
    }
}
