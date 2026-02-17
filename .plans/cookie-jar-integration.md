# Cookie Jar Integration — Remaining Work

**Status**: Contracts + hooks DONE. UI remaining.
**Branch**: `feature/action-domains`
**Created**: 2026-02-10 | **Trimmed**: 2026-02-16

> `CookieJarModule.sol`, unit tests, shared hooks (`useCookieJarAdmin`, `useCookieJarDeposit`, `useCookieJarWithdraw`, `useGardenCookieJars`, `useUserCookieJars`), and admin `CookieJars.tsx` view exist.
> Full architecture, contract specs, audit checklist, and NFT gating strategy were implemented.

---

## Remaining: Phase 3 — Shared Package Gaps

| # | Task | Files | Status |
|---|------|-------|--------|
| 3.2 | Add `COOKIE_JAR_ABI` + `COOKIE_JAR_MODULE_ABI` to abis.ts | `shared/utils/blockchain/abis.ts` | TODO |
| 3.6 | Add `app.cookieJar.*` i18n keys (Endowment, Payouts, withdrawal status) | `shared/i18n/*.json` | TODO |
| 3.5 | Add `cookie-jar` query keys + invalidation patterns | `shared/hooks/query-keys.ts` | TODO |

---

## Remaining: Phase 4 — Client UI (Treasury Drawer Tabs)

| # | Task | Files | Status |
|---|------|-------|--------|
| 4.1 | Refactor `TreasuryDrawer` to use `ModalDrawer` tab props (Endowment / Payouts) | `client/components/Dialogs/TreasuryDrawer.tsx` | TODO |
| 4.2 | Extract current vault content into `EndowmentTabContent` | `client/components/Treasury/EndowmentTab.tsx` | TODO |
| 4.3 | Create `PayoutsTabContent` — balance, eligibility status, withdraw form, deposit, activity feed | `client/components/Treasury/PayoutsTab.tsx` | TODO |
| 4.4 | Add cookie jar state to Garden view (fetch jar, check eligibility) | `client/views/Home/Garden/index.tsx` | TODO |
| 4.5 | Update TopNav treasury button: show when jar OR vaults exist | `client/components/Navigation/TopNav.tsx` | TODO |
| 4.6 | Cooldown countdown timer component | `shared/components/CookieJar/CooldownTimer.tsx` | TODO |

**Default tab logic**: User has vault deposits → Endowment. Gardener with no deposits → Payouts. Otherwise → Endowment.

**Payouts tab sections**: Jar balance → Your status (eligible/cooldown/not-member) → Deposit form → Recent activity.

**Access rules**: Gardeners/Operators/Owners can withdraw (all wear gardener hat). Standalone Evaluators/Funders/Community cannot.

---

## Remaining: Phase 5 — Admin UI (Funding Management)

| # | Task | Files | Status |
|---|------|-------|--------|
| 5.1 | Rename `Vault.tsx` → `Funding.tsx`, add Endowment/Payouts tab structure | `admin/views/Gardens/Garden/Funding.tsx` | TODO |
| 5.2 | Create `PayoutsManagement` — config display, deposit form, swap trigger, history | `admin/components/CookieJar/PayoutsManagement.tsx` | TODO |
| 5.3 | Update garden detail summary card (show both Endowment + Payouts) | `admin/views/Gardens/Garden/Detail.tsx` | TODO |
| 5.4 | Router: `/gardens/:id/vault` → `/gardens/:id/funding` + redirect | `admin/router.tsx` | TODO |
| 5.5 | Cookie Jar step in garden creation wizard | `admin/views/Gardens/CreateGarden.tsx` | TODO |
| 5.6 | Update global treasury view with jar data | `admin/views/Treasury/index.tsx` | TODO |

**Operator actions**: Deposit, trigger multi-token swaps, pause/unpause, view history.
**Owner-only**: Emergency withdraw (if enabled).

---

## Remaining: Phase 6 — Deployment & E2E

| # | Task | Status |
|---|------|--------|
| 6.1 | Deploy Cookie Jar Factory on Arbitrum (if not already) | TODO |
| 6.2 | Deploy CookieJarModule on Sepolia | TODO |
| 6.3 | E2E: create garden → jar created → operator deposits → gardener withdraws | TODO |
| 6.4 | E2E: multi-token deposit → swap → withdraw ETH | TODO |
| 6.5 | E2E: cooldown enforcement, non-member rejection | TODO |

---

## Key Design References

**Naming**: "Endowment" = Octant yield vaults (savings). "Payouts" = Cookie Jar (petty cash).

**Architecture**: Garden TBA owns jar. Currency: ETH. Access: Hats ERC-1155 gardener hat. Cooldown: 24h default. Fixed amount: 0.01 ETH default.

**Multi-token**: Enabled — anyone deposits any token, auto-swapped to ETH via Uniswap. Not available on Celo (no Uniswap).

**NFT gating**: `balanceOf(user, gardenerHatId) >= 1`. HatsModule auto-mints gardener hat for Operators and Owners.
