// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../interfaces/ICommitmentPoolingModule.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";

/// @notice Internal-only earned-source eligibility checks; the core owns lifecycle and Hats owns roles.
library VoucherSourceAuthority {
    error TermsNotPreAcceptance();
    error NotVoucherSteward();

    function preAcceptance(Core core, uint256 id) internal view returns (Core.Commitment memory commitment) {
        commitment = core.getCommitment(id);
        if (commitment.state != Core.CommitmentState.Offered && commitment.state != Core.CommitmentState.Requested) {
            revert TermsNotPreAcceptance();
        }
    }

    function requireSteward(Core core, IHatsModule hats, uint256 poolId) internal view {
        address garden = core.getPool(poolId).garden;
        if (!hats.isOwnerOf(garden, msg.sender) && !hats.isStewardOf(garden, msg.sender)) revert NotVoucherSteward();
    }
}
