// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentServiceOffers as Service } from "../../interfaces/ICommitmentServiceOffers.sol";

/// @notice Opt-in service consent lives outside the frozen pooling layout.
library CommitmentPoolingServiceOfferStorageLib {
    /// @custom:storage-location erc7201:green.goods.commitment.service-offers.v1
    struct State {
        mapping(uint256 commitmentId => Service.ServiceOfferTerms terms) terms;
        mapping(uint256 commitmentId => mapping(address buyer => Service.ServiceClaimConsent consent)) claimConsent;
        mapping(uint256 commitmentId => Service.ServiceClaimConsent consent) acceptedConsent;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256(namespace)) - 1)) & ~bytes32(uint256(0xff)).
    bytes32 internal constant STORAGE_SLOT = 0x24ca80d21f1705094d1274ffc56402fbe8dcf0f5d16f72308874eba3e38f6e00;

    function state() internal pure returns (State storage result) {
        bytes32 slot = STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            result.slot := slot
        }
    }

    function isServiceOffer(uint256 commitmentId) internal view returns (bool) {
        return state().terms[commitmentId].revision != 0;
    }

    function requireLegacyClaim(uint256 commitmentId) internal view {
        if (isServiceOffer(commitmentId)) revert Service.ServiceClaimPathRequired(commitmentId);
    }

    function requireLegacyTerms(uint256 commitmentId) internal view {
        if (isServiceOffer(commitmentId)) revert Service.ServiceOfferTermsLocked(commitmentId);
    }

    function requireNoExchange(uint256 commitmentId) internal view {
        if (isServiceOffer(commitmentId)) revert Service.ServiceExchangeUnsupported(commitmentId);
    }
}
