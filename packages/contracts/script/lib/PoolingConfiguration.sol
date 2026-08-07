// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @dev Minimal views and setters this lane touches. Narrow interfaces keep the resolvers'
///      creation code out of every script and test that only needs to configure them.
interface IAssessmentResolverConfig {
    function schemaUID() external view returns (bytes32);
    function assessmentV3SchemaUID() external view returns (bytes32);
    function setSchemaUID(bytes32 uid) external;
    function setAssessmentV3SchemaUID(bytes32 uid) external;
}

interface ITestimonyResolverConfig {
    function schemaUID() external view returns (bytes32);
    function commitmentModule() external view returns (address);
    function setSchemaUID(bytes32 uid) external;
    function setCommitmentModule(address module) external;
}

interface IWorkApprovalResolverConfig {
    function commitmentModule() external view returns (address);
    function setCommitmentModule(address module) external;
}

/// @title PoolingConfiguration
/// @notice The five resolver calls that turn a deployed, wired Commitment Pooling module from
///         inert into live — as one ordered, re-runnable sequence.
/// @dev Owned here rather than inline in the deploy script so the Arbitrum fork rehearsal drives
///      the *same* code an operator will broadcast. A rehearsal of a hand-copied sequence proves
///      only that the copy works.
///
///      Order is load-bearing twice. `setAssessmentV3SchemaUID` reverts
///      `AssessmentV2SchemaUIDRequired` while the v2 UID is zero, which is the live Arbitrum
///      state. `TestimonyResolver.setCommitmentModule` reverts `SchemaUIDRequired` before its
///      schema is pinned.
///
///      `workApprovalBridge` is the step that decides whether the release means anything: without
///      it the resolver never calls `onWorkDecision`, so approved work never earns commitment
///      credit and the module deploys inert.
library PoolingConfiguration {
    /// @notice A step's live value diverges from what this run would write.
    /// @dev Never overwritten. These proxies handle real attestations: repointing a schema UID
    ///      revalidates existing attestations against a different schema, and repointing the
    ///      work-approval bridge redirects commitment credit to another module. Both are
    ///      deliberate operator acts, never a side effect of re-running configuration.
    error ConfigurationConflict(string step, bytes32 onChain, bytes32 requested);
    error MissingConfiguration(string name);
    error AssessmentSchemaUIDCollision(bytes32 uid);

    struct Targets {
        address assessmentResolver;
        address testimonyResolver;
        address workApprovalResolver;
        address commitmentPoolingModule;
        bytes32 assessmentSchemaUID;
        bytes32 assessmentV3SchemaUID;
        bytes32 communityTestimonySchemaUID;
    }

    /// @notice Number of calls a run actually sent, for the operator-facing summary.
    /// @dev A fully configured chain returns 0 — that is the re-run contract, not a failure.
    function configure(Targets memory targets) internal returns (uint256 written) {
        _requireTargets(targets);

        IAssessmentResolverConfig assessment = IAssessmentResolverConfig(targets.assessmentResolver);
        ITestimonyResolverConfig testimony = ITestimonyResolverConfig(targets.testimonyResolver);
        IWorkApprovalResolverConfig workApproval = IWorkApprovalResolverConfig(targets.workApprovalResolver);

        // Deployment leaves the v2 UID unpinned, so this is a real ordered step of the runbook and
        // not scaffolding: v3 cannot be set until it lands.
        if (_needsUID("assessmentV2Pin", assessment.schemaUID(), targets.assessmentSchemaUID)) {
            assessment.setSchemaUID(targets.assessmentSchemaUID);
            written++;
        }
        if (_needsUID("assessmentV3", assessment.assessmentV3SchemaUID(), targets.assessmentV3SchemaUID)) {
            assessment.setAssessmentV3SchemaUID(targets.assessmentV3SchemaUID);
            written++;
        }
        if (_needsUID("testimonySchema", testimony.schemaUID(), targets.communityTestimonySchemaUID)) {
            testimony.setSchemaUID(targets.communityTestimonySchemaUID);
            written++;
        }
        if (_needsAddress("testimonyModule", testimony.commitmentModule(), targets.commitmentPoolingModule)) {
            testimony.setCommitmentModule(targets.commitmentPoolingModule);
            written++;
        }
        if (_needsAddress("workApprovalBridge", workApproval.commitmentModule(), targets.commitmentPoolingModule)) {
            workApproval.setCommitmentModule(targets.commitmentPoolingModule);
            written++;
        }
    }

    /// @notice True once every step is satisfied on chain, so a caller can assert the end state
    ///         without re-deriving which setter proves what.
    function isConfigured(Targets memory targets) internal view returns (bool) {
        IAssessmentResolverConfig assessment = IAssessmentResolverConfig(targets.assessmentResolver);
        ITestimonyResolverConfig testimony = ITestimonyResolverConfig(targets.testimonyResolver);

        return assessment.schemaUID() == targets.assessmentSchemaUID
            && assessment.assessmentV3SchemaUID() == targets.assessmentV3SchemaUID
            && testimony.schemaUID() == targets.communityTestimonySchemaUID
            && testimony.commitmentModule() == targets.commitmentPoolingModule
            && IWorkApprovalResolverConfig(targets.workApprovalResolver).commitmentModule() == targets.commitmentPoolingModule;
    }

    function _requireTargets(Targets memory targets) private pure {
        if (targets.assessmentResolver == address(0)) revert MissingConfiguration("assessmentResolver");
        if (targets.testimonyResolver == address(0)) revert MissingConfiguration("testimonyResolver");
        if (targets.workApprovalResolver == address(0)) revert MissingConfiguration("workApprovalResolver");
        if (targets.commitmentPoolingModule == address(0)) revert MissingConfiguration("commitmentPoolingModule");
        if (targets.assessmentSchemaUID == bytes32(0)) revert MissingConfiguration("assessmentSchemaUID");
        if (targets.assessmentV3SchemaUID == bytes32(0)) revert MissingConfiguration("assessmentV3SchemaUID");
        if (targets.communityTestimonySchemaUID == bytes32(0)) {
            revert MissingConfiguration("communityTestimonySchemaUID");
        }
        // The resolver reverts SchemaUIDCollision on this; catching it here names the artifact
        // defect instead of surfacing a bare resolver revert mid-broadcast.
        if (targets.assessmentV3SchemaUID == targets.assessmentSchemaUID) {
            revert AssessmentSchemaUIDCollision(targets.assessmentV3SchemaUID);
        }
    }

    function _needsUID(string memory step, bytes32 onChain, bytes32 requested) private pure returns (bool) {
        if (onChain == bytes32(0)) return true;
        if (onChain == requested) return false;
        revert ConfigurationConflict(step, onChain, requested);
    }

    function _needsAddress(string memory step, address onChain, address requested) private pure returns (bool) {
        if (onChain == address(0)) return true;
        if (onChain == requested) return false;
        revert ConfigurationConflict(step, bytes32(uint256(uint160(onChain))), bytes32(uint256(uint160(requested))));
    }
}
