# ENS L2 Sender Admin Recovery Evaluation Plan

## Release Gates

1. Correctness: recovery clears the intended L2 sender state and keeps L1 receiver state consistent.
2. Safety: garden names cannot be released through the normal user recovery path.
3. User clarity: passkey users see a request/recovery flow, not an unsupported transaction path.
4. Migration confidence: current active names are preserved or intentionally reconciled from a reviewed manifest.
5. Evidence quality: tests and live verification prove both-chain state before removing the legacy UI gate.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Same-passkey username change has a documented support-assisted path on the current contract | `state_api` | Runbook or support flow copy |
| AC-2 | Sender v2 has owner-only gardener-name recovery with event emission | `contracts` | Contract tests |
| AC-3 | Recovery cannot release garden names through the user-name path | `contracts` | Negative contract tests |
| AC-4 | Migration manifest reconciles active names from sender events and receiver state | `contracts` | Dry-run report |
| AC-5 | Rewired sender/receiver state verifies on both chains | `qa_pass_2` | Post-deploy verification output |

## Test Strategy

- Unit: contract tests for recovery success, unauthorized caller rejection, garden-name rejection, stale owner/slug mismatch, and event emission.
- Integration: migration dry-run using production-derived sender events and L1 receiver reads.
- UI/state: targeted tests for request username change, lost-passkey recovery copy, and removal of broken sponsored-release call.
- Manual checks: same-passkey release support flow and lost-passkey exact-name recovery policy.

## QA Sequence

### Claude QA Pass 1

- Review user-facing recovery copy and support flow clarity.
- Confirm users are not asked to understand L1/L2 internals.
- Check that lost-passkey recovery is framed honestly and does not promise automatic exact-name restoration before admin tooling exists.

### Codex QA Pass 2

- Re-run contract tests, migration dry-run, and targeted shared/client tests.
- Verify production deployment JSON and onchain reads after rewiring.
- Confirm the legacy sponsored-release gate is removed only after sender v2 is live and verified.
