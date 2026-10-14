// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";

import { ICommitmentPoolingModule } from "../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "./helpers/CommitmentPoolingFixture.sol";

/// @notice Shared recorder for PRD-721 cold-transaction production-path measurements.
/// @dev Foundry invokes setUp separately before each test transaction. Every concrete case prepares
///      state in setUp and measures exactly one subsequent module call with a fresh access list.
abstract contract CommitmentPoolingBoundCase is CommitmentPoolingFixture {
    uint256 private constant TRANSACTION_GAS_CEILING = 10_000_000;
    uint256 private constant MEASURED_EVENT_DATA_CEILING = 16_384;

    function _size() internal pure virtual returns (uint256);

    function _record(string memory bound, string memory operation, uint256 gasUsed, uint256 payloadBytes) internal {
        string memory size = vm.toString(_size());
        string memory prefix = string.concat(bound, "/", size, "/", operation);
        emit log_named_uint(string.concat(prefix, "/gas"), gasUsed);
        emit log_named_uint(string.concat(prefix, "/payload-bytes"), payloadBytes);
        vm.writeFile(
            string.concat(".generated/commitment-pooling-bounds-", bound, "-", size, "-", operation, ".csv"),
            string.concat(bound, ",", size, ",", operation, ",", vm.toString(gasUsed), ",", vm.toString(payloadBytes), "\n")
        );
        assertGt(gasUsed, 0, string.concat(prefix, "/empty-production-path"));
        assertLt(gasUsed, TRANSACTION_GAS_CEILING, string.concat(prefix, "/transaction-unsafe"));
        assertLe(
            payloadBytes,
            MEASURED_EVENT_DATA_CEILING,
            string.concat(prefix, "/measured-canonical-fixture-event-payload-unsafe")
        );
    }

    function _largestModuleEventData(Vm.Log[] memory logs) internal view returns (uint256 largest) {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(module) && logs[i].data.length > largest) largest = logs[i].data.length;
        }
    }

    function _requirementsParams(bytes32 key)
        internal
        view
        returns (ICommitmentPoolingModule.CreateCommitmentParams memory params)
    {
        uint256 size = _size();
        params = _baseParams(key);
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](size);
        for (uint256 i = 0; i < size; i++) {
            params.requirements[i] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: i, requiredCount: 1 });
        }
    }

    function _addFullContributorRoster(uint256 commitmentId, uint256 prefix) internal {
        for (uint256 i = 1; i < _size(); i++) {
            address contributor = address(uint160(prefix + i));
            _setMember(contributor);
            vm.prank(CREATOR);
            module.addContributor(commitmentId, contributor);
        }
    }

    function _creditedRoster(uint256 prefix) internal pure returns (address[] memory credited) {
        credited = new address[](_size());
        credited[0] = CREATOR;
        for (uint256 i = 1; i < _size(); i++) {
            credited[i] = address(uint160(prefix + i));
        }
    }

    function _attachFullRosterEvidence(uint256 commitmentId, uint256 prefix) internal {
        address[] memory credited = _creditedRoster(prefix);
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafybeihcommitmentpoolingcanonicalevidencepayload", credited);
    }

    function _confirmerParams(
        bytes32 key,
        uint32 threshold
    )
        internal
        view
        returns (ICommitmentPoolingModule.CreateCommitmentParams memory params)
    {
        params = _baseParams(key);
        params.confirmers = new address[](_size());
        params.confirmationThreshold = threshold;
        for (uint256 i = 0; i < _size(); i++) {
            params.confirmers[i] = address(uint160(0x3000 + i));
        }
    }
}

