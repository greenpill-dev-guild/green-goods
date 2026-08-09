// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { CommitmentSchemaRecovery } from "../../script/lib/CommitmentSchemaRecovery.sol";

/// @title CommitmentSchemaRecoveryTest
/// @notice Exhaustive coverage of the Community Testimony recovery state machine.
/// @dev The classifier is pure precisely so this can enumerate the whole input space rather than
///      test the orderings a deploy script happens to produce. `testEveryCombinationClassifies`
///      walks all 36 of them; the named cases below explain the ones a reader would otherwise have
///      to derive.
///
///      The property that matters is asymmetric: a state wrongly called `Invalid` costs an operator
///      a manual investigation, but a state wrongly called recoverable activates a live resolver
///      against a schema this lane never verified. The tests are written accordingly — every
///      non-legal combination is asserted `Invalid` explicitly.
contract CommitmentSchemaRecoveryTest is Test {
    using CommitmentSchemaRecovery for CommitmentSchemaRecovery.Observation;

    bytes32 private constant EXPECTED_UID = keccak256("expected-community-testimony");
    bytes32 private constant FOREIGN_UID = keccak256("some-other-schema");
    address private constant MODULE = address(0xB0B0);
    address private constant FOREIGN_MODULE = address(0xBAD);

    function classify(CommitmentSchemaRecovery.Observation memory observation)
        external
        pure
        returns (CommitmentSchemaRecovery.State)
    {
        return CommitmentSchemaRecovery.classify(observation);
    }

    function preparable(CommitmentSchemaRecovery.Observation memory observation)
        external
        pure
        returns (CommitmentSchemaRecovery.State)
    {
        return CommitmentSchemaRecovery.assertPreparable(observation);
    }

    function finalizable(CommitmentSchemaRecovery.Observation memory observation)
        external
        pure
        returns (CommitmentSchemaRecovery.State)
    {
        return CommitmentSchemaRecovery.assertFinalizable(observation);
    }

    function _observation() private pure returns (CommitmentSchemaRecovery.Observation memory observation) {
        observation.expectedUID = EXPECTED_UID;
        observation.expectedModule = MODULE;
    }

    // ───────────────────────── The four legal states ─────────────────────────

    function testUnpreparedIsUidZeroNoRecordModuleZero() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Unprepared),
            "a fresh chain is Unprepared"
        );
    }

    function testPreparedIsExpectedUidNoRecordModuleZero() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Prepared),
            "pinned UID with the module still zero is the prepared state"
        );
    }

    function testRecordRegisteredIsExactRecordWithModuleStillZero() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;
        observation.recordExists = true;
        observation.recordMatches = true;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.RecordRegistered),
            "registration without activation is resumable"
        );
    }

    function testFinalizedRequiresTheExactArtifactModule() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;
        observation.recordExists = true;
        observation.recordMatches = true;
        observation.module = MODULE;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Finalized),
            "exact UID + exact record + exact module is finalized"
        );
    }

    // ───────────────────────── Out-of-order states ─────────────────────────

    /// @notice A live module with no pinned UID is the headline out-of-order failure.
    function testModuleSetWithoutAPinnedUidIsInvalid() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.module = MODULE;
        observation.recordExists = true;
        observation.recordMatches = true;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Invalid),
            "an active resolver with no pinned schema must never be repaired automatically"
        );
    }

    /// @notice A live module with no registry record behind it.
    function testModuleSetWithoutARecordIsInvalid() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;
        observation.module = MODULE;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Invalid),
            "activation without a registered record is out of order"
        );
    }

    /// @notice A module that is not the one the deployment artifact records.
    function testModulePointingSomewhereElseIsInvalid() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;
        observation.recordExists = true;
        observation.recordMatches = true;
        observation.module = FOREIGN_MODULE;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Invalid),
            "a resolver bridged to an unrecorded module is not finalized"
        );
    }

    /// @notice A foreign record under our deterministic UID can never be reconciled.
    /// @dev EAS schemas are immutable, so this is terminal rather than repairable — and it is
    ///      checked before the UID, because no later state is reachable from it.
    function testAMismatchedRecordIsInvalidInEveryOtherRespect() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;
        observation.recordExists = true;
        observation.recordMatches = false;
        observation.module = MODULE;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Invalid),
            "an immutable foreign record is terminal"
        );
    }

    /// @notice The resolver pinned to some other schema entirely.
    function testAForeignPinnedUidIsInvalid() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = FOREIGN_UID;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Invalid),
            "setSchemaUID is one-way; a foreign pin is unrecoverable"
        );
    }

    /// @notice An exact record that exists before any UID is pinned is preparable, not `Invalid`.
    /// @dev Reachable without us, and cheaply: registration is permissionless and the UID is
    ///      deterministic from public inputs (schema constant, versioned salt, checked-in factory),
    ///      so anyone watching this repo can register the byte-identical record before our first
    ///      broadcast. §6.4.4 requires preparation to accept it. Classifying it `Invalid` would
    ///      turn a zero-risk registration into a lane-bricking grief whose only escape is a
    ///      `DEPLOY_VERSION` bump the same watcher can chase.
    ///
    ///      Safe because the record is exact by construction — the UID commits to
    ///      (schema, resolver, revocable) — and the pin never consults the registry.
    function testAnExactRecordBeforeAnyPinIsPreparable() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.recordExists = true;
        observation.recordMatches = true;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.RecordAheadOfPin),
            "a permissionless exact record ahead of the pin is a preparable state"
        );
        assertEq(
            uint256(this.preparable(observation)),
            uint256(CommitmentSchemaRecovery.State.RecordAheadOfPin),
            "preparation pins from here exactly as it would from Unprepared"
        );
    }

    /// @notice A FOREIGN record before any pin stays terminal.
    /// @dev The half of the pre-pin case that must not widen. EAS schemas are immutable, so a
    ///      non-matching record under our deterministic UID can never be reconciled.
    function testAForeignRecordBeforeAnyPinIsStillInvalid() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.recordExists = true;
        observation.recordMatches = false;

        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.Invalid),
            "an immutable foreign record is terminal at every pin position"
        );
    }

    /// @notice Finalization still refuses the pre-pin record: the pin comes first.
    function testFinalizationRefusesARecordAheadOfThePin() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.recordExists = true;
        observation.recordMatches = true;

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaRecovery.UnexpectedRecoveryState.selector,
                CommitmentSchemaRecovery.State.RecordAheadOfPin,
                "finalization"
            )
        );
        this.finalizable(observation);
    }

    // ───────────────────────── Phase gates ─────────────────────────

    /// @notice Preparation accepts exactly the four module-zero states, and refuses the two others.
    /// @dev The record's presence is deliberately not a gate. Registration is permissionless, so
    ///      gating on it would let any observer block preparation — including the artifact
    ///      reconstruction retry §6.4.4 requires to stay available after a persistence failure.
    ///      What preparation must never run behind is a LIVE MODULE, and that is what is refused.
    function testPreparationAcceptsEveryInertState() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        assertEq(uint256(this.preparable(observation)), uint256(CommitmentSchemaRecovery.State.Unprepared));

        observation.recordExists = true;
        observation.recordMatches = true;
        assertEq(uint256(this.preparable(observation)), uint256(CommitmentSchemaRecovery.State.RecordAheadOfPin));

        observation.pinnedUID = EXPECTED_UID;
        assertEq(uint256(this.preparable(observation)), uint256(CommitmentSchemaRecovery.State.RecordRegistered));

        observation.recordExists = false;
        observation.recordMatches = false;
        assertEq(uint256(this.preparable(observation)), uint256(CommitmentSchemaRecovery.State.Prepared));
    }

    /// @notice Preparation refuses to run behind a live module.
    function testPreparationRefusesAFinalizedResolver() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;
        observation.recordExists = true;
        observation.recordMatches = true;
        observation.module = MODULE;

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaRecovery.UnexpectedRecoveryState.selector,
                CommitmentSchemaRecovery.State.Finalized,
                "preparation"
            )
        );
        this.preparable(observation);
    }

    /// @notice Preparation refuses an out-of-order chain rather than repairing it.
    function testPreparationRefusesAnInvalidState() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = FOREIGN_UID;

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaRecovery.UnexpectedRecoveryState.selector,
                CommitmentSchemaRecovery.State.Invalid,
                "preparation"
            )
        );
        this.preparable(observation);
    }

    function testFinalizationRefusesToRunBeforePreparation() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaRecovery.UnexpectedRecoveryState.selector,
                CommitmentSchemaRecovery.State.Unprepared,
                "finalization"
            )
        );
        this.finalizable(observation);
    }

    function testFinalizationAcceptsTheThreeOrderedStates() public {
        CommitmentSchemaRecovery.Observation memory observation = _observation();
        observation.pinnedUID = EXPECTED_UID;
        assertEq(uint256(this.finalizable(observation)), uint256(CommitmentSchemaRecovery.State.Prepared));

        observation.recordExists = true;
        observation.recordMatches = true;
        assertEq(uint256(this.finalizable(observation)), uint256(CommitmentSchemaRecovery.State.RecordRegistered));

        observation.module = MODULE;
        assertEq(uint256(this.finalizable(observation)), uint256(CommitmentSchemaRecovery.State.Finalized));
    }

    /// @notice What each accepted finalization state still has to do.
    function testWorkRemainingPerState() public {
        assertTrue(CommitmentSchemaRecovery.needsRecord(CommitmentSchemaRecovery.State.Prepared));
        assertFalse(CommitmentSchemaRecovery.needsRecord(CommitmentSchemaRecovery.State.RecordRegistered));
        assertFalse(CommitmentSchemaRecovery.needsRecord(CommitmentSchemaRecovery.State.Finalized));

        assertTrue(CommitmentSchemaRecovery.needsActivation(CommitmentSchemaRecovery.State.Prepared));
        assertTrue(CommitmentSchemaRecovery.needsActivation(CommitmentSchemaRecovery.State.RecordRegistered));
        // The property that makes a finalized retry a no-op rather than a second activation.
        assertFalse(CommitmentSchemaRecovery.needsActivation(CommitmentSchemaRecovery.State.Finalized));
    }

    function testAZeroExpectedUidIsRejectedRatherThanClassified() public {
        CommitmentSchemaRecovery.Observation memory observation;
        observation.expectedModule = MODULE;

        vm.expectRevert(CommitmentSchemaRecovery.ExpectedUIDRequired.selector);
        this.classify(observation);
    }

    // ───────────────────────── Whole input space ─────────────────────────

    /// @notice Every combination classifies, and the accepting sets are exactly the expected size.
    /// @dev The counts are the point. A classifier or gate that quietly widened its accepting set —
    ///      the dangerous direction — changes a number here even if every named case above passes.
    ///      `expectedModule` is held non-zero throughout; preparation's `expectedModule == 0` path
    ///      is covered by the phase-gate cases above, which is where that input actually varies.
    function testEveryCombinationClassifies() public {
        bytes32[3] memory uids = [bytes32(0), EXPECTED_UID, FOREIGN_UID];
        address[3] memory modules = [address(0), MODULE, FOREIGN_MODULE];
        // (exists, matches): absent, exact, foreign. `!exists && matches` is not a real state.
        bool[2] memory existsOptions = [false, true];
        bool[2] memory matchesOptions = [false, true];

        uint256 legal;
        uint256 total;
        uint256 preparable_;
        uint256 finalizable_;
        for (uint256 u = 0; u < uids.length; u++) {
            for (uint256 m = 0; m < modules.length; m++) {
                for (uint256 e = 0; e < existsOptions.length; e++) {
                    for (uint256 k = 0; k < matchesOptions.length; k++) {
                        CommitmentSchemaRecovery.Observation memory observation = _observation();
                        observation.pinnedUID = uids[u];
                        observation.module = modules[m];
                        observation.recordExists = existsOptions[e];
                        observation.recordMatches = matchesOptions[k];

                        total++;
                        if (CommitmentSchemaRecovery.classify(observation) != CommitmentSchemaRecovery.State.Invalid) {
                            legal++;
                        }
                        // The gates, not just the classifier: a state can be legal yet refused by
                        // one phase, and it is the phase gates a deploy run actually hits.
                        try this.preparable(observation) returns (CommitmentSchemaRecovery.State) {
                            preparable_++;
                        } catch { }
                        try this.finalizable(observation) returns (CommitmentSchemaRecovery.State) {
                            finalizable_++;
                        } catch { }
                    }
                }
            }
        }

        assertEq(total, 36, "input space changed shape");
        // Unprepared and Prepared each appear twice (recordMatches is irrelevant when no record
        // exists); RecordAheadOfPin, RecordRegistered, and Finalized once each.
        assertEq(legal, 7, "exactly seven of the 36 combinations are recoverable");
        // The accepting set split by phase, which is what the two gates actually enforce. Widening
        // either one is the dangerous direction and moves a number here.
        assertEq(preparable_, 6, "six combinations are preparable: every inert state");
        assertEq(finalizable_, 4, "four are finalizable: Prepared x2, RecordRegistered, Finalized");
    }
}
