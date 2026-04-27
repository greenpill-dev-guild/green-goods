# Signal Pool Yield Wiring - qa_pass_2 Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `qa_pass_2`
**Owner**: `codex`
**Status**: `blocked`
**Branch**: `codex/qa-pass-2/signal-pool-yield-wiring`
**Depends on**: `qa_pass_1`

## Review Focus

- Re-run source-grounded contract review against the acceptance checks.
- Confirm storage gaps and upgrade safety for both UUPS contracts.
- Confirm `Upgrade.s.sol` and `upgrade.ts` can cross-wire YieldResolver and GardensModule.
- Confirm migration dry-run reports:
  - Typed HypercertSignal pool backfill.
  - Resolver pool wiring.
  - Garden treasury defaults.
  - No-pool gardens requiring operator action.
- Confirm post-deploy verification fails on one-sided or mismatched references.
- Confirm no unacknowledged no-pool gardens remain before closing the hub.

## Validation

- `node scripts/harness/plan-hub.mjs validate`
- `cd packages/contracts && bun run test -- --match-contract GardensModule`
- `cd packages/contracts && bun run test -- --match-contract YieldSplitter`
- `cd packages/contracts && bun run test -- --match-path test/UpgradeSafety.t.sol`
- `bun format && bun lint`
- `bun run test`
- `VITE_CHAIN_ID=11155111 bun run build`
