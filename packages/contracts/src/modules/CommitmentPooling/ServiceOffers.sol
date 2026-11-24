// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentServiceOffers } from "../../interfaces/ICommitmentServiceOffers.sol";
import { CommitmentPoolingClaimsLib } from "../../lib/CommitmentPooling/ClaimsLib.sol";
import { CommitmentPoolingTermsLib } from "../../lib/CommitmentPooling/TermsLib.sol";
import { CommitmentPoolingViewsLib } from "../../lib/CommitmentPooling/ViewsLib.sol";
import { CommitmentPoolingOperations } from "./Operations.sol";

/// @notice Opt-in service-offer shells; storage and deployed library ownership remain unchanged.
abstract contract CommitmentPoolingServiceOffers is CommitmentPoolingOperations {
    function serviceOfferProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function setServiceOfferTerms(
        uint256 commitmentId,
        uint64 expectedRevision,
        ICommitmentServiceOffers.ServiceOfferTermsInput calldata terms,
        uint256 gdPrice
    )
        external
        whenOperational
    {
        CommitmentPoolingTermsLib.setServiceOfferTerms(
            _env(), pools, commitments, commitmentConfirmers, commitmentId, expectedRevision, terms, gdPrice
        );
    }

    function requestServiceClaim(
        uint256 commitmentId,
        ICommitmentServiceOffers.ServiceClaimRequest calldata request
    )
        external
        whenOperational
        nonReentrant
        returns (bytes32 claimHash)
    {
        return CommitmentPoolingClaimsLib.requestServiceClaim(
            _env(), pools, gardenPool, commitments, pendingClaim, commitmentId, request
        );
    }

    function acceptServiceClaim(
        uint256 commitmentId,
        address buyer,
        bytes32 expectedClaimHash
    )
        external
        whenOperational
        nonReentrant
    {
        CommitmentPoolingClaimsLib.acceptServiceClaim(
            _env(),
            pools,
            gardenPool,
            commitments,
            pendingClaim,
            contributors,
            commitmentConfirmers,
            commitmentId,
            buyer,
            expectedClaimHash
        );
    }

    /// @dev Wind-down remains available while paused; the direct buyer can withdraw no other claim.
    function withdrawServiceClaim(uint256 commitmentId, bytes32 expectedClaimHash) external {
        CommitmentPoolingClaimsLib.withdrawServiceClaim(commitments, pendingClaim, commitmentId, expectedClaimHash);
    }

    function getServiceOfferTerms(uint256 commitmentId)
        external
        view
        returns (ICommitmentServiceOffers.ServiceOfferTerms memory)
    {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := commitments.slot
        }
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getServiceOfferTerms.selector, slot, commitmentId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function getServiceClaimConsent(
        uint256 commitmentId,
        address buyer
    )
        external
        view
        returns (ICommitmentServiceOffers.ServiceClaimConsent memory)
    {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := commitments.slot
        }
        _forwardView(
            abi.encodeWithSelector(CommitmentPoolingViewsLib.getServiceClaimConsent.selector, slot, commitmentId, buyer)
        );
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }

    function getAcceptedServiceTerms(uint256 commitmentId)
        external
        view
        returns (ICommitmentServiceOffers.AcceptedServiceTerms memory)
    {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            slot := commitments.slot
        }
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getAcceptedServiceTerms.selector, slot, commitmentId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            revert(0, 0)
        } // unreachable
    }
}
