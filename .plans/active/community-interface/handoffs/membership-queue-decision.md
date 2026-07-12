# Membership queue decision handoff

**Status:** MANUALLY BLOCKED — RESR-64 decision due 2026-08-12.

## Inputs

- `research-plan.md` options/exit criteria, operator interviews, privacy/threat/abuse review, cost and recovery rehearsal.

## Outputs

- Signed engagement-model decision naming selected transport, controller/processor, auth, encrypted fields, retention/deletion, cancellation/recovery, abuse controls, cost, incident owner, and operator handoff.

## Acceptance

- Selected option and rejected alternatives are justified; member/operator failure paths are rehearsed; revisit date is set; public on-chain, Linear-as-queue, and implicit localStorage remain excluded.

## RED / GREEN or proof limit

- Proof limit: no implementation test can replace human/privacy evidence. RED is any missing exit criterion; GREEN is Product/Research/operator sign-off on every criterion.

## Exact commands

```sh
node scripts/harness/plan-hub.mjs validate
node scripts/harness/plan-hub.mjs linear-sync --feature community-interface --json
```

## Out of scope

Implementing the queue, storing real join identities in repo/Linear, or changing `waiting_for_hat` into join transport.

## Unblock evidence

Linked RESR-64 document, dated sign-offs, threat/abuse review, operator rehearsal notes, and an intentional status change setting this sublane's `manual_blocked` false.
