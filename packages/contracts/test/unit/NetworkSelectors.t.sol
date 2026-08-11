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
///
///      One rule is deliberately NOT tested here: that the config stores selectors quoted. Whether
///      a value was quoted is not recoverable from what `parseJson` returns — forge chooses the
///      encoding by magnitude, and that choice changed between versions — so the rule is enforced
///      against the file's own text in `script/utils/pooling-release.test.ts` instead.
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

    /// @notice The bare-number encoding reads exactly, rather than being refused as malformed.
    /// @dev Covers the 32-byte branch on every toolchain. An unquoted JSON number is the one input
    ///      guaranteed to produce that encoding on all forge versions, whereas the case this branch
    ///      exists for — a large quoted selector — only produces it on current stable, so pinning
    ///      the branch to the quoted case alone would leave it untested on older builds. Accepting
    ///      this shape is not a licence to write config this way: `pooling-release.test.ts` fails
    ///      the build if any selector in `networks.json` is unquoted.
    function testTheBareNumberEncodingIsReadExactly() public {
        assertEq(this.read(_json("4949039107694359620")), 4_949_039_107_694_359_620);
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

    /// @notice A selector past 2**63 parses, whichever encoding this forge build hands back.
    /// @dev The regression that made this explicit: `parseJson` infers a type per value, and on
    ///      current stable a quoted selector this large arrives as a bare 32-byte word rather than
    ///      an ABI string. Reading only the string encoding rejected valid config — Sepolia's
    ///      16015286601757825753 sits in this range, so the settlement lane could not read its own
    ///      network entry. Pinned with the real value rather than a synthetic one.
    function testASelectorPastTwoToThe63Parses() public {
        assertEq(this.read(_json('"16015286601757825753"')), 16_015_286_601_757_825_753);
    }

    /// @notice An empty string is a hand-edit, not an absent lane.
    function testAnEmptyStringIsRejected() public {
        vm.expectRevert(abi.encodeWithSelector(MalformedChainSelector.selector, string.concat(BASE, ".ccipChainSelector")));
        this.read(_json('""'));
    }
}
