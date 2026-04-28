# Developer Experience Proof Pass Evaluation

## Acceptance Criteria

| ID | Criterion | Lane | Evidence |
|---|---|---|---|
| AC-1 | Web doctor runs in the target proof environment | `state_api` | Command output summary for `bun run dev:doctor -- --profile web --json` |
| AC-2 | JSON output is parseable and secret-safe | `state_api` | Parsed summary plus explicit note that secrets are not printed |
| AC-3 | Web stack starts client/admin/docs or records exact blocker | `state_api` | `bun run dev:web` output summary |
| AC-4 | Web smoke checks reachability for client/admin/docs | `state_api` | `bun run dev:smoke:web` output summary |
| AC-5 | Any remaining work is split cleanly | `qa_pass_1` | Follow-up hub or explicit no-follow-up decision |

## Regression Checks

- `node scripts/harness/plan-hub.mjs validate`
- `node --check scripts/dev/doctor.js`
- `node --check scripts/dev/smoke-web.js`

## Exit Rule

Archive this hub when the proof evidence is recorded and any remaining full-stack/Docker/indexer work is either split into its own plan or intentionally deferred.
