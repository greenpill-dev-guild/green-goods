# Plan C: Admin UX Fixes

**GitHub Issues**: #376, #377, #418, #417, #412, #414
**Branch**: `fix/admin-ux`
**Status**: IN PROGRESS
**Created**: 2026-03-07
**Phase**: 2 (after Plan A lands)
**Depends on**: Plan A (shared infrastructure)

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Fix infinite re-render loop FIRST | Blocks all other create garden work |
| 2 | Change domain defaults to empty array | Users should consciously select domains |
| 3 | Swap member order: operators first, gardeners second | User's explicit request |
| 4 | Add advisory: "Operators are also gardeners" | Missing context per walkthrough |
| 5 | Split TVL into two separate stat cards | Avoids overflow, cleaner design |
| 6 | Cap positions section at max-height with scroll | Prevent unbounded growth |
| 7 | Promote description above details in action sidebar | Most important content first |

## CLAUDE.md Compliance
- [x] Hooks in shared package (store + form hook changes)
- [x] i18n for UI strings (advisory text, "Distribute Rewards" rename, tooltips)
- [x] No deep imports — barrel imports only

## Impact Analysis

### Files to Modify
- `packages/admin/src/views/Gardens/CreateGarden.tsx` — fix infinite loop
- `packages/shared/src/hooks/garden/useCreateGardenForm.ts` — domain defaults
- `packages/admin/src/components/Garden/CreateGardenSteps/TeamStep.tsx` — member order, advisory
- `packages/admin/src/components/Garden/CreateGardenSteps/DetailsStep.tsx` — domain selection UX
- `packages/admin/src/views/Endowments/index.tsx` — TVL card, positions section
- `packages/admin/src/views/Actions/ActionDetail.tsx` — description layout
- `packages/admin/src/components/Work/CookieJarWithdrawModal.tsx` — title copy
- `packages/admin/src/components/Work/CookieJarPayoutPanel.tsx` — button copy
- `packages/admin/src/components/Dashboard/GardenSummaryList.tsx` — richer stats
- `packages/admin/src/components/Dashboard/RecentActivitySection.tsx` — richer events
- `packages/admin/src/components/Vault/WithdrawModal.tsx` — decimal precision
- i18n `en.json` — updated keys

### Files to Create
- None

## Test Strategy
- **Unit tests**: Create garden form validation, member dedup, domain defaults
- **Component tests**: Endowment card rendering, activity feed events
- **Manual**: Create garden flow end-to-end, vault withdraw with dust amounts

---

## Implementation Steps

