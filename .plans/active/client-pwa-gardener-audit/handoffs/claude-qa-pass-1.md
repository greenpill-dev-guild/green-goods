# Client PWA Gardener Audit — qa_pass_1 Handoff

**Feature**: `client-pwa-gardener-audit`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `passed (with limitations noted)`
**Branch**: `claude/qa-pass-1/client-pwa-gardener-audit`
**Depends on**: `ui`, `state_api`, `contracts (n/a)`
**Date**: 2026-05-03

## Run Profile

- Dev server: already-running PM2 stack at `https://localhost:3001` (verified by tab navigation; not started by this pass).
- Test user: authenticated session for `0xaB8C…fb0a` (afo).
- Browser tab: Brave via Chrome MCP, tab `131716150`.
- Widths exercised: desktop `1302×629` and mobile `447×629` (after window resize to 393×852 — Chrome chrome accounts for the ~50 px delta).
- Presentation overrides used: `?presentation=website` (browser shell), `?presentation=pwa` (installed-app shell). Source: `packages/shared/src/utils/app/pwa.ts:188-247`.

## Acceptance Check Results

| # | Acceptance check (from `eval.md` / `fixes.md` §Manual browser pass) | Result | Evidence |
|---|---|---|---|
| 1 | Browser-vs-PWA shell boundary holds at desktop and mobile widths | **PASS (browser)** | `/?presentation=website` ⇒ `SiteHeader` with main nav + `Open menu` hamburger, no bottom `nav`; `/home?presentation=pwa` ⇒ no `SiteHeader`, bottom `nav` with Home / Garden / Profile. Validated at 1302×629 and 447×629. |
| 2 | `/login` new-user passkey-first reveal animation | **CODE-ONLY** | Cannot exercise without logging the user out. Code-verified: `views/Login/index.tsx:395-412` — new-user default mode renders `Splash` with primary `app.login.button.createPasskeyAccount` ("Create your account"); clicking calls `setShowPasskeyCreate(true)`; secondary action is the wallet path (`app.login.button.connectWallet`). When the authenticated session navigates `/login`, `RequireAuth` redirects to `/home` (observed live during this pass). |
| 3 | `/home/:id` non-operator header has no Governance / Endowment icons | **PASS (browser, with positive contrast)** | **Negative case**: visited Ilhas de Abundância (`/home/0x749F…D532`), Vida Verde (`/home/0x26c3…76E2`), and Green Goods Community Garden (`/home/0xf401…858a`). Header in every case: Skip to content / Go back / garden title + location + founded date / Work · Insights · Gardeners tabs. No Governance icon, no Endowment icon. **Positive contrast**: visited Aiyeloja Family Garden (`/home/0xF7b8…37A0`) where the user `0xaB8C…fb0a` is an operator (`0xab…b0a` in the garden's operator list). Header now adds `View notifications` + `Open endowment` buttons — Endowment chip appears because `gardenVaults.length > 0 && canReview === true`. Aiyeloja has no Conviction strategy configured, so the Governance icon is correctly still absent (`hasGovernanceConfigured === false` ⇒ `showGovernanceButton === false` regardless of `canReview`). The presence/absence pattern matches the gating expression in `views/Home/Garden/index.tsx:174-175`. |
| 4 | `/profile` Account details disclosure collapsed by default | **PASS (browser)** | `<details>` element present with `open === false`; summary text "Account details / Sign-in method, address, and advanced settings." Toggling the summary increased `#profile-scroll.scrollHeight` from 1465 → 1719 (Δ = 254 px, matching the inner div's height) — proves the inner `AccountInfo` block is not contributing visible scroll content while collapsed. Validated at desktop (1302×629) and mobile (447×629). |
| 5 | `/home/:id/assessments/:assessmentId` non-operator gardener-friendly rendering | **CODE-ONLY** | No garden in the local dataset has any assessments — Insights tab on Vida Verde and Green Goods Community Garden both show "No assessments yet for this garden." Cannot browser-exercise the gardener-friendly rows / hidden impact-attestations branch without seeded assessment data. Code-verified: `views/Home/Garden/Assessment.tsx:24-25` (`isOperatorView = canManageGarden(garden)`), `:136` (operator-only `<pre>` JSON), `:213` (operator-only impact-attestations section), `:198-201` (`app.garden.assessments.documentItem` indexed labels). |

## Browser Walk Notes

### Public website shell (`?presentation=website`)
- `/`: SiteHeader logo + nav (Gardens / Impact / Fund / Actions) + `Install App` + `Open menu`. Renders editorial homepage and footer.
- Mobile width: nav collapses, `Open menu` hamburger remains, no bottom nav. Boundary holds.

### Installed PWA shell (`?presentation=pwa`)
- `/home`: bottom `nav` (Home / Garden / Profile). No SiteHeader. Garden cards render with `data-testid="garden-card"`. Pull-to-refresh status visible.
- Tabbed garden detail (`/home/:address`) renders `Work` / `Insights` / `Gardeners`. No leaked operator chrome on default header for the tested gardens.

### `/profile`
- Visible top-level surfaces (collapsed disclosure absent): InstallCta · AppSettings (Theme / Language / Refresh app) · GardensList · ENSSection ("Claim your name", "Claim name" CTA — gardener-friendly copy as fixes.md §7 + #20 prescribe).
- `<details>` for Account details:
  - `open === false` after fresh navigation, both widths.
  - Summary container: dropdown caret, hint copy correct.
  - On `summary.click()`: scrollHeight delta exactly +254 px on desktop (`1465 → 1719`); inner `AccountInfo` block (Wallet / Address chip / Logout) becomes laid-out content.
  - Re-clicking returns scrollHeight to 1465 — toggle is reversible.

## Limitations / Gaps

- **No live `/login` walkthrough**: blocked by "do not destroy authenticated session." Recommend qa_pass_2 (Codex) hit `/login` from a fresh incognito profile or reuse the existing `Login.test.tsx` red/green coverage as the durable proof.
- **No live assessment walkthrough**: no garden in dev has assessment data. Either seed an assessment via the indexer / fixtures, or have qa_pass_2 confirm via `Assessment.test.tsx` + visual story (if any) before archive. The runtime risk is low since the `isOperatorView` branch is single-call (`canManageGarden(garden)`) and unit-tested.
- **Governance icon positive case still unconfirmed at runtime**: Aiyeloja gives us the Endowment positive contrast but no garden in the live dataset has both `canReview` and `hasGovernanceConfigured` for the active user, so the Governance icon's positive branch remains unit-test-only. The negative branch (icon hidden for non-operators *and* for operators on gardens with no Conviction strategy) is browser-confirmed.

## Suggested Disposition

- Mark `qa_pass_1` `passed` and unblock `qa_pass_2`.
- Codex qa_pass_2 should fold in the two code-only items above as final read-throughs (no implementation expected). If they find a divergence, RED/GREEN proof should follow before any code change.

## Reproduction Steps

```bash
# Prerequisites: dev:web stack already running, authenticated session.
# 1. Browser-vs-PWA boundary, mobile + desktop:
open "https://localhost:3001/?presentation=website"
open "https://localhost:3001/home?presentation=pwa"

# 2. Profile collapse check (with DevTools console):
open "https://localhost:3001/profile"
#   const det = document.querySelector('details');
#   const ps  = document.querySelector('#profile-scroll');
#   console.log({ open: det.open, scrollHeight: ps.scrollHeight }); // expect open:false, ~1465
#   det.querySelector('summary').click();
#   console.log({ open: det.open, scrollHeight: ps.scrollHeight }); // expect open:true,  ~1719 (+254)

# 3. Non-operator garden header:
open "https://localhost:3001/home/0x26c32E54F23af9F9fcC757414c76E56e3fB176E2"  # Vida Verde
#   header should show: Go back · title · location · founded date · Work | Insights | Gardeners
#   no Governance icon, no Endowment icon

# 4. Operator garden header (positive contrast):
open "https://localhost:3001/home/0xF7b892886998DAe960D64a9db488336684F137A0"  # Aiyeloja Family Garden
#   header should show: Go back · View notifications · Open endowment · title · …
#   Endowment chip is present (vault configured + operator); Governance still absent (no conviction strategy on this garden)
```
