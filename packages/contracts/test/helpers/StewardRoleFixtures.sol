// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

contract StewardRoleFixture {
    mapping(address => bool) public stewards;
    bool public configured = true;
    bool public unavailable;
    uint256 public stewardHat = 2;

    function setUnavailable(bool value) external {
        unavailable = value;
    }

    function changeHat(uint256 value) external {
        stewardHat = value;
    }

    function set(address member, bool eligible) external {
        stewards[member] = eligible;
    }

    function isStewardOf(address, address member) external view returns (bool) {
        require(!unavailable, "authority unavailable");
        return stewards[member];
    }

    function getGardenHatIds(address)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool)
    {
        return (1, stewardHat, 3, 4, 5, 6, 7, configured);
    }

    function deconfigure() external {
        configured = false;
    }
}

contract StewardRouterFixture {
    bytes public lastData;
    bytes public lastReceiver;
    uint256 public sends;
    bool public broken;

    function setBroken(bool value) external {
        broken = value;
    }

    function getFee(uint64, Client.EVM2AnyMessage calldata) external pure returns (uint256) {
        return 10;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata m) external payable returns (bytes32) {
        require(!broken, "transport down");
        require(msg.value == 10, "fee");
        lastData = m.data;
        lastReceiver = m.receiver;
        return bytes32(++sends);
    }
}
