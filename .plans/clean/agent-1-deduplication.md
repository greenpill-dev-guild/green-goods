# Agent 1: Deduplication & DRY Findings

Monorepo: `/Users/afo/Code/greenpill/green-goods` (bun, 7 packages). Focused on admin↔client↔shared duplication, not contracts/indexer (which have legit runtime isolation).

## Executive Summary

1. **`useTxErrorMessages` hook is built but unused.** The shared hook at `packages/shared/src/hooks/utils/useTxErrorMessages.ts` exists explicitly to replace a ~20-line boilerplate that is still copy-pasted across 6 components. Single biggest mechanical win: adoption saves ~110 LOC. See HIGH-1.
2. **`useMediaQuery` is duplicated in admin** despite being in shared. The 2026-04-15 principles audit flagged this — it's still there (`CanvasLayout.tsx:44`). One-line fix.
3. **`formatDateRange` and `formatBytes`/`formatFileSize` are duplicated within shared itself.** One in `admin/Assessment/shared.tsx`, one in `shared/utils/time.ts`; another pair within shared (`quota.ts` vs `image-compression.ts`). Cleanup target.
4. **`TradeHistoryTable.tsx` has 3 local helpers that duplicate shared utilities** (`truncateAddress`, `formatTimestamp`, inline explorer URL construction). Replace with `formatAddress`, `formatDate`, `getBlockExplorerTxUrl`.
5. **Admin and client each have their own CookieJar deposit modal** with ~70% overlapping logic; same pattern with Vault deposit. Cross-boundary consolidation possible but needs design sign-off (surface identity is intentionally different).

---

## HIGH-CONFIDENCE (safe to fix)

### 1. `useTxErrorMessages` adoption — 6 call sites still using raw boilerplate

The shared hook `useTxErrorMessages(error)` already exists at `packages/shared/src/hooks/utils/useTxErrorMessages.ts` and returns `{ view, title, message }`. It has ZERO adopters — the exact boilerplate it replaces is duplicated at:

- `packages/admin/src/components/Vault/DepositModal.tsx:143-163` (21 LOC)
- `packages/admin/src/components/Vault/WithdrawModal.tsx:116-136` (21 LOC)
- `packages/admin/src/views/Hub/components/CookieJarDepositModal.tsx:85-105` (21 LOC)
- `packages/admin/src/views/Hub/components/CookieJarWithdrawModal.tsx:79-99` (21 LOC)
- `packages/client/src/components/Dialogs/CookieJarDepositDialog.tsx:80-94` (15 LOC — slightly different, no "cancelled" branch)
- `packages/client/src/components/Dialogs/VaultDepositDialog.tsx:70-94` (25 LOC approx)

**Fix**: Replace `useMemo(()=>classifyTxError(...), ...)` + manual `formatMessage` blocks with `const { view, title, message } = useTxErrorMessages(mutation.error);`.

**Est. LOC reduction**: ~110 LOC (plus ~6 `classifyTxError`/`isMeaningfulTxErrorMessage` imports removed).

**Owner**: Shared hook is already there; just migrate consumers.

### 2. `useMediaQuery` local re-implementation in admin

- Local copy: `packages/admin/src/components/Layout/CanvasLayout.tsx:44-57`
- Canonical: `packages/shared/src/hooks/ui/useMediaQuery.ts` (already in barrel at `packages/shared/src/index.ts:503`)

`views/Hub/index.tsx:17` already imports from shared. Only `CanvasLayout` has the stale copy.

**Fix**: Delete local function at `CanvasLayout.tsx:44-57`, add `useMediaQuery` to the `@green-goods/shared` import at top of file.

**Est. LOC reduction**: 14 LOC.

### 3. `TradeHistoryTable` has 3 local helpers duplicating shared utilities

`packages/admin/src/components/Hypercerts/TradeHistoryTable.tsx`:

- Line 17-22: local `formatUnits(units: bigint)` — abbreviates as "1.2M"/"1.2K". Not in shared yet but is a one-off; low priority.
- Line 24-31: `formatTimestamp(timestamp)` → duplicates `formatDate(timestamp * 1000, { month: "short", day: "numeric", year: "numeric" })` from `@green-goods/shared`.
- Line 33-35: `truncateAddress(address)` → duplicates `formatAddress(address, { variant: "card" })` from `@green-goods/shared` (same `6...4` behavior).

