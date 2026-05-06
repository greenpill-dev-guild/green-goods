# Agent 1: Deduplication & DRY Findings (re-run, dry-run)

Scope: `admin`, `shared`, `client`, `contracts`. Agent + indexer out of scope.
Re-verified against current `develop` (2026-04-18). Prior report's HIGH-2 and HIGH-8 are still live exactly as described; two prior MEDIUMs (cookie jar and vault modal duplication) fully solidified — they are now HIGH adoption gaps.

## Executive summary

1. **`useTxErrorMessages` adoption is STILL zero — 10 call sites paste the same 15-25 LOC boilerplate** (up from 6 in the prior report). Two new consumers (`CreateGarden.tsx`, `CreateAssessment.tsx`) were added after the hook existed; neither uses it. ~170 LOC mechanical win. See HIGH-1. This is the single biggest finding.
2. **`formatAddress`/`truncateAddress` adoption gap — 7 inline `slice(0,6)...slice(-4)` duplicates in admin** (up from 1 known). Both helpers are already exported from `@green-goods/shared`. See HIGH-2.
3. **`useMediaQuery`, `normalizeAddress`, `formatDateRange`, `formatFileSize`, `WorkDetailStatusBadge`, `getBlockExplorerTxUrl` barrel** — all prior HIGH-2/4/5/6/7/8 findings are unchanged. None have been fixed in the last 30 commits.
4. **New: `toLocaleDateString()` inline — 13 occurrences** (up from 3). Promoted from LOW to HIGH — shared `formatDate`/`formatDateTime` exists. Consistency + locale safety.
5. **New: `address.toLowerCase() as Address` — 10+ sites in shared hooks** (yield, cookie-jar, greenwill, ENS). Should call `normalizeAddress` — tied to HIGH-7 (prior). Related to HIGH-6.
6. `ImpactFunders` / `GardenSupporters` still 85% duplicate. Unchanged MEDIUM.

---

## HIGH-CONFIDENCE findings (safe to fix)

### HIGH-1. `useTxErrorMessages` — 0 adopters, 10 hand-rolled consumers (ADOPTION FAILURE)

Shared hook at `packages/shared/src/hooks/utils/useTxErrorMessages.ts:29` returns `{ view, title, message }`. Zero files import it (`$RG useTxErrorMessages\(` → only the definition).

10 sites still do `classifyTxError(...)` + manual `formatMessage` blocks (15–25 LOC each):

- `packages/admin/src/components/Vault/DepositModal.tsx:144-164` (25 LOC)
- `packages/admin/src/components/Vault/WithdrawModal.tsx:117-138` (25 LOC)
- `packages/admin/src/views/Hub/components/CookieJarDepositModal.tsx:86-105` (21 LOC)
- `packages/admin/src/views/Hub/components/CookieJarWithdrawModal.tsx:80-99` (21 LOC)
- `packages/admin/src/views/Garden/CreateGarden.tsx:54-76` (~22 LOC) — **new since prior report**
- `packages/admin/src/views/Garden/CreateAssessment.tsx:298-316` (18 LOC) — **new since prior report**
- `packages/admin/src/components/Hypercerts/Steps/MintProgress.tsx:66-69` (partial — uses `classifyTxError` only; no `formatMessage` yet, but same pattern will grow)
- `packages/client/src/components/Dialogs/VaultDepositDialog.tsx:70-86` (17 LOC)
- `packages/client/src/components/Dialogs/CookieJarDepositDialog.tsx:80-97` (18 LOC)
- `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:169` (internal — different context, leave alone)

**Fix**: replace each with `const { view, title, message } = useTxErrorMessages(mutation.error);`. Remove `classifyTxError` + `isMeaningfulTxErrorMessage` + `useMemo` imports.

**Est. reduction**: ~170 LOC across 9 files. Purely mechanical; no behavior change.

**Owner**: shared hook exists — migration only.

### HIGH-2. `formatAddress`/`truncateAddress` — 7+ inline `slice(0,6)...slice(-4)` duplicates (ADOPTION GAP)

