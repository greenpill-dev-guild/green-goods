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

interface IOwnableConfig {
    function owner() external view returns (address);
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
    /// @notice A proxy this run must write to is not owned by the caller.
    /// @dev Checked for ALL THREE proxies before the first write **within a single simulation**.
    ///      That is a weaker guarantee than it looks: `forge script` submits each setter as its own
    ///      transaction, so ownership verified here is ownership at simulation time, not a
    ///      precondition attached to each submitted call. If ownership moves mid-broadcast — to a
    ///      Safe, say — earlier setters can land and later ones revert, leaving configuration split.
    ///      Closing that needs an atomic owner-side executor or a runbook ownership freeze; it is
    ///      not closed here. What this does close is the cheap, likely case: a wrong declared owner
    ///      fails before anything is written rather than halfway through. Every setter is
    ///      `onlyOwner`, so
    ///      without this the run would send calls until it reached a proxy the caller does not own
    ///      and revert there — leaving the earlier steps applied and the module half-configured.
    ///      That partial state is the failure this guard exists to prevent, not the revert itself.
    error ConfigurationNotOwner(string target, address owner, address expectedOwner);

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
    function configure(Targets memory targets, address expectedOwner) internal returns (uint256 written) {
        _requireTargets(targets);
        _requireEveryTargetOwnedBy(targets, expectedOwner);

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

    /// @dev All three proxies must be owned by the SAME declared account, proven before the first
    ///      write. The owner is passed in rather than read from `msg.sender`: this is an internal
    ///      library function, so it inlines into its caller, where `msg.sender` is that caller's
    ///      own caller and not the address the outgoing setter calls will carry. Under
    ///      `vm.startBroadcast` the two differ again. Making the expectation explicit is the only
    ///      reading that is correct in a script, in a test, and on chain.
    ///
    ///      What this proves: the three proxies agree on one owner, and it is the one the operator
    ///      declared. What it cannot prove: that the broadcasting key is that owner — forge sends
    ///      each call as its own transaction, so a wrong signer would revert partway with earlier
    ///      steps applied. `pooling-configure.ts` closes that gap by refusing to broadcast unless
    ///      `--sender` equals every live `owner()`.
    function _requireEveryTargetOwnedBy(Targets memory targets, address expectedOwner) private view {
        if (expectedOwner == address(0)) revert MissingConfiguration("expectedOwner");
        _requireOwner("assessmentResolver", targets.assessmentResolver, expectedOwner);
        _requireOwner("testimonyResolver", targets.testimonyResolver, expectedOwner);
        _requireOwner("workApprovalResolver", targets.workApprovalResolver, expectedOwner);
    }

    function _requireOwner(string memory label, address target, address expectedOwner) private view {
        address owner = IOwnableConfig(target).owner();
        if (owner != expectedOwner) revert ConfigurationNotOwner(label, owner, expectedOwner);
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
