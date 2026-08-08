// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingCommonLib } from "./CommonLib.sol";
import { CommitmentPoolingGuardLib } from "./GuardLib.sol";

/// @title CommitmentPoolingCreationChecksLib
/// @notice Creation-time input validation and the frozen payload hash, shared by commitment
///         creation, term edits, and exchange acceptance.
/// @dev Internal-only: inlined into the deployed behavior libraries, never deployed itself.
///      Semantics track `contract-spec.md` §6.1 exactly; the payload hash preimage is frozen.
library CommitmentPoolingCreationChecksLib {
    // solhint-disable-next-line code-complexity
    function resolveCreator(
        CommitmentPoolingCommonLib.Env memory env,
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        ICommitmentPoolingModule.Pool storage pool
    )
        internal
        view
        returns (address creator)
    {
        bool steward =
            msg.sender == env.owner || CommitmentPoolingGuardLib.isGardenSteward(env.hats, pool.garden, msg.sender);
        if (pool.poolType == ICommitmentPoolingModule.PoolType.Protocol && !steward) {
            revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
        }
        if (params.commitmentType == ICommitmentPoolingModule.CommitmentType.StewardCaptured) {
            if (!steward) revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
            if (params.onBehalfOf == address(0)) revert ICommitmentPoolingModule.ZeroAddress();
            creator = params.onBehalfOf;
            if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, pool.garden, creator)) {
                revert ICommitmentPoolingModule.NotEligibleContributor(creator);
            }
        } else {
            if (params.onBehalfOf != address(0)) revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            creator = msg.sender;
            if (params.commitmentType == ICommitmentPoolingModule.CommitmentType.SeasonCampaign) {
                if (!steward) revert ICommitmentPoolingModule.NotPoolSteward(msg.sender, params.poolId);
            } else if (!CommitmentPoolingGuardLib.isGardenMember(env.hats, pool.garden, creator)) {
                revert ICommitmentPoolingModule.UnauthorizedCaller(msg.sender);
            }
        }
    }

    function validateCycleForCreation(
        mapping(uint256 cycleId => ICommitmentPoolingModule.Cycle cycle) storage cycles,
        uint256 poolId,
        uint256 cycleId
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

    function validateSeriesForCreation(
        mapping(uint256 seriesId => ICommitmentPoolingModule.CommitmentSeries series) storage commitmentSeries,
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
    function validateCounterCommitment(
        CommitmentPoolingCommonLib.Env memory env,
        mapping(uint256 commitmentId => ICommitmentPoolingModule.Commitment commitment) storage commitments,
        ICommitmentPoolingModule.CreateCommitmentParams calldata params,
        address creator,
        uint256 nextCommitmentIdValue
    )
        internal
        view
    {
        uint256 counterId = params.counterCommitmentId;
        if (counterId == 0) return;
        if (counterId == nextCommitmentIdValue) revert ICommitmentPoolingModule.SelfCounterCommitment();
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
            if (env.registry.committedOf(counter.creator, counterId) != counter.targetUnits) {
                revert ICommitmentPoolingModule.ExchangeStateInvalid(counterId, counter.state);
            }
        }
    }

    // solhint-disable-next-line code-complexity
    function validateAndBuildRequirements(
        CommitmentPoolingCommonLib.Env memory env,
        ICommitmentPoolingModule.CreateCommitmentParams calldata params
    )
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
            domains = validateSubmittedDomains(params.domainTags);
            actionUIDs = new uint256[](0);
            requirementDomains = new uint8[](0);
            requiredCounts = new uint32[](0);
            return (domains, actionUIDs, requirementDomains, requiredCounts);
        }
        if (length == 0) revert ICommitmentPoolingModule.InvalidRequirementCount(0);
        if (length > CommitmentPoolingCommonLib.MAX_REQUIREMENTS) {
            revert ICommitmentPoolingModule.TooManyRequirements(length, CommitmentPoolingCommonLib.MAX_REQUIREMENTS);
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
            if (env.actionRegistry.actionToOwner(requirement.actionUID) == address(0)) {
                revert ICommitmentPoolingModule.UnknownAction(requirement.actionUID);
            }
            uint8 domain = uint8(env.actionRegistry.getAction(requirement.actionUID).domain);
            if (!seenDomain[domain]) {
                seenDomain[domain] = true;
                uniqueDomainCount++;
            }
            actionUIDs[i] = requirement.actionUID;
            requirementDomains[i] = domain;
            requiredCounts[i] = requirement.requiredCount;
            totalRequired += requirement.requiredCount;
        }
        if (totalRequired > CommitmentPoolingCommonLib.MAX_LINKED_WORKS_PER_COMMITMENT) {
            revert ICommitmentPoolingModule.TooManyLinkedWorks(
                totalRequired, CommitmentPoolingCommonLib.MAX_LINKED_WORKS_PER_COMMITMENT
            );
        }
        domains = new uint8[](uniqueDomainCount);
        uint256 cursor;
        for (uint8 domain = 0; domain < 4; domain++) {
            if (seenDomain[domain]) domains[cursor++] = domain;
        }
    }

    function validateSubmittedDomains(uint8[] calldata submitted) internal pure returns (uint8[] memory domains) {
        domains = submitted;
        bool[4] memory seen;
        for (uint256 i = 0; i < submitted.length; i++) {
            uint8 domain = submitted[i];
            if (domain > 3 || seen[domain]) revert ICommitmentPoolingModule.InvalidDomains();
            seen[domain] = true;
        }
    }

    function creationPayloadHash(
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

    function validateReward(ICommitmentPoolingModule.DeclaredReward calldata reward) internal pure {
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

    function validateDeclaredValue(uint256 value, string calldata basis) internal pure {
        if ((value == 0) != (bytes(basis).length == 0)) {
            revert ICommitmentPoolingModule.InvalidValueDeclaration();
        }
    }

    function validateConfirmerRule(
        CommitmentPoolingCommonLib.Env memory env,
        address[] calldata namedConfirmers,
        uint32 threshold,
        bool protocolFallbackEnabled
    )
        internal
        pure
    {
        uint256 length = namedConfirmers.length;
        if (length > CommitmentPoolingCommonLib.MAX_CONFIRMERS) {
            revert ICommitmentPoolingModule.TooManyConfirmers(length, CommitmentPoolingCommonLib.MAX_CONFIRMERS);
        }
        if (length != 0 && threshold == 0) revert ICommitmentPoolingModule.InvalidConfirmerRule();
        if (protocolFallbackEnabled && env.protocolPoolId == 0) revert ICommitmentPoolingModule.ModuleNotReady();
    }
}
