# Adversarial Review Report

## Purpose

Run a read-only review that actively looks for ways agent work could be wrong, leaky, over-scoped, or under-verified in Green Goods.

## Default High-Risk Surface

Contracts/deployments, shared hooks/providers, admin/client design-system drift, PostHog privacy boundaries, and `.plans` truth drift.

## Review Lenses

- Privacy and data leakage.
- Security, auth, permissions, secrets, and destructive operations.
- Public-contract or payload drift.
- UX/accessibility regressions.
- Scope drift or competing truth surfaces.
- Missing verification or unverifiable claims.

## Finding Format

| Severity | Finding | Evidence | Recommendation | Disposition |
|---|---|---|---|---|
| P1 | Evidence artifacts were templates only, so completion could be claimed without a real ledger or scorecard. | Initial artifact files had blank templates. | Record the scaffold-hardening lane as the first measured lane and keep product adoption as future work. | closed |
| P2 | The state lane was queue-visible as ready while its handoff still said not started. | Initial `status.json` had `state_api: ready`; `handoffs/codex-state-api.md` had no closeout evidence. | Mark state_api completed with proof-limit evidence and manually block UI until scoped. | closed |
| P2 | Validation commands mixed commands with prose. | Initial eval had a backticked non-command for selected-feature validation. | Split executable commands from run conditions. | closed |
| P3 | Linear warnings could be mistaken for plan failure. | The plan-hub list showed missing Linear parent/lane issues for ready work. | Remove premature ready lanes and record that this pass is repo-local; create Linear issues only when the user wants external tracking. | follow-up |

## Proof Limit

This report is read-only. It does not authorize fixes unless the user explicitly approves implementation.
