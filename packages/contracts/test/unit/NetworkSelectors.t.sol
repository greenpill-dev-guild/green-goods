// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import { MalformedChainSelector, NetworkSelectors } from "../../script/lib/NetworkSelectors.sol";

/// @title NetworkSelectorsTest
/// @notice The shapes `deployments/networks.json` can present a CCIP selector in, and which of them
///         are allowed to produce a number.
/// @dev The library's contract is "fail loud on anything malformed, return 0 only for genuinely
///      absent". That contract had one hole: an in-range-looking value that does not fit `uint64`
///      was silently truncated by the narrowing cast, so `2**64 + 1` came back as `1` — a valid
///      selector, pointing at the wrong chain. A round-trip test on the TypeScript side cannot see
///      it, because the string round-trips perfectly; only the cast loses.
contract NetworkSelectorsTest is Test {
    string private constant BASE = ".networks.probe";

    function read(string memory json) external pure returns (uint64) {
        return NetworkSelectors.readCcipChainSelector(json, BASE);
    }

    function _json(string memory selectorLiteral) private pure returns (string memory) {
        return string.concat('{"networks":{"probe":{"ccipChainSelector":', selectorLiteral, "}}}");
    }

    // ───────────────────────── Accepted ─────────────────────────

    /// @notice The real Arbitrum selector, which exceeds JavaScript's safe-integer range.
    function testAStringSelectorParsesExactly() public {
        assertEq(this.read(_json('"4949039107694359620"')), 4_949_039_107_694_359_620);
    }

    /// @notice A network with no CCIP lane is the common case, not an error.
    function testAnAbsentKeyIsZeroRatherThanAFailure() public {
        assertEq(this.read('{"networks":{"probe":{"name":"probe"}}}'), 0);
    }

    /// @notice The largest value that still fits, to pin the boundary from the accepting side.
    function testTheMaximumUint64IsAccepted() public {
        assertEq(this.read(_json('"18446744073709551615"')), type(uint64).max);
    }

    // ───────────────────────── Rejected ─────────────────────────

    /// @notice A value one past the boundary must fail, not wrap.
    /// @dev The headline case. `uint64(2**64 + 1)` is `1`, so before the range check this returned a
    ///      perfectly plausible selector for a completely different chain — the failure mode this
    ///      library exists to prevent, reintroduced by the cast at the very last line.
    function testAValueTooLargeForUint64IsRejectedRatherThanTruncated() public {
        vm.expectRevert(abi.encodeWithSelector(MalformedChainSelector.selector, string.concat(BASE, ".ccipChainSelector")));
        this.read(_json('"18446744073709551617"'));
    }

    /// @notice Exactly 2**64 — the first value that does not fit — truncates to 0 without the guard.
    function testTwoToThe64IsRejected() public {
        vm.expectRevert(abi.encodeWithSelector(MalformedChainSelector.selector, string.concat(BASE, ".ccipChainSelector")));
        this.read(_json('"18446744073709551616"'));
    }

    /// @notice A JSON number, the lossy format this library exists to keep out.
    /// @dev Solidity would read it correctly; a TypeScript consumer would not. Refusing the shape
    ///      here is what stops a future entry reintroducing it.
    function testAJsonNumberIsRejected() public {
        vm.expectRevert(abi.encodeWithSelector(MalformedChainSelector.selector, string.concat(BASE, ".ccipChainSelector")));
        this.read(_json("4949039107694359620"));
    }

    /// @notice An empty string is a hand-edit, not an absent lane.
    function testAnEmptyStringIsRejected() public {
        vm.expectRevert(abi.encodeWithSelector(MalformedChainSelector.selector, string.concat(BASE, ".ccipChainSelector")));
        this.read(_json('""'));
    }
}
