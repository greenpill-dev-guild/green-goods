# v1.1.0 Release Readiness Status

**Branch**: `release/1.1.0`  
**Last updated**: 2026-05-06  
**Mode**: core-only release gate, safe live reads only

## Current Verdict

The confirmed public editorial data blocker is fixed in the current dirty tree:
`usePublicGardens()` refetches on mount so a cached empty public gardens result
cannot keep `/gardens`, `/fund`, `/impact`, garden detail, or featured public
sections empty after `getGardens()` is returning live gardens.

The follow-up browser/runtime blockers found during this pass are also fixed:

- `/fund` now renders wallet-backed vault summary and funding dialogs under one
  page-level wallet runtime provider, so the public route no longer crashes with
  `WagmiProviderNotFoundError`.
- `/cookies` no longer lazy-loads the wallet runtime behind a null fallback; the
  no-campaign state and direct `?jar=` dialog render honestly.
- package test scripts now route Vitest through `scripts/dev/node-cli.js`, so
  stale package-local shims no longer try to fetch `node` from npm.

No code blocker remains from the findings in this pass. Release tagging still
needs manual or environment-backed signoff for real authenticated PWA/admin
operator flows and optional live third-party checks where local env is absent.

## Dirty Tree Classification

Tracked changes are release-related and are grouped by surface:

- Public editorial/funding/cookies data and UI:
  `packages/client/src/views/Public/**`,
  `packages/client/src/components/Public/**`,
  `packages/shared/src/hooks/public/**`,
  `packages/shared/src/public-contracts/**`.
- Admin operator flow and canonical canvas work:
  `packages/admin/src/components/**`, `packages/admin/src/views/**`,
  `packages/admin/src/styles/**`.
- Agent public API, subscriptions, upload signer, and metrics support:
  `packages/agent/src/**`.
- Shared app shell, query keys, roles, i18n, domain utilities, and design-token
  gate updates: `packages/shared/src/**`,
  `docs/docs/builders/packages/client-pwa-token-audit.generated.md`,
  `scripts/data/design-token-usage-baseline.tsv`.
- Dev/test/build runner hardening for this readiness pass:
  package test scripts and `scripts/dev/node-cli.js`.

Untracked local/evidence files are not auto-staged:

- Release evidence to preserve/reconcile:
  `.plans/release-1.1.0-readiness/run-*.md` and this `status.md`.
- Adjacent active audit work not part of this release fix loop:
  `.plans/active/client-pwa-audit/**`.
- Local tunnel state:
  `.tunnel-url-admin`.
- Adjacent public funding/cookie/vault-yield additions:
  untracked public funding card/cookie jar components and public vault summary
  hook/ABI support files. These were treated as related release work and were
  not auto-staged.

## Findings Reconciled

1. Public editorial data blocker
   - Status: fixed in dirty tree; targeted unit and browser coverage present.
   - Current proof: `usePublicGardens` cached-empty recovery test passes;
     `/gardens`, `/fund`, `/impact`, `/actions`, and a garden-detail URL render
     live public content without falling into empty states.

2. Release evidence durability
   - Status: reconciled here.
   - Older run notes remain point-in-time evidence; this file is the current
     short-form status for the release-readiness pass.

3. Core live proof
   - Status: partially complete.
   - Public browser proof completed on desktop and mobile local client routes.
   - Admin route proof completed through unauthenticated gates and dev
     `?mockAuth=` role gates: operator role showed the honest no-garden-access
     state; deployer role reached the campaign cookie-jar admin surface.
   - Local Agent API live proof is blocked by no local listener on port 3000;
     public API/upload/funding-intent contracts are covered by agent tests.

4. Package test runtime hazard
   - Status: fixed in package scripts.
   - Cause: package-local `node_modules/.bin/vitest` shims invoke
     `npm --package=node@20`, which fails under restricted network access.
   - Fix: package test scripts route through `scripts/dev/node-cli.js`, which
     now prefers the root workspace binary before stale package-local shims.

## Validation Log

- 2026-05-06: branch confirmed as `release/1.1.0`.
- 2026-05-06: targeted public route tests passed after approved rerun:
  `packages/client` public gardens/fund/impact/cookies, 31/31.
- 2026-05-06: targeted shared hook test passed after approved rerun:
  `usePublicGardens`, 8/8.
- 2026-05-06: targeted public route regression tests passed:
  `packages/client` fund and cookies, 17/17.
- 2026-05-06: targeted PWA/auth/work tests passed:
  `RequireAuth`, `AccountInfo`, `HomeGarden`, and `Review`, 17/17.
- 2026-05-06: targeted shared core-flow tests passed:
  session, work submission/approval, batch approval, works, assessments,
  campaign-cookie hooks/data, vault operations/deposit form, and vault utils,
  153/153.
- 2026-05-06: targeted agent public API tests passed:
  `public-api` and `upload-signer`, 23/23.
- 2026-05-06: browser proof passed on `http://127.0.0.1:3301` desktop and
  mobile for `/gardens`, `/fund`, `/impact`, `/actions`, `/cookies`, direct
  `?jar=0x1111111111111111111111111111111111111111`, and a garden-detail URL.
  Focused proof showed the fund dialog at `Amount` / `Pay with` /
  `Connect Wallet`, and direct jar showed `Direct jar` plus the load-failed
  message instead of a blank state.
- 2026-05-06: admin browser proof passed on `http://127.0.0.1:3302`:
  unauthenticated routes showed `Connect to continue`; `?mockAuth=operator`
  showed honest no-garden-access state; `?mockAuth=deployer` reached campaign
  cookie-jar admin. No page errors.
- 2026-05-06: `bun run format:check` passed.
- 2026-05-06: `bun lint` passed with existing warnings only.
- 2026-05-06: `bun run check:design-generated`, `bun run check:design-tokens`,
  and `bun run lint:vocab` passed.
- 2026-05-06: `node scripts/dev/ci-local.js --quick` passed.
- 2026-05-06: `VITE_CHAIN_ID=11155111 bun run build` passed. Non-fatal output
  included the existing large-chunk/Rollup annotation warnings and a Foundry
  signature-cache permission warning.

## Proof Limits

- No mainnet transactions were broadcast.
- Browser proof did not exercise real wallet signatures, real passkey login, or
  mobile Add-to-Home-Screen install; those require manual/device proof.
- Admin operator flow proof was limited by the dev operator mock address having
  no eligible garden access in local data. Deployer campaign-cookie admin did
  render under `?mockAuth=deployer`.
- Local Agent API route proof is blocked by no running local agent server; the
  Hono public API/upload/funding-intent contracts are covered by tests.
- Public browser logs include local HTTP service-worker registration warnings,
  WalletConnect RPC CORS failures when opening the funding dialog from
  localhost, and IPFS gateway image request failures in headless Chromium. These
  did not produce page errors or empty public states.
