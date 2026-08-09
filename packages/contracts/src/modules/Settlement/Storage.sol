// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";

import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";
import { SettlementPlanLib } from "../../lib/Settlement/PlanLib.sol";

/// @title SettlementModuleStorage
/// @notice Sole storage declaration for the Arbitrum settlement command module.
/// @dev Every chain contract in this directory inherits this base and declares NO storage of its
///      own, so the frozen layout baseline is independent of how behavior is organized. The four
///      upgradeable/receiver bases below must keep this exact order — the baseline assigns their
///      slots before this contract's own entries.
abstract contract SettlementModuleStorage is
    ISettlementModule,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    CCIPReceiver
{
    uint16 internal constant _HARD_MAX_BATCH_SIZE = 24;
    uint8 internal constant _PROTOCOL_VERSION = 1;
    uint64 internal constant _MAX_PREVIOUS_PEER_GRACE = 30 days;

    address public immutable override CCIP_ROUTER;
    uint64 public immutable override SOURCE_CHAIN_SELECTOR;
    uint64 public immutable override DESTINATION_EVM_CHAIN_ID;

    address public override hatsModule;
    address public override commitmentPoolingModule;
    address public override protocolGarden;
    address public override gDollarToken;
    bool public override paused;
    bool public override gardenerDeliveryEnabled;
    uint16 public override batchSizeLimit;
    address public override dispatcher;
    uint256 public override feeReserveMinimum;

    CcipRoute internal _ccipRoute;
    uint256 internal _nextDisbursementId;
    uint256 internal _nextBatchId;

    mapping(address garden => SettlementAccount account) internal _settlementAccounts;
    mapping(uint256 disbursementId => Disbursement disbursement) internal _disbursements;
    mapping(uint256 batchId => Batch batch) internal _batches;
    SettlementPlanLib.State internal _planState;
    mapping(bytes32 executionKey => CommandRecord record) internal _commandRecords;
    mapping(bytes32 executionKey => bytes payload) internal _commandPayloads;
    mapping(bytes32 commandMessageId => bytes32 executionKey) public commandExecutionKeys;

    uint256[29] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address ccipRouter_, uint64 sourceChainSelector_, uint64 destinationEvmChainId_) {
        if (ccipRouter_ == address(0)) revert ZeroAddress();
        if (sourceChainSelector_ == 0 || destinationEvmChainId_ == 0) revert FundingConfigurationIncomplete();
        CCIP_ROUTER = ccipRouter_;
        SOURCE_CHAIN_SELECTOR = sourceChainSelector_;
        DESTINATION_EVM_CHAIN_ID = destinationEvmChainId_;
        _disableInitializers();
    }
}