Shared `truncateAddress` at `packages/shared/src/utils/blockchain/address.ts:74` and `formatAddress` at `packages/shared/src/utils/app/text.ts` (barrel: `shared/src/index.ts:930, 1011`). Current inline duplicates:

- `packages/admin/src/components/Hypercerts/TradeHistoryTable.tsx:33-35` (local function definition)
- `packages/admin/src/components/Layout/UserMenu.tsx:52`
- `packages/admin/src/components/Garden/GardenMetadata.tsx:98,156`
- `packages/admin/src/components/Hypercerts/Steps/DistributionConfig.tsx:21`
- `packages/admin/src/components/Hypercerts/DistributionChart.tsx:56`
- `packages/admin/src/components/Hypercerts/Steps/HypercertPreview.tsx:61`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx:508`

**Fix**: Import `truncateAddress` from `@green-goods/shared` (handles undefined + defaults match: 6/4), or `formatAddress(addr, { variant: "card" })` for Address-typed inputs.

**Est. reduction**: ~10 LOC + API consistency. One source of truth for truncation.

### HIGH-3. `useTxErrorMessages` not in barrel — blocker for HIGH-1 adoption

Verify barrel before the HIGH-1 migration. `shared/src/hooks/utils/useTxErrorMessages.ts` exists but confirm `packages/shared/src/hooks/index.ts` and `packages/shared/src/index.ts` export it (a 1-line check; if not exported, that alone explains zero adoption).

Current state: `$RG "useTxErrorMessages" packages/shared/src/index.ts` returns **no results** — **the hook is NOT exported from the barrel**. This is the root cause of zero adoption.

**Fix**: Add `useTxErrorMessages` to `packages/shared/src/hooks/index.ts` (or wherever utility hooks are exported) and re-export from the root barrel. THEN run HIGH-1 migration.

**Est. reduction**: 1 LOC add, unblocks ~170 LOC reduction in HIGH-1.

### HIGH-4. `useMediaQuery` local re-impl in `CanvasLayout` — unchanged from prior report

- Local copy: `packages/admin/src/components/Layout/CanvasLayout.tsx:44-57` (14 LOC)
- Canonical: `packages/shared/src/hooks/ui/useMediaQuery.ts` (already in barrel)
- `views/Hub/index.tsx` already imports from shared — inconsistency.

**Fix**: Delete local, import from shared. Still outstanding since 2026-04-15.

**Est. reduction**: 14 LOC.

### HIGH-5. `TradeHistoryTable` local helpers duplicate shared utilities — unchanged

`packages/admin/src/components/Hypercerts/TradeHistoryTable.tsx:17-35`:

- Line 17-22: `formatUnits(units: bigint)` — abbreviates "1.2M"/"1.2K". Local one-off; LOW.
- Line 24-31: `formatTimestamp(timestamp)` → use shared `formatDate(timestamp * 1000, { month: "short", day: "numeric", year: "numeric" })`.
- Line 33-35: `truncateAddress(address)` → use shared `truncateAddress` or `formatAddress(addr, { variant: "card" })`.
- Line 48 + 137: inline `${explorerUrl}/tx/${trade.txHash}` → use `getBlockExplorerTxUrl` (see HIGH-6).

**Est. reduction**: ~20 LOC + correctness.

### HIGH-6. `getBlockExplorerTxUrl` missing from barrel — unchanged

`packages/shared/src/utils/eas/explorers.ts` exports it. `packages/shared/src/utils/index.ts` re-exports. But `packages/shared/src/index.ts:953-954` exports only `getBlockExplorerAddressUrl` + `getBlockExplorerTokenUrl`. Tx URL export is missing.

Result: 5 inline `/tx/${txHash}` constructions in admin:

- `packages/admin/src/components/Vault/VaultEventHistory.tsx:106,173`
- `packages/admin/src/views/Garden/HypercertDetail.tsx:234`
- `packages/admin/src/components/Hypercerts/TradeHistoryTable.tsx:137`
- `packages/admin/src/components/Hypercerts/Steps/MintProgress.tsx:211`

**Fix**: Add one line `getBlockExplorerTxUrl,` to the barrel, then migrate 5 call sites.

**Est. reduction**: ~6 LOC + single source of truth.

### HIGH-7. `formatDateRange` duplicated in admin + shared — unchanged

- Admin: `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:256-279` (24 LOC)
- Shared (canonical): `packages/shared/src/utils/time.ts:553` (has optional `fallback` param)
- Admin re-export: `packages/admin/src/components/Assessment/index.ts:10` (used once by `views/Garden/Assessment.tsx:9`)

**Fix**: Delete admin copy + re-export. Import from `@green-goods/shared`.

**Est. reduction**: 24 LOC.

### HIGH-8. `formatBytes` vs `formatFileSize` — unchanged

- `packages/shared/src/utils/storage/quota.ts:167` — `formatBytes` ("B/KB/MB/GB", `toFixed(1)`)
- `packages/shared/src/utils/work/image-compression.ts:367` — `formatFileSize` ("Bytes/KB/MB/GB", `toFixed(2)`)

Both exported from barrel. Only external consumer is `packages/client/src/components/Cards/Work/WorkCard.tsx:3,130` → `formatFileSize`.

**Fix**: Keep `formatBytes`. Delete `formatFileSize`. Migrate the one client call site + its test at `packages/client/src/__tests__/components/Cards.test.tsx`.

**Est. reduction**: 10 LOC + consistent API.

### HIGH-9. `WorkDetailStatusBadge` duplicates shared `StatusBadge` — unchanged

`packages/admin/src/views/Garden/WorkDetail/index.tsx:100-129` defines a local badge component (30 LOC) for `"pending" | "approved" | "rejected"`. Shared `StatusBadge` at `packages/shared/src/components/StatusBadge.tsx` supports the exact same statuses with identical visuals.

`packages/admin/src/views/Actions/ActionDetail.tsx` already uses the shared version.

**Fix**: Replace `<WorkDetailStatusBadge status={work.status} />` (uses at lines 189, 306) with `<StatusBadge status={work.status} />`. Delete local component + icon imports.

**Est. reduction**: ~30 LOC.

### HIGH-10. `normalizeAddress` duplicated inside shared + 10 inline `toLowerCase() as Address` in shared hooks

Shared-internal dup:

- Canonical: `packages/shared/src/utils/blockchain/address.ts:98-103` (overloaded, type-safe)
- Local copy: `packages/shared/src/modules/data/vaults.ts:190-192` (private) — **unchanged from prior report**

Plus **10 non-test inline usages** of `addr.toLowerCase() as Address` (pattern normalizeAddress is for) in shared hooks/modules:

- `packages/shared/src/modules/data/vaults.ts:191`
- `packages/shared/src/modules/data/yield-allocations.ts:61,62,104`
- `packages/shared/src/modules/data/greenwill.ts:137`
- `packages/shared/src/hooks/ens/useGreenGoodsEnsName.ts:23`
- `packages/shared/src/hooks/cookie-jar/useUserCookieJars.ts:44,68`
- `packages/shared/src/hooks/cookie-jar/useAccessibleCookieJars.ts:42,85,111`
- `packages/shared/src/hooks/cookie-jar/useGardenCookieJars.ts:25`

**Fix**: Delete local copy in `vaults.ts:190`, import `normalizeAddress` from `../../utils/blockchain/address`. Then migrate inline `toLowerCase()` sites. Contracts/indexer sites OUT OF SCOPE (different runtime — leave as-is).

**Est. reduction**: ~12 LOC + single address-normalization contract.

### HIGH-11. `toLocaleDateString()` inline — 13 occurrences, shared `formatDate` exists (PROMOTED from LOW)

Shared `formatDate`, `formatDateTime`, `formatRelativeTime` all exist and are barrel-exported. Inline `toLocaleDateString()` still appears at:

- `packages/admin/src/views/Garden/HypercertDetail.tsx:447`
- `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:263,269` (will be deleted via HIGH-7)
- `packages/admin/src/components/Hypercerts/TradeHistoryTable.tsx:26` (covered by HIGH-5)
- `packages/admin/src/components/Hypercerts/Steps/MetadataEditor.tsx:32`
- `packages/admin/src/components/Layout/CommandPalette.tsx:284`
- `packages/admin/src/components/Action/CreateActionSteps/ReviewStep.tsx:58` (×2)
- `packages/client/src/views/Home/Garden/Assessment.tsx:32,39`
- `packages/client/src/views/Home/Garden/index.tsx:350`
- `packages/client/src/components/Features/Garden/Assessments.tsx:39,46`

**Fix**: Replace with `formatDate(ts)` / `formatDate(new Date(ts))` from shared. Ensures consistent locale/format (`formatDate` uses IntlContext).

**Est. reduction**: ~13 LOC, correctness win for locale handling.

### HIGH-12. Cookie Jar modal boilerplate (admin + client) — now counts as adoption gap

No shared `useCookieJarDepositForm` / `useCookieJarWithdrawForm` hook exists. Four near-identical modals copy the same jar + amount + validation + mutation state machine:

- `packages/admin/src/views/Hub/components/CookieJarDepositModal.tsx` (258 LOC)
- `packages/admin/src/views/Hub/components/CookieJarWithdrawModal.tsx` (241 LOC)
- `packages/client/src/components/Dialogs/CookieJarDepositDialog.tsx` (~220 LOC)
- `packages/client/src/components/Dialogs/TreasuryDrawer/CookieJarCard.tsx` (inline withdraw)

Each has: jar state, `amount` + `validateDecimalInput`, decimals, parsed BigInt, balance check, mutation, tx-error boilerplate (HIGH-1), `useEffect` to reset error.

**Fix**: Extract `useCookieJarDepositForm(gardenAddress, isOpen)` and `useCookieJarWithdrawForm(...)` to `packages/shared/src/hooks/cookie-jar/` returning `{ jar, setJar, amount, setAmount, inputError, belowMin, parsedAmount, mutation, submit, reset, txMessages }`. Modals keep only their surface chrome (AdminDialog vs DialogShell).

**Est. reduction**: ~200 LOC across 4 files once the hook lands. Pair with HIGH-1.

**Owner**: shared (per CLAUDE.md hook boundary).

---

## Adoption gaps (shared primitives with ≥3 hand-rolled duplicates)

| Shared primitive | Location | Adopters | Hand-rolled copies |
|---|---|---|---|
| `useTxErrorMessages` hook | `shared/src/hooks/utils/useTxErrorMessages.ts` | 0 | **10** (see HIGH-1). Not exported in barrel → root cause. |
| `truncateAddress` / `formatAddress` | `shared/src/utils/blockchain/address.ts:74` + `shared/src/utils/app/text.ts` | many | **7** inline `slice(0,6)...slice(-4)` (HIGH-2) |
| `normalizeAddress` | `shared/src/utils/blockchain/address.ts:98` | some | **10** inline `toLowerCase() as Address` in shared hooks (HIGH-10) |
| `formatDate` / `formatDateTime` | `shared/src/utils/time.ts` | some | **13** inline `toLocaleDateString()` (HIGH-11) |
| `StatusBadge` | `shared/src/components/StatusBadge.tsx` | 1 (`ActionDetail`) | 1 local `WorkDetailStatusBadge` (HIGH-9) |
| `useMediaQuery` | `shared/src/hooks/ui/useMediaQuery.ts` | some | 1 local in `CanvasLayout` (HIGH-4) |
| `formatBytes` | `shared/src/utils/storage/quota.ts` | 0 external | 1 shared-internal twin `formatFileSize` (HIGH-8) |
| `getBlockExplorerTxUrl` | `shared/src/utils/eas/explorers.ts` | 0 | 5 inline `/tx/${hash}` (HIGH-6, blocker: not in barrel) |

Pattern: 4 of 8 entries are primitives that are defined in shared but **not exported at the root barrel**, or the barrel export exists yet consumers never discovered it. Barrel hygiene is the single-point intervention.

---

## MEDIUM (judgment needed)

### M-1. `ImpactFunders` vs `GardenSupporters` — 85% duplicate (unchanged)

- `packages/admin/src/components/Vault/ImpactFunders.tsx` (88 LOC)
- `packages/admin/src/components/Vault/GardenSupporters.tsx` (~70 LOC)

Both call `useFunderLeaderboard()`, render identical skeleton + header chrome + row loop with `<FunderRow />`. Difference: ImpactFunders has expand/collapse.

**Fix**: `FunderLeaderboardPanel` props: `{ gardenAddress?: Address; title; subtitle; explainer?; defaultVisible? }`. Net ~80 LOC. Design sign-off for expand behavior.

### M-2. Vault Deposit/Withdraw Modal duplication (admin)

`DepositModal.tsx` (366+ LOC) and `WithdrawModal.tsx` (330+ LOC) — identical debounce + decimals + gas estimation + validation scaffolding. Non-chrome differences are meaningful (deposit has gas estimation + max-deposit limits; withdraw has max-withdrawable). HIGH-1 + HIGH-12 cover the common tx-error + form pieces. What remains is ~40 LOC of shared "amount editor" UI that could move to `AdminAmountField` or similar — but that's a new primitive, not a dedup.

### M-3. `DOMAIN_ICON_CONFIG` (admin) vs `DOMAIN_CONFIG` (shared) — unchanged

- `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:8-30` (string-icon shape)
- `packages/shared/src/config/domain.ts:19-72` (component-icon shape)

Admin uses `<i className={icon}>` pattern; shared uses `<config.icon />`. Pick one — migrating Assessment to component-icon deletes `DOMAIN_ICON_CONFIG` + `DOMAIN_LABEL_DEFAULTS` + `resolveDomainLabel` (reuse shared labels).

**Est. reduction**: ~25 LOC.

### M-4. Native `<select>` chrome — 2 duplicates (down from 4)

Same exact class string at:

- `packages/admin/src/views/Hub/components/CookieJarDepositModal.tsx:137`
- `packages/admin/src/views/Hub/components/CookieJarWithdrawModal.tsx:126`

(Client versions appear to have been refactored since the prior report.)

**Fix** (or leave): Add `AdminSelect` wrapper to the Admin* palette. Feature add; out of scope for pure dedup. Flag for design.

### M-5. `rounded-xl border border-stroke-soft bg-bg-white p-4 shadow-sm` — 9 call sites

Card-section Tailwind string duplicated in:

- `packages/admin/src/components/Vault/GardenSupporters.tsx:15,37`
- `packages/admin/src/components/Vault/ImpactFunders.tsx:16,40`
- `packages/admin/src/components/Hypercerts/Steps/HypercertPreview.tsx:149,195,239`
- `packages/admin/src/components/Garden/GardenYieldCard.tsx:51`
- `packages/shared/src/components/Tokens/MaterialRoles.stories.tsx:43` (story)

**Decision**: Likely should use `AdminCard` (9 consumers already). Flag for design — one layer deeper than a mechanical dedup. LOW-MEDIUM.

---

## LOW (probably not worth it)

### L-1. Inline `RiLoader4Line ... animate-spin` — ~40 occurrences

Shared `Spinner` / `CenteredSpinner` exist (~5 consumers). Sizing varies (`h-3.5`/`h-4`/`h-5`/`h-6`) and color class varies. Mechanical sweep, marginal value, some intentional context differences.

### L-2. `Array.from({ length: N }).map(...)` skeleton loops — 14+ occurrences

Skeleton shape varies by view (table rows / cards / list items). Not enough similarity.

### L-3. Dialog `max-w-[calc(100vw-2rem)] sm:max-w-md` — 3 sites

`AdminDialog.tsx:73`, `Dialog/ConfirmDialog.tsx:80,244`. Intentional per `project_dialog_architecture` memory — two wrappers, two surface identities.

### L-4. `skeleton-shimmer` class — used in 12+ files

Already a shared CSS helper in `admin/src/index.css` + `shared/src/components/Skeleton.tsx`. Just repeated consumption. Not a dedup target.

---

## Contracts (Solidity / script / test) — scope skim

No obvious same-file duplication. Observations:

- `packages/contracts/src/vendor/octant/**` — vendored Octant strategies; leave as-is by policy.
- `packages/contracts/src/mocks/*.sol` — mock contracts are testing fixtures; duplication intentional across mocks (each models a different upstream).
- `packages/contracts/test/helpers/*` — `DeploymentBase.sol`, `EASHelper.sol`, `ERC6551Helper.sol`, `GAPTestHelper.sol` are already shared helpers; no obvious dup inside tests.
- `packages/contracts/script/utils/post-deploy-verify.ts` + `script/migrate-vaults.ts` both define their own `normalizeAddress` — intentional (different tsconfig context from shared, forge-adjacent). **Leave alone.**

Agent 1 skips contracts in depth — nothing actionable.

---

## Explicit non-findings (intentionally preserved)

- **`AdminCard` vs shared `Card`** — M3 strict anatomy requires admin-owned wrappers per `project_m3_component_compliance` memory. Both coexist.
- **`AdminDialog` vs shared `DialogShell`** — Intentional per `project_dialog_architecture`. Two surface identities.
- **`indexer/handlers/helpers.ts` `normalizeAddress`** — Envio runtime doesn't import shared. Leave.
- **`contracts/script/.../normalizeAddress`** — Deploy scripts, different tsconfig. Leave.
- **`agent/src/handlers/utils.ts` `formatAddress`** — Agent is OUT OF SCOPE; file also has explicit comment saying the duplication is deliberate (no browser-only deps in Node agent).
- **Client `Display/Image/ImageWithFallback.tsx`** — Already a pure re-export shim.
- **`HubWorkCard` vs `WorkCard`** (admin) — Different purposes; `HubWorkCard` has no runtime consumer (only storybook + test). Flag to agent-3 (dead-code pass) — not a dedup.
- **`CreateAction.tsx` vs `EditAction.tsx`** — Different schemas/fields/APIs; consolidation would hurt.
- **Shared utility hooks (`useEventListener`, `useTimeout`, `useAsyncEffect`)** — Good shape, per `react-patterns.md` rules.
- **Client cards vs shared `Cards/*`** — Client cards intentionally compose client's own primitives for warm-glass surface identity.

---

## Priority-ordered action list

All HIGH items are mechanical and safe after step 1:

1. **HIGH-3** (export `useTxErrorMessages` from barrel) — 1 LOC, unblocks HIGH-1
2. **HIGH-1** (`useTxErrorMessages` migration × 9) — ~170 LOC
3. **HIGH-6** (export `getBlockExplorerTxUrl` from barrel) — 1 LOC, unblocks HIGH-5
4. **HIGH-5** (`TradeHistoryTable` local helpers) — ~20 LOC
5. **HIGH-2** (inline address truncation → `truncateAddress`) — ~10 LOC
6. **HIGH-4** (`useMediaQuery` in CanvasLayout) — 14 LOC
7. **HIGH-7** (`formatDateRange` dedupe) — 24 LOC
8. **HIGH-9** (`WorkDetailStatusBadge` → shared `StatusBadge`) — 30 LOC
9. **HIGH-8** (`formatFileSize` → `formatBytes`) — 10 LOC
10. **HIGH-10** (shared-internal `normalizeAddress` + 10 inline sites) — 12 LOC
11. **HIGH-11** (`toLocaleDateString` → `formatDate`) — 13 LOC
12. **HIGH-12** (`useCookieJar*Form` hooks) — ~200 LOC, needs shared hook design first

**HIGH-only mechanical reduction**: ~305 LOC after step 1 across ~20 files, plus ~200 LOC once HIGH-12 hook design lands. Zero behavior change.

Root cause of the biggest finding (HIGH-1): the hook was built but never exported from the barrel. The adoption-failure fix is the 1-line barrel export first, then the migration. Worth checking the barrel discipline in a follow-up pass — the same pattern likely exists elsewhere.
