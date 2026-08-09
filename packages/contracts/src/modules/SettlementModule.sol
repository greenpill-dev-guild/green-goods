// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";

import { SettlementPlanLib } from "../lib/Settlement/PlanLib.sol";
import { SettlementModuleStorage } from "./Settlement/Storage.sol";
import { SettlementViews } from "./Settlement/Views.sol";

/// @title SettlementModule
/// @notice Arbitrum source of canonical, message-only Celo settlement commands.
/// @dev The module never custodies or approves G$. It derives every value-moving fact from
///      frozen commitment, payout-plan, and settlement-account state.
///      File architecture mirrors `CommitmentPooling.sol`: the `./Settlement/*` abstract
///      contracts are thin shells in a single linear chain — Storage -> Base -> Admin -> Plans ->
///      Lifecycle -> Views -> this contract — and only `SettlementModuleStorage` declares state,
///      so the frozen layout baseline is independent of the chain. Behavior weight lives in the
///      deployed libraries under `src/lib/Settlement/`. Keep this file and the contract name
///      stable: tests and deploy tooling resolve the artifact as
///      `SettlementModule.sol:SettlementModule`, and the storage-layout baseline is keyed on the
///      contract name.
contract SettlementModule is SettlementViews {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address ccipRouter_,
        uint64 sourceChainSelector_,
        uint64 destinationEvmChainId_
    )
        SettlementModuleStorage(ccipRouter_, sourceChainSelector_, destinationEvmChainId_)
        CCIPReceiver(ccipRouter_)
    { }

    function initialize(
        address owner_,
        address hatsModule_,
        address commitmentPoolingModule_,
        address protocolGarden_,
        address gDollarToken_
    )
        external
        override
        initializer
    {
        if (
            owner_ == address(0) || hatsModule_ == address(0) || commitmentPoolingModule_ == address(0)
                || protocolGarden_ == address(0) || gDollarToken_ == address(0)
        ) revert ZeroAddress();

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);

        hatsModule = hatsModule_;
        commitmentPoolingModule = commitmentPoolingModule_;
        protocolGarden = protocolGarden_;
        gDollarToken = gDollarToken_;
        paused = true;
        _nextDisbursementId = 1;
        _nextBatchId = 1;
        SettlementPlanLib.initialize(_planState);

        emit FundingConfigurationLocked(protocolGarden_, gDollarToken_);
        emit HatsModuleUpdated(address(0), hatsModule_);
        emit CommitmentPoolingModuleUpdated(address(0), commitmentPoolingModule_);
        emit PausedSet(true);
    }

    function _authorizeUpgrade(address) internal view override onlyOwner {
        if (!paused) revert SourceMustBePaused();
    }

    receive() external payable {
        emit FeeReserveFunded(msg.sender, msg.value);
    }
}
