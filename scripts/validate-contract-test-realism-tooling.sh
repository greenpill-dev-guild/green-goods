#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_AUDIT_SCRIPT="$ROOT_DIR/scripts/check-contract-test-realism.sh"
TMP_DIR="$(mktemp -d)"

cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

assert_json() {
    local script="$1"
    node -e "$script"
}

write_common_matrix_files() {
    mkdir -p "$TMP_DIR/packages/contracts/test/fork/e2e"
    mkdir -p "$TMP_DIR/packages/contracts/test/audit"

    cat > "$TMP_DIR/packages/contracts/test/E2EWorkflow.t.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
contract SepoliaSentinel {
    // GardenToken GardenAccount ActionRegistry WorkResolver WorkApprovalResolver AssessmentResolver HatsModule
}
SOL

    cat > "$TMP_DIR/packages/contracts/test/fork/e2e/ArbitrumFullProtocolE2E.t.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
contract ArbitrumSentinel {
    // GardenToken GardenAccount ActionRegistry GardensModule YieldResolver GreenGoodsENS
}
SOL
}

write_allowlist() {
    local entries_json="$1"
    cat > "$TMP_DIR/packages/contracts/test/audit/mock-allowlist.json" <<JSON
{
  "version": 1,
  "updated_at": "2026-02-19",
  "entries": $entries_json
}
JSON
}

reset_fixture() {
    rm -rf "$TMP_DIR/packages" "$TMP_DIR/output" "$TMP_DIR/scripts"
    mkdir -p "$TMP_DIR/scripts"
    cp "$SOURCE_AUDIT_SCRIPT" "$TMP_DIR/scripts/check-contract-test-realism.sh"
    chmod +x "$TMP_DIR/scripts/check-contract-test-realism.sh"
    write_common_matrix_files
}

run_audit() {
    local mode="$1"
    shift || true
    (
        cd "$TMP_DIR"
        "$TMP_DIR/scripts/check-contract-test-realism.sh" \
            --mode "$mode" \
            --report-md "output/report.md" \
            --report-json "output/report.json" \
            "$@"
    )
}

run_audit_expect_exit() {
    local expected_exit="$1"
    shift
    set +e
    run_audit "$@"
    local rc=$?
    set -e
    if [[ "$rc" -ne "$expected_exit" ]]; then
        echo "Expected exit code $expected_exit but got $rc for command: $*" >&2
        exit 1
    fi
}

scenario_1_unallowlisted_mockcall_fails() {
    reset_fixture
    mkdir -p "$TMP_DIR/packages/contracts/test/fork"
    cat > "$TMP_DIR/packages/contracts/test/fork/Scenario1.t.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
contract Scenario1 {
    function t(address router) external {
        vm.mockCall(router, hex"", hex"");
    }
}
SOL
    write_allowlist '[]'
    run_audit_expect_exit 1 enforce-must-fix

    assert_json "const r=require('$TMP_DIR/output/report.json'); const ok=r.findings.must_fix.some((f)=>f.title.includes('Unallowlisted mock primitive: vm.mockCall')&&f.file==='packages/contracts/test/fork/Scenario1.t.sol'); if(!ok){process.exit(1)}"
}

scenario_2_generic_revert_warns_or_fails() {
    reset_fixture
    mkdir -p "$TMP_DIR/packages/contracts/test/fork"
    cat > "$TMP_DIR/packages/contracts/test/fork/Scenario2.t.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
contract Scenario2 {
    function t() external {
        vm.expectRevert();
    }
}
SOL
    write_allowlist '[]'
    run_audit_expect_exit 1 enforce-should-fix

    assert_json "const r=require('$TMP_DIR/output/report.json'); const ok=r.findings.should_fix.some((f)=>f.title.includes('Generic vm.expectRevert()')&&f.file==='packages/contracts/test/fork/Scenario2.t.sol'); if(!ok){process.exit(1)}"
}

scenario_3_ci_skip_governance_detected() {
    reset_fixture
    mkdir -p "$TMP_DIR/packages/contracts/test/fork"
    cat > "$TMP_DIR/packages/contracts/test/fork/Scenario3.t.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
contract Scenario3 {
    event log(string);
    function _tryChainFork(string memory) internal pure returns (bool) { return false; }
    function t() external {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }
    }
}
SOL
    write_allowlist '[]'
    set +e
    (
        cd "$TMP_DIR"
        CI=true "$TMP_DIR/scripts/check-contract-test-realism.sh" \
            --mode enforce-should-fix \
            --report-md output/report.md \
            --report-json output/report.json
    )
    local rc=$?
    set -e
    if [[ "$rc" -ne 1 ]]; then
        echo "Expected enforce-should-fix CI skip governance scenario to fail, got $rc" >&2
        exit 1
    fi

    assert_json "const r=require('$TMP_DIR/output/report.json'); const ok=r.findings.should_fix.some((f)=>f.id==='ci-skip-target-zero'); if(!ok){process.exit(1)}"
}

scenario_4_expired_allowlist_fails() {
    reset_fixture
    mkdir -p "$TMP_DIR/packages/contracts/test/fork"
    cat > "$TMP_DIR/packages/contracts/test/fork/Scenario4.t.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
contract Scenario4 {
    function t(address router) external {
        vm.mockCall(router, hex"", hex"");
    }
}
SOL
    write_allowlist '[
      {
        "file": "packages/contracts/test/fork/Scenario4.t.sol",
        "pattern": "vm.mockCall",
        "reason": "Expired test entry",
        "owner": "contracts-core",
        "expires_on": "2025-01-01",
        "network_scope": ["sepolia"],
        "classification": "necessary"
      }
    ]'
    run_audit_expect_exit 1 enforce-should-fix

    assert_json "const r=require('$TMP_DIR/output/report.json'); const ok=r.findings.should_fix.some((f)=>f.title.includes('Allowlist entry is expired')); if(!ok){process.exit(1)}"
}

scenario_5_valid_allowlisted_mock_passes() {
    reset_fixture
    mkdir -p "$TMP_DIR/packages/contracts/test/fork"
    cat > "$TMP_DIR/packages/contracts/test/fork/Scenario5.t.sol" <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
contract Scenario5 {
    function t(address router) external {
        vm.mockCall(router, hex"", hex"");
    }
}
SOL
    write_allowlist '[
      {
        "file": "packages/contracts/test/fork/Scenario5.t.sol",
        "pattern": "vm.mockCall",
        "reason": "Infra-only mock in controlled fixture",
        "owner": "contracts-core",
        "expires_on": "2026-12-31",
        "network_scope": ["sepolia"],
        "classification": "necessary"
      }
    ]'
    run_audit_expect_exit 0 enforce-must-fix

    assert_json "const r=require('$TMP_DIR/output/report.json'); if(!r.status.pass){process.exit(1)}"
}

main() {
    scenario_1_unallowlisted_mockcall_fails
    echo "[ok] scenario_1_unallowlisted_mockcall_fails"

    scenario_2_generic_revert_warns_or_fails
    echo "[ok] scenario_2_generic_revert_warns_or_fails"

    scenario_3_ci_skip_governance_detected
    echo "[ok] scenario_3_ci_skip_governance_detected"

    scenario_4_expired_allowlist_fails
    echo "[ok] scenario_4_expired_allowlist_fails"

    scenario_5_valid_allowlisted_mock_passes
    echo "[ok] scenario_5_valid_allowlisted_mock_passes"

    echo "All realism audit tooling scenarios passed."
}

main "$@"
