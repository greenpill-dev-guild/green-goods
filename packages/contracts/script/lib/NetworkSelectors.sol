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

        // Read whichever shape arrived, because forge picks it, not this library: `parseJson`
        // infers a type per value, and that inference moved between forge versions. On current
        // stable a quoted selector past 2**63 arrives as a bare 32-byte word — the same encoding
        // an unquoted JSON number produces — while older builds returned an ABI string for both
        // magnitudes. Treating the short encoding as proof of an unquoted entry therefore rejected
        // correctly-quoted config: Sepolia's 16015286601757825753 is in exactly that range, so the
        // settlement lane could not read its own network entry on a current toolchain.
        //
        // Rejecting the unquoted numeric FORM stays enforced, but against the config file's text
        // in `script/utils/pooling-release.test.ts`, where quoting is directly observable and no
        // toolchain sits between the rule and the bytes it judges. Precision is not at stake here:
        // Solidity reads either encoding exactly, and the lossiness this guards against is a
        // TypeScript `JSON.parse` failure mode that only that file-level check can see.
        uint256 parsed;
        if (raw.length >= 64) {
            string memory decoded = abi.decode(raw, (string));
            if (bytes(decoded).length == 0) revert MalformedChainSelector(key);
            parsed = VM.parseUint(decoded);
        } else if (raw.length == 32) {
            parsed = abi.decode(raw, (uint256));
        } else {
            revert MalformedChainSelector(key);
        }

        // Range-checked before narrowing: an unchecked `uint64` cast turns a value that does not
        // fit into a different, valid-looking selector rather than an error — 2^64+1 becomes 1.
        // That contradicts this library's whole contract of failing loud on a malformed entry, and
        // the TypeScript round-trip cannot catch it because the string itself round-trips fine.
        if (parsed > type(uint64).max) revert MalformedChainSelector(key);

        return uint64(parsed);
    }
}

error MalformedChainSelector(string key);
