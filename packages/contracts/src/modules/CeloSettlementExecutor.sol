// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";

import { ICeloSettlementExecutor } from "../interfaces/ICeloSettlementExecutor.sol";
import { CeloSettlementStorage } from "./CeloSettlement/Storage.sol";
import { CeloSettlementViews } from "./CeloSettlement/Views.sol";

/// @title CeloSettlementExecutor
/// @notice Executes authenticated, message-only settlement commands through bounded Zodiac Roles.
/// @dev Canonical G$ and the CCIP router are immutable implementation facts. The executor owns no
///      G$, accepts no CCIP tokens, and exposes no caller-controlled target or calldata surface.
///      File architecture mirrors `CommitmentPooling.sol`: the `./CeloSettlement/*` abstract
///      contracts are thin shells in a single linear chain — Storage -> Base -> Admin ->
///      Acknowledgments -> Execution -> Views -> this contract — and only `CeloSettlementStorage`
///      declares state, so the frozen layout baseline is independent of the chain. Keep this file
///      and the contract name stable: tests and deploy tooling resolve the artifact as
///      `CeloSettlementExecutor.sol:CeloSettlementExecutor`, and the storage-layout baseline is
///      keyed on the contract name.
contract CeloSettlementExecutor is CeloSettlementViews {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address ccipRouter_,
        address gDollarToken_
    )
        CeloSettlementStorage(ccipRouter_, gDollarToken_)
        CCIPReceiver(ccipRouter_)
    { }

    function initialize(
        address owner_,
        uint64 sourceChainSelector_,
        address sourceSettlementModule_,
        uint8 protocolVersion_
    )
        external
        override
        initializer
    {
        if (owner_ == address(0) || sourceChainSelector_ == 0 || sourceSettlementModule_ == address(0)) {
            revert ZeroAddress();
        }
        if (protocolVersion_ == 0) revert UnsupportedMessageVersion();
        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(owner_);
        _sourcePeer = SourcePeer({
            sourceChainSelector: sourceChainSelector_,
            sourceSettlementModule: sourceSettlementModule_,
            previousSourceSettlementModule: address(0),
            previousPeerExpiresAt: 0,
            protocolVersion: protocolVersion_
        });
        paused = true;
        // First fact out of this contract: the immutables nothing else emits (Decision Log #59).
        emit ExecutorDeploymentPinned(CCIP_ROUTER, G_DOLLAR_TOKEN, sourceChainSelector_);
        emit SourcePeerUpdated(sourceChainSelector_, sourceSettlementModule_, address(0), 0, protocolVersion_);
        emit PausedSet(true);
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyOwner {
        _requirePaused();
        try ICeloSettlementExecutor(newImplementation).CCIP_ROUTER() returns (address replacementRouter) {
            if (replacementRouter != CCIP_ROUTER) revert ImmutableRouterMismatch(CCIP_ROUTER, replacementRouter);
        } catch {
            revert ImmutableRouterMismatch(CCIP_ROUTER, address(0));
        }
        try ICeloSettlementExecutor(newImplementation).G_DOLLAR_TOKEN() returns (address replacementToken) {
            if (replacementToken != G_DOLLAR_TOKEN) {
                revert ImmutableGdollarMismatch(G_DOLLAR_TOKEN, replacementToken);
            }
        } catch {
            revert ImmutableGdollarMismatch(G_DOLLAR_TOKEN, address(0));
        }
    }

    receive() external payable {
        emit AcknowledgmentFeeReserveFunded(msg.sender, msg.value);
    }
}
