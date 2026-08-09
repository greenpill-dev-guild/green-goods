// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture, IOwnableCommitmentPoolingModule } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingTest
/// @notice RED-first ABI and initialization coverage for PRD-721.
contract CommitmentPoolingTest is Test {
    address private constant OWNER = address(0xA11CE);
    address private constant ROOT_GARDEN = address(0xBEEF);

    IOwnableCommitmentPoolingModule private module;

    function setUp() public {
        address implementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        bytes memory initData = abi.encodeWithSelector(ICommitmentPoolingModule.initialize.selector, OWNER, ROOT_GARDEN);
        module = IOwnableCommitmentPoolingModule(address(new ERC1967Proxy(implementation, initData)));
    }

    function testInitializerPinsRootAndStartsPaused() public {
        assertEq(module.owner(), OWNER);
        assertEq(module.rootGarden(), ROOT_GARDEN);
        assertTrue(module.paused());
    }

    function testInitializerEmitsExplicitPausedFirstTransition() public {
        address implementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        bytes memory initData = abi.encodeWithSelector(ICommitmentPoolingModule.initialize.selector, OWNER, ROOT_GARDEN);

        vm.recordLogs();
        new ERC1967Proxy(implementation, initData);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 pauseTopic = keccak256("ModulePauseStatusChanged(bool,bool)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == pauseTopic) {
                (bool previousPaused, bool paused_) = abi.decode(logs[i].data, (bool, bool));
                assertFalse(previousPaused);
                assertTrue(paused_);
                found = true;
            }
        }
        assertTrue(found, "missing paused-first replay event");
    }

    function testExactConfigurationRepeatsAreEventFreeNoOps() public {
        address dependency = address(0xD001);
        bytes32 workUID = bytes32(uint256(1));
        bytes32 approvalUID = bytes32(uint256(2));
        bytes32 legacyAssessmentUID = bytes32(uint256(3));
        bytes32 assessmentV3UID = bytes32(uint256(4));

        vm.startPrank(OWNER);
        module.setGardenToken(dependency);
        module.setHatsModule(dependency);
        module.setActionRegistry(dependency);
        module.setCommitmentRegistry(dependency);
        module.setWorkApprovalResolver(dependency);
        module.setEAS(dependency);
        module.setSchemaUIDs(workUID, approvalUID, legacyAssessmentUID, assessmentV3UID);

        vm.recordLogs();
        module.setGardenToken(dependency);
        module.setHatsModule(dependency);
        module.setActionRegistry(dependency);
        module.setCommitmentRegistry(dependency);
        module.setWorkApprovalResolver(dependency);
        module.setEAS(dependency);
        module.setSchemaUIDs(workUID, approvalUID, legacyAssessmentUID, assessmentV3UID);
        module.setPaused(true);
        vm.stopPrank();

        assertEq(vm.getRecordedLogs().length, 0);
    }

    function testInitializerRejectsZeroRoot() public {
        address implementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        bytes memory initData = abi.encodeWithSelector(ICommitmentPoolingModule.initialize.selector, OWNER, address(0));

        vm.expectRevert(ICommitmentPoolingModule.RootGardenRequired.selector);
        new ERC1967Proxy(implementation, initData);
    }

    function testBoundsAreExplicitPureAbiGetters() public {
        assertGt(module.MAX_REQUIREMENTS(), 0);
        assertGt(module.MAX_LINKED_WORKS_PER_COMMITMENT(), 0);
        assertGt(module.MAX_CONTRIBUTORS_PER_COMMITMENT(), 0);
        assertGt(module.MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT(), 0);
        assertGt(module.MAX_CONFIRMERS(), 0);
    }

    function testCyclelessRecognitionPolicyIsFrozenTwentyEighty() public {
        ICommitmentPoolingModule.RecognitionPolicy memory policy = module.cyclelessRecognitionPolicy();
        assertEq(policy.equalParticipationBps, 2000);
        assertEq(policy.verifiedContributionBps, 8000);
    }

    function testCreationRequestReadThroughStartsUnseen() public {
        assertEq(module.getCommitmentIdByCreationRequest(address(this), keccak256("offline-create")), 0);
    }

    function testWorkLinkOperationReadThroughStartsUnseen() public {
        assertEq(module.getWorkLinkOperationPayloadHash(address(this), keccak256("offline-work-link")), bytes32(0));
    }
}

