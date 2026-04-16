// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Attestation } from "@eas/IEAS.sol";

import { MockEAS } from "../../src/mocks/EAS.sol";
import { WorkAttestationValidator } from "../../src/validators/WorkAttestationValidator.sol";

contract WorkAttestationValidatorTest is Test {
    MockEAS internal eas;
    WorkAttestationValidator internal validator;

    bytes32 internal constant WORK_SCHEMA_UID = keccak256("WORK_SCHEMA_UID");
    bytes32 internal constant WRONG_SCHEMA_UID = keccak256("WRONG_SCHEMA_UID");
    bytes32 internal constant WORK_UID = keccak256("WORK_UID");

    address internal constant CLAIMANT = address(0xCA11AB1E);
    address internal constant OTHER_ATTESTER = address(0x0B0B);
    address internal constant GARDEN = address(0x600D);

    function setUp() public {
        eas = new MockEAS();
        validator = new WorkAttestationValidator(address(eas), WORK_SCHEMA_UID);
    }

    function test_validate_returnsUidForValidAttestation() public {
        _setAttestation(WORK_UID, WORK_SCHEMA_UID, CLAIMANT);

        bytes32 sourceRef = validator.validate(CLAIMANT, abi.encode(WORK_UID));
        assertEq(sourceRef, WORK_UID);
    }

    function test_validate_revertsWhenAttestationMissing() public {
        vm.expectRevert(abi.encodeWithSelector(WorkAttestationValidator.AttestationNotFound.selector, WORK_UID));
        validator.validate(CLAIMANT, abi.encode(WORK_UID));
    }

    function test_validate_revertsForWrongSchema() public {
        _setAttestation(WORK_UID, WRONG_SCHEMA_UID, CLAIMANT);

        vm.expectRevert(
            abi.encodeWithSelector(
                WorkAttestationValidator.InvalidAttestationSchema.selector, WORK_UID, WORK_SCHEMA_UID, WRONG_SCHEMA_UID
            )
        );
        validator.validate(CLAIMANT, abi.encode(WORK_UID));
    }

    function test_validate_revertsForWrongAttester() public {
        _setAttestation(WORK_UID, WORK_SCHEMA_UID, OTHER_ATTESTER);

        vm.expectRevert(
            abi.encodeWithSelector(WorkAttestationValidator.InvalidAttester.selector, WORK_UID, CLAIMANT, OTHER_ATTESTER)
        );
        validator.validate(CLAIMANT, abi.encode(WORK_UID));
    }

    function _setAttestation(bytes32 uid, bytes32 schemaUID, address attester) internal {
        eas.setAttestationByUID(
            uid,
            Attestation({
                uid: uid,
                schema: schemaUID,
                time: uint64(block.timestamp),
                expirationTime: 0,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: GARDEN,
                attester: attester,
                revocable: true,
                data: abi.encode("work")
            })
        );
    }
}
