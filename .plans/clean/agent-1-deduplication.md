# Agent 1 — Deduplication & DRY

## Summary
- Files scanned: ~1024 TS/TSX across all packages (excluding node_modules, generated, lib)
- Findings: HIGH=3, MEDIUM=4, LOW=2
- Implemented: 3 HIGH-confidence consolidations
- Validation:
  - `bun lint` admin: PASS (17 warnings → all pre-existing, my changes removed 1 unused-import warning)
  - `bun lint` client: PASS (0 warnings, 0 errors)
  - `tsc --noEmit` admin: PASS (0 errors)
  - `tsc --noEmit` client: PASS (0 errors)
  - `bun run test` admin/client: BLOCKED — worktree has no node_modules (`@tanstack/react-query` resolution fails for shared/__tests__/test-utils). Per recorded guidance "Don't reach into primary repo tooling/node_modules from a Codex worktree", accepted as env-gated. Changes will be re-validated by the parent /clean orchestrator on the merged checkpoint branch.

## Scan strategy used (advisor-recommended order)
1. Inline re-implementations of shared exports (highest yield)
2. Component name twins across admin/client (mostly intentional surface divergence — skipped)
3. Per-package internal duplication (admin-internal `TruncatedAddress`)
4. Repeated Tailwind class strings (skipped — too tied to admin design tokens)
5. Same-named utility helpers across files
6. Storybook story scaffolding (skipped — minimal duplication)

## HIGH-confidence findings (implemented)

### 1. Inline `${addr.slice(0,6)}...${addr.slice(-4)}` reimplementations of shared `truncateAddress`
- **Locations** (8 inline occurrences):
  - `packages/admin/src/components/Garden/GardenMetadata.tsx:98` (slice 6/-4 in mobile breakpoint)
  - `packages/admin/src/components/Garden/GardenMetadata.tsx:101` (slice 10/-8 in tablet breakpoint)
  - `packages/admin/src/components/Garden/GardenMetadata.tsx:156` (slice 6/-4 mobile, with NFT tokenId)
  - `packages/admin/src/components/Garden/GardenMetadata.tsx:159` (slice 10/-8 tablet)
  - `packages/admin/src/components/hypercerts/DistributionChart.tsx:56` (chart label)
  - `packages/admin/src/components/hypercerts/TradeHistoryTable.tsx:34-36` (local `truncateAddress` helper — directly shadows shared export)
  - `packages/admin/src/views/Assessments/index.tsx:94` (garden filter option label)
  - `packages/client/src/components/Dialogs/ConvictionDrawer.tsx:508` (tx hash truncation — same pattern, works on any 0x string)
- **Why this is safe**:
  - Shared `truncateAddress(address, startChars=6, endChars=4)` already exists at `packages/shared/src/utils/blockchain/address.ts` and is exported via the barrel.
  - Default args (6, -4) match the inline pattern exactly.
  - `TradeHistoryTable.tsx` defines `function truncateAddress(address: Address): string` locally — same signature, same behavior.
  - All affected files already import from `@green-goods/shared` (only need to add `truncateAddress` to the existing import).
  - No recent commits diverged these files (last touches were "consolidation" / "extract from monolithic" — supports the dedup direction).
- **Change**:
  - Replaced inline slice expressions with `truncateAddress(...)` calls.
  - Removed local `truncateAddress` helper from `TradeHistoryTable.tsx`.
  - For `GardenMetadata.tsx`, used `truncateAddress(addr, 10, 8)` for the tablet breakpoint variant (shared util supports custom char counts).
  - Skipped `RecentActivitySection.tsx:161` (uses Unicode ellipsis `…` instead of `...` — visual divergence, classified as MEDIUM).
- **Tests**:
  - No tests assert the truncated string format — visual rendering equivalent.
  - `bun run test` in admin and client packages — see test results section.

### 2. Identical local `TruncatedAddress` React components in two hypercert step files
- **Locations** (byte-for-byte identical 26-line component):
  - `packages/admin/src/components/hypercerts/steps/HypercertPreview.tsx:55-81`
  - `packages/admin/src/components/hypercerts/steps/DistributionConfig.tsx:16-42`
- **Why this is safe**:
  - Both copies are identical — same JSX, same className strings, same a11y labels, same icons.
  - Both files live in the same directory (`hypercerts/steps/`).
  - Both already import from `@green-goods/shared` (`useCopyToClipboard`).
  - Per advisor: shared visual components risk surface-identity breakage cross-package — but this is admin-only consolidation (both consumers are admin), so the surface-identity rule is satisfied.
  - No recent divergence: both files last touched in `291c2529` ("dashboard revamp, component consolidation, and UX polish") which explicitly endorses consolidation.
