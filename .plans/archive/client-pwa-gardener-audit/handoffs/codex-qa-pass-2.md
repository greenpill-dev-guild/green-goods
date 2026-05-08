# Client PWA Gardener Audit — qa_pass_2 Handoff

**Feature**: `client-pwa-gardener-audit`
**Lane**: `qa_pass_2`
**Owner**: `codex`
**Status**: `blocked`
**Branch**: `release/1.1.0`
**Depends on**: `qa_pass_1`
**Date**: 2026-05-04

## Run Profile

- Branch guard: `git branch --show-current` returned `release/1.1.0` before edits.
- Dev server: `bun run dev:web`.
  - First run failed in the sandbox because PM2 could not write `/Users/afo/.pm2/pm2.log`.
  - Approved rerun started the web stack; client reported `https://localhost:3001/`.
- Browser tooling:
  - In-app Browser against `https://localhost:3001`.
  - Headless Playwright mobile/desktop viewport check was attempted, but sandbox escalation for launching Chromium was rejected, so no fresh mobile runtime claim is made in this pass.
- Auth/data state:
  - In-app Browser session was unauthenticated, so authenticated `/home`, `/garden`, and `/profile` runtime checks redirected to `/login`.
  - Public Gardens data was empty in local dev, so a populated public Garden dialog could not be browser-verified.

## Verdict

`qa_pass_2` is **blocked**. The Account details disclosure verified by QA pass 1 is no longer present on `release/1.1.0`; account method, address, passkey warning, and logout are rendered directly on the Account tab again.

## Blocking Repro

1. Inspect the current release source:
   - `packages/client/src/views/Profile/Account.tsx:13-17` renders:
     - `InstallCta`
     - `AppSettings`
     - `GardensList`
     - `ENSSection`
     - `<AccountInfo />`
   - There is no `<details>` or `<summary>` wrapper in `ProfileAccount`.
2. Confirm the disclosure copy contract is gone:
   - `rg 'app\.profile\.accountDetails(Title|Hint)' packages/client/src packages/shared/src/i18n` returns no matches.
3. Inspect the visible account block:
   - `packages/client/src/views/Profile/AccountInfo.tsx:63-170` renders the `Account` heading, auth method card, address card, passkey warning, and logout button directly.
4. This contradicts the release expectation recorded in QA pass 1:
   - `<details>` collapsed by default.
   - Summary copy: `Account details / Sign-in method, address, and advanced settings.`
   - Inner `AccountInfo` hidden from the top-level Profile account stack until expanded.

Related stale source note: `packages/client/src/views/Profile/index.tsx:49-51` still says raw addresses live behind the Account details disclosure, but the disclosure no longer exists.

## Checks That Passed

| Surface | Result | Evidence |
|---|---|---|
| Public browser shell `/` | PASS at current in-app Browser viewport | `/?presentation=website` rendered `SiteHeader` main navigation (`Gardens`, `Impact`, `Fund`, `Actions`) and no authenticated bottom nav. |
| Public Garden dialog route | LIMITED PASS for empty-data fallback | `/gardens/vida-verde?presentation=website` kept the public shell and opened the `Garden not found` dialog. Populated dialog content could not be verified because `/gardens` returned "Gardens will appear here as they come online." |
| PWA login passkey-first path | PASS | Unauthenticated `/home?presentation=pwa` redirected to `/login?redirectTo=...`; `/login` showed primary `Create your account` and secondary `Sign in with a wallet`. Clicking primary revealed the display-name textbox and changed the primary action to `Create account`. |
| Login tests | PASS | `Login.test.tsx` covered the passkey-first default and reveal flow. |
| Assessment route code/test proof | PASS | `Assessment.test.tsx` passed: non-operators get labeled metric rows and no impact attestations; operators retain JSON/attestation detail. Source matches `GardenAssessment.tsx:24-25`, `:136-151`, `:213-225`. |
| Garden header gating source | PASS by source | `Home/Garden/index.tsx:201-202` keeps `showGovernanceButton = hasGovernanceConfigured && canReview` and `showEndowmentButton = gardenVaults.length > 0 && (canReview || hasOwnEndowmentDeposit)`. |
| Shell boundary source | PASS by source | `PublicShell` renders `SiteHeader`; `AppShell` renders bottom `AppBar`; `AppBar` hides in browser mode via `!isPwaPresentation`. `SiteHeader` desktop nav is `md:flex`, mobile hamburger is `md:hidden`. |

## Validation

Focused client tests passed via the root Vitest entrypoint:

```bash
env APP_ENV=test /Users/afo/.local/share/mise/installs/node/22.22.1/bin/node ../../node_modules/vitest/vitest.mjs run src/__tests__/views/Login.test.tsx src/__tests__/views/Assessment.test.tsx src/__tests__/views/ProfileAccount.test.tsx
```

Result: 3 files passed, 30 tests passed.

The package-local command:

```bash
bun run test src/__tests__/views/Login.test.tsx src/__tests__/views/Assessment.test.tsx src/__tests__/views/ProfileAccount.test.tsx
```

did not reach Vitest because `packages/client/node_modules/.bin/vitest` shells through `npm --prefix /tmp exec --yes --package=node@20`, and the offline sandbox could not resolve `registry.npmjs.org/node`. This is a tooling proof limit, not an app failure.

Plan hub validation was run as requested:

```bash
node scripts/harness/plan-hub.mjs validate
```

Result: **failed on unrelated pre-existing `.plans/active/admin-design-revamp` issues** (invalid taxonomy values, missing required standard lanes, missing linked file, and missing handoff paths). The validator output did not report a `client-pwa-gardener-audit` error. I did not edit the unrelated admin plan.

## Remaining Proof Limits

- No authenticated live check for PWA Home, Garden, or Profile in this pass; the available browser profile was logged out.
- No populated public Garden dialog check; local public garden data was empty.
- No fresh mobile runtime screenshot; headless Chromium launch needed sandbox escalation and was rejected. Source confirms the responsive shell split, but this pass should not claim mobile visual proof.
- No governance positive runtime case; local data/auth did not provide a garden with both `canReview` and configured Conviction strategy.

## Disposition

Keep this lane blocked until the Account details disclosure is restored or the release expectation is explicitly changed. If restored, rerun the focused profile test with an assertion that `AccountInfo` is inside a collapsed `<details>` and repeat a live authenticated `/profile` check.
