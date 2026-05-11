# QA Pass 1 Handoff

**Actual branch**: `main` per operator instruction to stay on main.
**Planned branch**: `claude/qa-pass-1/hypercert-marketplace-arbitrum-readiness`
**Status**: passed.
**Date**: 2026-05-10

## Scope

Per `eval.md` § QA Sequence:

- Review admin UX and Storybook evidence for the marketplace state matrix.
- Confirm no marketplace state is hidden behind vague copy.
- Confirm design principles, i18n, and banned vocabulary checks.
- Confirm no client-facing surface implies marketplace completion without readiness evidence.

Out of scope (covered by qa_pass_2): regression validation across contracts/shared/admin packages, broadcast verification, plan-hub integrity sweep.

## Verdict

**Pass.** All UI lane acceptance criteria (AC-7, AC-8, AC-9, AC-10) are satisfied.

## Findings

### 1. State matrix coverage — pass

The full operator state matrix is now visible in the admin marketplace surface and exercised by tests:

| State | Trigger | Visible affordance | Test |
|---|---|---|---|
| unavailable | `getMarketplaceReadiness(chainId).available === false` | Shared `Alert` (warning) with chain id + missing-fields caption. Children, approval CTA, and listing CTA all hidden. `useMarketplaceApprovals` is **not** invoked. | `MarketplaceApprovalGate.test.tsx > state: unavailable` (2 assertions) |
| checking | Readiness available, approvals query loading | Spinner row, localized "Checking marketplace approvals..." | `state: checking` |
| needs-approval | Readiness available, missing approvals | Two-step approval card with grant CTA | `state: needs-approval` (2 assertions inc. mutation dispatch) |
| ready | Readiness + approvals both ok | Children render: "Not listed" body + `List for Yield` CTA, or active-listing summary | `state: ready` |
| pending | `grantApprovals` in flight | CTA shows "Approving..." and is disabled | `state: pending` |
| failure | `useMarketplaceApprovals().error !== null` | Inline error message + retainable CTA for retry | `state: failure` |

The listing dialog's own state machine (`building → signing → registering → confirming → done → error`) is unchanged by this lane and remains covered by `CreateListingDialog.test.tsx` and the `Steps/MintProgress` story tree.

**AC-7 ✓** — Unavailable state never exposes the `List for Yield` button or approval CTA. Verified by both the test assertion and the gate's structural split (`ApprovalGateInner` never mounts when readiness is unavailable, so `useMarketplaceApprovals` cannot fire its query against zero-address contracts).

**AC-8 ✓** — All five approval/listing visible states are reachable and tested. Listing-dialog states stay covered by the pre-existing dialog tests.

### 2. Operator clarity — pass

The unavailable alert names the active chain and lists missing artifact fields by canonical name (`hypercertExchange`, `hypercertMinter`, `transferManager`, `strategyHypercertFractionOffer`). For an operator cockpit this is actionable: they immediately know which deployment-artifact fields to populate before broadcasting the configuration transactions. No vague copy. No marketing claim.

Listing-state pills ("Listed for Yield" / "Expired") and the inline price/expires/orderId triple are specific. The "Not listed" body sits next to the `List for Yield` CTA inside the gate, so the operator scans status and the only safe next action in one glance.

### 3. Restrained admin design — pass

- Uses shared `Alert` (variant `warning`) for the unavailable state — matches AGENTS.md preferred primitives and Rule 16 (Alert for error/warning/info, no inline styled divs).
- No hero sections, decorative gradients, marketing banners, or promo callouts.
- Iconography stays operational: `RiAlertLine` for warning, `RiExchangeDollarLine` for the marketplace section heading, `RiShieldCheckLine` for the approval CTA.
- No glass effects outside the admin `AppBar`.
- Typography stays on `text-sm` body / `text-xs` caption — operator density, not marketing scale.
- The `surface-inset` section wrapper is unchanged; the gate composes inside it.

### 4. i18n + vocab — pass

- Three new keys added: `app.marketplace.unavailable.title`, `app.marketplace.unavailable.description`, `app.marketplace.unavailable.missingFields`.
- All three present in `en`, `es`, and `pt`. Verified by `cd packages/shared && bun run test src/__tests__/i18n/locale-coverage.test.ts` (12 tests pass).
- Spanish: "Marketplace no disponible en esta red" / Portuguese: "Marketplace indisponível nesta rede" — accurate, operational tone, no marketing voice.
- `bun run lint:vocab`: clean. No banned admin vocabulary (`hero moment`, `gallery`, `decorative gradient`, `marketing banner`, glass-outside-AppBar) and no banned cross-surface vocabulary (`streak`, `countdown`, `leaderboard`, `FOMO`).

### 5. No unsupported marketplace claims — pass

