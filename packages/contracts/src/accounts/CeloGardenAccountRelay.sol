// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import { IERC6551Registry } from "../interfaces/IERC6551Registry.sol";
import { IGardenAccountExecutor, ISafeV141 } from "../interfaces/IGardenAccountRelayDependencies.sol";
import { GardenSafeActionCodec } from "../libraries/GardenSafeActionCodec.sol";
import { GardenSafeExecution } from "../libraries/GardenSafeExecution.sol";

/// @title CeloGardenAccountRelay
/// @notice Executes only a fully committed Garden Safe transaction after authenticated CCIP
///         proposal/finalization and one independently committed recovery Safe signature.
/// @dev The relay is intentionally not a Safe owner, module, guard, Zodiac member, Settlement
///      executor, token spender, or administrator. The matching AccountGuardian trust is a
///      separate reviewed deployment boundary and authorizes only this fixed execution path.
contract CeloGardenAccountRelay is CCIPReceiver, ReentrancyGuard {
    error ZeroAddress();
    error InvalidConfiguration();
    error InvalidCcipSource();
    error InvalidCcipSender();
    error CcipTokensNotAllowed();
    error CcipMessageReplay();
    error InvalidAction();
    error InvalidActionState();
    error InvalidActionNonce();
    error ActionHashMismatch();
    error ActionExpired();
    error InvalidRecoveryOwner();
    error InvalidRecoverySignature();
    error InvalidSafeTopology();
    error InvalidSafeNonce();
    error InvalidSafeTransactionHash();
    error SafeExecutionFailed();

    event ActionReceived(
        bytes32 indexed actionId,
        GardenSafeActionCodec.MessageKind indexed kind,
        address indexed gardenAccount,
        address destinationSafe,
        bytes32 messageId
    );
    event ActionExpiredAtDestination(bytes32 indexed actionId);
    event ActionExecuted(
        bytes32 indexed actionId,
        address indexed gardenAccount,
        address indexed destinationSafe,
        address recoverySafe,
        bytes32 safeTransactionHash
    );

    uint8 public constant PROTOCOL_VERSION = 1;
    uint256 public constant MAX_SAFE_CALLDATA_BYTES = 4096;
    uint256 public constant SOURCE_EVM_CHAIN_ID = 42_161;
    uint256 public constant DESTINATION_EVM_CHAIN_ID = 42_220;
    bytes32 public constant ACCOUNT_SALT = 0x6551655165516551655165516551655165516551655165516551655165516551;

    uint64 public immutable SOURCE_CHAIN_SELECTOR;
    uint64 public immutable DESTINATION_CHAIN_SELECTOR;
    address public immutable SOURCE_ROUTER;
    address public immutable ERC6551_REGISTRY;
    address public immutable ACCOUNT_IMPLEMENTATION;
    address public immutable GARDEN_TOKEN;
    address public immutable GREEN_GOODS_RECOVERY_SAFE;
    address public immutable DEV_GUILD_RECOVERY_SAFE;

    mapping(address gardenAccount => address safe) public safeForGarden;
    mapping(address safe => address gardenAccount) public gardenForSafe;
    mapping(address gardenAccount => uint256 nonce) public nextActionNonce;
    mapping(bytes32 actionId => GardenSafeActionCodec.ActionStatus status) public actionStatus;
    mapping(bytes32 messageId => bool processed) public processedMessages;
    mapping(bytes32 actionId => bytes32 digest) private _actionDigests;

    constructor(
        address ccipRouter,
        uint64 sourceChainSelector,
        uint64 destinationChainSelector,
        address sourceRouter,
        address erc6551Registry,
        address accountImplementation,
        address gardenToken,
        address greenGoodsRecoverySafe,
        address devGuildRecoverySafe,
        address[] memory gardenAccounts,
        address[] memory destinationSafes
    )
        CCIPReceiver(ccipRouter)
    {
        if (
            ccipRouter == address(0) || sourceRouter == address(0) || erc6551Registry == address(0)
                || accountImplementation == address(0) || gardenToken == address(0) || greenGoodsRecoverySafe == address(0)
                || devGuildRecoverySafe == address(0)
        ) {
            revert ZeroAddress();
        }
        if (
            block.chainid != DESTINATION_EVM_CHAIN_ID || sourceChainSelector == 0 || destinationChainSelector == 0
                || greenGoodsRecoverySafe == devGuildRecoverySafe || gardenAccounts.length == 0
                || gardenAccounts.length != destinationSafes.length
        ) {
            revert InvalidConfiguration();
        }

        SOURCE_CHAIN_SELECTOR = sourceChainSelector;
        DESTINATION_CHAIN_SELECTOR = destinationChainSelector;
        SOURCE_ROUTER = sourceRouter;
        ERC6551_REGISTRY = erc6551Registry;
        ACCOUNT_IMPLEMENTATION = accountImplementation;
        GARDEN_TOKEN = gardenToken;
        GREEN_GOODS_RECOVERY_SAFE = greenGoodsRecoverySafe;
        DEV_GUILD_RECOVERY_SAFE = devGuildRecoverySafe;

        for (uint256 i; i < gardenAccounts.length; ++i) {
            address gardenAccount = gardenAccounts[i];
            address destinationSafe = destinationSafes[i];
            if (
                gardenAccount == address(0) || destinationSafe == address(0) || gardenAccount == greenGoodsRecoverySafe
                    || gardenAccount == devGuildRecoverySafe || destinationSafe == greenGoodsRecoverySafe
                    || destinationSafe == devGuildRecoverySafe || safeForGarden[gardenAccount] != address(0)
                    || gardenForSafe[destinationSafe] != address(0)
            ) {
                revert InvalidConfiguration();
            }
            safeForGarden[gardenAccount] = destinationSafe;
            gardenForSafe[destinationSafe] = gardenAccount;
        }
    }

    function actionDigest(bytes32 actionId) external view returns (bytes32) {
        return _actionDigests[actionId];
    }

    function expire(bytes32 actionId, GardenSafeActionCodec.Action calldata action) external {
        GardenSafeActionCodec.ActionStatus status = actionStatus[actionId];
        if (status != GardenSafeActionCodec.ActionStatus.Proposed && status != GardenSafeActionCodec.ActionStatus.Finalized)
        {
            revert InvalidActionState();
        }
        GardenSafeActionCodec.Action memory actionCopy = action;
        _requireStoredAction(actionId, actionCopy);
        if (block.timestamp <= actionCopy.deadline) revert InvalidActionState();
        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Expired;
        emit ActionExpiredAtDestination(actionId);
    }

    function execute(
        bytes32 actionId,
        GardenSafeActionCodec.Action calldata action,
        address recoverySafe,
        bytes calldata recoverySignature
    )
        external
        nonReentrant
    {
        if (actionStatus[actionId] != GardenSafeActionCodec.ActionStatus.Finalized) revert InvalidActionState();

        GardenSafeActionCodec.Action memory actionCopy = action;
        _requireStoredAction(actionId, actionCopy);
        if (block.timestamp > actionCopy.deadline) revert ActionExpired();
        if (recoverySafe != GREEN_GOODS_RECOVERY_SAFE && recoverySafe != DEV_GUILD_RECOVERY_SAFE) {
            revert InvalidRecoveryOwner();
        }
        if (keccak256(abi.encode(recoverySafe, recoverySignature)) != actionCopy.recoverySignatureHash) {
            revert InvalidRecoverySignature();
        }

        ISafeV141 destinationSafe = ISafeV141(actionCopy.destinationSafe);
        _requireFinalSafeTopology(destinationSafe, actionCopy.gardenAccount);
        if (destinationSafe.nonce() != actionCopy.safeTransaction.nonce) revert InvalidSafeNonce();

        bytes32 liveSafeTransactionHash = GardenSafeExecution.transactionHash(destinationSafe, actionCopy.safeTransaction);
        if (liveSafeTransactionHash != actionCopy.safeTransactionHash) revert InvalidSafeTransactionHash();

        bytes memory signatures =
            GardenSafeExecution.buildSignatures(actionCopy.gardenAccount, recoverySafe, recoverySignature);
        bytes memory safeCall = abi.encodeCall(
            ISafeV141.execTransaction,
            (
                actionCopy.safeTransaction.to,
                actionCopy.safeTransaction.value,
                actionCopy.safeTransaction.data,
                actionCopy.safeTransaction.operation,
                actionCopy.safeTransaction.safeTxGas,
                actionCopy.safeTransaction.baseGas,
                actionCopy.safeTransaction.gasPrice,
                actionCopy.safeTransaction.gasToken,
                payable(actionCopy.safeTransaction.refundReceiver),
                signatures
            )
        );

        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Executed;
        bytes memory safeResult =
            IGardenAccountExecutor(actionCopy.gardenAccount).execute(actionCopy.destinationSafe, 0, safeCall, 0);
        if (safeResult.length < 32 || !abi.decode(safeResult, (bool))) revert SafeExecutionFailed();

        emit ActionExecuted(
            actionId, actionCopy.gardenAccount, actionCopy.destinationSafe, recoverySafe, actionCopy.safeTransactionHash
        );
    }

    function buildSafeSignatures(
        address gardenAccount,
        address recoverySafe,
        bytes calldata recoverySignature
    )
        external
        pure
        returns (bytes memory)
    {
        return GardenSafeExecution.buildSignatures(gardenAccount, recoverySafe, recoverySignature);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (message.sourceChainSelector != SOURCE_CHAIN_SELECTOR) revert InvalidCcipSource();
        if (message.sender.length != 32 || abi.decode(message.sender, (address)) != SOURCE_ROUTER) {
            revert InvalidCcipSender();
        }
        if (message.destTokenAmounts.length != 0) revert CcipTokensNotAllowed();
        if (processedMessages[message.messageId]) revert CcipMessageReplay();

        GardenSafeActionCodec.Envelope memory envelope = GardenSafeActionCodec.decode(message.data);
        GardenSafeActionCodec.Action memory action = envelope.action;
        _validateAction(action);
        bytes32 actionId = GardenSafeActionCodec.actionId(action);

        if (envelope.kind == GardenSafeActionCodec.MessageKind.Proposal) {
            _receiveProposal(actionId, action);
        } else if (envelope.kind == GardenSafeActionCodec.MessageKind.Finalization) {
            _receiveFinalization(actionId, action);
        } else if (envelope.kind == GardenSafeActionCodec.MessageKind.Cancellation) {
            _receiveCancellation(actionId, action);
        } else {
            revert InvalidAction();
        }

        processedMessages[message.messageId] = true;
        emit ActionReceived(actionId, envelope.kind, action.gardenAccount, action.destinationSafe, message.messageId);
    }

    function _receiveProposal(bytes32 actionId, GardenSafeActionCodec.Action memory action) private {
        if (block.timestamp > action.deadline) revert ActionExpired();
        if (actionStatus[actionId] != GardenSafeActionCodec.ActionStatus.None) revert InvalidActionState();
        if (action.actionNonce < nextActionNonce[action.gardenAccount]) revert InvalidActionNonce();

        _actionDigests[actionId] = GardenSafeActionCodec.actionDigest(action);
        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Proposed;
        nextActionNonce[action.gardenAccount] = action.actionNonce + 1;
    }

    function _receiveFinalization(bytes32 actionId, GardenSafeActionCodec.Action memory action) private {
        if (block.timestamp > action.deadline) revert ActionExpired();
        if (actionStatus[actionId] != GardenSafeActionCodec.ActionStatus.Proposed) revert InvalidActionState();
        _requireStoredAction(actionId, action);
        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Finalized;
    }

    function _receiveCancellation(bytes32 actionId, GardenSafeActionCodec.Action memory action) private {
        if (actionStatus[actionId] != GardenSafeActionCodec.ActionStatus.Proposed) revert InvalidActionState();
        _requireStoredAction(actionId, action);
        actionStatus[actionId] = GardenSafeActionCodec.ActionStatus.Cancelled;
    }

    function _validateAction(GardenSafeActionCodec.Action memory action) private view {
        if (
            action.version != PROTOCOL_VERSION || action.sourceEvmChainId != SOURCE_EVM_CHAIN_ID
                || action.sourceChainSelector != SOURCE_CHAIN_SELECTOR || action.sourceRouter != SOURCE_ROUTER
                || action.gardenToken != GARDEN_TOKEN || action.gardenAccount == address(0)
                || action.destinationEvmChainId != DESTINATION_EVM_CHAIN_ID
                || action.destinationChainSelector != DESTINATION_CHAIN_SELECTOR || action.destinationRouter != getRouter()
                || action.destinationRelay != address(this) || action.destinationSafe != safeForGarden[action.gardenAccount]
                || action.safeTransaction.to == address(0) || action.safeTransaction.operation > 1
                || action.safeTransaction.data.length > MAX_SAFE_CALLDATA_BYTES || action.safeTransactionHash == bytes32(0)
                || action.recoverySignatureHash == bytes32(0) || action.deadline == 0
        ) {
            revert InvalidAction();
        }

        address expectedAccount = IERC6551Registry(ERC6551_REGISTRY)
            .account(ACCOUNT_IMPLEMENTATION, ACCOUNT_SALT, SOURCE_EVM_CHAIN_ID, GARDEN_TOKEN, action.tokenId);
        if (expectedAccount != action.gardenAccount) revert InvalidAction();
    }

    function _requireStoredAction(bytes32 actionId, GardenSafeActionCodec.Action memory action) private view {
        if (
            GardenSafeActionCodec.actionId(action) != actionId
                || GardenSafeActionCodec.actionDigest(action) != _actionDigests[actionId]
        ) {
            revert ActionHashMismatch();
        }
    }

    function _requireFinalSafeTopology(ISafeV141 destinationSafe, address gardenAccount) private view {
        address[] memory owners = destinationSafe.getOwners();
        if (owners.length != 3 || destinationSafe.getThreshold() != 2) revert InvalidSafeTopology();

        bool hasGarden;
        bool hasGreenGoods;
        bool hasDevGuild;
        for (uint256 i; i < owners.length; ++i) {
            address owner = owners[i];
            if (owner == gardenAccount) hasGarden = true;
            else if (owner == GREEN_GOODS_RECOVERY_SAFE) hasGreenGoods = true;
            else if (owner == DEV_GUILD_RECOVERY_SAFE) hasDevGuild = true;
            else revert InvalidSafeTopology();
        }
        if (!hasGarden || !hasGreenGoods || !hasDevGuild) revert InvalidSafeTopology();
    }
}
