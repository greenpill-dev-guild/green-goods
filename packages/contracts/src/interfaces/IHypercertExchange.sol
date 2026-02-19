// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title OrderStructs
/// @notice Order types for the Hypercert Exchange (LooksRare-based)
/// @dev Matches the deployed HypercertExchange at 0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83 on Arbitrum
library OrderStructs {
    /// @notice Quote type: whether the maker is bidding or asking
    enum QuoteType {
        MakerBid, // 0 = buyer is maker
        MakerAsk // 1 = seller is maker

    }

    /// @notice Collection type for the order
    enum CollectionType {
        ERC721, // 0
        ERC1155, // 1
        Hypercert // 2

    }

    /// @notice Maker order (signed off-chain by the seller/buyer)
    struct Maker {
        QuoteType quoteType;
        uint256 globalNonce;
        uint256 subsetNonce;
        uint256 orderNonce;
        uint256 strategyId;
        CollectionType collectionType;
        address collection;
        address currency;
        address signer;
        uint256 startTime;
        uint256 endTime;
        uint256 price; // price per unit for fractional sales
        uint256[] itemIds;
        uint256[] amounts;
        bytes additionalParameters;
    }

    /// @notice Taker order (submitted on-chain by the buyer/seller)
    struct Taker {
        address recipient;
        bytes additionalParameters;
    }

    /// @notice Merkle tree node for batch/collection orders
    struct MerkleTreeNode {
        bytes32 value;
        uint8 position; // 0 = Left, 1 = Right
    }

    /// @notice Merkle tree for order proof verification
    struct MerkleTree {
        bytes32 root;
        MerkleTreeNode[] proof;
    }
}

/// @title IHypercertExchange
/// @notice Minimal interface for the deployed HypercertExchange contract
/// @dev Wraps the LooksRare-based exchange for executing taker bids against maker asks
interface IHypercertExchange {
    /// @notice Execute a taker bid against a maker ask
    /// @param takerBid The taker bid (buyer on-chain)
    /// @param makerAsk The maker ask (seller signed off-chain)
    /// @param makerSignature The EIP-712 signature of the maker order
    /// @param merkleTree The merkle tree proof (empty for single orders)
    function executeTakerBid(
        OrderStructs.Taker calldata takerBid,
        OrderStructs.Maker calldata makerAsk,
        bytes calldata makerSignature,
        OrderStructs.MerkleTree calldata merkleTree
    )
        external
        payable;
}

/// @title IHypercertMinter
/// @notice Minimal interface for the HypercertMinterUUPS contract
/// @dev Used by HypercertsModule to mint hypercerts on behalf of gardens
interface IHypercertMinter {
    /// @notice Create a new hypercert with an allowlist for claiming fractions
    /// @param account The owner/creator of the hypercert
    /// @param units The total number of units for this hypercert
    /// @param merkleRoot The merkle root for the allowlist (0 for open)
    /// @param uri The metadata URI for the hypercert
    /// @param restrictions Transfer restriction type (0 = none)
    /// @return claimID The new hypercert's claim/token ID
    function createAllowlist(
        address account,
        uint256 units,
        bytes32 merkleRoot,
        string calldata uri,
        uint8 restrictions
    )
        external
        returns (uint256 claimID);

    /// @notice Set approval for all tokens for an operator
    function setApprovalForAll(address operator, bool approved) external;

    /// @notice Check if an operator is approved for all tokens
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}