/// @title CommitmentPoolingProductionPathsTest
/// @notice RED coverage for the frozen PRD-721 production entrypoints.
contract CommitmentPoolingProductionPathsTest is CommitmentPoolingFixture {
    function setUp() public {
        _setUpProductionFixture();
    }

    function testWrongRootProtocolRegistrationRevertsBeforeAnyPoolResidue() public {
        address wrongRoot = address(0xBAD);
        uint256 nextPoolBefore = module.nextPoolId();

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ProtocolGardenMismatch.selector, ROOT_GARDEN, wrongRoot)
        );
        module.registerPool(wrongRoot, ICommitmentPoolingModule.PoolType.Protocol);

        assertEq(module.protocolPoolId(), 0);
        assertEq(module.nextPoolId(), nextPoolBefore);
        (uint256 wrongPoolId,) = module.getPoolByGarden(wrongRoot);
        assertEq(wrongPoolId, 0);
    }

    function testCreationStoresFrozenPayloadHashAndExactReplayIsNoOp() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("offline-create"));
        bytes32 expectedHash = _creationPayloadHash(params);

        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        uint256 nextIdAfterFirst = module.nextCommitmentId();

        vm.prank(CREATOR);
        uint256 replayedId = module.createCommitment(params);

        ICommitmentPoolingModule.Commitment memory stored = module.getCommitment(commitmentId);
        assertEq(stored.creationPayloadHash, expectedHash);
        assertEq(replayedId, commitmentId);
        assertEq(module.nextCommitmentId(), nextIdAfterFirst);
    }

    function testCreationEmitsTheFrozenCommitmentCreatedAbi() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("created-event"));
        bytes32 expectedHash = _creationPayloadHash(params);
        bytes32 eventTopic = keccak256(
            "CommitmentCreated(uint256,uint256,uint256,uint256,bytes32,bytes32,address,address,uint8,uint8,uint8,uint8,uint8,uint8[],uint256[],uint8[],uint32[],string,uint256,bool,uint64,string,bytes32,uint256,uint256,string,address)"
        );

        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] != eventTopic) continue;
            assertEq(logs[i].topics.length, 4);
            assertEq(logs[i].topics[1], bytes32(commitmentId));
            assertEq(logs[i].topics[2], bytes32(params.poolId));
            assertEq(logs[i].topics[3], bytes32(params.cycleId));

            bytes memory data = logs[i].data;
            assertEq(_eventWord(data, 0), bytes32(params.commitmentSeriesId));
            assertEq(_eventWord(data, 1), params.creationRequestKey);
            assertEq(_eventWord(data, 2), expectedHash);
            assertEq(_eventWord(data, 3), bytes32(uint256(uint160(CREATOR))));
            assertEq(_eventWord(data, 4), bytes32(uint256(uint160(CREATOR))));
            assertEq(_eventWord(data, 5), bytes32(uint256(params.direction)));
            assertEq(_eventWord(data, 6), bytes32(uint256(params.commitmentType)));
            assertEq(_eventWord(data, 7), bytes32(uint256(params.claimType)));
            assertEq(_eventWord(data, 8), bytes32(uint256(params.claimMode)));
            assertEq(_eventWord(data, 9), bytes32(uint256(params.contributorPolicy)));
            assertEq(_eventWord(data, 10), bytes32(uint256(768)));
            assertEq(_eventWord(data, 11), bytes32(uint256(800)));
            assertEq(_eventWord(data, 12), bytes32(uint256(832)));
            assertEq(_eventWord(data, 13), bytes32(uint256(864)));
            assertEq(_eventWord(data, 14), bytes32(uint256(896)));
            assertEq(_eventWord(data, 15), bytes32(params.targetUnits));
            assertEq(_eventWord(data, 16), bytes32(uint256(params.requiresAssessment ? 1 : 0)));
            assertEq(_eventWord(data, 17), bytes32(uint256(params.dueDate)));
            assertEq(_eventWord(data, 18), bytes32(uint256(960)));
            assertEq(_eventWord(data, 19), params.needUID);
            assertEq(_eventWord(data, 20), bytes32(params.counterCommitmentId));
            assertEq(_eventWord(data, 21), bytes32(params.declaredUnitValue));
            assertEq(_eventWord(data, 22), bytes32(uint256(1024)));
            assertEq(_eventWord(data, 23), bytes32(0));
            assertEq(_dynamicLength(data, 10), 0);
            assertEq(_dynamicLength(data, 11), 0);
            assertEq(_dynamicLength(data, 12), 0);
            assertEq(_dynamicLength(data, 13), 0);
            assertEq(_dynamicLength(data, 14), bytes(params.unitLabel).length);
            assertEq(_dynamicHash(data, 14), keccak256(bytes(params.unitLabel)));
            assertEq(_dynamicLength(data, 18), bytes(params.metadataCID).length);
            assertEq(_dynamicHash(data, 18), keccak256(bytes(params.metadataCID)));
            assertEq(_dynamicLength(data, 22), 0);
            assertEq(data.length, 1056);
            found = true;
        }
        assertTrue(found, "missing CommitmentCreated event");
    }

    function testDistinctEvidenceCidsCreditEachContributorAtMostOnce() public {
        uint256 commitmentId = _createOffer(keccak256("evidence-credit"));
        _acceptOffer(commitmentId);

        address contributor = address(0xC01);
        _setMember(contributor);
        vm.prank(CREATOR);
        module.addContributor(commitmentId, contributor);

        address[] memory credited = new address[](1);
        credited[0] = contributor;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-evidence-one", credited);
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-evidence-two", credited);

        ICommitmentPoolingModule.ContributorRecord memory record = module.getContributor(commitmentId, contributor);
        ICommitmentPoolingModule.Commitment memory stored = module.getCommitment(commitmentId);
        assertEq(record.evidenceCredits, 1);
        assertEq(stored.evidenceCount, 2);
        assertEq(stored.totalVerifiedCredits, 1);
    }

    function testAssessmentIsWriteOnceAcceptedAndUnfrozen() public {
        uint256 commitmentId = _createOffer(keccak256("assessment"));
        _acceptOffer(commitmentId);
        bytes32 firstUID = keccak256("assessment-one");
        bytes32 secondUID = keccak256("assessment-two");
        _setAssessment(firstUID);
        _setAssessment(secondUID);

        vm.prank(EVALUATOR);
        module.attachAssessment(commitmentId, firstUID);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.AssessmentAlreadyAttached.selector, commitmentId, firstUID)
        );
        vm.prank(EVALUATOR);
        module.attachAssessment(commitmentId, secondUID);

        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-assessment-credit", credited);
        module.markReadyForConfirmation(commitmentId, "manual review complete");
        vm.expectRevert();
        vm.prank(EVALUATOR);
        module.attachAssessment(commitmentId, secondUID);
    }

    function testReadyOverrideCannotBypassVerifiedCreditPredicate() public {
        uint256 commitmentId = _createOffer(keccak256("zero-credit-override"));
        _acceptOffer(commitmentId);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NoEligibleContributors.selector, commitmentId));
        module.markReadyForConfirmation(commitmentId, "override cannot manufacture credit");
    }

    function testDefaultConfirmerIsRejectedAtRosterEntryNotAtFreeze() public {
        uint256 commitmentId = _createOffer(keccak256("unreachable-default-confirmer"));
        _acceptOffer(commitmentId);

        // The roster mutation itself now rejects the default confirmer, so a commitment can
        // never reach the freeze in this state. Catching it here rather than at Ready matters:
        // once the counterparty held evidence credit they could no longer leave, and the
        // commitment would have been stranded Accepted with its units and live counts reserved.
        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ConfirmationThresholdUnreachable.selector, commitmentId)
        );
        vm.prank(CREATOR);
        module.addContributor(commitmentId, CLAIMANT);

        // The rejected mutation left no residue, and an untouched roster still reaches Ready.
        assertFalse(module.isContributor(commitmentId, CLAIMANT));
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-ready-credit", credited);
        module.markReadyForConfirmation(commitmentId, "default confirmer stayed off the roster");

        assertEq(
            uint256(module.getCommitment(commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation)
        );
    }

    function testReadyOverrideRequiresOpenRecognitionPolicyForCycleScopedCommitment() public {
        uint256 commitmentId = _createOffer(keccak256("closed-cycle-override"));
        _acceptOffer(commitmentId);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-cycle-credit", credited);

        uint256 unavailableCycleId = 999;
        bytes32 commitmentBase = keccak256(abi.encode(commitmentId, uint256(169)));
        vm.store(address(module), bytes32(uint256(commitmentBase) + 1), bytes32(unavailableCycleId));

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.RecognitionPolicyUnavailable.selector, unavailableCycleId)
        );
        module.markReadyForConfirmation(commitmentId, "cycle policy is not open");
    }

    function testProtocolOfferGardenClaimUsesClaimingGardenStewardsForDefaultConfirmation() public {
        address rootOnlySteward = address(0xA001);
        uint256 protocolId = _openProtocolPool();
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, rootOnlySteward, true);
        hats.setOperator(POOL_GARDEN, CLAIMANT, true);

        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("garden-offer"));
        params.poolId = protocolId;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);

        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-garden-offer-credit", credited);
        module.markReadyForConfirmation(commitmentId, "garden claimant confirmation ready");

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotConfirmer.selector, rootOnlySteward));
        vm.prank(rootOnlySteward);
        module.confirmFulfillment(commitmentId);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotConfirmer.selector, POOL_GARDEN));
        vm.prank(POOL_GARDEN);
        module.confirmFulfillment(commitmentId);

        vm.expectRevert(ICommitmentPoolingModule.SelfConfirmation.selector);
        vm.prank(CREATOR);
        module.confirmFulfillment(commitmentId);

        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);
        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
    }

    function testGardenRequestKeepsRequestCreatorAsDefaultConfirmer() public {
        uint256 protocolId = _openProtocolPool();
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(POOL_GARDEN, CLAIMANT, true);

        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("garden-request-confirm"));
        params.poolId = protocolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);

        address[] memory credited = new address[](1);
        credited[0] = CLAIMANT;
        vm.prank(CLAIMANT);
        module.attachEvidence(commitmentId, "bafy-garden-request-credit", credited);
        module.markReadyForConfirmation(commitmentId, "request creator confirmation ready");

        vm.prank(CREATOR);
        module.confirmFulfillment(commitmentId);
        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
    }

    function testGardenRequestStoresAuthenticatedRequesterAsLead() public {
        uint256 protocolId = _openProtocolPool();
        hats.setOperator(POOL_GARDEN, CLAIMANT, true);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);

        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("garden-request"));
        params.poolId = protocolId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;

        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);

        ICommitmentPoolingModule.Commitment memory stored = module.getCommitment(commitmentId);
        assertEq(stored.counterparty, POOL_GARDEN);
        assertEq(stored.leadProvider, CLAIMANT);
        assertEq(stored.providerGarden, POOL_GARDEN);
        assertEq(registry.committedOf(CLAIMANT, commitmentId), params.targetUnits);
    }

    function testMaxPlusOneConfirmersRejectsBeforeCommitmentAllocation() public {
        uint256 supplied = module.MAX_CONFIRMERS() + 1;
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("too-many-confirmers"));
        params.confirmers = new address[](supplied);
        params.confirmationThreshold = uint32(supplied);
        for (uint256 i = 0; i < supplied; i++) {
            params.confirmers[i] = address(uint160(i + 0x1000));
        }
        uint256 nextCommitmentBefore = module.nextCommitmentId();

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.TooManyConfirmers.selector, supplied, module.MAX_CONFIRMERS())
        );
        vm.prank(CREATOR);
        module.createCommitment(params);

        assertEq(module.nextCommitmentId(), nextCommitmentBefore);
    }

    function testCreationAuthorityAndScopeValidationFailClosed() public {
        uint256 protocolId = _openProtocolPool();
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("protocol-outsider"));
        params.poolId = protocolId;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.NotPoolSteward.selector);

        params = _baseParams(keccak256("garden-claim-in-garden-pool"));
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.GardenClaimRequiresProtocolPool.selector);

        address outsider = address(0xBAD1);
        params = _baseParams(keccak256("captured-by-outsider"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.StewardCaptured;
        params.onBehalfOf = CREATOR;
        _expectCreateRevert(params, outsider, ICommitmentPoolingModule.NotPoolSteward.selector);

        params = _baseParams(keccak256("captured-zero-member"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.StewardCaptured;
        _expectCreateRevert(params, address(this), ICommitmentPoolingModule.ZeroAddress.selector);

        params = _baseParams(keccak256("captured-nonmember"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.StewardCaptured;
        params.onBehalfOf = outsider;
        _expectCreateRevert(params, address(this), ICommitmentPoolingModule.NotEligibleContributor.selector);

        params = _baseParams(keccak256("ordinary-on-behalf"));
        params.onBehalfOf = CLAIMANT;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.UnauthorizedCaller.selector);

        params = _baseParams(keccak256("campaign-by-member"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.SeasonCampaign;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.NotPoolSteward.selector);

        params = _baseParams(keccak256("ordinary-outsider"));
        _expectCreateRevert(params, outsider, ICommitmentPoolingModule.UnauthorizedCaller.selector);
    }

    function testCreationCycleAndSeriesValidationFailClosed() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("unknown-cycle"));
        params.cycleId = 999;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.UnknownCycle.selector);

        uint256 protocolId = _openProtocolPool();
        uint256 protocolCycleId = module.seedCycle(
            protocolId,
            ICommitmentPoolingModule.CycleType.Campaign,
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            "bafy-protocol-cycle"
        );
        params = _baseParams(keccak256("cycle-pool-mismatch"));
        params.cycleId = protocolCycleId;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.CyclePoolMismatch.selector);

        params = _baseParams(keccak256("unknown-series"));
        params.commitmentSeriesId = 999;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.UnknownCommitmentSeries.selector);

        vm.prank(CREATOR);
        uint256 gardenSeriesId = module.createCommitmentSeries(poolId, keccak256("garden-series"), "bafy-garden-series");

        hats.setGardener(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        params = _baseParams(keccak256("series-pool-mismatch"));
        params.poolId = protocolId;
        params.commitmentSeriesId = gardenSeriesId;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.CommitmentSeriesPoolMismatch.selector);

        params = _baseParams(keccak256("series-request"));
        params.commitmentSeriesId = gardenSeriesId;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.CommitmentSeriesOfferOnly.selector);

        vm.prank(CREATOR);
        uint256 protocolSeriesId =
            module.createCommitmentSeries(protocolId, keccak256("protocol-series"), "bafy-protocol-series");
        params = _baseParams(keccak256("series-garden-claim"));
        params.poolId = protocolId;
        params.commitmentSeriesId = protocolSeriesId;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.CommitmentSeriesIndividualOnly.selector);
    }

    function testCreationCounterValidationFailClosed() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("self-counter-id"));
        params.counterCommitmentId = module.nextCommitmentId();
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.SelfCounterCommitment.selector);

        params = _baseParams(keccak256("unknown-counter"));
        params.counterCommitmentId = 999;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.UnknownCounterCommitment.selector);

        uint256 firstOffer = _createOffer(keccak256("counter-first-offer"));
        uint256 protocolId = _openProtocolPool();
        hats.setGardener(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        params = _baseParams(keccak256("counter-pool-mismatch"));
        params.poolId = protocolId;
        params.counterCommitmentId = firstOffer;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.CounterCommitmentPoolMismatch.selector);

        params = _baseParams(keccak256("counter-request"));
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Request;
        vm.prank(CLAIMANT);
        uint256 requestId = module.createCommitment(params);
        params = _baseParams(keccak256("counter-invalid-state"));
        params.counterCommitmentId = requestId;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.ExchangeStateInvalid.selector);

        params = _baseParams(keccak256("counter-self-exchange"));
        params.counterCommitmentId = firstOffer;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.SelfExchange.selector);

        params = _baseParams(keccak256("garden-counter"));
        params.poolId = protocolId;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        vm.prank(CREATOR);
        uint256 gardenCounterId = module.createCommitment(params);
        hats.setGardener(ROOT_GARDEN, CLAIMANT, true);
        hats.setOperator(ROOT_GARDEN, CLAIMANT, true);
        params = _baseParams(keccak256("unsupported-counter-claim"));
        params.poolId = protocolId;
        params.counterCommitmentId = gardenCounterId;
        _expectCreateRevert(params, CLAIMANT, ICommitmentPoolingModule.ExchangeClaimTypeUnsupported.selector);
    }

    function testCreationRequirementAndConsiderationValidationFailClosed() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(keccak256("requirements-on-support"));
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 0, requiredCount: 1 });
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.InvalidDomains.selector);

        params = _baseParams(keccak256("domain-without-requirements"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.InvalidRequirementCount.selector);

        params = _baseParams(keccak256("too-many-requirements"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](module.MAX_REQUIREMENTS() + 1);
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.TooManyRequirements.selector);

        params = _baseParams(keccak256("zero-required-count"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 0, requiredCount: 0 });
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.InvalidRequirementCount.selector);

        params = _baseParams(keccak256("unknown-action"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 999, requiredCount: 1 });
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.UnknownAction.selector);

        _registerActions(1);
        params = _baseParams(keccak256("too-many-linked-works"));
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({
            actionUID: 0,
            requiredCount: uint32(module.MAX_LINKED_WORKS_PER_COMMITMENT() + 1)
        });
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.TooManyLinkedWorks.selector);

        params = _baseParams(keccak256("duplicate-domains"));
        params.domainTags = new uint8[](2);
        params.domainTags[0] = 1;
        params.domainTags[1] = 1;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.InvalidDomains.selector);

        params = _baseParams(keccak256("free-external-rail"));
        params.consideration.rail = ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.InvalidConsiderationConfiguration.selector);

        params = _baseParams(keccak256("external-missing-source"));
        params.consideration.rail = ICommitmentPoolingModule.ConsiderationRail.ArbitrumExternal;
        params.consideration.token = address(0x6000);
        params.consideration.amount = 1;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.InvalidConsiderationConfiguration.selector);

        params = _baseParams(keccak256("celo-unexpected-source"));
        params.consideration.rail = ICommitmentPoolingModule.ConsiderationRail.CeloSettlement;
        params.consideration.source = address(0x6000);
        params.consideration.amount = 1;
        _expectCreateRevert(params, CREATOR, ICommitmentPoolingModule.InvalidConsiderationConfiguration.selector);
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Garden-recipient confirmation liveness.
    //
    // These characterize a KNOWN OPEN GAP, not desired behavior. A Garden Offer's
    // default confirmer is the set of current owner/steward Hat wearers, and no
    // on-chain predicate can decide whether that set still contains an eligible,
    // non-contributor address: IHatsModule exposes only per-account queries, and
    // IHats.viewHat returns a wearer count that does NOT fall on revocation because
    // HatsModule._revokeRole transfers the Hat to a burn address rather than
    // burning it (Hats.sol:716). Any mock that decrements supply on revoke would
    // fabricate a signal production never emits.
    //
    // Resolution decided 2026-08-05: recover through the terminal machinery, not the
    // confirmation predicate (contract-spec.md 223-224). These tests now assert that
    // recovery end to end — a steward raises a dispute from ReadyForConfirmation with
    // no time gate and resolves it to Fulfilled, so a dark or contributor-only claiming
    // garden costs the provider nothing.
    // ───────────────────────────────────────────────────────────────────────────

    function testGardenOfferFreezeIsNotBlockedWhenClaimingGardenGoesDark() public {
        uint256 commitmentId = _readyGardenOffer(keccak256("garden-offer-goes-dark"));

        // Revoke every current owner/steward Hat of the claiming garden before the freeze.
        hats.setOperator(POOL_GARDEN, CLAIMANT, false);

        // The freeze still succeeds: revocation left viewHat().supply untouched, so no
        // reachability probe can observe that the garden went dark.
        module.markReadyForConfirmation(commitmentId, "claiming garden has no current stewards");
        assertEq(
            uint256(module.getCommitment(commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation)
        );
    }

    function testGardenOfferRecoversThroughDisputeAfterStewardsRevoked() public {
        address poolSteward = address(0xA001);
        hats.setOperator(ROOT_GARDEN, poolSteward, true);
        uint256 commitmentId = _readyGardenOffer(keccak256("garden-offer-revoked-after-freeze"));
        module.markReadyForConfirmation(commitmentId, "garden claimant confirmation ready");

        hats.setOperator(POOL_GARDEN, CLAIMANT, false);

        // No ordinary confirmer remains.
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotConfirmer.selector, CLAIMANT));
        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);

        // And fallback is refused, because Garden reachability cannot be disproved.
        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.OrdinaryConfirmationStillReachable.selector, commitmentId)
        );
        vm.prank(poolSteward);
        module.confirmFulfillmentAsFallback(commitmentId, "claiming garden went dark");

        // The terminal machinery is the recovery: dispute from ReadyForConfirmation has no
        // time gate, so the provider is not stranded by a garden that went dark.
        vm.prank(poolSteward);
        module.raiseDispute(commitmentId, "bafy-claiming-garden-dark");
        vm.prank(poolSteward);
        module.resolveDispute(
            commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-steward-verified-delivery"
        );

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
        assertEq(registry.fulfilledOf(CREATOR, commitmentId), 1);
    }

    function testGardenOfferRecoversThroughDisputeWhenStewardsAreContributors() public {
        address poolSteward = address(0xA001);
        hats.setOperator(ROOT_GARDEN, poolSteward, true);
        uint256 commitmentId = _readyGardenOffer(keccak256("garden-offer-steward-is-contributor"));

        // The claiming garden's only steward joins the provider roster before the freeze.
        hats.setGardener(ROOT_GARDEN, CLAIMANT, true);
        vm.prank(CREATOR);
        module.addContributor(commitmentId, CLAIMANT);
        module.markReadyForConfirmation(commitmentId, "garden claimant confirmation ready");

        // Contributor exclusion blocks the only ordinary confirmer.
        vm.expectRevert(ICommitmentPoolingModule.SelfConfirmation.selector);
        vm.prank(CLAIMANT);
        module.confirmFulfillment(commitmentId);

        // Supply cannot exclude contributors, so fallback is refused here too.
        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.OrdinaryConfirmationStillReachable.selector, commitmentId)
        );
        vm.prank(poolSteward);
        module.confirmFulfillmentAsFallback(commitmentId, "only steward is a contributor");

        // Same recovery: the contributor-only garden is resolved through dispute, not confirmation.
        vm.prank(poolSteward);
        module.raiseDispute(commitmentId, "bafy-only-steward-is-contributor");
        vm.prank(poolSteward);
        module.resolveDispute(
            commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-steward-verified-delivery"
        );

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
    }

    /// @dev Protocol-pool Offer claimed by POOL_GARDEN, credited and one call away from Ready.
    ///      The commitment pool garden (ROOT_GARDEN) and claiming garden (POOL_GARDEN) differ,
    ///      so local fallback authority is distinguishable from the ordinary garden path.
    function _readyGardenOffer(bytes32 creationKey) private returns (uint256 commitmentId) {
        uint256 protocolId = _openProtocolPool();
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(POOL_GARDEN, CLAIMANT, true);

        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.poolId = protocolId;
        params.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Garden, POOL_GARDEN);

        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-garden-offer-credit", credited);
    }

    function _openProtocolPool() private returns (uint256 protocolId) {
        protocolId = module.registerPool(ROOT_GARDEN, ICommitmentPoolingModule.PoolType.Protocol);
        module.setProviderOpenCommitmentCap(protocolId, 128);
        module.setPoolCharter(protocolId, "bafy-protocol-charter");
        module.markPoolReady(protocolId);
        module.openPool(protocolId);
    }

    function _setAssessment(bytes32 assessmentUID) private {
        mockEAS.setAttestationByUID(
            assessmentUID,
            Attestation({
                uid: assessmentUID,
                schema: ASSESSMENT_V3_SCHEMA_UID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: POOL_GARDEN,
                attester: EVALUATOR,
                revocable: false,
                data: bytes("")
            })
        );
    }

    function _expectCreateRevert(
        ICommitmentPoolingModule.CreateCommitmentParams memory params,
        address caller,
        bytes4 selector
    )
        private
    {
        vm.prank(caller);
        (bool success, bytes memory returnData) =
            address(module).call(abi.encodeWithSelector(ICommitmentPoolingModule.createCommitment.selector, params));
        assertFalse(success, "creation unexpectedly succeeded");
        assertGe(returnData.length, 4, "creation revert omitted selector");
        bytes4 actual;
        assembly ("memory-safe") {
            actual := mload(add(returnData, 0x20))
        }
        assertEq(actual, selector, "unexpected creation revert");
    }

    function _eventWord(bytes memory data, uint256 wordIndex) private pure returns (bytes32 word) {
        require(data.length >= (wordIndex + 1) * 32, "event data word out of bounds");
        assembly ("memory-safe") {
            word := mload(add(add(data, 0x20), mul(wordIndex, 0x20)))
        }
    }

    function _dynamicLength(bytes memory data, uint256 headIndex) private pure returns (uint256) {
        uint256 offset = uint256(_eventWord(data, headIndex));
        return uint256(_eventWord(data, offset / 32));
    }

    function _dynamicHash(bytes memory data, uint256 headIndex) private pure returns (bytes32 digest) {
        uint256 offset = uint256(_eventWord(data, headIndex));
        uint256 length = uint256(_eventWord(data, offset / 32));
        require(data.length >= offset + 32 + length, "event data tail out of bounds");
        assembly ("memory-safe") {
            digest := keccak256(add(add(data, 0x40), offset), length)
        }
    }

    function _creationPayloadHash(ICommitmentPoolingModule.CreateCommitmentParams memory params)
        private
        pure
        returns (bytes32)
    {
        uint32 effectiveThreshold = params.confirmers.length == 0 ? 1 : params.confirmationThreshold;
        return keccak256(
            bytes.concat(
                abi.encode(
                    params.poolId,
                    params.cycleId,
                    params.commitmentSeriesId,
                    params.direction,
                    params.commitmentType,
                    params.claimType,
                    params.claimMode,
                    params.contributorPolicy
                ),
                abi.encode(
                    params.onBehalfOf,
                    keccak256(abi.encodePacked(params.domainTags)),
                    keccak256(abi.encode(params.requirements)),
                    keccak256(bytes(params.unitLabel)),
                    params.targetUnits,
                    params.requiresAssessment,
                    params.dueDate,
                    keccak256(bytes(params.metadataCID))
                ),
                abi.encode(
                    params.needUID,
                    params.counterCommitmentId,
                    keccak256(abi.encodePacked(params.confirmers)),
                    effectiveThreshold,
                    params.protocolFallbackEnabled,
                    keccak256(abi.encode(params.consideration)),
                    params.declaredUnitValue,
                    keccak256(bytes(params.declaredValueBasis))
                )
            )
        );
    }
}
