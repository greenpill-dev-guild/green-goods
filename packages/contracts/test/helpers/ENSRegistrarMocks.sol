// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @dev Records what was sent to L1, so a test can read the payload the receiver would get.
contract RecordingCCIPRouter {
    bytes[] public payloads;
    address[] public receivers;
    uint256 public fee;

    constructor(uint256 fee_) {
        fee = fee_;
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external view returns (uint256) {
        return fee;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        require(msg.value == fee, "router must receive exactly the fee");
        payloads.push(message.data);
        receivers.push(abi.decode(message.receiver, (address)));
        return keccak256(abi.encode(payloads.length));
    }

    function count() external view returns (uint256) {
        return payloads.length;
    }

    function setFee(uint256 fee_) external {
        fee = fee_;
    }
}
