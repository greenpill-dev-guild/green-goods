# Codex State/API Handoff

## What Changed

- Corrected stale DevEx script references in this hub from `scripts/dev-doctor.js` / `scripts/dev-smoke-web.js` to `scripts/dev/doctor.js` / `scripts/dev/smoke-web.js`.
- Corrected the hub validation command to `node scripts/harness/plan-hub.mjs validate`.
- Fixed `scripts/dev/smoke-web.js` so it runs the real web doctor path and enforces bounded request timeouts.
- Fixed `scripts/dev/smoke-web.js` to re-exec under system Node when `bun run` invokes it through Bun's node shim; this makes the public `bun run dev:smoke:web` command able to probe HTTPS Vite servers.
- Updated the web stack proof target to include Storybook alongside client, admin, and docs.
- Cleaned the root env schema contract and regenerated `env.d.ts`: removed no-source defaults, added missing live variables, and aligned onboarding docs to `PINATA_JWT_OP_REF` / `VITE_PINATA_JWT`.
- Updated the secret policy in setup, doctor, schema comments, and onboarding docs: baseline web dev does not require 1Password; shared team/deploy/upload/CI secrets should use 1Password; personal local-only values can be direct root `.env` values.
- Changed the doctor so only schema-backed active OP refs or enabled bulk loading require `op`; ignored non-schema OP refs now warn instead of blocking baseline web.
- Restored `PINATA_JWT_OP_REF` as the stable schema-backed upload ref and removed the temporary `PINATA_UPLOAD_JWT_OP_REF` alias.
- Trimmed `.env.schema` to developer-owned local config: PostHog host is hardcoded to the US default, PostHog source-map upload secrets stay in deploy/workflow contexts, and ad hoc test URL / `ANVIL_PORT` overrides are no longer schema entries.

## What Remains

- Preferred clean Ubuntu/WSL/devcontainer proof is still unrun; this pass used the strongest local macOS fallback.
- Upload-capable QA still needs `VITE_PINATA_JWT` or a resolvable `PINATA_JWT_OP_REF`.
- Full-stack Docker/indexer proof should stay deferred until the web profile has a clean proof target.

## Validation Run

- `node --check scripts/dev/doctor.js` — passed.
- `node --check scripts/dev/smoke-web.js` — passed.
- `node --check scripts/ops/upload-sourcemaps.js` — passed.
- `bunx varlock load --path .env.schema --format env --compact` — passed after schema cleanup.
- `rg` stale-key checks against `.env.schema` and `env.d.ts` — no hits for removed Storacha or legacy generated keys.
- `bun run dev:doctor -- --profile web --json` — passed with 0 failures and 1 warning for missing upload credentials.
- `bun run dev:doctor -- --profile upload --json` — failed with expected upload-only failures when Pinata credentials were unresolved.
- `bun run dev:web` — escalated run started docs/admin/client/Storybook.
- `bun run dev:smoke:web` — passed through the normal doctor gate against the running PM2 web stack.
- `bun run dev:stop` — stopped PM2 services after validation.
- `node scripts/harness/plan-hub.mjs validate` — passed.

## Known Risks Or Blockers

- Root `.env` was not modified, per repo invariant.
- No client public/editorial UI files were touched.
- The worktree had unrelated dirty files before this pass; this handoff only covers the DevEx proof changes and evidence above.