abstract contract RequirementsCreateBoundCase is CommitmentPoolingBoundCase {
    function setUp() public {
        _setUpProductionFixture();
        _registerActions(_size());
    }

    function testColdRequirementsCreate() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _requirementsParams(keccak256(abi.encode("requirements-create", _size())));
        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.createCommitment(params);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_REQUIREMENTS", "create", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract RequirementsReplayBoundCase is CommitmentPoolingBoundCase {
    bytes32 private creationKey;

    function setUp() public {
        _setUpProductionFixture();
        _registerActions(_size());
        creationKey = keccak256(abi.encode("requirements-replay", _size()));
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _requirementsParams(creationKey);
        vm.prank(CREATOR);
        module.createCommitment(params);
    }

    function testColdRequirementsReplay() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _requirementsParams(creationKey);
        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.createCommitment(params);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_REQUIREMENTS", "replay", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract RequirementsApprovalBoundCase is CommitmentPoolingBoundCase {
    bytes32 private finalWorkUID;
    bytes32 private finalApprovalUID;

    function setUp() public {
        _setUpProductionFixture();
        _registerActions(_size());
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _requirementsParams(keccak256(abi.encode("requirements-approval", _size())));
        vm.prank(CREATOR);
        uint256 commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);

        for (uint256 i = 0; i < _size(); i++) {
            bytes32 workUID = keccak256(abi.encode("requirement-work", _size(), i));
            bytes32 approvalUID = keccak256(abi.encode("requirement-approval", _size(), i));
            _setWorkAttestation(workUID, CREATOR, i);
            vm.prank(CREATOR);
            module.linkWork(commitmentId, workUID, uint16(i), keccak256(abi.encode("requirement-link", _size(), i)));
            decisionResolver.setLatestDecisionSequence(workUID, 1);
            decisionResolver.setDecisionSequence(approvalUID, 1);
            _setApprovalAttestation(approvalUID, workUID, i, true);
            if (i + 1 == _size()) {
                finalWorkUID = workUID;
                finalApprovalUID = approvalUID;
            } else {
                vm.prank(address(decisionResolver));
                module.onWorkDecision(workUID, approvalUID, 1, POOL_GARDEN, true);
            }
        }
    }

    function testColdRequirementsApprovalAndReadyEvaluation() public {
        vm.recordLogs();
        vm.prank(address(decisionResolver));
        uint256 gasBefore = gasleft();
        module.onWorkDecision(finalWorkUID, finalApprovalUID, 1, POOL_GARDEN, true);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_REQUIREMENTS", "approval-ready", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract LinkedWorkAddBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;
    bytes32 private finalWorkUID;
    bytes32 private finalOperationKey;

    function setUp() public {
        _setUpProductionFixture();
        commitmentId = _createOffer(keccak256(abi.encode("linked-work-add", _size())));
        _acceptOffer(commitmentId);
        for (uint256 i = 0; i < _size(); i++) {
            bytes32 workUID = keccak256(abi.encode("linked-work-add", _size(), i));
            _setWorkAttestation(workUID, CREATOR, 0);
            if (i + 1 == _size()) {
                finalWorkUID = workUID;
                finalOperationKey = keccak256(abi.encode("linked-work-add-operation", _size(), i));
            } else {
                vm.prank(CREATOR);
                module.linkWork(commitmentId, workUID, 0, keccak256(abi.encode("linked-work-add-operation", _size(), i)));
            }
        }
    }

    function testColdFinalLinkedWork() public {
        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.linkWork(commitmentId, finalWorkUID, 0, finalOperationKey);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_LINKED_WORKS_PER_COMMITMENT", "link", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract LinkedWorkFreezeBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;

    function setUp() public {
        _setUpProductionFixture();
        commitmentId = _createOffer(keccak256(abi.encode("linked-work-freeze", _size())));
        _acceptOffer(commitmentId);
        for (uint256 i = 0; i < _size(); i++) {
            bytes32 workUID = keccak256(abi.encode("linked-work-freeze", _size(), i));
            _setWorkAttestation(workUID, CREATOR, 0);
            vm.prank(CREATOR);
            module.linkWork(commitmentId, workUID, 0, keccak256(abi.encode("linked-work-freeze-operation", _size(), i)));
        }
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-linked-work-freeze-credit", credited);
    }

    function testColdLinkedWorkFreshnessFreeze() public {
        vm.recordLogs();
        uint256 gasBefore = gasleft();
        module.markReadyForConfirmation(commitmentId, "bounded freshness scan");
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_LINKED_WORKS_PER_COMMITMENT", "freeze", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract ContributorAddBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;
    address private finalContributor;

    function setUp() public {
        _setUpProductionFixture();
        commitmentId = _createOffer(keccak256(abi.encode("contributor-add", _size())));
        _acceptOffer(commitmentId);
        for (uint256 i = 1; i + 1 < _size(); i++) {
            address contributor = address(uint160(0x1000 + i));
            _setMember(contributor);
            vm.prank(CREATOR);
            module.addContributor(commitmentId, contributor);
        }
        finalContributor = address(uint160(0x1000 + _size() - 1));
        _setMember(finalContributor);
    }

    function testColdFinalContributorAdd() public {
        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.addContributor(commitmentId, finalContributor);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONTRIBUTORS_PER_COMMITMENT", "add", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract ContributorEvidenceBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;

    function setUp() public {
        _setUpProductionFixture();
        commitmentId = _createOffer(keccak256(abi.encode("contributor-evidence", _size())));
        _acceptOffer(commitmentId);
        _addFullContributorRoster(commitmentId, 0x1000);
    }

    function testColdFullRosterEvidence() public {
        address[] memory credited = _creditedRoster(0x1000);
        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.attachEvidence(commitmentId, "bafybeihcommitmentpoolingcanonicalevidencepayload", credited);
        uint256 gasUsed = gasBefore - gasleft();
        uint256 payloadBytes = _largestModuleEventData(vm.getRecordedLogs());
        _record("MAX_CONTRIBUTORS_PER_COMMITMENT", "evidence", gasUsed, payloadBytes);
        _record("MAX_EVIDENCE_CONTRIBUTORS_PER_ATTACHMENT", "attach", gasUsed, payloadBytes);
    }
}

abstract contract ContributorReadyBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;

    function setUp() public {
        _setUpProductionFixture();
        commitmentId = _createOffer(keccak256(abi.encode("contributor-ready", _size())));
        _acceptOffer(commitmentId);
        _addFullContributorRoster(commitmentId, 0x1000);
        _attachFullRosterEvidence(commitmentId, 0x1000);
    }

    function testColdFullRosterReady() public {
        vm.recordLogs();
        uint256 gasBefore = gasleft();
        module.markReadyForConfirmation(commitmentId, "bounded contributor finalization");
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONTRIBUTORS_PER_COMMITMENT", "ready", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract ContributorConfirmBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;

    function setUp() public {
        _setUpProductionFixture();
        commitmentId = _createOffer(keccak256(abi.encode("contributor-confirm", _size())));
        _acceptOffer(commitmentId);
        _addFullContributorRoster(commitmentId, 0x1000);
        _attachFullRosterEvidence(commitmentId, 0x1000);
        module.markReadyForConfirmation(commitmentId, "bounded contributor finalization");
    }

    function testColdFullRosterConfirmation() public {
        vm.recordLogs();
        vm.prank(CLAIMANT);
        uint256 gasBefore = gasleft();
        module.confirmFulfillment(commitmentId);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONTRIBUTORS_PER_COMMITMENT", "confirm", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract ConfirmerCreateBoundCase is CommitmentPoolingBoundCase {
    function setUp() public {
        _setUpProductionFixture();
    }

    function testColdConfirmerRuleCreate() public {
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _confirmerParams(keccak256(abi.encode("confirmer-create", _size())), uint32(_size()));
        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.createCommitment(params);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONFIRMERS", "create", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract ConfirmerAcceptBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;

    function setUp() public {
        _setUpProductionFixture();
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _confirmerParams(keccak256(abi.encode("confirmer-accept", _size())), uint32(_size()));
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
    }

    function testColdConfirmerAcceptanceNormalization() public {
        vm.recordLogs();
        vm.prank(CLAIMANT);
        uint256 gasBefore = gasleft();
        module.claimCommitment(commitmentId, ICommitmentPoolingModule.ClaimType.Individual, POOL_GARDEN);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONFIRMERS", "accept", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

abstract contract ConfirmerRosterBoundCase is CommitmentPoolingBoundCase {
    uint256 private commitmentId;
    address private rosterCandidate;

    function setUp() public {
        _setUpProductionFixture();
        ICommitmentPoolingModule.CreateCommitmentParams memory params =
            _confirmerParams(keccak256(abi.encode("confirmer-roster", _size())), uint32(_size() - 1));
        rosterCandidate = params.confirmers[0];
        _setMember(rosterCandidate);
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);
    }

    function testColdConfirmerRosterRevalidation() public {
        vm.recordLogs();
        vm.prank(CREATOR);
        uint256 gasBefore = gasleft();
        module.addContributor(commitmentId, rosterCandidate);
        uint256 gasUsed = gasBefore - gasleft();
        _record("MAX_CONFIRMERS", "roster", gasUsed, _largestModuleEventData(vm.getRecordedLogs()));
    }
}

contract RequirementsCreate8Test is RequirementsCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract RequirementsCreate16Test is RequirementsCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract RequirementsCreate24Test is RequirementsCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract RequirementsCreate32Test is RequirementsCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract RequirementsCreate40Test is RequirementsCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract RequirementsReplay8Test is RequirementsReplayBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract RequirementsReplay16Test is RequirementsReplayBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract RequirementsReplay24Test is RequirementsReplayBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract RequirementsReplay32Test is RequirementsReplayBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract RequirementsReplay40Test is RequirementsReplayBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract RequirementsApproval8Test is RequirementsApprovalBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract RequirementsApproval16Test is RequirementsApprovalBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract RequirementsApproval24Test is RequirementsApprovalBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract RequirementsApproval32Test is RequirementsApprovalBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract RequirementsApproval40Test is RequirementsApprovalBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract LinkedWorkAdd8Test is LinkedWorkAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract LinkedWorkAdd16Test is LinkedWorkAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract LinkedWorkAdd24Test is LinkedWorkAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract LinkedWorkAdd32Test is LinkedWorkAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract LinkedWorkAdd40Test is LinkedWorkAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract LinkedWorkFreeze8Test is LinkedWorkFreezeBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract LinkedWorkFreeze16Test is LinkedWorkFreezeBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract LinkedWorkFreeze24Test is LinkedWorkFreezeBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract LinkedWorkFreeze32Test is LinkedWorkFreezeBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract LinkedWorkFreeze40Test is LinkedWorkFreezeBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract ContributorAdd8Test is ContributorAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract ContributorAdd16Test is ContributorAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract ContributorAdd24Test is ContributorAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract ContributorAdd32Test is ContributorAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract ContributorAdd40Test is ContributorAddBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract ContributorEvidence8Test is ContributorEvidenceBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract ContributorEvidence16Test is ContributorEvidenceBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract ContributorEvidence24Test is ContributorEvidenceBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract ContributorEvidence32Test is ContributorEvidenceBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract ContributorEvidence40Test is ContributorEvidenceBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract ContributorReady8Test is ContributorReadyBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract ContributorReady16Test is ContributorReadyBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract ContributorReady24Test is ContributorReadyBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract ContributorReady32Test is ContributorReadyBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract ContributorReady40Test is ContributorReadyBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract ContributorConfirm8Test is ContributorConfirmBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract ContributorConfirm16Test is ContributorConfirmBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract ContributorConfirm24Test is ContributorConfirmBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract ContributorConfirm32Test is ContributorConfirmBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract ContributorConfirm40Test is ContributorConfirmBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract ConfirmerCreate8Test is ConfirmerCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract ConfirmerCreate16Test is ConfirmerCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract ConfirmerCreate24Test is ConfirmerCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract ConfirmerCreate32Test is ConfirmerCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract ConfirmerCreate40Test is ConfirmerCreateBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract ConfirmerAccept8Test is ConfirmerAcceptBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract ConfirmerAccept16Test is ConfirmerAcceptBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract ConfirmerAccept24Test is ConfirmerAcceptBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract ConfirmerAccept32Test is ConfirmerAcceptBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract ConfirmerAccept40Test is ConfirmerAcceptBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}

contract ConfirmerRoster8Test is ConfirmerRosterBoundCase {
    function _size() internal pure override returns (uint256) {
        return 8;
    }
}

contract ConfirmerRoster16Test is ConfirmerRosterBoundCase {
    function _size() internal pure override returns (uint256) {
        return 16;
    }
}

contract ConfirmerRoster24Test is ConfirmerRosterBoundCase {
    function _size() internal pure override returns (uint256) {
        return 24;
    }
}

contract ConfirmerRoster32Test is ConfirmerRosterBoundCase {
    function _size() internal pure override returns (uint256) {
        return 32;
    }
}

contract ConfirmerRoster40Test is ConfirmerRosterBoundCase {
    function _size() internal pure override returns (uint256) {
        return 40;
    }
}
