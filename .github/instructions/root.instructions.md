---
applyTo: ".github/**,package.json,scripts/**"
---

- Keep GitHub automation aligned with this repo's existing branch strategy: most CI targets `main` and `develop`, with narrower scopes only when a workflow is intentionally release-only.
- Minimize workflow permissions and runners. Start from `contents: read`, add only the scopes a job needs, and keep path filters narrow to control CI noise and Copilot spend.
- Use Bun and Node 22 conventions already established in this repo's workflows. Do not introduce `npm`, `yarn`, or raw `forge`.
- Treat Copilot instructions, workflows, CODEOWNERS, dependency/security config, and root scripts as protected surfaces that still require human review.
- When a root or workflow change affects package behavior, preserve package boundaries and the build order `contracts -> shared -> indexer -> client/admin/agent`.
- If a GitHub or Copilot setting cannot be committed in-repo, document the exact manual value instead of inventing a second hidden rule set.