**AC-10 ✓**

- `grep -rli 'marketplace' packages/client/src` returns no results. The client PWA has no marketplace UI surface at all, so it cannot claim completion.
- `docs/docs/community/evaluator-guide/evaluating-certificates.mdx`: already states "Full marketplace and trade evaluation features are pending activation." No update needed.
- `docs/docs/builders/journeys/harvest.mdx`: marks the listing step as `partial` with a note that "Octant Vault auto-buy is aspirational". Honest pre-broadcast framing.
- Admin's own Hypercert detail surface never asserts the marketplace is ready; it derives the visible state purely from `getMarketplaceReadiness` and `useMarketplaceApprovals`.

### 6. Test surface — pass

- `cd packages/admin && bun run test src/__tests__/components/`: **30 files, 314 passed, 3 skipped, 0 failed**.
- `cd packages/admin && bun run test src/__tests__/components/hypercerts/`: **7 files, 153 passed**.
- `cd packages/admin && bun run test src/__tests__/components/hypercerts/MarketplaceApprovalGate.test.tsx`: **8 passed** (full state matrix).
- `cd packages/shared && bun run test src/__tests__/i18n/locale-coverage.test.ts`: **12 passed**.
- `bun run lint:vocab`: clean.
- `bun run --filter @green-goods/shared check:stories`: `PASS: Required Storybook contract is satisfied.`
- `cd packages/admin && VITE_CHAIN_ID=11155111 bun run build`: **success** (`built in 2m 6s`). Pre-existing 2 MB warning is unchanged.
- `node scripts/harness/plan-hub.mjs validate`: `Validated 20 feature hubs.`

## Non-Blocking Observations (Follow-Up Candidates)

These do not block the UI lane or qa_pass_2. Recording them so qa_pass_2 and future cleanups can decide whether to absorb them.

1. **Pre-existing inline-styled warning panel inside `ApprovalGateInner`.** The `needs-approval` and `checking` branches still use bespoke `<div className="rounded-lg border …">` and `<div className="flex items-center justify-center …">` instead of shared `Alert` / `Spinner`. Rule 16 prefers `Alert` for error/warning/info boxes. This is pre-existing technical debt; this lane only added the unavailable branch (which does use `Alert`) and left the existing branches alone to keep the diff minimal. Migration belongs in a focused admin-Alert-consolidation pass, not in the marketplace readiness lane.

2. **`chainId` source split inside the gate.** `MarketplaceApprovalGate` reads readiness from a `chainId` prop (passed as `garden.chainId ?? DEFAULT_CHAIN_ID` from `HypercertDetail.tsx`). The inner `useMarketplaceApprovals` reads `chainId` from `useAdminStore.selectedChainId`. In single-chain builds they're equal; in a hypothetical multi-chain future they could disagree, which would let the gate green-light approvals for a chain whose deployment artifact wasn't actually checked. Single-chain is the documented stance (`CLAUDE.md` § Key Principles), so this is latent and acceptable today.

3. **Trade History section keeps its header even when readiness is unavailable.** The section is rendered below the gated section in `HypercertDetail.tsx`; its body short-circuits to an empty state via `getTradeHistory`'s zero-adapter guard, so it's safe — but an operator sees "Trade History" with no entries which is mildly redundant alongside the unavailable alert. A future pass could hide the entire section when readiness is unavailable; this lane scope said "minimum admin UI change", so the rendering tree is unchanged.

4. **Unrelated pre-existing design-check drift.** `bun run check:design-tokens` flags `packages/client/vite/social-preview.ts` hex values and `bun run check:design-generated` flags `docs/docs/builders/packages/client-pwa-token-audit.generated.md` as stale. Neither file was modified by this lane (both authored by `feat(client): add static social preview shells` and `feat(client,shared): PWA native-feel remediation lane`). Belongs in a client-cleanup or docs-refresh lane.

## Acceptance Criteria Cross-Check

| AC | Description | Result |
|---|---|---|
| AC-7 | Hypercert marketplace UI shows setup-unavailable state without offering unsafe listing actions | Pass — unavailable branch hides children + CTA; no `useMarketplaceApprovals` call |
| AC-8 | Approval gate and listing flow cover needs-approval, ready, pending, success, and failure states | Pass — all states tested and reachable in Storybook + tests |
| AC-9 | New user-facing strings exist in en, es, pt; vocab and design-token checks pass when UI files move | Pass for files I touched; pre-existing client/docs drift flagged separately |
| AC-10 | QA pass confirms operator clarity, restrained admin design, and no unsupported marketplace claims | Pass |

## Recommendation

Promote `qa_pass_2` to `ready` so Codex can run the regression and plan-hub integrity sweep. UI lane stays `completed`. Feature stays `active` until qa_pass_2 closes.
