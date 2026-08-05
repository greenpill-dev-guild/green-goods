// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentRegistry } from "../../src/registries/Commitment.sol";
import { ActionRegistry, Capital, Domain } from "../../src/registries/Action.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockHatsModule } from "./MockHatsModule.sol";

interface IOwnableCommitmentPoolingModule is ICommitmentPoolingModule {
    function owner() external view returns (address);
    function nextPoolId() external view returns (uint256);
    function nextCycleId() external view returns (uint256);
    function nextCommitmentId() external view returns (uint256);
    function nextCommitmentSeriesId() external view returns (uint256);
}

/// @notice Selector-compatible decision-sequence mock for production-path pooling tests.
contract MockWorkDecisionResolver {
    mapping(bytes32 workUID => uint64 sequence) public latestDecisionSequence;
    mapping(bytes32 decisionUID => uint64 sequence) public decisionSequenceByUID;

    function setLatestDecisionSequence(bytes32 workUID, uint64 sequence) external {
        latestDecisionSequence[workUID] = sequence;
    }

    function setDecisionSequence(bytes32 decisionUID, uint64 sequence) external {
        decisionSequenceByUID[decisionUID] = sequence;
    }
}

/// @notice Real dependency fixture for PRD-721 module behavior and gas measurements.
abstract contract CommitmentPoolingFixture is Test {
    address internal constant ROOT_GARDEN = address(0xBEEF);
    address internal constant POOL_GARDEN = address(0xCAFE);
    address internal constant CREATOR = address(0xA11CE);
    address internal constant CLAIMANT = address(0xB0B);
    address internal constant EVALUATOR = address(0xE0A1);
    address internal constant GARDEN_TOKEN = address(0x600D);

    bytes32 internal constant WORK_SCHEMA_UID = bytes32(uint256(101));
    bytes32 internal constant WORK_APPROVAL_SCHEMA_UID = bytes32(uint256(102));
    bytes32 internal constant LEGACY_ASSESSMENT_SCHEMA_UID = bytes32(uint256(103));
    bytes32 internal constant ASSESSMENT_V3_SCHEMA_UID = bytes32(uint256(104));

    IOwnableCommitmentPoolingModule internal module;
    CommitmentRegistry internal registry;
    ActionRegistry internal actions;
    MockHatsModule internal hats;
    MockEAS internal mockEAS;
    MockWorkDecisionResolver internal decisionResolver;
    uint256 internal poolId;

    function _setUpProductionFixture() internal {
        hats = new MockHatsModule();
        mockEAS = new MockEAS();
        decisionResolver = new MockWorkDecisionResolver();

        ActionRegistry actionImplementation = new ActionRegistry();
        actions = ActionRegistry(
            address(
                new ERC1967Proxy(
                    address(actionImplementation), abi.encodeWithSelector(ActionRegistry.initialize.selector, address(this))
                )
            )
        );

        address moduleImplementation = deployCode("CommitmentPooling.sol:CommitmentPoolingModule");
        module = IOwnableCommitmentPoolingModule(
            address(
                new ERC1967Proxy(
                    moduleImplementation,
                    abi.encodeWithSelector(ICommitmentPoolingModule.initialize.selector, address(this), ROOT_GARDEN)
                )
            )
        );

        CommitmentRegistry registryImplementation = new CommitmentRegistry();
        registry = CommitmentRegistry(
            address(
                new ERC1967Proxy(
                    address(registryImplementation),
                    abi.encodeWithSelector(CommitmentRegistry.initialize.selector, address(this), address(module))
                )
            )
        );

        module.setGardenToken(GARDEN_TOKEN);
        module.setHatsModule(address(hats));
        module.setActionRegistry(address(actions));
        module.setCommitmentRegistry(address(registry));
        module.setWorkApprovalResolver(address(decisionResolver));
        module.setEAS(address(mockEAS));
        module.setSchemaUIDs(
            WORK_SCHEMA_UID, WORK_APPROVAL_SCHEMA_UID, LEGACY_ASSESSMENT_SCHEMA_UID, ASSESSMENT_V3_SCHEMA_UID
        );
        module.setPaused(false);

        hats.setGardener(POOL_GARDEN, CREATOR, true);
        hats.setGardener(POOL_GARDEN, CLAIMANT, true);
        hats.setEvaluator(POOL_GARDEN, EVALUATOR, true);

        poolId = module.registerPool(POOL_GARDEN, ICommitmentPoolingModule.PoolType.Garden);
        module.setProviderOpenCommitmentCap(poolId, 128);
        module.setPoolCharter(poolId, "bafy-charter");
        module.markPoolReady(poolId);
        module.openPool(poolId);
    }

    function _registerActions(uint256 count) internal {
        Capital[] memory capitals = new Capital[](0);
        string[] memory media = new string[](0);
        for (uint256 i = 0; i < count; i++) {
            actions.registerAction(
                block.timestamp,
                block.timestamp + 30 days,
                string.concat("Action ", vm.toString(i)),
                string.concat("action-", vm.toString(i)),
                "bafy-instructions",
                capitals,
                media,
                Domain(i % 4)
            );
        }
    }

    function _baseParams(bytes32 creationKey)
        internal
        view
        returns (ICommitmentPoolingModule.CreateCommitmentParams memory params)
    {
        params.poolId = poolId;
        params.creationRequestKey = creationKey;
        params.direction = ICommitmentPoolingModule.CommitmentDirection.Offer;
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.SupportService;
        params.claimType = ICommitmentPoolingModule.ClaimType.Individual;
        params.claimMode = ICommitmentPoolingModule.ClaimMode.Open;
        params.contributorPolicy = ICommitmentPoolingModule.ContributorPolicy.LeadManaged;
        params.unitLabel = "hours";
        params.targetUnits = 1;
        params.metadataCID = "bafy-commitment";
        params.reward = ICommitmentPoolingModule.DeclaredReward({
            rail: ICommitmentPoolingModule.RewardRail.None,
            source: address(0),
            token: address(0),
            amount: 0
        });
    }

    function _createOffer(bytes32 creationKey) internal returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        vm.prank(CREATOR);
        return module.createCommitment(params);
    }

    function _acceptOffer(uint256 commitmentId) internal {
        vm.prank(CLAIMANT);
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
    }

    function _setMember(address account) internal {
        hats.setGardener(POOL_GARDEN, account, true);
    }

    function _setWorkAttestation(bytes32 workUID, address contributor, uint256 actionUID) internal {
        string[] memory media = new string[](0);
        mockEAS.setAttestationByUID(
            workUID,
            Attestation({
                uid: workUID,
                schema: WORK_SCHEMA_UID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: POOL_GARDEN,
                attester: contributor,
                revocable: false,
                data: abi.encode(actionUID, "Work", "", "bafy-work", media)
            })
        );
    }
}
