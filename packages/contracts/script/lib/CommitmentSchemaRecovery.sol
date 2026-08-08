// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title CommitmentSchemaRecovery
/// @notice The ordered recovery state machine for the Community Testimony schema
///         (`contract-spec.md` §6.4.4).
/// @dev Kept as a pure classifier so every reachable and unreachable combination can be enumerated
///      in a test, rather than inferred from whichever orderings a deploy script happens to take.
///
///      The lane exists because `SchemaRegistry.register` is **permissionless** and the resolver's
///      `commitmentModule` is what makes attestations succeed. Those two facts force an order:
///      the UID is pinned first while the module is still zero — so the resolver is provably
///      inactive no matter who registers the record — and the module is set last, only after the
///      record has been proven to match exactly. An exact record may therefore exist briefly while
///      the resolver is deliberately inert; no attestation can succeed in that window.
///
///      Finalization accepts exactly three states, and preparation exactly two. Everything else is
///      an out-of-order chain that a retry must not paper over: module-nonzero with a zero UID, or
///      module-nonzero with an absent or mismatched record, means something activated the resolver
///      against a schema this lane cannot vouch for.
library CommitmentSchemaRecovery {
    /// @notice Where the Community Testimony lane currently stands on chain.
    enum State {
        /// @dev No UID pinned, module zero. Preparation may pin. Finalization must not run.
        Unprepared,
        /// @dev Expected UID pinned, no registry record yet, module zero. The prepared state.
        Prepared,
        /// @dev Expected UID pinned, exact registry record, module still zero. Registration landed
        ///      but activation did not — either an interrupted finalization or a permissionless
        ///      third-party register. Both resume identically.
        RecordRegistered,
        /// @dev Expected UID, exact record, exact verified module. Fully finalized; a retry is a
        ///      no-op rather than a second activation.
        Finalized,
        /// @dev Any other combination. Never repaired automatically.
        Invalid
    }

    /// @notice What the chain currently reports, gathered by the caller.
    struct Observation {
        /// @dev `TestimonyResolver.schemaUID()`.
        bytes32 pinnedUID;
        /// @dev Deterministic `keccak256(schemaString, resolver, false)`.
        bytes32 expectedUID;
        /// @dev A `SchemaRegistry` record exists under `expectedUID`.
        bool recordExists;
        /// @dev That record's schema string, resolver, and `revocable == false` all match.
        bool recordMatches;
        /// @dev `TestimonyResolver.commitmentModule()`.
        address module;
        /// @dev The module proxy read from the verified deployment artifact.
        address expectedModule;
    }

    error UnexpectedRecoveryState(State state, string phase);
    error ExpectedUIDRequired();

    /// @notice Classify the observation into exactly one state.
    /// @dev Order of the checks is the order of the invariants, not convenience. A registry record
    ///      that exists but does not match is `Invalid` before anything else is considered: EAS
    ///      schemas are immutable, so a foreign record under our deterministic UID can never be
    ///      reconciled and no later state is reachable from it.
    function classify(Observation memory observation) internal pure returns (State) {
        if (observation.expectedUID == bytes32(0)) revert ExpectedUIDRequired();
        if (observation.recordExists && !observation.recordMatches) return State.Invalid;

        bool uidPinned = observation.pinnedUID == observation.expectedUID;
        bool uidUnset = observation.pinnedUID == bytes32(0);
        // A UID that is neither zero nor the expected value means the resolver is pinned to some
        // other schema. `TestimonyResolver.setSchemaUID` reverts SchemaUIDConflict on that, and it
        // is one-way, so no run can recover it.
        if (!uidPinned && !uidUnset) return State.Invalid;

        if (observation.module == address(0)) {
            if (uidUnset) return observation.recordExists ? State.Invalid : State.Unprepared;
            return observation.recordExists ? State.RecordRegistered : State.Prepared;
        }

        // Module non-zero: the resolver is live, so every earlier step must already be exact.
        if (!uidPinned || !observation.recordExists) return State.Invalid;
        if (observation.expectedModule == address(0)) return State.Invalid;
        return observation.module == observation.expectedModule ? State.Finalized : State.Invalid;
    }

    /// @notice States preparation may run from.
    /// @dev `Unprepared` pins the UID; `Prepared` is already pinned and re-runs as a no-op. Anything
    ///      later means the module is live or a record exists, and preparation must not touch a
    ///      resolver that finalization has already moved past.
    function assertPreparable(Observation memory observation) internal pure returns (State state) {
        state = classify(observation);
        if (state != State.Unprepared && state != State.Prepared) {
            revert UnexpectedRecoveryState(state, "preparation");
        }
    }

    /// @notice States finalization may run from — the three ordered ones.
    /// @dev `Unprepared` is rejected on purpose: finalizing without a pinned UID would register a
    ///      record and activate a module against a resolver whose schema was never fixed, which is
    ///      the out-of-order case the whole lane exists to prevent. Run preparation first.
    function assertFinalizable(Observation memory observation) internal pure returns (State state) {
        state = classify(observation);
        if (state != State.Prepared && state != State.RecordRegistered && state != State.Finalized) {
            revert UnexpectedRecoveryState(state, "finalization");
        }
    }

    /// @notice True when finalization still has work to do.
    function needsRecord(State state) internal pure returns (bool) {
        return state == State.Prepared;
    }

    /// @notice True when the module activation call still has to be sent.
    function needsActivation(State state) internal pure returns (bool) {
        return state == State.Prepared || state == State.RecordRegistered;
    }
}