- **Change**:
  - Extracted `TruncatedAddress` to a new admin-local component at `packages/admin/src/components/hypercerts/TruncatedAddress.tsx`.
  - Replaced both local copies with imports.
  - Replaced the inline `${address.slice(0,6)}...${address.slice(-4)}` inside the new component with the shared `truncateAddress()` (recursive simplification — applies finding #1 inside the extracted component).
- **Tests**:
  - Existing tests at `packages/admin/src/__tests__/components/hypercerts/HypercertPreview.test.tsx` and `DistributionConfig.test.tsx` do not assert internal `TruncatedAddress` structure — visual equivalence preserved.

### 3. Dead-code re-export of `formatDateRange` in admin (overlay of shared export)
- **Locations**:
  - `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:259-282` (local `export function formatDateRange`)
  - `packages/admin/src/views/Assessments/index.tsx:6` (imports `formatDateRange` from `@green-goods/shared`, NOT from local `shared.tsx`)
  - `packages/admin/src/views/Gardens/Garden/Assessment.tsx:5` (same — imports from shared)
- **Why this is safe**:
  - The local `formatDateRange` is **not imported by any consumer** — verified via repo-wide grep for `from "./shared"` style imports.
  - Both actual consumers already use the shared version.
  - Local impl differs only in fallback string ("Not provided" vs the configurable shared default) — no behavior change for anyone.
  - This is dead code, not a behavior dupe. Removing it reduces confusion (matching exported names with different signatures is footgun-prone).
- **Change**:
  - Removed the `export function formatDateRange` block (lines 259-282) from `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx`.
- **Tests**: No usage means no test risk. Type-check covers the rest.
- **Coordination note**: Agent 3 (dead code) may also flag this. Implemented here because it surfaced naturally during the dedup scan and the fix is a direct match for "inline re-implementation of shared exports."

## MEDIUM findings (NOT implemented — needs judgment)

### M1. `RecentActivitySection.tsx:161` — Unicode ellipsis variant of address truncation
- **Locations**: `packages/admin/src/components/Dashboard/RecentActivitySection.tsx:161`
- **Pattern**: `approval.operatorAddress.slice(0, 6) + "…" + approval.operatorAddress.slice(-4)`
- **Why skipped**: Uses Unicode `…` (single char) instead of `...` (three ASCII dots). Shared `truncateAddress` returns ASCII `...`. Replacing changes the visible character. Could be intentional typographic style. Recommendation: design lens (Lens 1 / typography review) confirms which character is canonical, then bulk-update.

### M2. `attestation.id.slice(0, 6)` first-N-chars truncation (no separator)
- **Locations**:
  - `packages/admin/src/views/Assessments/index.tsx:262`
  - `packages/admin/src/views/Gardens/Garden/Assessment.tsx:109`
- **Pattern**: ``Assessment ${attestation.id.slice(0, 6)}`` — short prefix only, used as an anonymous title fallback.
- **Why skipped**: Different intent from address truncation (no `...` suffix, no end chars). Could become `formatAssessmentTitle(attestation)` or similar — but only 2 occurrences with very simple inline logic. Doesn't meet 3+ threshold.

### M3. Local `formatUnits` in TradeHistoryTable
- **Locations**: `packages/admin/src/components/hypercerts/TradeHistoryTable.tsx:18-23` (`1_000_000` / `1_000` -> `M` / `K`)
- **Why skipped**: Single occurrence, no duplication in repo. Not a dedup target. Could move to shared as `formatCompactNumber()` if a second consumer appears.

### M4. Repeated Tailwind class strings (16 occurrences of `"w-full rounded-md border border-stroke-soft px-3 py-2"`)
- **Locations**: spread across admin and client form inputs.
- **Why skipped**: Each occurrence is on a `<input>` or `<select>` element. Project already has `FormField` component. Consolidating would either (a) require all consumers to migrate to `FormField` (Agent 1 scope creep), or (b) introduce a CSS utility class that bypasses Tailwind's atomic design (Tailwind v4 gotcha — see CLAUDE.md). Defer to Agent 6 (AI slop) or a focused frontend pass.

## LOW findings (NOT implemented — risky/unclear)

### L1. `packages/agent/src/handlers/utils.ts:formatAddress`
- **Location**: `packages/agent/src/handlers/utils.ts:13-16`
- **Pattern**: Local `formatAddress` that mirrors shared.
- **Why skipped**: File contains an explicit comment ("intentionally a local implementation matching @green-goods/shared behavior to avoid pulling in browser-only dependencies in the Node.js agent environment"). Deliberate divergence — leave alone (`agent` is `sensitive` per criticality matrix).

### L2. Test mock helpers replicating shared truncation
- **Locations**:
  - `packages/admin/src/__tests__/views/EndowmentsOverview.test.tsx:16` (`formatAddress: (value: string) => value.slice(0, 6)`)
  - `packages/admin/src/views/Endowments/index.test.tsx:16` (same)
  - `packages/client/src/__tests__/components/Cards.test.tsx:18-21` (mock `formatAddress` and `truncateAddress`)
- **Why skipped**: These are `vi.mock` factories — intentional test isolation, not production duplication. Replacing would defeat the mock's purpose (controlled output for snapshot/assertion). Out of scope.

## Skipped under guardrails

- **`packages/contracts/lib/`**: Foundry submodules — never touch.
- **`packages/indexer/generated/`**: Envio generated — never touch.
- **`contracts/script/deploy/goods.ts:56`**: Uses inline slice for env var masking. Not a UI string, lives in deploy script. Agent shouldn't import shared util into deploy scripts (different runtime concerns). Leave.
- **Cross-surface visual components**: All `*Card`, `*Header`, `*EmptyState` look-alikes between `packages/admin/src/views/` and `packages/client/src/views/` are intentionally divergent per surface-identity rule (M3 strict admin vs Warm Earth client). Not consolidated.
- **Hooks**: All hook-shaped duplication candidates would need to live in `@green-goods/shared`. None of the HIGH findings involve hooks (all are pure utilities or visual components within a single package).
