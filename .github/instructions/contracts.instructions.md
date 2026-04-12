---
applyTo: "packages/contracts/**"
---

- Keep contract review conservative. Contracts, deployment, verification, migration, and upgrade paths are high-risk and remain human-governed for merge.
- Use repo `bun` scripts for build, test, deploy, and upgrade flows. Do not introduce raw `forge` commands into the repo contract.
- Preserve Solidity safety patterns already documented here: checks-effects-interactions, pull-over-push payments, explicit visibility, bounded iteration, custom errors, and UUPS-aware upgrade safety.
- Treat changes under `packages/contracts/script/**`, `packages/contracts/deployments/**`, `packages/contracts/config/**`, and upgrade-safety tests as high-risk. Copilot review should still inspect them, but missing human review is a blocker.
- Prefer minimal, auditable changes over broad refactors in safety-critical contract code.
- Validate ordinary contract changes with `cd packages/contracts && bun run build && bun run test`; use `cd packages/contracts && bun run test:audit:full` for security-sensitive or rollout-hardening changes when feasible.
