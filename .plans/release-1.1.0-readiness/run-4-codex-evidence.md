# v1.1.0 Codex Release Evidence - 2026-05-06

Branch: `release/1.1.0`

## Fixed

1. Public editorial garden data recovery
   - `usePublicGardens` now refetches on mount, so a successful cached empty result from a transient indexer failure cannot keep public pages empty while `getGardens()` returns live gardens.
   - Regression coverage seeds a fresh cached empty list and verifies the hook refetches live garden data.

2. Client test harness drift
   - `PublicHome.test.tsx` now mocks `useInViewReveal`, matching the newer public homepage section dependencies.

3. PWA build gate under Bun
   - Workbox service-worker generation avoids the Bun/Rollup/Terser early-exit path while the Vite app bundle remains a production build.

4. Design gate reconciliation
   - Regenerated the stale DesignMD public audit artifact.
   - Updated the token usage baseline to match the existing token-driven ActionBannerFallback/domain cleanup.

## Browser Proof

Local client on `https://localhost:3001`:

- `/gardens`: rendered 18 garden links; empty state was not visible.
- `/fund`: rendered 18 Donate buttons and 18 Endow buttons; Donate and Endow opened funding dialogs with Connect Wallet at the wallet/auth boundary.
- `/impact`: rendered garden filter options and evidence cards.
- `/cookies`: rendered the honest no-active-drops state with Connect Wallet.
- `/cookies?jar=0x1111111111111111111111111111111111111111`: opened the campaign jar dialog and showed a load-failed state for the undeployed/invalid jar.
- Desktop and mobile public install actions rendered; desktop install opened the phone handoff/QR guidance dialog.

No mainnet transactions were broadcast.

## Validation

Green:

- `bun run format:check`
- `bun lint`
- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`
- `VITE_CHAIN_ID=11155111 bun run build`
- `packages/shared`: direct Vitest, 244 files passed, 2992 passed, 1 skipped
- `packages/client`: direct Vitest, 58 files passed, 388 passed
- `packages/admin`: direct Vitest, 46 files passed, 397 passed, 3 skipped
- `packages/agent`: package test suite via ci-local, 12 files passed, 119 passed
- `packages/indexer`: 186 passing
- `packages/contracts`: 62 suites, 1528 passing

Blocked or red:

- `node scripts/dev/ci-local.js --quick` reaches format, lint, typecheck, and agent tests, but shared/client/admin package test phases fail before running because the local package-script runtime tries to fetch `node` from npm and receives `403`.
- `node scripts/quality/check-codex-docs.js` fails on preexisting `AGENTS.md` command-form validation: unsupported command form `.env`.
- `bash scripts/quality/check-test-quality.sh` fails on preexisting ungoverned `test.skip(...)` calls in Playwright specs.

## Proof Limits

- No live authenticated browser session was exercised for PWA/admin because local browser automation did not have a real wallet/passkey/operator account.
- The local agent API server was not listening on port 3000 during browser proof; API behavior was covered by agent tests.
- Local client browser logs still show production-agent CORS errors for `https://agent.greengoods.app/public/vault-yield-metrics?period=7d` when loaded from `https://localhost:3001`.
