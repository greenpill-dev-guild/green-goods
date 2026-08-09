// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISafeOwnerView, IZodiacRoles } from "../../interfaces/IZodiacRoles.sol";
import { CeloSettlementBase } from "./Base.sol";

/// @title CeloSettlementAdmin
/// @notice Paused-first configuration surface: routes, peer rotation, caps, and fee policy.
abstract contract CeloSettlementAdmin is CeloSettlementBase {
    function configureGardenRoute(
        address garden,
        address safe,
        address rolesModifier,
        bytes32 roleKey,
        bytes32 allowanceKey,
        bytes32 permissionsConfigHash
    )
        external
        override
        onlyOwner
    {
        _requirePaused();
        if (
            garden == address(0) || safe == address(0) || rolesModifier == address(0) || roleKey == bytes32(0)
                || allowanceKey == bytes32(0) || permissionsConfigHash == bytes32(0)
        ) revert ZeroAddress();
        if (_gardenRoutes[garden].safe != address(0)) revert GardenRouteAlreadyConfigured(garden);
        address assignedGarden = safeToGarden[safe];
        if (assignedGarden != address(0)) revert SafeAlreadyAssigned(safe, assignedGarden);
        if (safe.code.length == 0 || rolesModifier.code.length == 0) revert PolicyNotConfigured();
        IZodiacRoles roles = IZodiacRoles(rolesModifier);
        if (
            ISafeOwnerView(safe).isOwner(address(this)) || roles.avatar() != safe || roles.target() != safe
                || !roles.isModuleEnabled(address(this)) || roles.defaultRoles(address(this)) != roleKey
        ) revert PolicyNotConfigured();

        _gardenRoutes[garden] = GardenRoute({
            safe: safe,
            rolesModifier: rolesModifier,
            roleKey: roleKey,
            allowanceKey: allowanceKey,
            permissionsConfigHash: permissionsConfigHash,
            active: true
        });
        safeToGarden[safe] = garden;
        emit GardenRouteConfigured(garden, safe, rolesModifier, roleKey, allowanceKey, permissionsConfigHash);
    }

    function setGardenRouteActive(address garden, bool active) external override onlyOwner {
        _requirePaused();
        if (_gardenRoutes[garden].safe == address(0)) revert PolicyNotConfigured();
        _gardenRoutes[garden].active = active;
        emit GardenRouteStatusChanged(garden, active);
    }

    /// @dev Keeps peer rotation and its grace-window snapshot in one auditable transition.
    // solhint-disable-next-line code-complexity
    function setSourcePeer(
        address sourceSettlementModule,
        uint8 protocolVersion,
        uint64 previousPeerGraceSeconds
    )
        external
        override
        onlyOwner
    {
        _requirePaused();
        if (sourceSettlementModule == address(0)) revert ZeroAddress();
        if (protocolVersion == 0) revert UnsupportedMessageVersion();
        if (previousPeerGraceSeconds > _MAX_PREVIOUS_PEER_GRACE) revert PolicyNotConfigured();

        SourcePeer memory prior = _sourcePeer;
        address previousModule;
        uint64 previousExpiresAt;
        if (sourceSettlementModule == prior.sourceSettlementModule && protocolVersion == prior.protocolVersion) {
            previousModule = prior.previousSourceSettlementModule;
            previousExpiresAt = prior.previousPeerExpiresAt;
            if (previousPeerGraceSeconds != 0) {
                if (previousModule == address(0)) revert PolicyNotConfigured();
                uint64 proposed = uint64(block.timestamp) + previousPeerGraceSeconds;
                if (proposed < previousExpiresAt) revert PolicyNotConfigured();
                previousExpiresAt = proposed;
            }
        } else if (protocolVersion != prior.protocolVersion) {
            if (previousPeerGraceSeconds != 0) revert PolicyNotConfigured();
        } else if (previousPeerGraceSeconds != 0) {
            previousModule = prior.sourceSettlementModule;
            previousExpiresAt = uint64(block.timestamp) + previousPeerGraceSeconds;
        }

        _sourcePeer.sourceSettlementModule = sourceSettlementModule;
        _sourcePeer.previousSourceSettlementModule = previousModule;
        _sourcePeer.previousPeerExpiresAt = previousExpiresAt;
        _sourcePeer.protocolVersion = protocolVersion;
        emit SourcePeerUpdated(
            prior.sourceChainSelector, sourceSettlementModule, previousModule, previousExpiresAt, protocolVersion
        );
    }

    function setCaps(
        uint16 maxBatchSize_,
        uint256 maxTransferAmount_,
        uint256 maxBatchAmount_
    )
        external
        override
        onlyOwner
    {
        _requirePaused();
        if (
            maxBatchSize_ > _HARD_MAX_BATCH_SIZE
                || (maxTransferAmount_ != 0 && maxBatchAmount_ != 0 && maxTransferAmount_ > maxBatchAmount_)
        ) revert PolicyNotConfigured();
        maxBatchSize = maxBatchSize_;
        maxTransferAmount = maxTransferAmount_;
        maxBatchAmount = maxBatchAmount_;
        emit CapsUpdated(maxBatchSize_, maxTransferAmount_, maxBatchAmount_);
    }

    function setFeePolicy(uint16 maxFeeBps_, uint256 maxFeeAmount_) external override onlyOwner {
        _requirePaused();
        if (maxFeeBps_ > _BPS_DENOMINATOR) revert InvalidFeePolicy(maxFeeBps_, maxFeeAmount_);
        maxFeeBps = maxFeeBps_;
        maxFeeAmount = maxFeeAmount_;
        emit FeePolicyUpdated(maxFeeBps_, maxFeeAmount_);
    }

    function setPeriodicCap(uint64 periodDuration_, uint256 maxPeriodAmount_) external override onlyOwner {
        _requirePaused();
        periodDuration = periodDuration_;
        maxPeriodAmount = maxPeriodAmount_;
        emit PeriodicCapUpdated(periodDuration_, maxPeriodAmount_);
    }

    function setAcknowledgmentFeeReserveMinimum(uint256 minimum) external override onlyOwner {
        _requirePaused();
        uint256 previous = acknowledgmentFeeReserveMinimum;
        acknowledgmentFeeReserveMinimum = minimum;
        emit AcknowledgmentFeeReserveMinimumUpdated(previous, minimum);
    }

    function setPaused(bool paused_) external override onlyOwner {
        if (!paused_) {
            SourcePeer memory peer = _sourcePeer;
            if (
                peer.sourceChainSelector == 0 || peer.sourceSettlementModule == address(0) || peer.protocolVersion == 0
                    || maxTransferAmount == 0 || maxBatchAmount == 0 || periodDuration == 0 || maxPeriodAmount == 0
                    || acknowledgmentFeeReserveMinimum == 0
            ) revert ExecutorNotReady();
        }
        paused = paused_;
        emit PausedSet(paused_);
    }
}
