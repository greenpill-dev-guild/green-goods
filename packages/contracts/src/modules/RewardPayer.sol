// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev The two ERC-20 calls the payer makes. Declared here so the contract pulls no library
/// source into the production build.
interface IRewardPayerToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title RewardPayer
/// @notice Pays one share of a promise's reward from the caller's own wallet, once (PRD-1556).
/// @dev A reward can carry a part in a token other than G$, declared in the promise's metadata
/// and paid by the steward from their own wallet. A share names the promise (the chain and
/// pooling module that hold it, and its id), the token, the gardener and the exact amount. The
/// payer moves that amount from the caller to the gardener and records the share as paid, so it
/// can never be paid again. It holds no funds, has no owner, no roles and no upgrade path, and
/// it reads nothing from the promise: anyone who pays a share pays exactly its amount to its
/// gardener, which is the obligation the share names. Whether the amount is the right one for
/// the promise is the app's and the indexer's to check, by computing the same share.
contract RewardPayer {
    struct Share {
        /// @dev The chain whose pooling module holds the promise.
        uint256 promiseChainId;
        address promiseModule;
        uint256 commitmentId;
        address token;
        address recipient;
        uint256 amount;
    }

    /// @notice Who paid each share; the zero address until it is paid.
    mapping(bytes32 shareId => address payer) public paidBy;

    event RewardSharePaid(
        bytes32 indexed shareId,
        uint256 indexed commitmentId,
        address indexed recipient,
        address payer,
        address token,
        uint256 amount,
        uint256 promiseChainId,
        address promiseModule
    );

    error InvalidShare();
    /// @dev A share is paid to its gardener by someone else; paying yourself moves nothing.
    error SelfPayment();
    error ShareAlreadyPaid(bytes32 shareId);
    /// @dev The token refused the transfer, or the gardener received a different amount (a token
    /// that charges a fee on transfer, for one). A share is paid in full or not at all.
    error ShareNotDelivered(bytes32 shareId);
    error NoShares();

    /// @notice The id a share is recorded under: the hash of everything it names.
    function shareIdOf(Share calldata share) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                share.promiseChainId, share.promiseModule, share.commitmentId, share.token, share.recipient, share.amount
            )
        );
    }

    /// @notice Pay one share from the caller's wallet. The caller approves the token first.
    function pay(Share calldata share) external returns (bytes32 shareId) {
        shareId = _pay(share);
    }

    /// @notice Pay several shares in one transaction: all of them, or none.
    function payAll(Share[] calldata shares) external returns (bytes32[] memory shareIds) {
        uint256 count = shares.length;
        if (count == 0) revert NoShares();
        shareIds = new bytes32[](count);
        for (uint256 i = 0; i < count; ++i) {
            shareIds[i] = _pay(shares[i]);
        }
    }

    function _pay(Share calldata share) private returns (bytes32 shareId) {
        if (
            share.promiseChainId == 0 || share.promiseModule == address(0) || share.commitmentId == 0
                || share.token.code.length == 0 || share.recipient == address(0) || share.amount == 0
        ) revert InvalidShare();
        if (share.recipient == msg.sender) revert SelfPayment();
        shareId = shareIdOf(share);
        if (paidBy[shareId] != address(0)) revert ShareAlreadyPaid(shareId);
        // Recorded before the transfer, so a token that calls back can't pay the same share twice.
        paidBy[shareId] = msg.sender;

        IRewardPayerToken token = IRewardPayerToken(share.token);
        uint256 before = token.balanceOf(share.recipient);
        // A low-level call so a token that returns nothing (USDT-style) or false, or reverts, all
        // end in this contract's own ShareNotDelivered rather than a decoding panic.
        bytes memory transfer = abi.encodeCall(IRewardPayerToken.transferFrom, (msg.sender, share.recipient, share.amount));
        // solhint-disable-next-line avoid-low-level-calls
        (bool ok, bytes memory returned) = share.token.call(transfer);
        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) {
            revert ShareNotDelivered(shareId);
        }
        uint256 received = token.balanceOf(share.recipient);
        if (received < before || received - before != share.amount) revert ShareNotDelivered(shareId);

        emit RewardSharePaid(
            shareId,
            share.commitmentId,
            share.recipient,
            msg.sender,
            share.token,
            share.amount,
            share.promiseChainId,
            share.promiseModule
        );
    }
}
