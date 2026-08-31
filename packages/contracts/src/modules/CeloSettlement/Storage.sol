// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { ICeloSettlementExecutor } from "../../interfaces/ICeloSettlementExecutor.sol";

/// @title CeloSettlementStorage
/// @notice Sole storage declaration for the Celo settlement executor.
/// @dev Every chain contract in this directory inherits this base and declares NO storage of its
///      own, so the frozen layout baseline is independent of how behavior is organized. The four
///      upgradeable/receiver bases below must keep this exact order — the baseline assigns their
///      slots before this contract's own entries.
abstract contract CeloSettlementStorage is
    ICeloSettlementExecutor,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    CCIPReceiver
{
    uint16 internal constant _HARD_MAX_BATCH_SIZE = 24;
    uint16 internal constant _BPS_DENOMINATOR = 10_000;
    uint64 internal constant _MAX_PREVIOUS_PEER_GRACE = 30 days;
    uint256 internal constant _ACKNOWLEDGMENT_GAS_LIMIT = 300_000;
    uint8 internal constant _CONTRIBUTOR_CONSIDERATION = 0;
    uint8 internal constant _FUNDING = 1;
    uint8 internal constant _LOAN_PRINCIPAL = 2;
    uint8 internal constant _GARDEN_BENEFICIARY = 3;
    uint8 internal constant _REFUND = 4;

    address public immutable override CCIP_ROUTER;
    address public immutable override G_DOLLAR_TOKEN;
    /// @dev This executor's own CCIP selector and the EVM chain ID of the source it answers to.
    ///      Neither is needed to execute — CCIP addressing uses the peer's selector — but nothing
    ///      else on this chain can state them, so without them the executor half of the read model
    ///      has no way to key its rows and silently produces none (Decision Log #59).
    uint64 public immutable override LOCAL_CHAIN_SELECTOR;
    uint64 public immutable override SOURCE_EVM_CHAIN_ID;

    SourcePeer internal _sourcePeer;
    mapping(address garden => GardenRoute route) internal _gardenRoutes;
    mapping(address safe => address garden) public safeToGarden;
    mapping(bytes32 executionKey => ExecutionResult result) internal _executionResults;
    uint16 public override maxBatchSize;
    uint256 public override maxTransferAmount;
    uint256 public override maxBatchAmount;
    uint64 public override periodDuration;
    uint256 public override maxPeriodAmount;
    mapping(address garden => GardenPeriodSpend spend) internal _gardenPeriodSpends;
    uint256 public override acknowledgmentFeeReserveMinimum;
    bool public override paused;
    uint16 public override maxFeeBps;
    uint256 public override maxFeeAmount;
    uint256[36] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address ccipRouter_, address gDollarToken_, uint64 localChainSelector_, uint64 sourceEvmChainId_) {
        if (ccipRouter_ == address(0) || gDollarToken_ == address(0)) revert ZeroAddress();
        if (localChainSelector_ == 0 || sourceEvmChainId_ == 0) revert PolicyNotConfigured();
        CCIP_ROUTER = ccipRouter_;
        G_DOLLAR_TOKEN = gDollarToken_;
        LOCAL_CHAIN_SELECTOR = localChainSelector_;
        SOURCE_EVM_CHAIN_ID = sourceEvmChainId_;
        _disableInitializers();
    }
}
