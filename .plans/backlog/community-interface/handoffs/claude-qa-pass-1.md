# Community QA pass 1 handoff

**Status:** BLOCKED — all implementation sublanes and ops evidence must complete first.

## Inputs

- GREEN lane handoffs, defect-free builds, test identities/gardens, authenticated Brave, TAS-class devices, PostHog privacy checklist.

## Outputs

- Role/state walkthrough evidence, screenshots, device/offline/recovery results, accessibility observations, defects with owners, and explicit blocked scenarios.

## Acceptance

- Member/operator/evaluator/funder flows cover loading/empty/offline/pending/waiting/declined/merged/hidden/retracted/failed/retry; signal support/non-support, both switches, clear, queued coalescing, revoked-winner/no-fallback, separate counts/no net score, and cross-garden read-only behavior; en/es/pt smoke; membership queue omitted unless its gate cleared.

## RED / GREEN or proof limit

- RED: expected failures/defects are recorded before fixes; GREEN requires rerun evidence. Authenticated/session/device blockers remain blockers, never substituted with isolated browser claims.

## Exact commands

```sh
bun run agentic:check
node scripts/dev/ci-local.js --quick
bun run lint:vocab
```

## Out of scope

Silent product fixes, isolated-browser claims for authenticated flows, or release readiness.

## Unblock evidence

Every prerequisite handoff GREEN, live sponsorship configured, QA accounts/devices available, and exact route/scenario matrix accepted.
