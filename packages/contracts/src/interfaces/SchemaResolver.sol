// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Attestation, IEAS } from "./IEAS.sol";

abstract contract SchemaResolver {
    IEAS internal immutable _eas;
    
    constructor(IEAS eas) {
        _eas = eas;
    }
    
    function isPayable() public pure virtual returns (bool);
    
    function attest(Attestation calldata attestation, uint256 value) external payable returns (bool) {
        return onAttest(attestation, value);
    }
    
    function revoke(Attestation calldata attestation, uint256 value) external payable returns (bool) {
        return onRevoke(attestation, value);
    }
    
    function onAttest(Attestation calldata attestation, uint256 value) internal virtual returns (bool);
    
    function onRevoke(Attestation calldata attestation, uint256 value) internal virtual returns (bool);
} 