// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { CCIPSettlementIntegrationTest } from "./CCIPSettlement.t.sol";

contract DualChainSettlementTest is CCIPSettlementIntegrationTest {
    function testSourcePayloadBindsPayerSafeAndBeneficiarySafeAcrossChains() public {
        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 disbursementId = settlement.prepareGardenBeneficiaryPayout(planId);
        settlement.dispatchDisbursement(disbursementId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory child = settlement.getDisbursement(disbursementId);
        SettlementMessageCodec.Command memory command = SettlementMessageCodec.decodeCommand(arbitrumRouter.lastData());
        assertEq(child.source, address(payerSafe));
        assertEq(child.executorGarden, PROTOCOL_GARDEN);
        assertEq(child.recipient, address(beneficiarySafe));
        assertEq(command.executorGarden, PROTOCOL_GARDEN);
        assertEq(command.recipients.length, 1);
        assertEq(command.recipients[0], address(beneficiarySafe));
        assertEq(command.amounts[0], 100 ether);
    }
}
