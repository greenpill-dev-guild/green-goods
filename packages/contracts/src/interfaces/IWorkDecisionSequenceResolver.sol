// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IWorkDecisionSequenceResolver
/// @notice The minimal decision-ordering surface the pooling control plane reads from the
///         Work approval resolver: the resolver-assigned chronological sequence per Work and
///         the sequence bound to one decision UID.
interface IWorkDecisionSequenceResolver {
    function latestDecisionSequence(bytes32 workUID) external view returns (uint64);
    function decisionSequenceByUID(bytes32 decisionUID) external view returns (uint64);
}
