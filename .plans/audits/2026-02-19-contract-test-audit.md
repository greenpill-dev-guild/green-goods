# Contract Test Coverage + Realism Audit — 2026-02-19

## Summary
- Scope: `packages/contracts/test` with strict-minimal mock policy for fork/e2e (Sepolia + Arbitrum mandatory).
- Baseline artifacts generated:
  - `output/contracts-test-audit/baseline.json`
  - `output/contracts-test-audit/realism-report.md`
  - `output/contracts-test-audit/realism-report-ci.md`
  - `output/contracts-test-audit/evidence-summary.txt`
  - `output/contracts-test-audit/coverage-summary.md`
  - `output/contracts-test-audit/tooling-scenarios.log`
- Current baseline metrics (fork/e2e):
  - `45` files in scope, `101` total Solidity test files.
  - `12` `src/mocks` import lines, `7` `vm.mockCall*`, `2` `vm.store`, `0` `vm.etch`.
  - `191` `vm.prank`/`vm.startPrank` call sites.
  - `126` `vm.expectRevert(...)` calls, `39` generic `vm.expectRevert();`, selector-specific ratio `54.76%`.
  - `275` `SKIPPED:` log lines, `169` early-return skip blocks on mandatory networks.
- Mock realism policy status:
  - `16` allowlist entries, `16` matched, `0` expired, `0` metadata issues.
  - Disallowed unallowlisted mock primitives in fork/e2e: `0`.

## Severity Mapping
- `Critical/High` -> `must-fix`
- `Medium` -> `should-fix`
- `Low` -> `nice-to-have`

## Must-Fix
- Fork/e2e execution is not green for mandatory audit evidence:
  - `test_e2e_workflow`: failed with `MetadataRequired()` in `test_fork_completeProtocolWorkflow()`.
  - `test_e2e_sepolia`: failed with `MetadataRequired()` and revert expectation mismatch.
  - `test_e2e_arbitrum`: compiler Yul stack-depth failure.
  - Evidence: `output/contracts-test-audit/test_e2e_workflow.log`, `output/contracts-test-audit/test_e2e_sepolia.log`, `output/contracts-test-audit/test_e2e_arbitrum.log`.
- Fork protocol and non-e2e full-suite evidence commands are not stable in this environment:
  - `build_full`, `test_non_e2e`, `test_fork_protocol` timed out or hit Yul compile failure.
  - Evidence: `output/contracts-test-audit/evidence-summary.txt`, `output/contracts-test-audit/test_fork_protocol.log`.
- Coverage slices currently fail to complete in the audit environment (timeouts under `forge coverage --ir-minimum`), preventing numeric target enforcement:
  - Evidence: `output/contracts-test-audit/coverage-unit.log`, `output/contracts-test-audit/coverage-integration.log`.

## Should-Fix
- Revert assertion strength is below policy threshold:
  - Selector-specific ratio is `54.76%` (`69/126`) vs phase targets (`>=70%` warning, `>=80%` phase-2 gate, `>=90%` phase-3 gate).
  - `39` generic `vm.expectRevert()` remain in fork/e2e.
  - Evidence: `output/contracts-test-audit/realism-report-ci.md`.
- CI skip-governance target is not met:
  - `169` early-return skip blocks on mandatory networks (Sepolia/Arbitrum), CI target is `0` effective skips.
  - Evidence: `output/contracts-test-audit/realism-report-ci.md`.
- Deterministic mock dependencies remain in conviction/yield/account fork paths and require sentinel real-contract parity coverage before allowlist expiry (`2026-03-19`).
  - Policy source: `packages/contracts/test/audit/mock-allowlist.json`.
- Conditional mock allowlist metadata still has unpaired sentinel gaps (`3` entries missing `sentinel_file`), which violates the conditional-allow policy.
  - Evidence: `output/contracts-test-audit/realism-report-ci.md`, `packages/contracts/test/audit/mock-allowlist.json`.
- Scenario matrix verification found Arbitrum sentinel coverage gap (`scenario-matrix-contracts-arbitrum`): missing required references `YieldResolver` and `GreenGoodsENS` in `packages/contracts/test/fork/e2e/ArbitrumFullProtocolE2E.t.sol`.
  - Evidence: `output/contracts-test-audit/realism-report-ci.md`.
- Fuzz/invariant depth remains concentrated and does not yet cover major module-heavy state machines (Gardens/Octant/Yield/assessment flows) at parity with role hierarchy coverage.

## Nice-to-Have
- Reduce noisy etherscan trace lookup warnings in fork e2e logs for better CI signal-to-noise.
- Split very long fork e2e runs into smaller deterministic groups to reduce timeout pressure and make failures more diagnosable.