### Step 1: Fix create garden infinite re-render loop (P0) ✅
**Files**: `packages/admin/src/views/Gardens/CreateGarden.tsx` (lines 141-143)
**Details**:
- Current code creates a loop because `form` is a new object reference every render from Zustand, and `resetValidationForm` (RHF's `reset`) triggers re-renders

**Current code (lines 141-143)**:
```typescript
useEffect(() => {
  resetValidationForm(form);
}, [form, resetValidationForm]);
```

**Fix options** (pick one):
1. **Remove the effect entirely** — if the purpose is to sync Zustand → RHF, use RHF's `defaultValues` prop instead of resetting on every change
2. **Memoize the form comparison** — use a deep equality check or serialize form to JSON, only reset when actual values change
3. **Use `useShallow`** — the component already uses `useShallow` at line 26 for store selectors, but the form object itself may not be shallow-stable

**Recommended**: Option 2 — replace the raw `form` dependency with a serialized key:
```typescript
const formKey = JSON.stringify(form);
useEffect(() => {
  resetValidationForm(form);
}, [formKey]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Verification**: Type in form fields — no rapid re-renders in React DevTools Profiler

---

### Step 2: Change domain defaults to empty and swap member order ✅
**Files**:
- `packages/shared/src/hooks/garden/useCreateGardenForm.ts` (line 86)
- `packages/admin/src/components/Garden/CreateGardenSteps/TeamStep.tsx`

**Domain defaults — line 86**, change:
```typescript
domains: [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE],
```
to:
```typescript
domains: [],
```

**Member order — TeamStep.tsx**: Swap the two sections:
- Move operators section (currently lines 114-191) ABOVE gardeners section (lines 35-112)
- Add advisory text explaining: "Operators are also gardeners — adding someone as an operator automatically grants gardener access"

**Current advisory at lines 20-34**:
```
"These addresses are planning notes. Add them on-chain from Garden Members after deployment."
```
Add below it:
```
"Note: Operators automatically have gardener access. You don't need to add them to both lists."
```

**Verification**: New garden form starts with no domains selected. Operators section appears first.

---

### Step 3: Fix vault withdraw decimal precision ✅ (already correct)
**Files**: `packages/admin/src/components/Vault/WithdrawModal.tsx`
**Details**:
- Line 86: `validateDecimalInput(amountInput, assetDecimals)` — correct
- Line 93: `parseUnits(amountInput, assetDecimals)` — correct
- Line 227: `formatTokenAmount(maxWithdrawable, assetDecimals)` — correct
- Line 233: `formatTokenAmount(maxShares, 18)` — **hardcoded 18 decimals for shares display**

**The issue**: When vault shares have different decimals than 18, the display is wrong. But ERC-4626 vault shares are always 18 decimals, so this may be cosmetically correct.

**Real issue from walkthrough**: "amount exceeds balance" on small amounts. This is likely:
1. Rounding error when converting between shares and assets on dust amounts
2. The user tries to withdraw their full balance, but `maxWithdraw()` returns slightly less than displayed balance due to rounding

**Fix**: When user clicks "Max", use the vault's `maxWithdraw()` return value directly instead of the displayed balance. Ensure the "Max" button fills the exact withdrawable amount, not the formatted display amount.

**Verification**: Deposit 0.01 DAI → withdraw max → succeeds without "amount exceeds balance"

---

### Step 4: Endowment views — TVL, asset order, positions height ✅
**Files**: `packages/admin/src/views/Endowments/index.tsx`

**TVL overflow (lines 303-310)** — split into two stat cards:
```typescript
// Instead of one combined card:
<StatCard value={`${ethAmount} ETH / ${daiAmount} DAI`} />
// Use two cards:
<StatCard label="ETH Locked" value={`${ethAmount} ETH`} />
<StatCard label="DAI Locked" value={`${daiAmount} DAI`} />
```

**Asset order consistency** — standardize everywhere to: ETH first, then DAI (alphabetical by symbol would put DAI first, but ETH-first is more natural for crypto UX). Apply to:
- TVL stat cards (now separate)
- Garden vault cards (lines 487-501) — sort by asset
- My Tracked Positions (lines 264-269) — change sort to match

**Positions height (lines 325-372)** — add max-height with scroll:
```typescript
<div className="max-h-[400px] overflow-y-auto space-y-3">
```

**Verification**: Endowments page with multiple positions doesn't overflow. Asset order is consistent.

---

### Step 5: Action detail — promote description, fix layout ✅
**Files**: `packages/admin/src/views/Actions/ActionDetail.tsx` (lines 170-265)
**Details**:
- Current: 2/3 media gallery (left) + 1/3 sidebar (right) with Details → Description → Form Fields
- Fix: Move description ABOVE the grid (full-width), or make it the FIRST item in the sidebar
- For single-image actions, consider collapsing the grid to a more balanced layout

**Approach**: Swap description and details order in the sidebar:
- Line 238 (description card) moves to before line 203 (details card)
- This puts description as the first thing in the sidebar — visible without scrolling

**Verification**: Action with description shows it above the fold on desktop

---

### Step 6: Rename "Pay Gardeners" copy ✅
**Files**:
- `packages/admin/src/components/Work/CookieJarWithdrawModal.tsx` (lines 119-123)
- `packages/admin/src/components/Work/CookieJarPayoutPanel.tsx` (lines 92-98)
- i18n `en.json`

**Change**: Update i18n key `app.cookieJar.withdrawModal.title`:
- From: "Pay Gardeners"
- To: "Distribute Rewards" (or "Cookie Jar Withdrawal" — check with user)

**Verification**: Modal title and button text show new copy

---

### Step 7: Garden dashboard cards — richer stats ✅ (work count badge added)
**Files**: `packages/admin/src/components/Dashboard/GardenSummaryList.tsx` (lines 119-200)
**Details**:
- Currently shows: thumbnail, name, location, date, domain dots, member count, status
- Add: work submission count, vault TVL (if available from existing queries)
- Use CSS-native tooltips (`title` attribute) for hover details on stats
- Keep the row compact — add stats as small badges/counts inline

**Verification**: Garden cards show work count and vault info alongside existing stats

---

### Step 8: Recent Activity — richer event types ⏳ (deferred — needs work_approval data plumbing)
**Files**: `packages/admin/src/components/Dashboard/RecentActivitySection.tsx`
**Details**:
- Currently supports 4 event types: garden_created, work_submitted, work_approved, assessment_created
- Add: `gardener_added`, `impact_certificate_minted`, `deposit_received` (if data available from hooks)
- Review data sources: `usePlatformStats()` hook — what additional events can it provide?
- Keep max 8 items, compact feed layout
- Each event should link to the relevant detail page

**Verification**: Activity feed shows diverse event types, not just garden creation

---

## Validation

```bash
bun format && bun lint && bun run test && bun build
```
