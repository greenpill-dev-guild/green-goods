// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CookieJarForkTestBase } from "./helpers/CookieJarForkTestBase.sol";

contract SepoliaCookieJarForkTest is CookieJarForkTestBase {
    function _rpcEnvVar() internal pure override returns (string memory) {
        return "SEPOLIA_RPC_URL";
    }
}
