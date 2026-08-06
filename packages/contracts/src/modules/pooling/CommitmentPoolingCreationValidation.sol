// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";
import { CommitmentPoolingPools, IWorkDecisionSequenceResolver } from "./CommitmentPoolingPools.sol";

/// @title CommitmentPoolingCreationValidation
/// @notice Creation-time input validation and the frozen payload hash.
abstract contract CommitmentPoolingCreationValidation is CommitmentPoolingPools {
    // solhint-disable-next-line code-complexity
    function _resolveCreator(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        ICommitmentPoolingModule.Pool storage pool
    )
        internal
        view
        returns (address creator)
    {
        bool steward = msg.sender == owner() || _isGardenSteward(pool.garden, msg.sender);
        if (pool.poolType == ICommitmentPoolingModule.PoolType.Protocol && !steward) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
        }
        if (params.commitmentType == ICommitmentPoolingModule.CommitmentType.StewardCaptured) {
            if (!steward) revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
            if (params.onBehalfOf == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
            creator = params.onBehalfOf;
            if (!_isGardenMember(pool.garden, creator)) {
                revert ICommitmentPoolingModule.NotEligibleContributor(creator);
            }
        } else {
            if (params.onBehalfOf != address(0)) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            creator = msg.sender;
            if (params.commitmentType == ICommitmentPoolingModule.CommitmentType.SeasonCampaign) {
                if (!steward) revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
            } else if (!_isGardenMember(pool.garden, creator)) {
                revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            }
        }
    }

    function _validateCycleForCreation(
        uint256 poolId,
        uint256 cycleId,
        ICommitmentPoolingModule.CommitmentType
    )
        internal
        view
    {
        if (cycleId == 0) return;
        ICommitmentPoolingModule.Cycle storage cycle = cycles[cycleId];
        if (cycle.state == ICommitmentPoolingModule.CycleState.None) {
            revert ICommitmentPoolingModule.UnknownCycle(cycleId);
        }
        if (cycle.poolId != poolId) {
            revert ICommitmentPoolingModule.CyclePoolMismatch(cycleId, poolId, cycle.poolId);
        }
        if (cycle.state != ICommitmentPoolingModule.CycleState.Open) {
            revert ICommitmentPoolingModule.CycleNotAcceptingCommitments(cycleId, cycle.state);
        }
    }

    function _validateSeriesForCreation(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        address creator
    )
        internal
        view
    {
        if (params.commitmentSeriesId == 0) return;
        ICommitmentPoolingModule.CommitmentSeries storage series = commitmentSeries[params.commitmentSeriesId];
        if (series.state == ICommitmentPoolingModule.CommitmentSeriesState.None) {
            revert ICommitmentPoolingModule.UnknownCommitmentSeries(params.commitmentSeriesId);
        }
        if (series.poolId != params.poolId) {
            revert ICommitmentPoolingModule.CommitmentSeriesPoolMismatch(
                params.commitmentSeriesId, params.poolId, series.poolId
            );
        }
        if (series.state != ICommitmentPoolingModule.CommitmentSeriesState.Active) {
            revert ICommitmentPoolingModule.CommitmentSeriesNotActive(params.commitmentSeriesId);
        }
        if (series.currentHolder != creator) {
            revert ICommitmentPoolingModule.CommitmentSeriesHolderOnly(params.commitmentSeriesId, creator);
        }
        if (params.direction != ICommitmentPoolingModule.CommitmentDirection.Offer) {
            revert ICommitmentPoolingModule.CommitmentSeriesOfferOnly(params.commitmentSeriesId);
        }
        if (params.claimType != ICommitmentPoolingModule.ClaimType.Individual || params.onBehalfOf != address(0)) {
            revert ICommitmentPoolingModule.CommitmentSeriesIndividualOnly(params.commitmentSeriesId);
        }
    }

    // solhint-disable-next-line code-complexity
    function _validateCounterCommitment(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        address creator
    )
        internal
        view
    {
        uint256 counterId = params.counterCommitmentId;
        if (counterId == 0) return;
        if (counterId == nextCommitmentId) revert ICommitmentPoolingModule.SelfCounterCommitment();
        ICommitmentPoolingModule.Commitment storage counter = commitments[counterId];
        if (counter.state == ICommitmentPoolingModule.CommitmentState.None) {
            revert ICommitmentPoolingModule.UnknownCounterCommitment(counterId);
        }
        if (counter.poolId != params.poolId) {
            revert ICommitmentPoolingModule.CounterCommitmentPoolMismatch(params.poolId, counterId);
        }
        if (params.direction == ICommitmentPoolingModule.CommitmentDirection.Offer) {
            if (
                params.claimType != ICommitmentPoolingModule.ClaimType.Individual
                    || params.commitmentType == ICommitmentPoolingModule.CommitmentType.StewardCaptured
                    || params.onBehalfOf != address(0)
            ) revert ICommitmentPoolingModule.ExchangeCreatorConsentRequired(counterId);
            if (
                counter.direction != ICommitmentPoolingModule.CommitmentDirection.Offer
                    || counter.state != ICommitmentPoolingModule.CommitmentState.Offered
            ) revert ICommitmentPoolingModule.ExchangeStateInvalid(counterId, counter.state);
            if (counter.claimType != ICommitmentPoolingModule.ClaimType.Individual) {
                revert ICommitmentPoolingModule.ExchangeClaimTypeUnsupported(counterId, counter.claimType);
            }
            if (counter.creator == creator) revert ICommitmentPoolingModule.SelfExchange(creator);
            if (commitmentRegistry.committedOf(counter.creator, counterId) != counter.targetUnits) {
                revert ICommitmentPoolingModule.ExchangeStateInvalid(counterId, counter.state);
            }
        }
    }

    // solhint-disable-next-line code-complexity
    function _validateAndBuildRequirements(ICommitmentPoolingModule.CreateCommitmentParams calldata params)
        internal
        view
        returns (
            uint8[] memory domains,
            uint256[] memory actionUIDs,
            uint8[] memory requirementDomains,
            uint32[] memory requiredCounts
        )
    {
        uint256 length = params.requirements.length;
        if (params.commitmentType != ICommitmentPoolingModule.CommitmentType.DomainImpact) {
            if (length != 0) revert ICommitmentPoolingModule.InvalidDomains();
            domains = _validateSubmittedDomains(params.domainTags);
            actionUIDs = new uint256[](0);
            requirementDomains = new uint8[](0);
            requiredCounts = new uint32[](0);
            return (domains, actionUIDs, requirementDomains, requiredCounts);
        }
        if (length == 0) revert ICommitmentPoolingModule.InvalidRequirementCount(0);
        if (length > MAX_REQUIREMENTS_VALUE) {
            revert ICommitmentPoolingModule.TooManyRequirements(length, MAX_REQUIREMENTS_VALUE);
        }

        actionUIDs = new uint256[](length);
        requirementDomains = new uint8[](length);
        requiredCounts = new uint32[](length);
        bool[4] memory seenDomain;
        uint256 uniqueDomainCount;
        uint256 totalRequired;
        for (uint256 i = 0; i < length; i++) {
            ICommitmentPoolingModule.CommitmentRequirementInput calldata requirement = params.requirements[i];
            if (requirement.requiredCount == 0) {
                revert ICommitmentPoolingModule.InvalidRequirementCount(i);
            }
            if (actionRegistry.actionToOwner(requirement.actionUID) == address(0)) {
                revert ICommitmentPoolingModule.UnknownAction(requirement.actionUID);
            }
            uint8 domain = uint8(actionRegistry.getAction(requirement.actionUID).domain);
            if (!seenDomain[domain]) {
                seenDomain[domain] = true;
                uniqueDomainCount++;
            }
            actionUIDs[i] = requirement.actionUID;
            requirementDomains[i] = domain;
            requiredCounts[i] = requirement.requiredCount;
            totalRequired += requirement.requiredCount;
        }
        if (totalRequired > MAX_LINKED_WORKS_PER_COMMITMENT_VALUE) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(totalRequired, MAX_LINKED_WORKS_PER_COMMITMENT_VALUE);
        }
        domains = new uint8[](uniqueDomainCount);
        uint256 cursor;
        for (uint8 domain = 0; domain < 4; domain++) {
            if (seenDomain[domain]) domains[cursor++] = domain;
        }
    }

    function _validateSubmittedDomains(uint8[] calldata submitted) internal pure returns (uint8[] memory domains) {
        domains = submitted;
        bool[4] memory seen;
        for (uint256 i = 0; i < submitted.length; i++) {
            uint8 domain = submitted[i];
            if (domain > 3 || seen[domain]) revert ICommitmentPoolingModule.InvalidDomains();
            seen[domain] = true;
        }
    }

    function _creationPayloadHash(
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        uint32 effectiveConfirmationThreshold
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                params.poolId,
                params.cycleId,
                params.commitmentSeriesId,
                params.direction,
                params.commitmentType,
                params.claimType,
                params.claimMode,
                params.contributorPolicy,
                params.onBehalfOf,
                keccak256(abi.encodePacked(params.domainTags)),
                keccak256(abi.encode(params.requirements)),
                keccak256(bytes(params.unitLabel)),
                params.targetUnits,
                params.requiresAssessment,
                params.dueDate,
                keccak256(bytes(params.metadataCID)),
                params.needUID,
                params.counterCommitmentId,
                keccak256(abi.encodePacked(params.confirmers)),
                effectiveConfirmationThreshold,
                params.protocolFallbackEnabled,
                keccak256(abi.encode(params.reward)),
                params.declaredUnitValue,
                keccak256(bytes(params.declaredValueBasis))
            )
        );
    }

    function _validateReward(ICommitmentPoolingModule.DeclaredReward calldata reward) internal pure {
        if (reward.amount == 0) {
            if (
                reward.rail != ICommitmentPoolingModule.RewardRail.None || reward.source != address(0)
                    || reward.token != address(0)
            ) revert ICommitmentPoolingModule.InvalidRewardConfiguration();
        } else if (reward.rail == ICommitmentPoolingModule.RewardRail.ArbitrumExternal) {
            if (reward.source == address(0) || reward.token == address(0)) {
                revert ICommitmentPoolingModule.InvalidRewardConfiguration();
            }
        } else if (reward.rail == ICommitmentPoolingModule.RewardRail.CeloSettlement) {
            if (reward.source != address(0) || reward.token != address(0)) {
                revert ICommitmentPoolingModule.InvalidRewardConfiguration();
            }
        } else {
            revert ICommitmentPoolingModule.InvalidRewardConfiguration();
        }
    }

    function _validateDeclaredValue(uint256 value, string calldata basis) internal pure {
        if ((value == 0) != (bytes(basis).length == 0)) {
            revert ICommitmentPoolingModule.InvalidValueDeclaration();
        }
    }

    function _validateConfirmerRule(
        address[] calldata namedConfirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    )
        internal
        view
    {
        uint256 length = namedConfirmers.length;
        if (length > MAX_CONFIRMERS_VALUE) {
            revert ICommitmentPoolingModule.TooManyConfirmers(length, MAX_CONFIRMERS_VALUE);
        }
        if (length != 0 && threshold == 0) revert ICommitmentPoolingModule.InvalidConfirmerRule();
        if (protocolFallbackEnabled && protocolPoolId == 0) revert ICommitmentPoolingModule.ModuleNotReady();
    }
}
