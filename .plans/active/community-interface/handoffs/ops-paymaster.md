# Community sponsorship operations handoff

**Status:** MANUALLY BLOCKED — the human Pimlico policy owner must provide external configuration and live burst evidence. Claude may assist only with repo-side evidence after dispatch.

## Inputs

- Final resolver/calldata allowlist, expected pilot cohort/burst, current sponsorship policy ID, privacy boundary.

## Outputs

- Dashboard policy for Need/Signal/Testimony, per-account/window caps, owner/rollback/runbook, staged burst evidence, and monitoring thresholds.

## Acceptance

- Only named writes are sponsored; NeedStatus/FundingAttribution are excluded; waiting jobs make no sponsor request; normal and gathering bursts pass without exposing wallet/reporter identifiers.

## RED / GREEN or proof limit

- Proof limit: repo tests cannot prove Pimlico dashboard state. RED/GREEN is a recorded dashboard denial/allow matrix plus staging transaction evidence.

## Exact commands

```sh
bun run --filter @green-goods/shared test -- src/__tests__/workflows/authServices.test.ts
bun run --filter @green-goods/shared typecheck
```

## Out of scope

New paymaster contracts, secrets in repo/Linear, settlement sponsorship, or production enablement without a rollback owner.

## Unblock evidence

Redacted policy export, policy owner, cap rationale, successful/denied staging matrix, burst results, alert and rollback procedure.
