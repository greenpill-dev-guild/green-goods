// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { ISchemaRegistry } from "../helpers/DeploymentBase.sol";
import { CommitmentPoolingModule } from "../../src/modules/CommitmentPooling.sol";
import { CommitmentRegistry } from "../../src/registries/Commitment.sol";
import { TestimonyResolver } from "../../src/resolvers/Testimony.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { PoolingConfiguration } from "../../script/lib/PoolingConfiguration.sol";

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
    using PoolingConfiguration for PoolingConfiguration.Targets;

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
        _configureResolvers();
        _openPool();
    }

    /// @dev `PoolingConfiguration.configure` is an internal library function, so it inlines into
    ///      whichever contract calls it — here, this test. `vm.expectRevert` requires the revert to
    ///      happen one call deeper than the cheatcode, so the failure cases need this external hop.
    ///      Calling it as `this.configureExternally(...)` keeps `msg.sender` at this contract,
    ///      which is the resolver owner on the fork.
    function configureExternally(PoolingConfiguration.Targets memory targets) external returns (uint256) {
        return targets.configure();
    }

    /// @dev The artifact-shaped inputs `deploy.ts pooling-configure` reads and hands to the same
    ///      library this test drives.
    function _configurationTargets() private view returns (PoolingConfiguration.Targets memory targets) {
        targets.assessmentResolver = address(assessmentResolver);
        targets.testimonyResolver = address(testimonyResolver);
        targets.workApprovalResolver = address(workApprovalResolver);
        targets.commitmentPoolingModule = address(pooling);
        targets.assessmentSchemaUID = assessmentSchemaUID;
        targets.assessmentV3SchemaUID = assessmentV3SchemaUID;
        targets.communityTestimonySchemaUID = communityTestimonySchemaUID;
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

    // ─────────────────────── Resolver configuration rehearsal ───────────────────────

    /// @notice Re-running the configure step on a configured chain is a no-op, not a revert.
    /// @dev The property that makes the step recoverable: an operator whose run died between two
    ///      of the five calls can simply run it again.
    function testConfigureIsSafeToReRun() public {
        PoolingConfiguration.Targets memory targets = _configurationTargets();

        assertTrue(targets.isConfigured(), "setUp must leave the chain fully configured");
        assertEq(targets.configure(), 0, "a configured chain needs no further calls");
        assertTrue(targets.isConfigured(), "re-running must not disturb the configured state");
    }

    /// @notice A partially configured chain writes only the steps that did not land.
    /// @dev A fresh testimony resolver with its own registered schema reproduces a run that died
    ///      after the assessment steps: the two testimony steps are open, the other three are not.
    function testConfigureResumesAfterAnInterruptedRun() public {
        (TestimonyResolver fresh, bytes32 freshSchemaUID) = _deployTestimonyResolverWithSchema("resume");

        PoolingConfiguration.Targets memory targets = _configurationTargets();
        targets.testimonyResolver = address(fresh);
        targets.communityTestimonySchemaUID = freshSchemaUID;

        assertEq(targets.configure(), 2, "only the two unsatisfied testimony steps may be written");
        assertEq(fresh.schemaUID(), freshSchemaUID);
        assertEq(fresh.commitmentModule(), address(pooling));
        assertTrue(targets.isConfigured(), "the resumed run must reach the configured state");
    }

    /// @notice The live work-approval bridge is never silently repointed at another module.
    /// @dev Repointing it redirects commitment credit; that is a deliberate operator act.
    function testConfigureRefusesToRepointALiveBridge() public {
        CommitmentPoolingModule replacement = _deployBareModule();
        PoolingConfiguration.Targets memory targets = _configurationTargets();
        targets.commitmentPoolingModule = address(replacement);

        vm.expectRevert(
            abi.encodeWithSelector(
                PoolingConfiguration.ConfigurationConflict.selector,
                "testimonyModule",
                bytes32(uint256(uint160(address(pooling)))),
                bytes32(uint256(uint160(address(replacement))))
            )
        );
        this.configureExternally(targets);
    }

    /// @notice A live schema UID is never silently repointed.
    /// @dev Overwriting it would revalidate every existing attestation against a different schema.
    function testConfigureRefusesToRepointALiveSchemaUid() public {
        PoolingConfiguration.Targets memory targets = _configurationTargets();
        bytes32 foreignUID = keccak256("some-other-testimony-schema");
        targets.communityTestimonySchemaUID = foreignUID;

        vm.expectRevert(
            abi.encodeWithSelector(
                PoolingConfiguration.ConfigurationConflict.selector,
                "testimonySchema",
                communityTestimonySchemaUID,
                foreignUID
            )
        );
        this.configureExternally(targets);
    }

    /// @notice The v3 UID cannot equal v2; the resolver reverts SchemaUIDCollision on it.
    function testConfigureRejectsAnAssessmentSchemaCollision() public {
        PoolingConfiguration.Targets memory targets = _configurationTargets();
        targets.assessmentV3SchemaUID = assessmentSchemaUID;

        vm.expectRevert(
            abi.encodeWithSelector(PoolingConfiguration.AssessmentSchemaUIDCollision.selector, assessmentSchemaUID)
        );
        this.configureExternally(targets);
    }

    /// @notice Every address and UID is required before a single call is sent.
    function testConfigureNamesAMissingTargetInsteadOfWritingPartially() public {
        PoolingConfiguration.Targets memory targets = _configurationTargets();
        targets.commitmentPoolingModule = address(0);

        vm.expectRevert(
            abi.encodeWithSelector(PoolingConfiguration.MissingConfiguration.selector, "commitmentPoolingModule")
        );
        this.configureExternally(targets);
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

    /// @dev Mirrors `deploy.ts testimony-resolver`: a UUPS proxy over an implementation whose
    ///      constructor bakes in the EAS address. Returns the schema registered against it, whose
    ///      UID is derived from this proxy's address — the ordering cycle that makes the resolver
    ///      its own deploy step.
    function _deployTestimonyResolverWithSchema(string memory label)
        private
        returns (TestimonyResolver resolver, bytes32 schemaUID)
    {
        (, address schemaRegistry) = _getEASForChain(block.chainid);
        // The implementation loads from artifacts rather than `new`, so its creation code never
        // enters this test contract's own bytecode — the full fork stack already fills it.
        resolver = TestimonyResolver(
            payable(
                address(
                    new ERC1967Proxy(
                        deployCode("Testimony.sol:TestimonyResolver", abi.encode(_easAddress())),
                        abi.encodeWithSelector(TestimonyResolver.initialize.selector, address(this))
                    )
                )
            )
        );

        // EAS rejects a duplicate (schema, resolver, revocable) triple, but each proxy gets a
        // fresh address, so the label only has to keep repeat callers legible in a trace.
        string memory schema = string.concat(communityTestimonySchema, ",string ", label);
        schemaUID = ISchemaRegistry(schemaRegistry).register(schema, address(resolver), false);
    }

    /// @dev Mirrors `deploy.ts commitment-schemas` against the live Arbitrum SchemaRegistry.
    function _registerCommitmentSchemas() private {
        (, address schemaRegistry) = _getEASForChain(block.chainid);

        assessmentV3Schema = _generateSchemaString("assessmentV3");
        communityTestimonySchema = _generateSchemaString("communityTestimony");

        assessmentV3SchemaUID =
            ISchemaRegistry(schemaRegistry).register(assessmentV3Schema, address(assessmentResolver), false);

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
        communityTestimonySchemaUID =
            ISchemaRegistry(schemaRegistry).register(communityTestimonySchema, address(testimonyResolver), false);

        // Neither resolver is pinned to a schema here. Deployment leaves the v2 UID zero — which
        // is exactly the live Arbitrum state — and every resolver-side setter belongs to
        // `_configureResolvers`, so this test rehearses the real step boundary.
        assertEq(assessmentResolver.schemaUID(), bytes32(0), "deployment leaves the v2 UID unpinned");
    }

    /// @dev Mirrors `deploy.ts pooling-configure` by calling the library that target broadcasts,
    ///      rather than a hand-copied sequence. A rehearsal of a copy proves only that the copy
    ///      works; this proves the code an operator will actually run.
    function _configureResolvers() private {
        uint256 written = _configurationTargets().configure();

        assertEq(written, 5, "a fresh chain must need all five configuration calls");
    }

    /// @dev Mirrors `deploy.ts pooling`. Resolver-side wiring is deliberately not done here — it
    ///      is a separate operator step, and the module is inert until it runs.
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
