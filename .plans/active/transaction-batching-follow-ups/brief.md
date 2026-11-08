# Transaction batching follow-ups

PRD-1399 and PRD-1054 carry unfinished work from the closed transaction-batching hub (final record `a63929336`). On 2026-11-07 the user approved the listed code fixes and automated proofs, preparation for live signing, and reporting remaining decisions.

Implementation remains on the existing branch. No broadcasts, deployments, dependency upgrades, account upgrades, publication, Linear closure, or copy decisions are authorized here. The user subsequently approved restoring already-pinned dependencies with `bun install --frozen-lockfile`; versions and the lockfile remain unchanged. The pre-existing cosmo-local-credit handoff stays untouched.
