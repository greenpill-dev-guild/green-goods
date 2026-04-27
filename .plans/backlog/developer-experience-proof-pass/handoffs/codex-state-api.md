# Codex State/API Handoff

## What Changed

- Corrected stale DevEx script references in this hub from `scripts/dev-doctor.js` / `scripts/dev-smoke-web.js` to `scripts/dev/doctor.js` / `scripts/dev/smoke-web.js`.
- Corrected the hub validation command to `node scripts/harness/plan-hub.mjs validate`.
- Fixed `scripts/dev/smoke-web.js` so it runs the real web doctor path and enforces bounded request timeouts.

## What Remains

- Preferred clean Ubuntu/WSL/devcontainer proof is still unrun; this pass used the strongest local macOS fallback.
- Local web doctor is blocked by root `.env` state: stale Storacha keys and 1Password CLI not signed in for configured OP refs.
- Admin localhost reachability needs follow-up: `https://localhost:3002` timed out locally even though the admin Vite server reported ready and responded on its Vite network address.
- Full-stack Docker/indexer proof should stay deferred until the web profile has a clean proof target.

## Validation Run

- `node --check scripts/dev/doctor.js` — passed.
- `node --check scripts/dev/smoke-web.js` — passed.
- `bun run dev:doctor -- --profile web --json` — failed with 2 required checks and 1 warning; JSON parsed and did not print secret values.
- `bun run dev:web` — sandbox blocked PM2 `~/.pm2` log write; escalated run started docs/admin/client.
- `bun run dev:smoke:web` — failed on the doctor gate with exact `.env` / `op` blockers.
- `bun run dev:smoke:web -- --skip-doctor --timeout 2` — completed bounded and failed because the stack was stopped.
- `node scripts/harness/plan-hub.mjs validate` — passed.

## Known Risks Or Blockers

- Root `.env` was not modified, per repo invariant.
- No client public/editorial UI files were touched.
- The worktree had unrelated dirty files before this pass; this handoff only covers the DevEx proof changes and evidence above.
