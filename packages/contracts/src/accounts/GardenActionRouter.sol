// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { IERC6551Registry } from "../interfaces/IERC6551Registry.sol";
import { GardenSafeActionCodec } from "../libraries/GardenSafeActionCodec.sol";

/// @title GardenActionRouter
/// @notice Authenticates an Arbitrum GardenAccount and sends its exact Safe action to Celo.
/// @dev This contract has no owner, admin, token approvals, Settlement role, or destination
///      execution authority. A GardenAccount pays the exact native CCIP fee for each message.
contract GardenActionRouter {
    error ZeroAddress();
    error InvalidConfiguration();
    error UnauthorizedGarden();
    error InvalidAction();
    error InvalidActionState();
    error InvalidActionNonce();
    error ActionHashMismatch();
    error ActionExpired();
    error InvalidFee();
    error UnauthorizedBinding();
    error DestinationRelayAlreadyBound();
    error DestinationRelayUnbound();

    event DestinationRelayBound(address indexed destinationRelay);

    event ActionMessageSent(
        bytes32 indexed actionId,
        GardenSafeActionCodec.MessageKind indexed kind,
        address indexed gardenAccount,
        address destinationSafe,
        bytes32 messageId,
        uint256 fee
    );

    uint8 public constant PROTOCOL_VERSION = 1;
    uint256 public constant MAX_SAFE_CALLDATA_BYTES = 4_096;
    uint256 public constant SOURCE_EVM_CHAIN_ID = 42_161;
    uint256 public constant DESTINATION_EVM_CHAIN_ID = 42_220;
    bytes32 public constant ACCOUNT_SALT =
        0x6551655165516551655165516551655165516551655165516551655165516551;

    address public immutable CCIP_ROUTER;
    uint64 public immutable SOURCE_CHAIN_SELECTOR;
    uint64 public immutable DESTINATION_CHAIN_SELECTOR;
    address public immutable DESTINATION_ROUTER;
    address public immutable BINDING_OPERATOR;
    address public immutable ERC6551_REGISTRY;
    address public immutable ACCOUNT_IMPLEMENTATION;
    address public immutable GARDEN_TOKEN;
    uint256 public immutable DESTINATION_GAS_LIMIT;
    address public destinationRelay;

    mapping(address gardenAccount => address safe) public safeForGarden;
    mapping(address safe => address gardenAccount) public gardenForSafe;
    mapping(address gardenAccount => uint256 nonce) public nextActionNonce;
    mapping(address gardenAccount => bytes32 actionId) public activeAction;
    mapping(bytes32 actionId => GardenSafeActionCodec.ActionStatus status) public actionStatus;
    mapping(bytes32 actionId => bytes32 digest) private _actionDigests;

    constructor(
        address ccipRouter,
        uint64 sourceChainSelector,
        uint64 destinationChainSelector,
        address destinationRouter,
        address bindingOperator,
        address erc6551Registry,
        address accountImplementation,
        address gardenToken,
        uint256 destinationGasLimit,
        address[] memory gardenAccounts,
        address[] memory destinationSafes
    ) {
        if (
            ccipRouter == address(0) || destinationRouter == address(0) || bindingOperator == address(0)
                || erc6551Registry == address(0) || accountImplementation == address(0) || gardenToken == address(0)
        ) {
            revert ZeroAddress();
        }
        if (
            block.chainid != SOURCE_EVM_CHAIN_ID || sourceChainSelector == 0 || destinationChainSelector == 0
                || destinationGasLimit == 0 || gardenAccounts.length == 0
                || gardenAccounts.length != destinationSafes.length
        ) {
            revert InvalidConfiguration();
        }

        CCIP_ROUTER = ccipRouter;
        SOURCE_CHAIN_SELECTOR = sourceChainSelector;
        DESTINATION_CHAIN_SELECTOR = destinationChainSelector;
        DESTINATION_ROUTER = destinationRouter;
        BINDING_OPERATOR = bindingOperator;
        ERC6551_REGISTRY = erc6551Registry;
        ACCOUNT_IMPLEMENTATION = accountImplementation;
        GARDEN_TOKEN = gardenToken;
        DESTINATION_GAS_LIMIT = destinationGasLimit;

        for (uint256 i; i < gardenAccounts.length; ++i) {
            address gardenAccount = gardenAccounts[i];
            address destinationSafe = destinationSafes[i];
            if (
                gardenAccount == address(0) || destinationSafe == address(0) || safeForGarden[gardenAccount] != address(0)
                    || gardenForSafe[destinationSafe] != address(0)
            ) {
                revert InvalidConfiguration();
            }
            safeForGarden[gardenAccount] = destinationSafe;
            gardenForSafe[destinationSafe] = gardenAccount;
        }
    }

    /// @notice Permanently binds the Celo relay after it has been deployed against this router.
    /// @dev The source router is inert before binding. The bootstrap operator has no mutation
    ///      path after this one successful call and is not an execution authority.
    function bindDestinationRelay(address destinationRelay_) external {
        if (msg.sender != BINDING_OPERATOR) revert UnauthorizedBinding();
        if (destinationRelay_ == address(0)) revert ZeroAddress();
        if (destinationRelay != address(0)) revert DestinationRelayAlreadyBound();
        destinationRelay = destinationRelay_;
        emit DestinationRelayBound(destinationRelay_);
    }

    function propose(GardenSafeActionCodec.Action calldata action) external payable returns (bytes32 actionId) {
        GardenSafeActionCodec.Action memory actionCopy = action;
        _validateAction(actionCopy, true);
        _requireGarden(actionCopy);
        if (actionCopy.actionNonce != nextActionNonce[actionCopy.gardenAccount]) revert InvalidActionNonce();
        if (activeAction[actionCopy.gardenAccount] != bytes32(0)) revert InvalidActionState();

        actionId = GardenSafeActionCodec.actionId(actionCopy);
        if (actionStatus[actionId] != GardenSafeActionCodec.ActionStatus.None) revert InvalidActionState();

        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Proposed;
        _actionDigests[actionId] = GardenSafeActionCodec.actionDigest(actionCopy);
        activeAction[actionCopy.gardenAccount] = actionId;
        nextActionNonce[actionCopy.gardenAccount] = actionCopy.actionNonce + 1;
        _send(actionId, GardenSafeActionCodec.MessageKind.Proposal, actionCopy);
    }

    function finalize(bytes32 actionId, GardenSafeActionCodec.Action calldata action) external payable {
        GardenSafeActionCodec.Action memory actionCopy = action;
        _validateAction(actionCopy, true);
        _requireGarden(actionCopy);
        _requireMatchingProposal(actionId, actionCopy);

        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Finalized;
        activeAction[actionCopy.gardenAccount] = bytes32(0);
        _send(actionId, GardenSafeActionCodec.MessageKind.Finalization, actionCopy);
    }

    function cancel(bytes32 actionId, GardenSafeActionCodec.Action calldata action) external payable {
        GardenSafeActionCodec.Action memory actionCopy = action;
        _validateAction(actionCopy, false);
        _requireGarden(actionCopy);
        _requireMatchingProposal(actionId, actionCopy);

        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Cancelled;
        activeAction[actionCopy.gardenAccount] = bytes32(0);
        _send(actionId, GardenSafeActionCodec.MessageKind.Cancellation, actionCopy);
    }

    function actionDigest(bytes32 actionId) external view returns (bytes32) {
        return _actionDigests[actionId];
    }

    function _validateAction(GardenSafeActionCodec.Action memory action, bool requireLiveDeadline) private view {
        if (destinationRelay == address(0)) revert DestinationRelayUnbound();
        if (
            action.version != PROTOCOL_VERSION || action.sourceEvmChainId != SOURCE_EVM_CHAIN_ID
                || action.sourceChainSelector != SOURCE_CHAIN_SELECTOR || action.sourceRouter != address(this)
                || action.gardenToken != GARDEN_TOKEN || action.gardenAccount == address(0)
                || action.destinationEvmChainId != DESTINATION_EVM_CHAIN_ID
                || action.destinationChainSelector != DESTINATION_CHAIN_SELECTOR
                || action.destinationRouter != DESTINATION_ROUTER || action.destinationRelay != destinationRelay
                || action.destinationSafe != safeForGarden[action.gardenAccount] || action.safeTransaction.to == address(0)
                || action.safeTransaction.operation > 1
                || action.safeTransaction.data.length > MAX_SAFE_CALLDATA_BYTES || action.safeTransactionHash == bytes32(0)
                || action.recoverySignatureHash == bytes32(0) || action.deadline == 0
        ) {
            revert InvalidAction();
        }
        if (requireLiveDeadline && block.timestamp > action.deadline) revert ActionExpired();
    }

    function _requireGarden(GardenSafeActionCodec.Action memory action) private view {
        address expectedAccount = IERC6551Registry(ERC6551_REGISTRY)
            .account(ACCOUNT_IMPLEMENTATION, ACCOUNT_SALT, SOURCE_EVM_CHAIN_ID, GARDEN_TOKEN, action.tokenId);
        if (expectedAccount != action.gardenAccount || msg.sender != expectedAccount) revert UnauthorizedGarden();
    }

    function _requireMatchingProposal(bytes32 actionId, GardenSafeActionCodec.Action memory action) private view {
        if (
            actionStatus[actionId] != GardenSafeActionCodec.ActionStatus.Proposed
                || activeAction[action.gardenAccount] != actionId
        ) {
            revert InvalidActionState();
        }
        if (
            GardenSafeActionCodec.actionId(action) != actionId
                || GardenSafeActionCodec.actionDigest(action) != _actionDigests[actionId]
        ) {
            revert ActionHashMismatch();
        }
    }

    function _send(
        bytes32 actionId,
        GardenSafeActionCodec.MessageKind kind,
        GardenSafeActionCodec.Action memory action
    )
        private
    {
        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationRelay),
            data: GardenSafeActionCodec.encode(kind, action),
            tokenAmounts: noTokens,
            feeToken: address(0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({ gasLimit: DESTINATION_GAS_LIMIT }))
        });
        uint256 fee = IRouterClient(CCIP_ROUTER).getFee(DESTINATION_CHAIN_SELECTOR, message);
        if (msg.value != fee) revert InvalidFee();
        bytes32 messageId = IRouterClient(CCIP_ROUTER).ccipSend{ value: fee }(DESTINATION_CHAIN_SELECTOR, message);
        emit ActionMessageSent(actionId, kind, action.gardenAccount, action.destinationSafe, messageId, fee);
    }
}
