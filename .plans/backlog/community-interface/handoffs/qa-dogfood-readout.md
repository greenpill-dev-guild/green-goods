# Community pilot and dogfood readout handoff

**Status:** BLOCKED — template only until UI, paymaster, and QA prerequisites are GREEN.

## Inputs

- Confirmed operator cohort/consent, staging build, sponsorship, analytics privacy config, authenticated Brave and TAS devices.

## Outputs

- Participant/readiness summary without identities, scenario results, offline/sponsor/attribution/export evidence, metric provenance, defects, operator burden, and PRD-695/696 promote/decline recommendation.

## Acceptance

- Results distinguish target/reported/verified; no replay/session/wallet/join identifiers; every failure has recovery outcome; unsupported scenarios are labeled blocked.

## RED / GREEN or proof limit

- Proof limit: dogfood requires real participants/devices/external services. RED/GREEN is per-scenario observed evidence with reruns after fixes, not unit-test substitution.

## Exact commands

```sh
node scripts/dev/ci-local.js --quick
bun run lint:vocab
bun run docs:audit
```

## Out of scope

Fabricated completion percentages, cross-garden rankings, unconsented recordings, automatic hardening promotion, or hidden incident data.

## Unblock evidence

Consent/readiness matrix, staging and paymaster health, test-device/session availability, PostHog project/privacy verification, and QA1 approval.
