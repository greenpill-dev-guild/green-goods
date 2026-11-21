// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenGoodsENSRegistrar
/// @notice The types, errors and events of the upgradeable `*.greengoods.eth` registrar on Arbitrum.
interface IGreenGoodsENSRegistrar {
    enum NameType {
        Gardener,
        Garden
    }

    /// @notice One existing registration, carried over from the previous sender.
    struct ImportedName {
        string slug;
        address owner;
        NameType nameType;
    }

    error NameTaken();
    error NotAuthorizedCaller();
    error AlreadyHasName();
    error CannotReleaseGardenName();
    error NameNotRegistered();
    error NameOwnerMismatch(address actualOwner);
    error InsufficientFee();
    error NameInCooldown();
    error InvalidCooldown();
    error ImportClosed();
    error ImportStillOpen();
    error OwnershipCannotBeRenounced();
    error ReferenceRequired();
    error NoRefundAvailable();
    error RefundTransferFailed();
    error NoWithdrawableBalance();
    error WithdrawTransferFailed();
    error BalanceFeeCapExceeded(uint256 fee, uint256 cap);

    event NameRegistrationSent(
        bytes32 indexed messageId, string slug, address indexed owner, NameType nameType, uint256 ccipFee
    );
    event NameReleaseSent(bytes32 indexed messageId, string slug, address indexed previousOwner);
    event NameImported(string slug, address indexed owner, NameType nameType);
    event ImportFinished();
    /// @notice An operator released a member's name.
    /// @param supportReference The support record that justifies the action; never empty.
    event NameReleasedByOperator(
        string slug, address indexed previousOwner, address indexed operator, bytes32 indexed supportReference
    );
    /// @notice An operator gave a free name to an account, for a member returning under a new account.
    event NameAssignedByOperator(
        string slug, address indexed newOwner, address indexed operator, bytes32 indexed supportReference
    );
    /// @notice An operator sent a name's registration to L1 again, after L1 did not apply the first.
    event NameRegistrationResent(
        string slug, address indexed owner, address indexed operator, bytes32 indexed supportReference
    );
    /// @notice An operator delivered a refund its creditor could not collect.
    event RefundRedirected(address indexed creditor, address indexed to, uint256 indexed amount);
    event L1ReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event AuthorizedCallerUpdated(address indexed caller, bool indexed authorized);
    event NameChangeCooldownUpdated(uint256 indexed oldCooldown, uint256 indexed newCooldown);
    event RefundFailed(address indexed recipient, uint256 indexed amount);
    event RefundClaimed(address indexed recipient, uint256 indexed amount);
}
