# State/API Lane Handoff

**Branch**: `codex/state-api/hypercert-marketplace-arbitrum-readiness`
**Status**: blocked until `contracts` completes

## Scope

- Shared marketplace readiness helpers.
- Deployment-artifact contract mapping for Arbitrum marketplace fields.
- Approval/listing hook guards that fail closed when config is incomplete.
- Marketplace query invalidation remains coherent after successful listing/approval changes.

## TDD Requirement

Start with failing shared tests that prove:

- Arbitrum marketplace addresses resolve only from declared deployment fields.
- Missing `hypercertExchange`, `hypercertMinter`, `transferManager`, or adapter/module fields produce an unavailable readiness state.
- Listing and approval hooks refuse to sign, approve, or write when readiness is incomplete.
- Successful mutations keep marketplace query invalidation behavior intact.

## Required Evidence

- RED/GREEN shared test output summary.
- File references for helpers/hooks touched.
- Any proof limits for live-chain-only behavior.

## TDD Proof

Pending.