Also at line 48 + template usage, this file constructs the tx URL inline: `explorerUrl = networkConfig?.blockExplorer` + string interpolation. Should use `getBlockExplorerTxUrl(chainId, txHash)` from shared.

**Fix**: Replace 3 helpers with shared imports; use `getBlockExplorerTxUrl`.

**Est. LOC reduction**: 20+ LOC + 1 file simpler.

### 4. `getBlockExplorerTxUrl` missing from shared barrel

`packages/shared/src/utils/eas/explorers.ts:51` defines `getBlockExplorerTxUrl`. `packages/shared/src/utils/index.ts:218` exports it. But `packages/shared/src/index.ts` only exports `getBlockExplorerAddressUrl` and `getBlockExplorerTokenUrl` (lines 953-954) — `getBlockExplorerTxUrl` is missing.

Consumers that inline-construct tx URLs as a result:

- `packages/admin/src/components/Vault/VaultEventHistory.tsx:106` and `:173` — `href={\`${blockExplorer}/tx/${event.txHash}\`}`
- `packages/admin/src/components/Hypercerts/TradeHistoryTable.tsx:48` — `const explorerUrl = networkConfig?.blockExplorer;` + usage
- `packages/admin/src/components/Hypercerts/Steps/MintProgress.tsx` — reported in prior audit, verify

**Fix**: Add `getBlockExplorerTxUrl` to the barrel export list in `packages/shared/src/index.ts` alongside lines 953-954, then use it in the 2-3 call sites.

**Est. LOC reduction**: ~6 LOC in admin + correctness (single source of truth for URL formatting).

### 5. `formatDateRange` duplicated inside the monorepo (admin + shared)

- Admin: `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:256-279` (24 LOC, hard-coded "Not provided" string instead of `fallback` param, uses `–` vs `\u2013`)
- Shared (canonical): `packages/shared/src/utils/time.ts:553-576` (exported via barrel at `packages/shared/src/index.ts:932`)

The shared version is strictly more flexible (accepts a `fallback` param) and handles same type signatures. The admin re-export is used exactly once (`views/Garden/Assessment.tsx:9`) through `components/Assessment/index.ts:10`.

**Fix**: Delete the admin copy. `Assessment.tsx:9` should import from `@green-goods/shared`. Remove the re-export from `components/Assessment/index.ts:10`.

**Est. LOC reduction**: 24 LOC.

### 6. `formatBytes` vs `formatFileSize` duplicated within shared

- `packages/shared/src/utils/storage/quota.ts:167-177` — `formatBytes(bytes)` (units `B/KB/MB/GB`)
- `packages/shared/src/utils/work/image-compression.ts:367-375` — `formatFileSize(bytes)` (units `Bytes/KB/MB/GB`)

These are functionally equivalent (same `log/pow` math). The only differences are the "B" vs "Bytes" label and `toFixed(1)` vs `toFixed(2)`. Both are exported from shared (`index.ts:935` exports `formatFileSize`; `utils/index.ts:315` exports `formatBytes`).

**Fix**: Keep `formatBytes` (shorter unit labels match industry convention). Delete `formatFileSize` from `image-compression.ts`. Update `packages/client/src/components/Cards/Work/WorkCard.tsx:3,130` (only external consumer) to use `formatBytes`.

**Est. LOC reduction**: 10 LOC + 1 consistent API.

### 7. `normalizeAddress` duplicated inside shared

- Canonical: `packages/shared/src/utils/blockchain/address.ts:98-103` (overloaded, type-safe)
- Local copy: `packages/shared/src/modules/data/vaults.ts:190-192` (private, simpler)

This is shared-internal duplication. The file already imports other things from shared utils so it can just use the canonical.

**Fix**: Delete `normalizeAddress` at `vaults.ts:190`, import from `../../utils/blockchain/address`.

**Est. LOC reduction**: 3 LOC + single source of truth for address normalization.

