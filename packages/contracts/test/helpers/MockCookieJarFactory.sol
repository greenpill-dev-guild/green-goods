// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICookieJarFactory } from "../../src/interfaces/ICookieJarFactory.sol";

/// @title MockCookieJarFactory
/// @notice Minimal mock of the 1Hive CookieJarFactory for unit tests
/// @dev Returns deterministic jar addresses based on the config params
contract MockCookieJarFactory {
    uint256 private _jarCount;

    event MockJarCreated(address indexed jarAddress, address indexed jarOwner, address indexed currency);

    function createCookieJar(
        ICookieJarFactory.JarConfig calldata params,
        ICookieJarFactory.AccessConfig calldata,
        ICookieJarFactory.MultiTokenConfig calldata
    )
        external
        returns (address jarAddress)
    {
        _jarCount++;
        // Generate a deterministic address from count + params
        jarAddress = address(uint160(uint256(keccak256(abi.encode(_jarCount, params.jarOwner, params.supportedCurrency)))));
        emit MockJarCreated(jarAddress, params.jarOwner, params.supportedCurrency);
    }

    function getJarCount() external view returns (uint256) {
        return _jarCount;
    }
}
