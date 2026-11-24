// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettlementPersonalServicePurchases as Personal } from "../../interfaces/ISettlementPersonalServicePurchases.sol";

/// @notice Versioned personal-purchase facts, separate from historical opaque deposit assertions.
library PersonalPurchaseStorageLib {
    /// @custom:storage-location erc7201:green.goods.settlement.personal-service-purchases.v1
    struct State {
        mapping(uint256 fundingId => Personal.PersonalServicePurchase purchase) purchases;
        mapping(bytes32 purchaseId => uint256 fundingId) fundingOfPurchase;
        mapping(bytes32 receiptKey => uint256 fundingId) fundingOfVerifiedReceipt;
    }

    bytes32 private constant _STATE_SLOT = 0x64a93a3248f51fd3aeb9fbdc8092d4a605842f1fe011ff3dab37abb5618add00;

    function state() internal pure returns (State storage result) {
        bytes32 slot = _STATE_SLOT;
        assembly ("memory-safe") { result.slot := slot }
    }

    function receiptKey(uint64 chainId, bytes32 transactionHash, uint32 logIndex) internal pure returns (bytes32) {
        return keccak256(abi.encode(chainId, transactionHash, logIndex));
    }
}