*(Skipped: indexer and contracts/script versions are intentionally isolated — Envio runtime doesn't import shared, and deploy scripts run in a different tsconfig context. Do NOT deduplicate across that boundary.)*

### 8. `WorkDetailStatusBadge` in admin duplicates shared `StatusBadge`

`packages/admin/src/views/Garden/WorkDetail/index.tsx:100-129` defines a local `WorkDetailStatusBadge` for work statuses (pending/approved/rejected) with its own `statusConfig` record, icon lookup, and i18n. `packages/shared/src/components/StatusBadge.tsx` already supports `status: "pending" | "approved" | "rejected"` with identical behavior (canonical, exported from the barrel at line 216 of `shared/components/index.ts`).

`ActionDetail.tsx:6,155` already uses the shared version correctly.

**Fix**: Replace `WorkDetailStatusBadge` with `<StatusBadge status={work.status} />`. Remove local component and its icon imports.

**Est. LOC reduction**: ~30 LOC.

---

## MEDIUM (needs judgment)

### 9. `ImpactFunders` vs `GardenSupporters` — 85% duplicate

- `packages/admin/src/components/Vault/ImpactFunders.tsx` (88 LOC)
- `packages/admin/src/components/Vault/GardenSupporters.tsx` (~70 LOC)

Both:

- Call `useFunderLeaderboard()` (one with `{ gardenAddress }`, one without)
- Render identical loading skeleton (`rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm sm:p-5` + shimmer rows)
- Render identical header chrome (title/subtitle + yield pill)
- Iterate with `<FunderRow key={funder.address} funder={funder} maxYield={maxYield} />`

Differences: ImpactFunders has expand/collapse logic + context explainer text; GardenSupporters has no expand.

**Proposed consolidation**: A `FunderLeaderboardPanel` component taking `{ gardenAddress?: Address; title; subtitle; explainer?: string; defaultVisible?: number }` props. Skeleton + header + row loop + (optional) expand all internal.

**Est. LOC reduction**: ~80 LOC (one surface keeps both views' configurations). Requires design review for the expand-by-default behavior.

### 10. Cookie Jar Deposit Modal: admin vs client cross-boundary duplicate

- `packages/admin/src/views/Hub/components/CookieJarDepositModal.tsx` (258 LOC)
- `packages/client/src/components/Dialogs/CookieJarDepositDialog.tsx` (comparable size, uses `DialogShell`)

Both implement: jar selector, amount input with decimals/validation, min-deposit check, wallet balance hook, `useCookieJarDeposit` mutation, error display.

**Reason to keep separate (surface identity)**: Admin uses `AdminDialog` (strict M3), client uses `DialogShell` (warm glass). Typography and layout polish are different.

**Proposed consolidation**: Extract a `useCookieJarDepositForm(gardenAddress, isOpen)` hook to `@green-goods/shared/hooks/cookie-jar/useCookieJarDepositForm.ts` that encapsulates: jar state, amount state, decimals, validation, parsed amount, mutation lifecycle, belowMin check. Return `{ jar, setJar, amount, setAmount, inputError, belowMin, parsedAmount, mutation, submit, reset, txMessages }`. Each modal wraps it in its own surface chrome.

**Est. LOC reduction**: ~80 LOC each — net ~120 LOC after hook is added. Owner: **shared** (per CLAUDE.md hook boundary rule).

### 11. Cookie Jar Withdraw Modal duplication (withdraw-only, within admin)

- `packages/admin/src/views/Hub/components/CookieJarWithdrawModal.tsx` (241 LOC)

70% overlap with CookieJarDepositModal structure. Adding a `useCookieJarWithdrawForm` hook following the same pattern as finding 10 would yield additional ~60 LOC reduction when the modal chrome can share an internal layout.

### 12. Vault Deposit/Withdraw Modal duplication

- `packages/admin/src/components/Vault/DepositModal.tsx` (366+ LOC) and `WithdrawModal.tsx` — same pattern as cookie jar: form state, decimals, debounced amount (`useDebouncedValue`), validation, mutation, tx feedback.
- Plus the **exact same** tx-error block duplicated (see HIGH-1).

**Note**: Deposit has gas estimation (`useEstimateGas` + `useGasPrice`) and max-deposit limits; withdraw has max-withdrawable. So the non-chrome logic is different. Consolidation here would be the tx-error block only (already covered in HIGH-1).

### 13. `DOMAIN_ICON_CONFIG` (admin) vs `DOMAIN_CONFIG` (shared) — two shapes for same data

- `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:8-30` — `{ icon: string, color: string, labelId: string }` with `DOMAIN_LABEL_DEFAULTS` at lines 32-37
- `packages/shared/src/config/domain.ts:19-72` — `{ icon: Component, labelId, colors: {bg,text,border}, gradient: {from,to} }`

Both map the same 4 `Domain` enum values to display metadata. The admin one uses a Remixicon *string* (`"ri-sun-line"`) because the Assessment wizard renders via `<i className={icon}>` instead of a React component.

**Proposed consolidation**: The shared `DOMAIN_CONFIG.icon` is already a component (`RiSunLine` etc.). The only real divergence is "string icon name vs component". Rather than storing both, pick one and migrate. Simpler path: change Assessment wizard to render `<config.icon className="..."/>` like the rest of the app. Removes `DOMAIN_ICON_CONFIG` + `DOMAIN_LABEL_DEFAULTS` entirely.

**Est. LOC reduction**: ~25 LOC. Owner: shared (it wins).

### 14. Native `<select>` chrome duplicated across 4 modals

Exact class string `"mt-1.5 w-full rounded-lg border border-stroke-sub bg-bg-white px-3 py-2.5 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/40"` appears (almost verbatim, small padding/radius differences) in:

- `admin/src/views/Hub/components/CookieJarDepositModal.tsx:137`
- `admin/src/views/Hub/components/CookieJarWithdrawModal.tsx:126`
- `client/src/components/Dialogs/CookieJarDepositDialog.tsx:158`
- `client/src/components/Dialogs/VaultDepositDialog.tsx:139`

This is native `<select>` styling (not a component swap). The admin set uses `AdminTextField`; there is no `AdminSelect` yet.

**Proposed consolidation**: Add an `AdminSelect` wrapper to `packages/admin/src/components` (admin surface) following the pattern of the other `Admin*` components. Client side is fewer usages and uses `DialogShell`; may warrant a `Select` primitive in `@green-goods/shared`.

**Est. LOC reduction**: ~8 LOC saved per call site — but real win is design-system compliance, not LOC.

### 15. `WorkCard` (Hub) + `HubWorkCard` — one used, one only in stories

- `packages/admin/src/views/Hub/components/WorkCard.tsx` (116 LOC) — wraps shared `WorkCardComponent`, used in `WorkSubmissionsView.tsx:12`
- `packages/admin/src/views/Hub/components/HubWorkCard.tsx` (218 LOC) — image-focused card, only imported in `HubWorkCard.stories.tsx` and `__tests__/components/HubWorkCard.test.tsx`

`HubWorkCard` has no runtime consumer. It's either dead code or intended for a pending Hub visual. Either way, the two cards do NOT duplicate each other — they coexist without being reconciled. Flag for the dead-code pass (agent-3) to confirm.

---

## LOW (probably not worth it)

### 16. Inline spinners: `<RiLoader4Line className="h-X w-X animate-spin" />` — 35 occurrences

Shared `Spinner` + `CenteredSpinner` exist (`packages/shared/src/components/Spinner.tsx`) but are used only 5 times. The inline usage is semantically the same but sizing varies (`h-3.5`, `h-4`, `h-5`, `h-6`) and color class varies (`text-text-soft`, `text-primary-base`, etc.). Replacing all would be a mechanical but LOW-value pass; the inline version is arguably clearer for button-adjacent spinners. **Not worth consolidating** unless design system is enforcing it.

### 17. `Array.from({ length: N }).map(...)` skeleton loops — 14 occurrences

Pattern appears in admin + client for skeleton rows. Could become `<SkeletonRows count={N} />` but the internal skeleton shape differs by view (table rows, cards, list items). Not enough similarity — **intentional**.

### 18. Inline `toLocaleDateString()` without `formatDate` helper

Found in 3 places:

- `admin/src/components/Layout/CommandPalette.tsx:284`
- `admin/src/views/Garden/HypercertDetail.tsx:447`
- `client/src/views/Home/Garden/index.tsx:350`

Shared has `formatDate()`, `formatDateTime()`, `formatRelativeTime()`. Could migrate for consistency but 3 hits is marginal. **Not worth** unless doing a sweep.

### 19. Mobile-safe dialog max-width `max-w-[calc(100vw-2rem)] sm:max-w-md` — duplicated in 2 shared components + admin

Both `packages/admin/src/components/AdminDialog.tsx:73` and `packages/shared/src/components/Dialog/ConfirmDialog.tsx:244` use this exact string. Since `AdminDialog` and `DialogShell/ConfirmDialog` are intentionally separate wrappers (see memory: project_dialog_architecture.md), each with its own surface identity, this is **intentional** — both happen to follow the same Rule 14 from frontend-design.md.

### 20. `.toLowerCase()` on addresses — 18+ occurrences

Many hooks call `address.toLowerCase()` inline instead of using the canonical `normalizeAddress`. Consolidating this is LOW priority — the behavior is identical and inlining is readable. The dedupe win from finding 7 (inside vaults.ts) is enough.

---

## Explicit NON-FINDINGS (checked and rejected)

- **`AdminCard` vs shared `Card`** — Intentionally separate. M3 strict anatomy (per project_m3_component_compliance memory) requires admin-owned wrappers with `data-component="AdminCard"` for CSS scoping. Don't merge.
- **Admin `AdminDialog` vs shared `DialogShell`** — Also intentional per project_dialog_architecture memory (2026-04-17). Admin uses M3 Basic Dialog chrome, shared uses warm glass. Do not merge.
- **`indexer/handlers/helpers.ts` `normalizeAddress`** — Envio handlers run in a Node runtime that doesn't import `@green-goods/shared`. Leave it.
- **`contracts/script/.../normalizeAddress`** — Deploy scripts use their own tsconfig + are forge/foundry-adjacent. Leave alone.
- **Client `Display/Image/ImageWithFallback.tsx`** — Already a pure re-export shim (`export { ImageWithFallback } from "@green-goods/shared"`). No work to do.
- **Two Hub WorkCards (finding 15)** — Not duplicates of each other; they serve different purposes. Flag to agent-3 as potential dead code.
- **`CreateAction.tsx` vs `EditAction.tsx`** (580 total LOC) — Different zod schemas, different form fields, different API surface. Not duplicates. Consolidating would create worse conditional complexity.
- **Client `ActionCard`, `DraftCard`, `WorkCard` + shared `Cards/*`** — Client cards intentionally compose `Card`/`CardBase` primitives from client's own `Base/Card`, not shared `Cards`. Client surface identity per design system. Leave intact.
- **Native `<select>` vs `AdminSelect`** — No `AdminSelect` exists yet. Flagged in finding 14 as a potential new primitive, but creating one is out of scope for a dedup pass; that's a feature add.
- **`useCookieJarWithdraw` per-component error clear `useEffect`** — Subtly different deps per modal (deposit clears on jar+amount; withdraw clears on jar+amount+purpose). Could live in the proposed `useCookieJar*Form` hooks (finding 10/11) but not worth a standalone dedup.
- **Shared utility hooks (`useEventListener`, `useTimeout`, `useAsyncEffect`)** — Already canonical and adopted per react-patterns.md rules. Good shape.

---

## Priority-Ordered Action List

Pick top-N for immediate fix:

1. **HIGH-1** (`useTxErrorMessages` adoption × 6) — ~110 LOC, purely mechanical
2. **HIGH-4** (export `getBlockExplorerTxUrl` from barrel) — 1 LOC add, unblocks HIGH-3
3. **HIGH-3** (`TradeHistoryTable` local helpers) — ~20 LOC + correctness
4. **HIGH-2** (`useMediaQuery` in CanvasLayout) — 14 LOC, long-overdue from 2026-04-15
5. **HIGH-5** (`formatDateRange` dedupe) — 24 LOC
6. **HIGH-8** (`WorkDetailStatusBadge` → shared `StatusBadge`) — 30 LOC
7. **HIGH-6** (`formatFileSize` → `formatBytes`) — 10 LOC
8. **HIGH-7** (shared-internal `normalizeAddress`) — 3 LOC
9. **MEDIUM-9** (FunderLeaderboardPanel) — design sign-off needed
10. **MEDIUM-10/11** (Cookie Jar form hooks) — shared hook design needed

Total HIGH-only mechanical reduction: **~210 LOC** across ~12 files with no behavior change.
