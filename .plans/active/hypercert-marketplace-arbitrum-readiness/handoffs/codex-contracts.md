# Contracts Lane Handoff

**Branch**: `codex/contracts/hypercert-marketplace-arbitrum-readiness`
**Status**: ready

## Scope

- Add Arbitrum deployment artifact marketplace fields after operator confirmation.
- Add package-scripted marketplace status, dry-run configure, and configure commands.
- Harden `contracts:verify:post-deploy:arbitrum`.
- Narrow verifier behavior for indexer config drift without blindly adding undefined Envio contracts.
- Resolve enable-now stalls before lane completion: configure now, pause/disable with operator approval, or record an accepted-risk blocker.

## TDD Requirement

Start with failing tests or fixtures that prove these failures are detected:

- adapter exchange or hypercert minter is zero
- module hypercert minter is zero or differs from adapter minter
- module marketplace adapter differs from deployment artifact
- adapter is paused
- adapter or module owner differs from the expected owner when an expected owner is declared
- adapter authorized module is false
- exchange transfer manager differs from deployment artifact
- strategy id `1` is inactive or points at the wrong strategy
- indexer verifier expects deployed contracts that are not actually defined/indexed by Envio

Record proof with:

```bash
node scripts/harness/plan-hub.mjs record-tdd --feature hypercert-marketplace-arbitrum-readiness --lane contracts --red-command "<command>" --red-evidence "handoffs/codex-contracts.md#tdd-proof" --green-command "<command>" --green-evidence "handoffs/codex-contracts.md#tdd-proof" --actor codex
```

## Required Evidence

- RED/GREEN command output summary.
- Dry-run output summary for proposed owner calls.
- Confirmation that root scripts follow the Arbitrum varlock plus `green-goods-deployer` wrapper pattern while package scripts own implementation.
- No-broadcast statement unless explicit operator approval is recorded.
- If operator confirmation or broadcast approval stalls, the selected fallback and decision owner.
- Confirmation that indexer verifier scope is narrowed to currently defined/indexed contracts, or a linked `.plans/backlog/indexer-deployed-modules-expansion/` hub exists.
- Post-transaction verification output only after approved broadcast.

## TDD Proof

Pending.