## Verification
- New realism audit tooling:
  - `scripts/check-contract-test-realism.sh`
  - `packages/contracts/test/audit/mock-allowlist.json`
  - `scripts/run-contract-coverage-audit.sh`
  - `scripts/validate-contract-test-realism-tooling.sh`
- Package scripts added:
  - `packages/contracts/package.json`: `test:audit:realism`, `test:audit:realism:tooling`, `test:audit:coverage`, `test:audit:full`
- CI wiring added:
  - `.github/workflows/contracts-tests.yml` -> `realism-audit` job with phased mode switch by date:
    - `< 2026-02-26`: `advisory`
    - `2026-02-26 .. 2026-03-04`: `enforce-must-fix`
    - `2026-03-05 .. 2026-03-18`: `enforce-should-fix` @ `0.80`
    - `>= 2026-03-19`: `enforce-should-fix` @ `0.90`
- Realism gate behavior validated:
  - `CI=true ... --mode enforce-must-fix` exits `0` with `Must-fix: 0`.
  - `CI=true ... --mode enforce-should-fix` exits `1` with `Should-fix: 45`.
  - Tooling scenarios validated (`5/5`) via `scripts/validate-contract-test-realism-tooling.sh`.
- Environment note:
  - `bun` is not installed in this execution environment, so evidence collection used equivalent direct `forge` invocations.

## Recommendation
1. `Phase 1` (must-fix gate, owner: `contracts-core`):
   - Stabilize mandatory fork/e2e command outcomes:
     - `packages/contracts/test/E2EWorkflow.t.sol` (resolve `MetadataRequired` failure path).
     - `packages/contracts/test/fork/e2e/FullProtocolE2E.t.sol` (resolve failing assertions).
     - Yul stack-depth issue surfaced by fork/e2e compile path (`src/mocks/Juicebox.sol` context in logs).
2. `Phase 2` (should-fix gate @ 80%, owner: `contracts-core`):
   - Burn down generic revert assertions in fork/e2e files identified by `realism-report-ci.md`.
   - Add CI-governed skip policy migration for mandatory-network early-return blocks.
3. `Phase 3` (should-fix gate @ 90%, owner: `contracts-core` + `security`):
   - Remove or renew expiring conditional mock entries before `2026-03-19` with concrete real-contract parity tests.
   - Add module-heavy fuzz/invariant suites beyond current `FuzzTests.t.sol` and `invariant/RoleHierarchy.t.sol` concentration.

## Remediation Backlog (Decision-Complete)
| Item | File(s) | Owner | Gate Phase | Change Required |
|---|---|---|---|---|
| Tighten revert assertions (completed in this pass) | `packages/contracts/test/E2EWorkflow.t.sol` | contracts-core | Phase 1 | Generic reverts replaced with explicit selectors + unchanged-state assertion for unauthorized description update. |
| Replace permissive Hats fallback (completed in this pass) | `packages/contracts/test/fork/helpers/ForkTestBase.sol` | contracts-core | Phase 1 | Added explicit `ForkTestEligibilityToggle` module and configured hat activity/wearer eligibility in fork setup. |
| Resolve failing workflow/e2e cases | `packages/contracts/test/E2EWorkflow.t.sol`, `packages/contracts/test/fork/e2e/FullProtocolE2E.t.sol` | contracts-core | Phase 1 | Fix failing test expectations/data setup currently producing `MetadataRequired` and revert mismatch failures. |
| Unblock fork/arbitrum compile instability | `packages/contracts/test/fork/**` (error surfaced in `src/mocks/Juicebox.sol` context) | contracts-core | Phase 1 | Refactor offending path or isolate compile profile to avoid Yul stack-depth failures in fork test runs. |
| Raise revert specificity to >=80% | Files listed in `output/contracts-test-audit/realism-report-ci.md` | contracts-core | Phase 2 | Replace generic `expectRevert()` with selector/encoded custom errors or allowlist justified nondeterministic external reverts. |
| Enforce CI skip-governance target 0 | Fork/e2e files with `_tryChainFork` early-return blocks | contracts-core | Phase 2 | Convert silent skip-return blocks to governed CI behavior for Sepolia/Arbitrum mandatory scenarios. |
| Pair conditional mock suites with real-contract sentinels | `packages/contracts/test/E2EConvictionVoting.t.sol`, conviction/yield/account fork suites | contracts-core + security | Phase 3 | Add real-contract fork parity tests and reduce deterministic mocks per allowlist expiry policy. |
| Expand fuzz/invariant depth | `packages/contracts/test/FuzzTests.t.sol`, `packages/contracts/test/invariant/*` | contracts-core + security | Phase 3 | Add module-heavy fuzz/invariant coverage for Gardens/Octant/Yield/assessment lifecycle behavior. |
