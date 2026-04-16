// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { GenesisHatValidator } from "../../src/validators/GenesisHatValidator.sol";
import { MockHats } from "../../src/mocks/Hats.sol";

contract GenesisHatValidatorTest is Test {
    MockHats internal hats;
    GenesisHatValidator internal validator;

    uint256 internal constant PROTOCOL_HAT_ID = 42;

    address internal constant ELIGIBLE = address(0xA11CE);
    address internal constant INELIGIBLE = address(0xB0B);

    function setUp() public {
        hats = new MockHats();
        hats.setHatActive(PROTOCOL_HAT_ID, true);
        hats.setWearer(PROTOCOL_HAT_ID, ELIGIBLE, true);

        validator = new GenesisHatValidator(address(hats), PROTOCOL_HAT_ID);
    }

    function test_validate_returnsHatIdForEligibleWearer() public {
        bytes32 sourceRef = validator.validate(ELIGIBLE, "");
        assertEq(sourceRef, bytes32(PROTOCOL_HAT_ID));
    }

    function test_validate_revertsForIneligibleWearer() public {
        vm.expectRevert(abi.encodeWithSelector(GenesisHatValidator.NotHatWearer.selector, INELIGIBLE, PROTOCOL_HAT_ID));
        validator.validate(INELIGIBLE, "");
    }
}
