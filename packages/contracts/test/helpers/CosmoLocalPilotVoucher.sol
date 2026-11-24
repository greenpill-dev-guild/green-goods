// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { MockERC20 } from "../../src/mocks/ERC20.sol";

/// @dev Six-decimal financial fixture only. No CLC bytecode, issuer authority or service proof.
contract CosmoLocalPilotVoucher is MockERC20 {
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
