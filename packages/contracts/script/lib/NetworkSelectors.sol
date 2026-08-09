// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";

/// @title NetworkSelectors
/// @notice The one place a CCIP chain selector is read out of `deployments/networks.json`.
/// @dev Exists because there were two. `DeployHelper.loadNetworkConfig` parsed selectors for
///      deployment code, and `test/fork/CrossChainSettlementLane.t.sol` parsed them again for the
///      lane verification — so a review could mutate the deploy-side parser to return the wrong
///      value and every lane test still passed. Two parsers means the tests verify a selector that
///      deployment code never uses.
///
///      Selectors are stored as base-10 **strings**, never JSON numbers. Both live values exceed
///      JavaScript's safe-integer range (Arbitrum's `4949039107694359620` loses 68 through a plain
///      `JSON.parse`, Celo's `1346049177634351622` loses 6). Solidity would read a JSON number
///      correctly, which is exactly why the corruption was invisible on this side and only showed
///      up for a TypeScript consumer.
library NetworkSelectors {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @notice Selector at `<basePath>.ccipChainSelector`, or 0 when the network declares none.
    /// @dev Zero is a legitimate answer — most networks have no CCIP lane — so a missing key is not
    ///      an error. A key that is present but malformed is: it means the config was hand-edited
    ///      into a shape deployment code cannot read, and returning 0 there would send a message to
    ///      chain selector zero rather than fail. `MalformedChainSelector` separates the two.
    function readCcipChainSelector(string memory json, string memory basePath) internal pure returns (uint64) {
        string memory key = string.concat(basePath, ".ccipChainSelector");

        bytes memory raw;
        try VM.parseJson(json, key) returns (bytes memory data) {
            raw = data;
        } catch {
            return 0;
        }
        if (raw.length == 0) return 0;

        // Shape check before decoding, because a failed `abi.decode` cannot be caught. An
        // ABI-encoded string is at least 64 bytes (32 offset + 32 length); a JSON number decodes
        // to a single 32-byte word. Refusing the short case is what stops a future entry silently
        // reintroducing the lossy numeric format for TypeScript consumers.
        if (raw.length < 64) revert MalformedChainSelector(key);

        string memory decoded = abi.decode(raw, (string));
        if (bytes(decoded).length == 0) revert MalformedChainSelector(key);

        // Range-checked before narrowing: an unchecked `uint64` cast turns a value that does not
        // fit into a different, valid-looking selector rather than an error — 2^64+1 becomes 1.
        // That contradicts this library's whole contract of failing loud on a malformed entry, and
        // the TypeScript round-trip cannot catch it because the string itself round-trips fine.
        uint256 parsed = VM.parseUint(decoded);
        if (parsed > type(uint64).max) revert MalformedChainSelector(key);

        return uint64(parsed);
    }
}

error MalformedChainSelector(string key);
