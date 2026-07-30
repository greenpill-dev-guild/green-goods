# Community sponsorship operations handoff

**Status:** MANUALLY BLOCKED — the human Pimlico policy owner must provide external configuration and live burst evidence. Claude may assist only with repo-side evidence after dispatch.

## Inputs

- Chain-specific EAS address, `attest` selector, final Need/NeedSignal/Testimony schema UIDs, expected pilot cohort/burst, current sponsorship policy ID, and privacy boundary.

## Outputs

- Hosted policy for Need/Signal/Testimony, per-account/window caps, owner/rollback/runbook, staged burst evidence, and monitoring thresholds. The smart account calls the chain-specific EAS contract, not a resolver, so the policy must match the EAS target plus `attest` selector and decode the attestation request's schema UID. Use a dashboard rule only if the exported policy proves that nested match; otherwise use the sponsorship-policy webhook to perform the same fail-closed decode. Resolver addresses are never the sponsored call target.

## Acceptance

- Only exact Need, NeedSignal, and Testimony schema UIDs sent through EAS `attest` are sponsored; NeedStatus, FundingAttribution, other EAS schemas, other EAS methods, and direct resolver calls are denied; waiting jobs make no sponsor request; normal and gathering bursts pass without exposing wallet/reporter identifiers.

## RED / GREEN or proof limit

- Proof limit: repo tests cannot prove Pimlico hosted-policy or webhook state. RED/GREEN is an exported rule/configuration, a recorded denial/allow matrix that includes excluded schema UIDs and methods, plus staging transaction evidence.

## Exact commands

```sh
bun run --filter @green-goods/shared test -- src/__tests__/workflows/authServices.test.ts
bun run --filter @green-goods/shared typecheck
```

## Out of scope

New paymaster contracts, secrets in repo/Linear, settlement sponsorship, or production enablement without a rollback owner.

## Unblock evidence

Redacted policy export, policy owner, cap rationale, successful/denied staging matrix, burst results, alert and rollback procedure.
