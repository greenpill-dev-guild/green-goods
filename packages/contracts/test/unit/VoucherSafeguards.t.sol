// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { VoucherRedemptionCodec as Legacy } from "../../src/libraries/VoucherRedemptionCodec.sol";
import { GnosisVoucherEscrow } from "../../src/modules/GnosisVoucherEscrow.sol";
import { VoucherRedemptionRouter, VoucherRedemptionToken } from "../helpers/VoucherRedemptionFixture.sol";

/// @notice Regression proof for old authorization and incremental-transfer bypasses.
/// @dev All accounts, inventory and transport are fictional local stand-ins.
contract VoucherSafeguardsTest is Test {
    VoucherRedemptionRouter private router;
    GnosisVoucherEscrow private escrow;
    VoucherRedemptionToken private token;
    address private constant ISSUER = address(0x111);
    address private constant HOLDER = address(0x222);
    address private constant SOURCE = address(0x333);

    function setUp() public {
        vm.chainId(100);
        router = new VoucherRedemptionRouter();
        token = new VoucherRedemptionToken(ISSUER);
        escrow = GnosisVoucherEscrow(
            payable(address(
                    new ERC1967Proxy(
                        address(new GnosisVoucherEscrow(address(router))),
                        abi.encodeCall(
                            GnosisVoucherEscrow.initialize,
                            (address(this), address(0x444), uint64(99), uint256(42_161), SOURCE)
                        )
                    )
                ))
        );
        escrow.unpause();
    }

    function testVoucherSafeguards_rejectsLegacyAuthorizationWithoutPreacceptanceSetup() public {
        Legacy.Authorization memory authorization = _legacy();
        (bool success,) = address(router).call(abi.encodeCall(router.deliver, (address(escrow), _message(authorization))));
        assertFalse(success, "v1 authorization must not bypass preacceptance escrow and activation");
    }

    function testVoucherSafeguards_rejectsIncrementalReleaseWithoutFrozenFinalAllocation() public {
        Legacy.Authorization memory authorization = _legacy();
        bytes32 id = Legacy.redemptionId(authorization);
        bytes32 hash = Legacy.hash(authorization);
        (bool opened,) = address(router).call(abi.encodeCall(router.deliver, (address(escrow), _message(authorization))));
        if (opened) {
            token.mintFixture(HOLDER, 100);
            vm.prank(ISSUER);
            escrow.approveAuthorization(id, hash);
            vm.startPrank(HOLDER);
            token.approve(address(escrow), 100);
            escrow.present(id, hash, 1);
            (bool released,) = address(escrow).call(abi.encodeCall(escrow.approveDelivered, (id, hash, uint64(2), 3, 40)));
            vm.stopPrank();
            assertFalse(released, "incremental release must not precede an immutable full allocation");
        }
        assertEq(token.balanceOf(ISSUER), 0, "no issuer transfer without a frozen final allocation");
    }

    function _message(Legacy.Authorization memory authorization) private pure returns (Client.Any2EVMMessage memory) {
        return Client.Any2EVMMessage({
            messageId: keccak256("old checkpoint authorization"),
            sourceChainSelector: 99,
            sender: abi.encode(SOURCE),
            data: Legacy.encodeAuthorization(authorization),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _legacy() private view returns (Legacy.Authorization memory a) {
        a.version = 1;
        a.sourceChainId = 42_161;
        a.sourceModule = SOURCE;
        a.commitmentId = 7;
        a.revision = 1;
        a.acceptedClaimHash = keccak256("fictional claim");
        a.termsHash = keccak256("terms");
        a.buyer = address(0x555);
        a.holder = HOLDER;
        a.buyerGarden = address(0x666);
        a.providerGarden = address(0x777);
        a.destinationChainId = 100;
        a.destinationEscrow = address(escrow);
        a.issuer = ISSUER;
        a.token = address(token);
        a.totalVoucherUnits = 100;
        a.totalServiceUnits = 10;
        a.serviceUnitLabelHash = keccak256("lessons");
        a.serviceTermsRef = keccak256("service");
        a.remedyTermsRef = keccak256("mutual remedy");
        a.remedyPolicy = 1;
    }
}
