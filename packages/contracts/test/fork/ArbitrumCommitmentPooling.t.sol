// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { ISchemaRegistry } from "../helpers/DeploymentBase.sol";
import { CommitmentPoolingModule } from "../../src/modules/CommitmentPooling.sol";
import { CommitmentRegistry } from "../../src/registries/Commitment.sol";
import { TestimonyResolver } from "../../src/resolvers/Testimony.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";

/// @title ArbitrumCommitmentPoolingForkTest
/// @notice Production rehearsal for the Commitment Pooling release, on an Arbitrum One fork.
/// @dev This replaces the planned Arbitrum Sepolia rehearsal. Hats Protocol has no Arbitrum Sepolia
///      deployment, so a testnet rehearsal would have to stand up a hand-rolled Hats tree and prove
///      nothing about the real one. A fork runs the same runbook against the *real* Hats, the real
///      EAS and SchemaRegistry, and real garden accounts at their production addresses.
///
///      What only this test can prove: a real EAS work-approval attestation flowing through the
///      live WorkApprovalResolver into the pooling module's onWorkDecision bridge. Every unit test
///      drives that bridge through a mock resolver, so this is the only place the try/catch hook,
///      the resolver-assigned sequence, and the module's credit accounting are exercised together.
///
///      What a fork still cannot prove: keystore signing, Etherscan verification, and real gas or
///      block timing. Those belong to a broadcast runbook, not to contract correctness.
contract ArbitrumCommitmentPoolingForkTest is ForkTestBase {
    CommitmentPoolingModule internal pooling;
    CommitmentRegistry internal commitmentRegistry;
    TestimonyResolver internal testimonyResolver;

    bytes32 internal assessmentV3SchemaUID;
    bytes32 internal communityTestimonySchemaUID;
    string internal assessmentV3Schema;
    string internal communityTestimonySchema;

    address internal gardenAccount;
    /// @dev A second real garden standing in for the protocol root garden.
    address internal rootGardenAccount;
    uint256 internal actionUID;
    uint256 internal poolId;

    /// @dev Offer creator and lead provider.
    address internal provider;
    /// @dev Claimant, default confirmer, and deliberately never a contributor.
    address internal recipient;

    function setUp() public {
        _requireChainFork("arbitrum");
        _deployFullStackOnFork();

        (gardenAccount, actionUID) = _setupGardenWithRolesAndAction("Fork Pooling Garden");
        rootGardenAccount = _mintTestGarden("Fork Root Garden", 0x0F);
        provider = forkGardener;
        recipient = forkEvaluator;

        _registerCommitmentSchemas();
        _deployAndWirePooling();
        _openPool();
    }

    // ─────────────────────── Schema registration rehearsal ───────────────────────

    /// @notice The deterministic UID the release tooling computes off-chain is the UID real EAS
    ///         assigns. This is what makes an interrupted registration resumable rather than a
    ///         duplicate, so it is proven against the live registry rather than asserted.
    function testRegisteredSchemaUidsMatchTheOffchainDerivation() public {
        assertEq(
            assessmentV3SchemaUID,
            keccak256(abi.encodePacked(assessmentV3Schema, address(assessmentResolver), false)),
            "assessment v3 UID must match SchemaRegistry._getUID"
        );
        assertEq(
            communityTestimonySchemaUID,
            keccak256(abi.encodePacked(communityTestimonySchema, address(testimonyResolver), false)),
            "community testimony UID must match SchemaRegistry._getUID"
        );
        assertTrue(assessmentV3SchemaUID != assessmentSchemaUID, "v3 must be a fresh UID beside v2");
    }

    /// @notice v2 stays readable and configured after v3 is added to the same resolver proxy.
    function testAssessmentV2SurvivesV3Activation() public {
        assertEq(assessmentResolver.schemaUID(), assessmentSchemaUID, "v2 UID must be preserved");
        assertEq(assessmentResolver.assessmentV3SchemaUID(), assessmentV3SchemaUID, "v3 UID must be set");
    }

    // ───────────────────────── Deploy and wiring rehearsal ─────────────────────────

    /// @notice The module is unusable until every dependency and all four schema UIDs are set.
    function testModuleRefusesToUnpauseUntilFullyWired() public {
        CommitmentPoolingModule bare = _deployBareModule();

        vm.expectRevert(ICommitmentPoolingModule.ModuleNotReady.selector);
        bare.setPaused(false);

        assertTrue(bare.paused(), "a half-wired module must stay paused");
        assertFalse(pooling.paused(), "the fully wired module unpauses");
    }

    function testRegisterMirrorsTheDeployScriptWiring() public {
        assertEq(address(pooling.commitmentRegistry()), address(commitmentRegistry));
        assertEq(pooling.rootGarden(), rootGardenAccount);
        assertEq(address(pooling.hatsModule()), address(hatsModule));
        assertEq(pooling.workApprovalResolver(), address(workApprovalResolver));
        assertEq(address(workApprovalResolver.commitmentModule()), address(pooling), "the bridge must be wired");
        assertEq(testimonyResolver.commitmentModule(), address(pooling));
    }

    // ──────────────────── Full lifecycle through the live resolver ────────────────────

    /// @notice The whole promise, end to end, with real attestations on real EAS.
    function testCommitmentLifecycleThroughTheLiveWorkApprovalResolver() public {
        uint256 commitmentId = _createDomainImpactOffer();

        vm.prank(recipient);
        pooling.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, gardenAccount);
        assertEq(
            uint256(pooling.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Accepted)
        );

        // A real Work attestation from the lead provider, linked before its decision.
        bytes32 workUID = _submitWorkAttestation(provider, gardenAccount, actionUID);
        vm.prank(provider);
        pooling.linkWork(commitmentId, workUID, 0, keccak256("fork-link"));
        assertEq(pooling.workCommitmentOf(workUID), commitmentId);

        // A real approval through the live resolver. Nothing calls the module directly: the
        // resolver's onAttest hook assigns the sequence and forwards the decision.
        bytes32 approvalUID = _submitWorkApproval(forkOperator, gardenAccount, actionUID, workUID);

        assertEq(workApprovalResolver.decisionSequenceByUID(approvalUID), 1, "resolver must sequence the decision");
        assertEq(workApprovalResolver.latestDecisionSequence(workUID), 1);
        assertTrue(pooling.isApprovalCounted(approvalUID), "the bridge must have delivered the decision");
        assertEq(pooling.getRequirement(commitmentId, 0).approvedCount, 1, "the requirement must be counted");
        assertEq(pooling.getContributor(commitmentId, provider).approvedWorkCredits, 1);

        // The single requirement is met, so the roster froze and readiness flipped automatically.
        ICommitmentPoolingModule.Commitment memory ready = pooling.getCommitment(commitmentId);
        assertEq(
            uint256(ready.state),
            uint256(ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation),
            "an approved requirement set must auto-flip to Ready"
        );
        assertTrue(ready.contributorsFrozen);
        assertEq(ready.eligibleContributorCount, 1);
        assertEq(ready.totalVerifiedCredits, 1);

        vm.prank(recipient);
        pooling.confirmFulfillment(commitmentId);

        assertEq(
            uint256(pooling.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
        assertEq(commitmentRegistry.fulfilledOf(provider, commitmentId), 1, "units convert on fulfilment");
        assertEq(commitmentRegistry.committedOf(provider, commitmentId), 0);
    }

    /// @notice Recognition over credits earned from real attestations, not seeded counters.
    function testRecognitionSnapshotOverRealCredits() public {
        uint256 commitmentId = _fulfilledCommitment();

        ICommitmentPoolingModule.RecognitionEntry[] memory entries = new ICommitmentPoolingModule.RecognitionEntry[](1);
        entries[0] = ICommitmentPoolingModule.RecognitionEntry({ contributor: provider, recognitionWeightBps: 10_000 });

        bytes32 expected = keccak256(abi.encode(block.chainid, commitmentId, entries));
        assertEq(pooling.validateRecognitionSnapshot(commitmentId, entries, expected), expected);
        assertTrue(pooling.isEligibleContributor(commitmentId, provider));
    }

    /// @notice A later rejection reverses the credit the approval created, through the same bridge.
    function testLiveRejectionReversesCreditBeforeFreeze() public {
        uint256 commitmentId = _createTwoRequirementOffer();
        vm.prank(recipient);
        pooling.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, gardenAccount);

        bytes32 workUID = _submitWorkAttestation(provider, gardenAccount, actionUID);
        vm.prank(provider);
        pooling.linkWork(commitmentId, workUID, 0, keccak256("fork-link-reversal"));

        _submitWorkApproval(forkOperator, gardenAccount, actionUID, workUID);
        assertEq(pooling.getRequirement(commitmentId, 0).approvedCount, 1);

        // The second requirement is still open, so the ledger is unfrozen and reversible.
        bytes32 rejectionUID = _submitWorkDecision(forkOperator, gardenAccount, actionUID, workUID, false);
        assertEq(workApprovalResolver.decisionSequenceByUID(rejectionUID), 2, "the rejection must outrank the approval");
        assertEq(pooling.getRequirement(commitmentId, 0).approvedCount, 0, "a newer rejection reverses the credit");
        assertEq(pooling.getContributor(commitmentId, provider).approvedWorkCredits, 0);
        assertEq(pooling.getCommitment(commitmentId).totalVerifiedCredits, 0);
    }

    // ───────────────────────────── Rehearsal setup ─────────────────────────────

    /// @dev Mirrors `deploy.ts commitment-schemas` against the live Arbitrum SchemaRegistry.
    function _registerCommitmentSchemas() private {
        (, address schemaRegistry) = _getEASForChain(block.chainid);
        // Implementations load from artifacts rather than `new`, so their creation code never
        // enters this test contract's own bytecode — the full fork stack already fills it.
        testimonyResolver = TestimonyResolver(
            payable(
                address(
                    new ERC1967Proxy(
                        deployCode("Testimony.sol:TestimonyResolver", abi.encode(_easAddress())),
                        abi.encodeWithSelector(TestimonyResolver.initialize.selector, address(this))
                    )
                )
            )
        );

        assessmentV3Schema = _generateSchemaString("assessmentV3");
        communityTestimonySchema = _generateSchemaString("communityTestimony");

        assessmentV3SchemaUID =
            ISchemaRegistry(schemaRegistry).register(assessmentV3Schema, address(assessmentResolver), false);
        communityTestimonySchemaUID =
            ISchemaRegistry(schemaRegistry).register(communityTestimonySchema, address(testimonyResolver), false);

        // v2 must be pinned before v3 exists: setAssessmentV3SchemaUID reverts
        // AssessmentV2SchemaUIDRequired while schemaUID is zero. Deployment leaves it zero — which
        // is exactly the live Arbitrum state — so pinning the verified v2 UID is a real, ordered
        // step of the release runbook and not test scaffolding.
        assertEq(assessmentResolver.schemaUID(), bytes32(0), "deployment leaves the v2 UID unpinned");
        assessmentResolver.setSchemaUID(assessmentSchemaUID);

        assessmentResolver.setAssessmentV3SchemaUID(assessmentV3SchemaUID);
        testimonyResolver.setSchemaUID(communityTestimonySchemaUID);
    }

    /// @dev Mirrors `deploy.ts pooling`, then performs the two configuration calls the deploy
    ///      tooling does not yet own: the resolver bridges back to the module.
    function _deployAndWirePooling() private {
        pooling = _deployBareModule();
        commitmentRegistry = CommitmentRegistry(
            address(
                new ERC1967Proxy(
                    deployCode("Commitment.sol:CommitmentRegistry"),
                    abi.encodeWithSelector(CommitmentRegistry.initialize.selector, address(this), address(pooling))
                )
            )
        );

        pooling.setCommitmentRegistry(address(commitmentRegistry));
        pooling.setSchemaUIDs(workSchemaUID, workApprovalSchemaUID, assessmentSchemaUID, assessmentV3SchemaUID);
        pooling.setPaused(false);

        workApprovalResolver.setCommitmentModule(address(pooling));
        testimonyResolver.setCommitmentModule(address(pooling));
    }

    /// @dev Everything the deploy script wires except the register and the schema UIDs, so the
    ///      readiness gate has something real to reject.
    function _deployBareModule() private returns (CommitmentPoolingModule module) {
        module = CommitmentPoolingModule(
            address(
                new ERC1967Proxy(
                    deployCode("CommitmentPooling.sol:CommitmentPoolingModule"),
                    abi.encodeWithSelector(CommitmentPoolingModule.initialize.selector, address(this), rootGardenAccount)
                )
            )
        );
        module.setGardenToken(address(gardenToken));
        module.setHatsModule(address(hatsModule));
        module.setActionRegistry(address(actionRegistry));
        module.setWorkApprovalResolver(address(workApprovalResolver));
        module.setEAS(_easAddress());
    }

    function _openPool() private {
        poolId = pooling.registerPool(gardenAccount, ICommitmentPoolingModule.PoolType.Garden);
        pooling.setProviderOpenCommitmentCap(poolId, 32);
        pooling.setPoolCharter(poolId, "ipfs://QmForkPoolCharter");
        pooling.markPoolReady(poolId);
        pooling.openPool(poolId);
    }

    function _easAddress() private view returns (address eas) {
        (eas,) = _getEASForChain(block.chainid);
    }

    function _baseOfferParams(bytes32 key)
        private
        view
        returns (ICommitmentPoolingModule.CreateCommitmentParams memory params)
    {
        params.poolId = poolId;
        params.creationRequestKey = key;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Offer;
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.claimType = ICommitmentPoolingModule.ClaimType.Individual;
        params.claimMode = ICommitmentPoolingModule.ClaimMode.Open;
        params.contributorPolicy = ICommitmentPoolingModule.ContributorPolicy.LeadManaged;
        params.unitLabel = "hours";
        params.targetUnits = 1;
        params.metadataCID = "ipfs://QmForkCommitment";
    }

    function _createDomainImpactOffer() private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseOfferParams(keccak256("fork-offer"));
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](1);
        params.requirements[0] =
            ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: actionUID, requiredCount: 1 });
        vm.prank(provider);
        return pooling.createCommitment(params);
    }

    /// @dev A second open requirement keeps the ledger unfrozen so a reversal is observable.
    function _createTwoRequirementOffer() private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseOfferParams(keccak256("fork-offer-two"));
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](2);
        params.requirements[0] =
            ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: actionUID, requiredCount: 1 });
        params.requirements[1] =
            ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: actionUID, requiredCount: 1 });
        vm.prank(provider);
        return pooling.createCommitment(params);
    }

    function _fulfilledCommitment() private returns (uint256 commitmentId) {
        commitmentId = _createDomainImpactOffer();
        vm.prank(recipient);
        pooling.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, gardenAccount);
        bytes32 workUID = _submitWorkAttestation(provider, gardenAccount, actionUID);
        vm.prank(provider);
        pooling.linkWork(commitmentId, workUID, 0, keccak256("fork-link-recognition"));
        _submitWorkApproval(forkOperator, gardenAccount, actionUID, workUID);
        vm.prank(recipient);
        pooling.confirmFulfillment(commitmentId);
    }
}
