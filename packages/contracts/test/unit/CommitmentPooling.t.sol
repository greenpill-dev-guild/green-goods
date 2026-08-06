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

    function testReadyOverrideCannotFreezeUnreachableDefaultConfirmer() public {
        uint256 commitmentId = _createOffer(keccak256("unreachable-default-confirmer"));
        _acceptOffer(commitmentId);

        vm.prank(CREATOR);
        module.addContributor(commitmentId, CLAIMANT);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-ready-credit", credited);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.ConfirmationThresholdUnreachable.selector, commitmentId)
        );
        module.markReadyForConfirmation(commitmentId, "default confirmer joined the roster");
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
            uint256(module.getCommitment(commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
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
            uint256(module.getCommitment(commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
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

    function _creationPayloadHash(ICommitmentPoolingModule.CreateCommitmentParams memory params)
        private
        pure
        returns (bytes32)
    {
        uint32 effectiveThreshold = params.confirmers.length == 0 ? 1 : params.confirmationThreshold;
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
                effectiveThreshold,
                params.protocolFallbackEnabled,
                keccak256(abi.encode(params.reward)),
                params.declaredUnitValue,
                keccak256(bytes(params.declaredValueBasis))
            )
        );
    }
}
