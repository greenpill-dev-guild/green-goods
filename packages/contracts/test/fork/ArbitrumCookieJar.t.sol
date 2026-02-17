// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { CookieJarForkTestBase } from "./helpers/CookieJarForkTestBase.sol";

contract ArbitrumCookieJarForkTest is CookieJarForkTestBase {
    function _rpcEnvVar() internal pure override returns (string memory) {
        return "ARBITRUM_RPC_URL";
    }
}
