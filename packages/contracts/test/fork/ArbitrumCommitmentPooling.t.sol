// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { ISchemaRegistry } from "../helpers/DeploymentBase.sol";
// The lane's own registry type. Distinct declaration from the one DeploymentBase re-exports, so
// the helpers that hand a registry to `CommitmentSchemaLane` need this one specifically.
import { ISchemaRegistry as ILaneSchemaRegistry } from "@eas/ISchemaRegistry.sol";
import { CommitmentPoolingModule } from "../../src/modules/CommitmentPooling.sol";
import { CommitmentRegistry } from "../../src/registries/Commitment.sol";
import { TestimonyResolver } from "../../src/resolvers/Testimony.sol";
import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { PoolingConfiguration } from "../../script/lib/PoolingConfiguration.sol";
import { CommitmentSchemaRecovery } from "../../script/lib/CommitmentSchemaRecovery.sol";
import { CommitmentSchemaLane } from "../../script/lib/CommitmentSchemaLane.sol";
import { TestimonyResolverDeployment } from "../../script/lib/TestimonyResolverDeployment.sol";

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
    /// @dev Labelled schema string per fixture resolver, so observations read the right one.
    mapping(address => string) private testimonySchemaOf;
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

        _runPreparation();
        _deployAndWirePooling();
        _configureResolvers();
        _runFinalization();
        _openPool();
    }

    /// @dev `PoolingConfiguration.configure` is an internal library function, so it inlines into
    ///      whichever contract calls it — here, this test. `vm.expectRevert` requires the revert to
    ///      happen one call deeper than the cheatcode, so the failure cases need this external hop.
    ///      Calling it as `this.configureExternally(...)` keeps `msg.sender` at this contract,
    ///      which is the resolver owner on the fork.
    function configureExternallyAs(
        PoolingConfiguration.Targets memory targets,
        address expectedOwner
    )
        external
        returns (uint256)
    {
        return targets.configure(expectedOwner);
    }

    function configureExternally(PoolingConfiguration.Targets memory targets) external returns (uint256) {
        return targets.configure(address(this));
    }

    /// @dev The artifact-shaped inputs `deploy.ts pooling-configure` reads and hands to the same
    ///      library this test drives.
    function _configurationTargets() private view returns (PoolingConfiguration.Targets memory targets) {
        targets.assessmentResolver = address(assessmentResolver);
        targets.workApprovalResolver = address(workApprovalResolver);
        targets.commitmentPoolingModule = address(pooling);
        targets.assessmentSchemaUID = assessmentSchemaUID;
        targets.assessmentV3SchemaUID = assessmentV3SchemaUID;
    }

    // ─────────────────────── Schema registration rehearsal
    // ───────────────────────

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

    /// @notice The Solidity constants match the schema config the TypeScript planner reads.
    /// @dev `DeployCommitmentSchemas` hardcodes both schema strings while `pooling-release.ts`
    ///      generates them from `config/schemas.json`. Nothing else forces them to agree, and a
    ///      config edit would silently give the planner one deterministic UID and the broadcast
    ///      another — the resolver would then be pinned to a schema the tooling cannot find.
    ///      `_generateSchemaString` reads the same config the planner does, so this is the parity
    ///      check. The lane already runs on the generated strings; this pins the constants to them.
    function testScriptSchemaConstantsMatchTheSharedConfig() public {
        assertEq(
            assessmentV3Schema,
            "string title,string description,string assessmentConfigCID,uint8 domain,uint256 startDate,"
            "uint256 endDate,string location,uint8 assessmentKind,uint256 cycleId,bytes32 baselineUID",
            "assessment v3 config string drifted from DeployCommitmentSchemas.ASSESSMENT_V3_SCHEMA"
        );
        assertEq(
            communityTestimonySchema,
            "uint256 commitmentId,string title,string testimonyCID",
            "community testimony config string drifted from DeployCommitmentSchemas.COMMUNITY_TESTIMONY_SCHEMA"
        );
    }

    /// @notice v2 stays readable and configured after v3 is added to the same resolver proxy.
    function testAssessmentV2SurvivesV3Activation() public {
        assertEq(assessmentResolver.schemaUID(), assessmentSchemaUID, "v2 UID must be preserved");
        assertEq(assessmentResolver.assessmentV3SchemaUID(), assessmentV3SchemaUID, "v3 UID must be set");
    }

    // ───────────────────────── Deploy and wiring rehearsal
    // ─────────────────────────

    /// @notice The module is unusable until every dependency and all four schema UIDs are set.
    function testModuleRefusesToUnpauseUntilFullyWired() public {
        CommitmentPoolingModule bare = _deployBareModule();

        vm.expectRevert(ICommitmentPoolingModule.ModuleNotReady.selector);
        bare.setPaused(false);

        assertTrue(bare.paused(), "a half-wired module must stay paused");
        assertFalse(pooling.paused(), "the fully wired module unpauses");
    }

    // ─────────────────────── Deterministic deploy rehearsal
    // ───────────────────────

    /// @notice The deploy target's own CREATE2 derivation, run against live Arbitrum.
    /// @dev Drives `TestimonyResolverDeployment` itself rather than a copy of its logic. The previous
    ///      revision of this file hand-deployed proxies with `new ERC1967Proxy`, so it proved
    ///      nothing about the script an operator actually runs — the gap that let a plain-CREATE,
    ///      non-recoverable deploy reach review.
    /// @notice The salts are exactly the declared namespace, version, and labels.
    /// @dev Pinned rather than recomputed. A test that derives the expected salt the same way the
    ///      target does proves only internal consistency: dropping `DEPLOY_VERSION` from the
    ///      preimage would still deploy and still self-agree, moving the release identity silently.
    ///      These constants are what make that change loud. If this test fails, the address pair
    ///      moved — update the runbook deliberately, do not update the constants to match.
    function testDeploymentSaltsArePinnedToTheDeclaredNamespaceAndVersion() public {
        (bytes32 implSalt, bytes32 proxySalt) = TestimonyResolverDeployment.deploymentSalts();

        assertEq(
            implSalt,
            keccak256(abi.encodePacked("green-goods:testimony-resolver", "v1", "TestimonyResolverImpl")),
            "implementation salt moved"
        );
        assertEq(
            proxySalt,
            keccak256(abi.encodePacked("green-goods:testimony-resolver", "v1", "TestimonyResolverProxy")),
            "proxy salt moved"
        );
        assertTrue(implSalt != proxySalt, "the two deployments must not share a salt");
    }

    /// @notice The factory this rehearsal deploys through is the one the deploy script will use.
    /// @dev The last unpinned input to the lane's identity. Every other one — namespace, version,
    ///      salt labels, schema strings — is now pinned against its source, but the factory was
    ///      hardcoded here while the script reads `networks.json#deploymentDefaults.factory`. They
    ///      agree today and nothing failed if they diverged, yet a divergence moves BOTH predicted
    ///      addresses away from everything this rehearsal proved about them.
    function testRehearsalFactoryMatchesTheConfiguredDeploymentFactory() public {
        (, address configuredFactory,) = getDeploymentDefaults();

        assertEq(_create2Factory(), configuredFactory, "the rehearsal factory drifted from networks.json");
    }

    /// @notice The predicted pair does not move when the shared deploy salt is set.
    /// @dev The recovery property is worthless if an operator's shell can change the address. An
    ///      earlier revision derived the salt from `getDeploymentDefaults()`, which honours
    ///      `DEPLOYMENT_SALT`, so retrying from a clean environment would have predicted a
    ///      different pair and deployed a second implementation and proxy over an already-mined run.
    function testPredictedAddressesIgnoreTheAmbientDeploymentSalt() public {
        address owner = assessmentResolver.owner();
        (address baselineImpl, address baselineProxy) =
            TestimonyResolverDeployment.predictAddresses(_easAddress(), owner, _create2Factory());

        vm.setEnv("DEPLOYMENT_SALT", "some-other-release-salt");
        (address impl, address proxy) =
            TestimonyResolverDeployment.predictAddresses(_easAddress(), owner, _create2Factory());

        assertEq(impl, baselineImpl, "implementation address moved with the ambient salt");
        assertEq(proxy, baselineProxy, "proxy address moved with the ambient salt");
    }

    /// @notice The addresses preparation actually deployed are the ones the derivation predicts.
    /// @dev Observed from the other side now that `setUp` runs the real preparation mode: rather
    ///      than deploying inside the test and checking its own output, this asserts the lane's
    ///      deployment landed where an operator comparing against the runbook would expect. The
    ///      `deployedSomething` assertion for a genuinely first run lives in `_runPreparation`.
    function testDeployTargetPredictsTheAddressesItDeploys() public {
        address owner = assessmentResolver.owner();

        (address predictedImpl, address predictedProxy) =
            TestimonyResolverDeployment.predictAddresses(_easAddress(), owner, _create2Factory());

        assertEq(address(testimonyResolver), predictedProxy, "preparation deployed off its prediction");
        assertGt(predictedProxy.code.length, 0, "the predicted proxy must be occupied after preparation");
        assertGt(predictedImpl.code.length, 0, "the predicted implementation must be occupied after preparation");
        assertEq(testimonyResolver.owner(), owner, "proxy owner must be the sibling owner");
    }

    /// @notice A rerun after a lost artifact deploys nothing and returns the same addresses.
    /// @dev This is the recovery property. Under plain CREATE, a run whose transaction mined but
    ///      whose artifact merge failed would, on retry, deploy a SECOND implementation and proxy at
    ///      fresh nonce-derived addresses — orphaning the first along with any schema registered
    ///      against it, since the schema UID commits to the resolver address.
    function testDeployTargetRecoversWithoutASecondDeployment() public {
        address owner = assessmentResolver.owner();

        TestimonyResolverDeployment.Deployment memory first =
            TestimonyResolverDeployment.deployOrReuse(_easAddress(), owner, _create2Factory());
        bytes32 implCodehash = first.testimonyResolverImpl.codehash;
        bytes32 proxyCodehash = first.testimonyResolver.codehash;

        // Exactly the retry an operator performs after a failed merge.
        TestimonyResolverDeployment.Deployment memory second =
            TestimonyResolverDeployment.deployOrReuse(_easAddress(), owner, _create2Factory());

        assertFalse(second.deployedSomething, "a recovery rerun must send no deployment transaction");
        assertEq(second.testimonyResolver, first.testimonyResolver, "recovery must return the same proxy");
        assertEq(second.testimonyResolverImpl, first.testimonyResolverImpl, "recovery must return the same implementation");
        assertEq(second.testimonyResolver.codehash, proxyCodehash, "the proxy must not have been replaced");
        assertEq(second.testimonyResolverImpl.codehash, implCodehash, "the implementation must not have been replaced");
    }

    /// @notice A proxy at the predicted address that was upgraded elsewhere is not silently reused.
    /// @dev CREATE2 proves the address was created from this creation code; it cannot prove nobody
    ///      upgraded the proxy afterwards. That is what the ERC-1967 slot read covers.
    function testDeployTargetRefusesAProxyUpgradedOutFromUnderIt() public {
        address owner = assessmentResolver.owner();
        TestimonyResolverDeployment.Deployment memory first =
            TestimonyResolverDeployment.deployOrReuse(_easAddress(), owner, _create2Factory());

        address foreignImplementation = deployCode("Testimony.sol:TestimonyResolver", abi.encode(_easAddress()));
        vm.store(
            first.testimonyResolver,
            0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc,
            bytes32(uint256(uint160(foreignImplementation)))
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                TestimonyResolverDeployment.ExistingProxyMismatch.selector,
                "implementation",
                first.testimonyResolverImpl,
                foreignImplementation
            )
        );
        this.deployOrReuseExternally(_easAddress(), owner, _create2Factory());
    }

    // ─────────────────────── Resolver configuration rehearsal
    // ───────────────────────

    /// @notice Re-running the configure step on a configured chain is a no-op, not a revert.
    /// @dev The property that makes the step recoverable: an operator whose run died between two
    ///      of the five calls can simply run it again.
    function testConfigureIsSafeToReRun() public {
        PoolingConfiguration.Targets memory targets = _configurationTargets();

        assertTrue(targets.isConfigured(), "setUp must leave the chain fully configured");
        assertEq(targets.configure(address(this)), 0, "a configured chain needs no further calls");
        assertTrue(targets.isConfigured(), "re-running must not disturb the configured state");
    }

    /// @dev The former `testConfigureResumesAfterAnInterruptedRun` lived here while `configure`
    ///      owned the two testimony steps and a fresh resolver could stand in for a half-finished
    ///      run. Its three remaining steps all sit on shared live proxies, so a partial state is no
    ///      longer constructible from a fork. Resume semantics moved with the work: they are now
    ///      the ordered recovery states in `CommitmentSchemaRecovery`, covered exhaustively in
    ///      `test/unit/CommitmentSchemaRecovery.t.sol` and end to end below.

    /// @notice The live work-approval bridge is never silently repointed at another module.
    /// @dev Repointing it redirects commitment credit; that is a deliberate operator act.
    function testConfigureRefusesToRepointALiveBridge() public {
        CommitmentPoolingModule replacement = _deployBareModule();
        PoolingConfiguration.Targets memory targets = _configurationTargets();
        targets.commitmentPoolingModule = address(replacement);

        vm.expectRevert(
            abi.encodeWithSelector(
                PoolingConfiguration.ConfigurationConflict.selector,
                "workApprovalBridge",
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
        bytes32 foreignUID = keccak256("some-other-assessment-v3-schema");
        targets.assessmentV3SchemaUID = foreignUID;

        vm.expectRevert(
            abi.encodeWithSelector(
                PoolingConfiguration.ConfigurationConflict.selector, "assessmentV3", assessmentV3SchemaUID, foreignUID
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

    /// @notice A caller who does not own every proxy is rejected before the first write.
    /// @dev The failure this prevents is partial configuration, not the revert. Without the upfront
    ///      check the run would send calls until it reached a proxy it does not own and revert
    ///      there, leaving the earlier steps applied. Proven by handing a fresh testimony resolver
    ///      owned by someone else to an otherwise-valid target set and showing nothing moved.
    function testConfigureRefusesACallerThatDoesNotOwnEveryProxy() public {
        PoolingConfiguration.Targets memory targets = _configurationTargets();

        vm.expectRevert(
            abi.encodeWithSelector(
                PoolingConfiguration.ConfigurationNotOwner.selector,
                "assessmentResolver",
                address(this),
                address(0xBEEFBEEF)
            )
        );
        this.configureExternallyAs(targets, address(0xBEEFBEEF));
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

    // ────────────── Community Testimony ordered recovery, against live EAS
    // ──────────────

    /// @notice setUp walked the lane, so the live resolver reports Finalized.
    /// @dev The unit suite enumerates the classifier; this proves the states it names are the ones
    ///      real chain state produces — pinned UID, a real SchemaRegistry record, and a live module.
    function testLaneReachesFinalizedAgainstLiveEas() public {
        assertEq(
            uint256(CommitmentSchemaRecovery.classify(_recoveryObservation(testimonyResolver, address(pooling)))),
            uint256(CommitmentSchemaRecovery.State.Finalized),
            "setUp must leave the lane finalized"
        );
        assertEq(testimonyResolver.commitmentModule(), address(pooling), "activation is the last action");
    }

    /// @notice A freshly deployed resolver is Unprepared, and finalization refuses to run.
    /// @dev The out-of-order case the lane exists to prevent: finalizing here would register a
    ///      record and activate a module against a resolver whose schema was never pinned.
    function testFinalizationRefusesAnUnpreparedResolver() public {
        (TestimonyResolver fresh,) = _deployTestimonyResolverWithSchema("unprepared", false);
        // Built before arming the cheatcode: the observation makes live reads, and expectRevert
        // would otherwise latch onto the first of those instead of the classifier.
        CommitmentSchemaRecovery.Observation memory observation = _recoveryObservation(fresh, address(pooling));

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaRecovery.UnexpectedRecoveryState.selector,
                CommitmentSchemaRecovery.State.Unprepared,
                "finalization"
            )
        );
        this.finalizableExternally(observation);
    }

    /// @notice Pinned but unregistered is Prepared, and finalization still has both steps to do.
    function testPreparedResolverStillNeedsRecordAndActivation() public {
        (TestimonyResolver fresh,) = _deployTestimonyResolverWithSchema("prepared", true);

        CommitmentSchemaRecovery.State state =
            CommitmentSchemaRecovery.classify(_recoveryObservation(fresh, address(pooling)));

        assertEq(uint256(state), uint256(CommitmentSchemaRecovery.State.Prepared), "pin without record is Prepared");
        assertTrue(CommitmentSchemaRecovery.needsRecord(state), "the record still has to be registered");
        assertTrue(CommitmentSchemaRecovery.needsActivation(state), "and the module still has to be set");
        assertEq(fresh.commitmentModule(), address(0), "a prepared resolver is inert");
    }

    /// @notice A third party registering the record first is RecordRegistered, not a failure.
    /// @dev `SchemaRegistry.register` is permissionless, so anyone can land the record between
    ///      preparation and finalization. Because the UID commits to (schema, resolver, revocable),
    ///      their record is byte-identical to ours — the lane resumes rather than fails closed.
    function testAPermissionlessRegistrationResumesRatherThanBlocking() public {
        (TestimonyResolver fresh, string memory schema) = _deployTestimonyResolverWithSchema("frontrun", true);
        (, address schemaRegistry) = _getEASForChain(block.chainid);

        vm.prank(address(0xF00DF00D));
        ISchemaRegistry(schemaRegistry).register(schema, address(fresh), false);

        CommitmentSchemaRecovery.State state =
            CommitmentSchemaRecovery.classify(_recoveryObservation(fresh, address(pooling)));

        assertEq(uint256(state), uint256(CommitmentSchemaRecovery.State.RecordRegistered), "a foreign register resumes");
        assertFalse(CommitmentSchemaRecovery.needsRecord(state), "the record is already exact");
        assertTrue(CommitmentSchemaRecovery.needsActivation(state), "only activation remains");
    }

    /// @notice A third party registering BEFORE the pin must not brick the lane.
    /// @dev The dangerous half of the front-run window, and the one the sibling test above cannot
    ///      reach: it pins first, so it only covers a registration that lands after preparation has
    ///      already run. This repo is public and every input to the UID is public with it — the
    ///      schema constant, the versioned salt, the checked-in factory — so a watcher can register
    ///      the byte-identical record for pennies before our first broadcast ever mines.
    ///
    ///      Classifying that `Invalid` would block preparation with no escape but a
    ///      `DEPLOY_VERSION` bump the same watcher could chase. §6.4.4 requires the opposite, and
    ///      it is safe: the record is exact by construction, and pinning never reads the registry.
    function testARegistrationBeforeThePinStillPreparesAndReachesRecordRegistered() public {
        (TestimonyResolver fresh, string memory schema) = _deployTestimonyResolverWithSchema("prepin", false);
        (, address schemaRegistry) = _getEASForChain(block.chainid);

        vm.prank(address(0xF00DF00D));
        ISchemaRegistry(schemaRegistry).register(schema, address(fresh), false);

        CommitmentSchemaRecovery.Observation memory observation = _recoveryObservation(fresh, address(pooling));
        assertEq(
            uint256(CommitmentSchemaRecovery.classify(observation)),
            uint256(CommitmentSchemaRecovery.State.RecordAheadOfPin),
            "an exact record ahead of the pin is its own state, not a failure"
        );
        // The gate preparation actually hits. Before this fix it reverted UnexpectedRecoveryState.
        assertEq(
            uint256(this.preparableExternally(observation)),
            uint256(CommitmentSchemaRecovery.State.RecordAheadOfPin),
            "preparation accepts it"
        );

        // And preparation's pin still lands, leaving the lane in the ordinary resumable state.
        fresh.setSchemaUID(observation.expectedUID);
        assertEq(
            uint256(CommitmentSchemaRecovery.classify(_recoveryObservation(fresh, address(pooling)))),
            uint256(CommitmentSchemaRecovery.State.RecordRegistered),
            "pinning over a pre-existing exact record reaches the normal resumable state"
        );
        assertEq(fresh.commitmentModule(), address(0), "and the resolver is still inert");
    }

    function preparableExternally(CommitmentSchemaRecovery.Observation memory observation)
        external
        pure
        returns (CommitmentSchemaRecovery.State)
    {
        return CommitmentSchemaRecovery.assertPreparable(observation);
    }

    /// @dev `deployOrReuse` is an internal library function, so it inlines into this contract and
    ///      reverts at the cheatcode's own depth. The hop restores the frame expectRevert needs.
    function deployOrReuseExternally(
        address eas,
        address owner,
        address factory
    )
        external
        returns (TestimonyResolverDeployment.Deployment memory)
    {
        return TestimonyResolverDeployment.deployOrReuse(eas, owner, factory);
    }

    /// @notice Finalization refuses a module address with no code behind it.
    /// @dev A guard with no negative test is a guard that can be deleted silently: removing the
    ///      `code.length` check survived the whole suite, because the happy path always has a real
    ///      module. An EOA or a typo'd address would otherwise be activated as the bridge.
    function testFinalizationRefusesAModuleWithNoCode() public {
        (, address schemaRegistry) = _getEASForChain(block.chainid);
        address notAContract = address(0xDEADDEAD);

        vm.expectRevert(abi.encodeWithSelector(CommitmentSchemaLane.ModuleNotDeployed.selector, notAContract));
        this.finalizeExternally(
            CommitmentSchemaLane.FinalizationInputs({
                schemaRegistry: schemaRegistry,
                testimonyResolver: address(testimonyResolver),
                module: notAContract,
                communityTestimonySchema: communityTestimonySchema
            })
        );
    }

    /// @notice Finalization refuses a module the resolver's owner cannot govern.
    /// @dev The owner boundary is the check that stops the lane bridging to a module this operator
    ///      does not control. Removing it survived the whole suite — the fork stack's module and
    ///      resolver always share an owner, so the happy path never exercises the comparison.
    ///      Spec §6.4.4 names the owner boundary as a finalization verification.
    function testFinalizationRefusesAModuleTheResolverOwnerCannotGovern() public {
        (, address schemaRegistry) = _getEASForChain(block.chainid);
        address resolverOwner = testimonyResolver.owner();

        pooling.transferOwnership(address(0xBEEFBEEF));

        vm.expectRevert(
            abi.encodeWithSelector(CommitmentSchemaLane.ModuleOwnerMismatch.selector, resolverOwner, address(0xBEEFBEEF))
        );
        this.finalizeExternally(
            CommitmentSchemaLane.FinalizationInputs({
                schemaRegistry: schemaRegistry,
                testimonyResolver: address(testimonyResolver),
                module: address(pooling),
                communityTestimonySchema: communityTestimonySchema
            })
        );
    }

    /// @notice Finalization refuses to report success if its activation did not stick.
    /// @dev The postcondition is what separates "the setter was called" from "the resolver is
    ///      live". A resolver proxy pointing at an implementation whose `setCommitmentModule` is a
    ///      no-op would otherwise finish the lane, write the canonical artifact key, and leave a
    ///      resolver that rejects every attestation. Mocking the view is the only way to reach it:
    ///      the real setter always sticks, which is exactly why deleting the check survived.
    function testFinalizationRefusesWhenTheActivationDoesNotStick() public {
        (, address schemaRegistry) = _getEASForChain(block.chainid);

        // Reads zero forever: entry classifies as RecordRegistered (pin and record are real), so
        // finalization proceeds to activate — and then cannot prove it worked.
        vm.mockCall(address(testimonyResolver), abi.encodeWithSignature("commitmentModule()"), abi.encode(address(0)));

        vm.expectRevert(
            abi.encodeWithSelector(CommitmentSchemaLane.FinalizationDidNotActivate.selector, address(pooling), address(0))
        );
        this.finalizeExternally(
            CommitmentSchemaLane.FinalizationInputs({
                schemaRegistry: schemaRegistry,
                testimonyResolver: address(testimonyResolver),
                module: address(pooling),
                communityTestimonySchema: communityTestimonySchema
            })
        );
    }

    /// @notice Preparation refuses to report success if its pin did not stick.
    /// @dev The mirror of the activation postcondition, and the reason preparation has one at all:
    ///      the pin is preparation's entire product. Without this, a no-op `setSchemaUID` would
    ///      report a clean preparation, write the resolver addresses into the artifact, and only
    ///      surface two broadcasts later when finalization found nothing pinned.
    function testPreparationRefusesWhenThePinDoesNotStick() public {
        (, address schemaRegistry) = _getEASForChain(block.chainid);

        // Preparation always reuses the deterministic resolver, so the mocks go on that one. Both
        // views read zero: entry classifies RecordAheadOfPin (the record is real, the pin appears
        // absent), the read-before-set fires the real setter, and the postcondition still sees
        // nothing pinned. `deployOrReuse` reads only the ERC-1967 slot and `owner()`, so neither
        // mock disturbs the reuse path.
        vm.mockCall(address(testimonyResolver), abi.encodeWithSignature("schemaUID()"), abi.encode(bytes32(0)));
        vm.mockCall(address(testimonyResolver), abi.encodeWithSignature("commitmentModule()"), abi.encode(address(0)));

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaLane.PreparationDidNotPin.selector, communityTestimonySchemaUID, bytes32(0)
            )
        );
        this.prepareExternally(schemaRegistry, communityTestimonySchema);
    }

    /// @notice Re-registering an existing schema reconciles instead of reverting `AlreadyExists`.
    /// @dev The retry contract §6.4.4 requires: a broadcast that mined but whose artifact merge
    ///      failed must be re-runnable. Preparation calls `registerOrReconcile` for AssessmentV3 on
    ///      every run, so without the early return the SECOND preparation of any chain reverts
    ///      inside EAS. Removing it survived the suite because `setUp` only ever runs preparation
    ///      once.
    function testRegisterOrReconcileRerunsInsteadOfRevertingAlreadyExists() public {
        (, address schemaRegistry) = _getEASForChain(block.chainid);

        // Exactly the call preparation makes, against the record preparation already registered.
        bytes32 reconciled =
            this.registerOrReconcileExternally(schemaRegistry, assessmentV3Schema, address(assessmentResolver));
        assertEq(reconciled, assessmentV3SchemaUID, "a rerun must reconcile to the UID preparation registered");

        // And the same holds for a UID this lane has never seen: register once, reconcile after.
        string memory probe = "uint256 laneRerunProbe";
        bytes32 first = this.registerOrReconcileExternally(schemaRegistry, probe, address(testimonyResolver));
        bytes32 second = this.registerOrReconcileExternally(schemaRegistry, probe, address(testimonyResolver));
        assertEq(second, first, "the second call must reconcile rather than register again");
    }

    function registerOrReconcileExternally(
        address schemaRegistry,
        string memory schema,
        address resolver
    )
        external
        returns (bytes32)
    {
        return CommitmentSchemaLane.registerOrReconcile(ILaneSchemaRegistry(schemaRegistry), schema, resolver);
    }

    /// @dev Preparation through the same library the script broadcasts, one frame deeper so
    ///      `expectRevert` latches onto the lane rather than the cheatcode's own depth.
    function prepareExternally(
        address schemaRegistry,
        string memory schema
    )
        external
        returns (CommitmentSchemaLane.PreparationResult memory)
    {
        return CommitmentSchemaLane.prepare(
            CommitmentSchemaLane.PreparationInputs({
                schemaRegistry: schemaRegistry,
                assessmentResolver: address(assessmentResolver),
                workApprovalResolver: address(workApprovalResolver),
                eas: _easAddress(),
                create2Factory: _create2Factory(),
                assessmentV3Schema: assessmentV3Schema,
                communityTestimonySchema: schema,
                assessmentEvidence: _assessmentEvidence()
            })
        );
    }

    /// @notice Preparation refuses to run before the assessment-resolver upgrade.
    /// @dev The ordering gate §6.4.4 puts at preparation. A v2 implementation has no
    ///      `assessmentV3SchemaUID()`, so the failed staticcall IS the capability proof. Without
    ///      it the whole lane succeeds against an un-upgraded proxy and the violation only appears
    ///      two broadcasts later, when `pooling-configure` calls a selector that does not exist.
    function testPreparationRefusesAnAssessmentProxyThatIsNotV3Capable() public {
        // A real v2-shaped contract rather than a mock: this is exactly what the live Arbitrum
        // proxy is before `upgrade.ts assessment-resolver` runs — same owner and v2 state, no v3
        // function at all.
        AssessmentV2Stub v2 = new AssessmentV2Stub(address(this), assessmentSchemaUID, address(0));
        // Built before arming the cheatcode: gathering evidence makes live reads, and expectRevert
        // would otherwise latch onto the first of those instead of the preflight.
        CommitmentSchemaLane.AssessmentEvidence memory evidence = _assessmentEvidence();

        vm.expectRevert(abi.encodeWithSelector(CommitmentSchemaLane.AssessmentResolverNotV3Capable.selector, address(v2)));
        this.assessmentPreflightAt(address(v2), evidence);
    }

    /// @notice An artifact pointing at an address with no code is named, not dereferenced.
    function testPreparationRefusesAnAssessmentProxyWithNoCode() public {
        CommitmentSchemaLane.AssessmentEvidence memory evidence = _assessmentEvidence();

        vm.expectRevert(
            abi.encodeWithSelector(CommitmentSchemaLane.AssessmentResolverNotDeployed.selector, address(0xD15EA5E))
        );
        this.assessmentPreflightAt(address(0xD15EA5E), evidence);
    }

    /// @notice Preparation refuses when the live v2 UID is not what the artifact recorded.
    /// @dev "Match the post-upgrade evidence": a v2 UID that moved means either the artifact is
    ///      stale or the upgrade did not preserve state, and neither is safe to build v3 on top of.
    function testPreparationRefusesAssessmentStateThatDivergedFromTheArtifact() public {
        CommitmentSchemaLane.AssessmentEvidence memory stale = _assessmentEvidence();
        bytes32 live = stale.assessmentSchemaUID;
        stale.assessmentSchemaUID = keccak256("some-other-v2-uid");

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaLane.AssessmentEvidenceMismatch.selector,
                "assessmentSchemaUID",
                stale.assessmentSchemaUID,
                live
            )
        );
        this.assessmentPreflightAt(address(assessmentResolver), stale);
    }

    /// @notice A KarmaGAP module that moved under the upgrade is caught too.
    /// @dev Zero is a legitimate KarmaGAP state (`setKarmaGAPModule(0)` disables it), which is why
    ///      the evidence carries an explicit `recorded` flag instead of treating zero as absent —
    ///      otherwise a module silently zeroed by a bad upgrade would read as "nothing recorded".
    function testPreparationRefusesAKarmaGapModuleThatMoved() public {
        CommitmentSchemaLane.AssessmentEvidence memory stale = _assessmentEvidence();
        address live = stale.karmaGAPModule;
        stale.karmaGAPModule = address(0xCAFEBABE);

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaLane.AssessmentEvidenceMismatch.selector,
                "karmaGAPModule",
                bytes32(uint256(uint160(address(0xCAFEBABE)))),
                bytes32(uint256(uint160(live)))
            )
        );
        this.assessmentPreflightAt(address(assessmentResolver), stale);
    }

    /// @notice With no recorded evidence, the capability and owner halves still run.
    /// @dev The skip must be narrow: a chain that has not pinned v2 yet still cannot be allowed to
    ///      prepare against an un-upgraded proxy.
    function testPreparationStillChecksCapabilityWithoutRecordedEvidence() public {
        CommitmentSchemaLane.AssessmentEvidence memory none;
        assertFalse(none.recorded, "the unrecorded case is the default-constructed one");

        // Unrecorded evidence skips only the comparison it has nothing to compare against...
        this.assessmentPreflightAt(address(assessmentResolver), none);

        // ...and never the capability probe.
        AssessmentV2Stub v2 = new AssessmentV2Stub(address(this), bytes32(0), address(0));
        vm.expectRevert(abi.encodeWithSelector(CommitmentSchemaLane.AssessmentResolverNotV3Capable.selector, address(v2)));
        this.assessmentPreflightAt(address(v2), none);
    }

    function assessmentPreflightAt(
        address resolver,
        CommitmentSchemaLane.AssessmentEvidence memory evidence
    )
        external
        view
    {
        CommitmentSchemaLane.assertAssessmentProxyReady(resolver, assessmentResolver.owner(), evidence);
    }

    /// @notice Preparation refuses when the sibling resolvers no longer share an owner.
    /// @dev The derivation exists so one sender can run the whole lane. If the siblings have
    ///      diverged, silently taking one of them would produce a resolver the configure step
    ///      cannot govern — so divergence must be loud. Removing this check also survived the
    ///      whole suite, since the fork stack's resolvers always agree.
    function testPreparationRefusesDivergedSiblingOwners() public {
        address assessmentOwner = assessmentResolver.owner();
        workApprovalResolver.transferOwnership(address(0xBEEFBEEF));

        vm.expectRevert(
            abi.encodeWithSelector(
                CommitmentSchemaLane.ResolverOwnerMismatch.selector, assessmentOwner, address(0xBEEFBEEF)
            )
        );
        this.resolverOwnerExternally(address(assessmentResolver), address(workApprovalResolver));
    }

    function finalizeExternally(CommitmentSchemaLane.FinalizationInputs memory inputs)
        external
        returns (CommitmentSchemaLane.FinalizationResult memory)
    {
        return CommitmentSchemaLane.finalize(inputs);
    }

    function resolverOwnerExternally(address assessment, address workApproval) external view returns (address) {
        return CommitmentSchemaLane.resolverOwner(assessment, workApproval);
    }

    /// @dev `vm.expectRevert` needs the revert one frame deeper than the cheatcode.
    function finalizableExternally(CommitmentSchemaRecovery.Observation memory observation)
        external
        pure
        returns (CommitmentSchemaRecovery.State)
    {
        return CommitmentSchemaRecovery.assertFinalizable(observation);
    }

    /// @dev Built from live chain reads, not from what the test believes it did.
    function _recoveryObservation(
        TestimonyResolver resolver,
        address expectedModule
    )
        private
        view
        returns (CommitmentSchemaRecovery.Observation memory observation)
    {
        (, address schemaRegistry) = _getEASForChain(block.chainid);
        string memory schema = _testimonySchemaFor(resolver);
        bytes32 expectedUID = keccak256(abi.encodePacked(schema, address(resolver), false));
        ISchemaRegistry.SchemaRecord memory record = ISchemaRegistry(schemaRegistry).getSchema(expectedUID);

        observation.pinnedUID = resolver.schemaUID();
        observation.expectedUID = expectedUID;
        observation.recordExists = record.uid != bytes32(0);
        observation.recordMatches = record.uid == expectedUID && record.resolver == address(resolver) && !record.revocable
            && keccak256(bytes(record.schema)) == keccak256(bytes(schema));
        observation.module = resolver.commitmentModule();
        observation.expectedModule = expectedModule;
    }

    // ──────────────────── Full lifecycle through the live resolver
    // ────────────────────

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

    // ───────────────────────────── Rehearsal setup
    // ─────────────────────────────

    /// @dev Mirrors what `commitment-schemas` preparation deploys: a UUPS proxy over an implementation whose
    ///      constructor bakes in the EAS address. Returns the schema registered against it, whose
    ///      UID is derived from this proxy's address — the ordering cycle that makes the resolver
    ///      its own deploy step.
    /// @dev A resolver at whatever lane state the caller asks for, built the way preparation
    ///      builds one: deployed, then optionally pinned. Never registers the record — that is
    ///      finalization's step, and the tests that want it registered do so explicitly.
    function _deployTestimonyResolverWithSchema(
        string memory label,
        bool pinSchema
    )
        private
        returns (TestimonyResolver resolver, string memory schema)
    {
        // The implementation loads from artifacts rather than `new`, so its creation code never
        // enters this test contract's own bytecode — the full fork stack already fills it.
        resolver = TestimonyResolver(
            payable(address(
                    new ERC1967Proxy(
                        deployCode("Testimony.sol:TestimonyResolver", abi.encode(_easAddress())),
                        abi.encodeWithSelector(TestimonyResolver.initialize.selector, address(this))
                    )
                ))
        );

        // EAS rejects a duplicate (schema, resolver, revocable) triple, but each proxy gets a fresh
        // address, so the label only has to keep repeat callers legible in a trace.
        schema = string.concat(communityTestimonySchema, ",string ", label);
        testimonySchemaOf[address(resolver)] = schema;

        if (pinSchema) {
            resolver.setSchemaUID(keccak256(abi.encodePacked(schema, address(resolver), false)));
        }
    }

    /// @dev The canonical resolver uses the real schema; fixtures use their labelled variant.
    function _testimonySchemaFor(TestimonyResolver resolver) private view returns (string memory) {
        string memory recorded = testimonySchemaOf[address(resolver)];
        return bytes(recorded).length == 0 ? communityTestimonySchema : recorded;
    }

    /// @dev Runs `commitment-schemas` PREPARATION through the same library the deploy script
    ///      broadcasts — not a hand-rolled copy. The first review's headline objection was a
    ///      rehearsal that never ran the deploy script; pinning and activating inline here would
    ///      have reintroduced exactly that one level up.
    function _runPreparation() private {
        (, address schemaRegistry) = _getEASForChain(block.chainid);
        assessmentV3Schema = _generateSchemaString("assessmentV3");
        communityTestimonySchema = _generateSchemaString("communityTestimony");

        CommitmentSchemaLane.PreparationResult memory result = CommitmentSchemaLane.prepare(
            CommitmentSchemaLane.PreparationInputs({
                schemaRegistry: schemaRegistry,
                assessmentResolver: address(assessmentResolver),
                workApprovalResolver: address(workApprovalResolver),
                eas: _easAddress(),
                create2Factory: _create2Factory(),
                assessmentV3Schema: assessmentV3Schema,
                communityTestimonySchema: communityTestimonySchema,
                assessmentEvidence: _assessmentEvidence()
            })
        );

        testimonyResolver = TestimonyResolver(payable(result.testimonyResolver));
        assessmentV3SchemaUID = result.assessmentV3UID;
        communityTestimonySchemaUID = result.communityTestimonyUID;

        assertEq(
            uint256(result.stateOnEntry),
            uint256(CommitmentSchemaRecovery.State.Unprepared),
            "a fresh chain enters preparation Unprepared"
        );
        assertTrue(result.deployedSomething, "preparation must deploy the resolver on a fresh chain");
        assertEq(testimonyResolver.commitmentModule(), address(0), "preparation must leave the resolver inert");
        // Deployment leaves the v2 UID zero — exactly the live Arbitrum state — and the assessment
        // setters belong to `_configureResolvers`, so the step boundary is real.
        assertEq(assessmentResolver.schemaUID(), bytes32(0), "deployment leaves the v2 UID unpinned");
    }

    /// @dev Runs `commitment-schemas --finalize-community-testimony` through the same library the
    ///      deploy script broadcasts.
    function _runFinalization() private {
        (, address schemaRegistry) = _getEASForChain(block.chainid);

        CommitmentSchemaLane.FinalizationResult memory result = CommitmentSchemaLane.finalize(
            CommitmentSchemaLane.FinalizationInputs({
                schemaRegistry: schemaRegistry,
                testimonyResolver: address(testimonyResolver),
                module: address(pooling),
                communityTestimonySchema: communityTestimonySchema
            })
        );

        assertEq(
            uint256(result.stateOnEntry),
            uint256(CommitmentSchemaRecovery.State.Prepared),
            "finalization runs from the prepared state"
        );
        assertTrue(result.registeredRecord, "finalization registers the record");
        assertTrue(result.activated, "finalization activates the resolver");
    }

    /// @dev Mirrors `deploy.ts pooling-configure` by calling the library that target broadcasts,
    ///      rather than a hand-copied sequence. A rehearsal of a copy proves only that the copy
    ///      works; this proves the code an operator will actually run.
    function _configureResolvers() private {
        uint256 written = _configurationTargets().configure(address(this));

        assertEq(written, 3, "a fresh chain must need all three configuration calls");
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

    /// @dev The post-upgrade evidence the deploy script reads out of the artifact. Live-sourced
    ///      here for the same reason the script reads the artifact: the rehearsal's stack is
    ///      deployed fresh, so its v2 UID and KarmaGAP module are whatever `_deployFullStackOnFork`
    ///      left. The mismatch paths are covered by their own negative tests below.
    function _assessmentEvidence() private view returns (CommitmentSchemaLane.AssessmentEvidence memory evidence) {
        evidence.recorded = true;
        evidence.assessmentSchemaUID = assessmentResolver.schemaUID();
        evidence.karmaGAPModule = address(assessmentResolver.karmaGAPModule());
    }

    /// @dev The canonical deterministic-deployment factory, which is what `getDeploymentDefaults()`
    ///      hands the deploy script. Reading it from the network config would drag the whole
    ///      DeployHelper into this test for one address.
    function _create2Factory() private pure returns (address) {
        return 0x4e59b44847b379578588920cA78FbF26c0B4956C;
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

/// @title AssessmentV2Stub
/// @notice The Assessment proxy as it exists BEFORE `upgrade.ts assessment-resolver` runs.
/// @dev A real contract rather than a mock, because the property under test is the ABSENCE of
///      `assessmentV3SchemaUID()` — the thing a mock cannot faithfully represent. Carries the v2
///      state the preflight reads so the capability probe is what fails, not an earlier check.
contract AssessmentV2Stub {
    address public owner;
    bytes32 public schemaUID;
    address public karmaGAPModule;

    constructor(address owner_, bytes32 schemaUID_, address karmaGAPModule_) {
        owner = owner_;
        schemaUID = schemaUID_;
        karmaGAPModule = karmaGAPModule_;
    }
}
