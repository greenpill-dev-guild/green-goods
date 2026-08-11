// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { CommitmentSchemaLane } from "../../script/lib/CommitmentSchemaLane.sol";
import { AssessmentResolver } from "../../src/resolvers/Assessment.sol";
import { TestimonyResolver } from "../../src/resolvers/Testimony.sol";

contract PausedAssessmentDependent {
    address public immutable owner;
    bool public paused = true;
    bytes32 public assessmentV2SchemaUID;
    bytes32 public assessmentV3SchemaUID;

    constructor(address owner_) {
        owner = owner_;
    }

    function configureAssessmentSchemas(bytes32 v2UID, bytes32 v3UID) external {
        require(msg.sender == owner, "owner");
        assessmentV2SchemaUID = v2UID;
        assessmentV3SchemaUID = v3UID;
    }
}

/// @title ArbitrumAssessmentReleaseSequenceForkTest
/// @notice One-state rehearsal of the live AssessmentResolver upgrade and every dependent schema
///         boundary that must follow it before the paused pooling release may proceed.
contract ArbitrumAssessmentReleaseSequenceForkTest is Test {
    address internal constant EAS = 0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458;
    address internal constant SCHEMA_REGISTRY = 0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB;
    address internal constant RELEASE_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    address internal constant ASSESSMENT_PROXY = 0x0646B09bcf3993F02957651354dC267c450CFE58;
    address internal constant WORK_APPROVAL_PROXY = 0x166732eD81Ab200A099215cF33F6A712309B69F7;

    bytes32 internal constant ASSESSMENT_V2_UID = 0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93;
    string internal constant ASSESSMENT_V3_SCHEMA = "string title,string description,string assessmentConfigCID,"
        "uint8 domain,uint256 startDate,uint256 endDate,string location,uint8 assessmentKind,uint256 cycleId,"
        "bytes32 baselineUID";
    string internal constant COMMUNITY_TESTIMONY_SCHEMA = "uint256 commitmentId,string title,string testimonyCID";

    function testIntegration_AssessmentResolver_liveUpgradeV2PinSchemaPreparationAndPausedDependencyShareOneForkState()
        public
    {
        assertEq(block.chainid, 42_161, "requires the Bun-wrapped Arbitrum process fork");
        AssessmentResolver resolver = AssessmentResolver(payable(ASSESSMENT_PROXY));
        address owner = resolver.owner();
        address preservedKarmaGap = address(resolver.karmaGAPModule());
        bytes32 preUpgradeV2UID = resolver.schemaUID();
        assertTrue(
            preUpgradeV2UID == bytes32(0) || preUpgradeV2UID == ASSESSMENT_V2_UID,
            "live AssessmentResolver has a conflicting v2 UID"
        );

        AssessmentResolver targetImplementation = new AssessmentResolver(EAS);
        vm.prank(owner);
        UUPSUpgradeable(ASSESSMENT_PROXY).upgradeTo(address(targetImplementation));
        assertEq(resolver.owner(), owner, "upgrade must preserve owner");
        assertEq(address(resolver.karmaGAPModule()), preservedKarmaGap, "upgrade must preserve Karma GAP");
        assertEq(resolver.assessmentV3SchemaUID(), bytes32(0), "v3 must be unset before preparation");

        if (preUpgradeV2UID == bytes32(0)) {
            vm.prank(owner);
            resolver.setSchemaUID(ASSESSMENT_V2_UID);
        }
        assertEq(resolver.schemaUID(), ASSESSMENT_V2_UID, "v2 must be pinned before schema preparation");

        vm.startPrank(owner);
        CommitmentSchemaLane.PreparationResult memory prepared = CommitmentSchemaLane.prepare(
            CommitmentSchemaLane.PreparationInputs({
                schemaRegistry: SCHEMA_REGISTRY,
                assessmentResolver: ASSESSMENT_PROXY,
                workApprovalResolver: WORK_APPROVAL_PROXY,
                eas: EAS,
                create2Factory: RELEASE_CREATE2_FACTORY,
                assessmentV3Schema: ASSESSMENT_V3_SCHEMA,
                communityTestimonySchema: COMMUNITY_TESTIMONY_SCHEMA,
                assessmentEvidence: CommitmentSchemaLane.AssessmentEvidence({
                    recorded: true,
                    assessmentSchemaUID: ASSESSMENT_V2_UID,
                    karmaGAPModule: preservedKarmaGap
                })
            })
        );

        PausedAssessmentDependent dependent = new PausedAssessmentDependent(owner);
        dependent.configureAssessmentSchemas(ASSESSMENT_V2_UID, prepared.assessmentV3UID);
        resolver.setAssessmentV3SchemaUID(prepared.assessmentV3UID);
        CommitmentSchemaLane.finalize(
            CommitmentSchemaLane.FinalizationInputs({
                schemaRegistry: SCHEMA_REGISTRY,
                testimonyResolver: prepared.testimonyResolver,
                module: address(dependent),
                communityTestimonySchema: COMMUNITY_TESTIMONY_SCHEMA
            })
        );
        vm.stopPrank();

        assertTrue(dependent.paused(), "dependent release candidate must remain paused");
        assertEq(dependent.assessmentV2SchemaUID(), ASSESSMENT_V2_UID, "dependent v2 UID drift");
        assertEq(dependent.assessmentV3SchemaUID(), prepared.assessmentV3UID, "dependent v3 UID drift");
        assertEq(resolver.schemaUID(), ASSESSMENT_V2_UID, "v2 must survive additive v3 activation");
        assertEq(resolver.assessmentV3SchemaUID(), prepared.assessmentV3UID, "v3 UID must activate exactly");
        assertEq(
            TestimonyResolver(payable(prepared.testimonyResolver)).commitmentModule(),
            address(dependent),
            "testimony finalization must bind the verified paused dependency"
        );
    }
}
