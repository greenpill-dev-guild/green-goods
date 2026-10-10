// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS } from "@eas/IEAS.sol";

import { ICommitmentRegistry } from "../../interfaces/ICommitmentRegistry.sol";
import { IHatsModule } from "../../interfaces/IHatsModule.sol";
import { ActionRegistry } from "../../registries/Action.sol";

/// @title CommitmentPoolingCommonLib
/// @notice The shared value-typed context and frozen protocol bounds of the pooling control
///         plane: the `Env` snapshot every deployed behavior-library call receives, and the
///         constants both the module facets and the libraries denominate in.
/// @dev Storage mappings cannot ride in a struct, so they are threaded as explicit storage
///      parameters; everything value-typed (dependency addresses, schema UIDs, scalars) travels
///      in `Env`, built once per call by `CommitmentPoolingBase._env()`.
///      `CommitmentPoolingStorage` aliases the constants so the module ABI (`MAX_CONFIRMERS()`
///      and friends) keeps compiling unchanged. Internal-only: inlined, never deployed.
library CommitmentPoolingCommonLib {
    struct Env {
        IHatsModule hats;
        ICommitmentRegistry registry;
        ActionRegistry actionRegistry;
        address workApprovalResolver;
        IEAS eas;
        bytes32 workSchemaUID;
        bytes32 workApprovalSchemaUID;
        bytes32 legacyAssessmentSchemaUID;
        bytes32 assessmentV3SchemaUID;
        uint256 protocolPoolId;
        address owner;
    }

    // Frozen by the PRD-721 8/16/24/32/40 production-path benchmark on 2026-08-05.
    uint256 internal constant MAX_CONFIRMERS = 40;
    uint256 internal constant MAX_REQUIREMENTS = 40;
    uint256 internal constant MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT = 40;
    uint256 internal constant MAX_CONTRIBUTORS_PER_COMMITMENT = 40;
    uint256 internal constant MAX_LINKED_WORKS_PER_COMMITMENT = 40;

    /// @dev Every allocation and recognition vector is denominated in these basis points, and the
    ///      cycle-less preset is the immutable protocol policy for a commitment with no cycle.
    uint256 internal constant TOTAL_ALLOCATION_BPS = 10_000;
    uint16 internal constant CYCLELESS_EQUAL_PARTICIPATION_BPS = 2000;
    uint16 internal constant CYCLELESS_VERIFIED_CONTRIBUTION_BPS = 8000;
}
