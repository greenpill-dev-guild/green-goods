# QA Application — Agent Guide

Use this guide for `packages/qa/**`. Read [README.md](README.md) for implementation ownership,
authentication, private storage, local rehearsal, and deployment. Running a QA session instead
uses `qa-session` and the [QA contract](../../.claude/context/qa.md).

## Boundaries

- Case definitions and lifecycle belong to `scripts/data/qa-test-catalog.json` and the append-only
  `scripts/data/qa-test-id-ledger.json`. Preserve issued IDs; retire cases instead of deleting or
  reusing them. Build the app from these authorities rather than editing generated output.
- Keep run observations, results, tester identities, and allowlists out of Git and public docs.
- Preserve wallet-signature identity, session checks, allowlist enforcement, and fail-closed
  configuration. The README owns authentication and concurrent storage contracts.
- Local rehearsal bypasses authentication only on loopback and uses disposable local state.
  It cannot establish authenticated proof. Follow [Browser Evidence](../../AGENTS.md#browser-evidence).
- Keep all three QA locales aligned in `locales/`. Frontend changes follow the root guidance
  and the root `DESIGN.md` tokens used by `build.mjs`.

## Commands

Run from this package after rendering the root validation plan:

- `bun run build` — validate and project the catalog into the QA application.
- `node dev.mjs` — serve the built app for loopback-only rehearsal.

Build first before starting the rehearsal server. QA implementation tests live under
`scripts/agents/`; use the focused tests selected by the root planner. Catalog changes also
require the QA ID ledger check. Read-only pulls and reports use `bun run --cwd ../.. qa`
and write private artifacts under gitignored `tmp/qa-session/`.
