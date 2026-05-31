# Pre-Agent-Max Checklist

Use this before assigning broad, parallel, or cross-package agent work. Keep it short enough to fill in during dispatch; link to deeper artifacts only when they are required.

## Required Fields

| Field | Entry |
|---|---|
| Date | YYYY-MM-DD |
| Branch |  |
| Human goal |  |
| Package guides read |  |
| Working tree classified | clean / scoped dirty / broad dirty |
| Unrelated dirty state |  |
| Starting drift check | command + pass/fail summary |
| Contract map required | yes / no + reason |
| Route/access matrix required | yes / no + reason |
| Validation ladder |  |
| Human judgment points |  |
| Dispatch decision | proceed / split / pause |

## Decision Rules

- Do not start broad parallel work while guidance mirror drift is unresolved.
- If the working tree is broad dirty, record which files are unrelated and avoid them.
- Require a data contract map when touching schemas, public contracts, persistent stores, shared domain types, generated artifacts, or API request/response shapes.
- Require a route/access matrix when touching routes, auth gates, role gates, shells, navigation, or public API route paths.
- Mark a section `N/A` only with a reason that another reviewer can verify.

## Current Pilot Entry

| Field | Entry |
|---|---|
| Date | 2026-05-26 |
| Branch | `codex/agent-max-readiness` |
| Human goal | Add lightweight agent-max readiness gates and prove one shared upload-signing validation contract. |
| Package guides read | Root `AGENTS.md`, `packages/shared/AGENTS.md`, `packages/agent/AGENTS.md`, `packages/client/AGENTS.md`. |
| Working tree classified | broad dirty |
| Unrelated dirty state | Pre-existing docs, env, scripts, contracts, shared config/transaction, and local-fork files were present before edits and are not part of this pilot unless drift checks cite them. |
| Starting drift check | `bun run drift:check -- --scope all --json` failed on skill mirror drift, docs-audit warnings, and inline alert lint warnings. |
| Contract map required | yes: upload signing touches a public API request contract and agent handler validation. |
| Route/access matrix required | no route or access behavior changes; `PUBLIC_AGENT_ROUTES.uploadSign` path remains unchanged. |
| Validation ladder | Plan hub, skills, docs audit, lint rules, shared tests, agent tests/build, full drift check. |
| Human judgment points | Keep guidance in this hub first; do not update global agent rules until retrospective proves adoption value. |
| Dispatch decision | proceed as one scoped implementation pass, not parallel agent-max work. |
