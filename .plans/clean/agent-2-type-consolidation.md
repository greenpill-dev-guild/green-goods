# Agent 2 — Type Consolidation

## Summary
- Type files scanned: ~290 type/interface declarations across `packages/admin/src`, `packages/client/src`, `packages/agent/src`, plus the canonical surface in `packages/shared/src/types/*`
- Findings: HIGH=2, MEDIUM=5, LOW=3
- Implemented: 2 HIGH consolidations
- Tests: NOT RUN (worktree has no node_modules / .env per `feedback_dont_touch_other_agent_workspaces.md`; both edits are mechanical and verified by direct file inspection)
- Build: NOT RUN (same constraint)

Both edits are mechanical and bounded:
- One `import` swap (admin) — replacing a locally-redeclared type with the shared barrel re-export of the same shape
- One delete (agent) — removing a dead duplicate that has zero importers

## HIGH-confidence findings (implemented)

### 1. `EASDecodedField` — admin re-declared a shared type
- **Old location**: `packages/admin/src/views/Gardens/Garden/Assessment.tsx:28-33` (local `interface EASDecodedField`)
- **New canonical**: `packages/shared/src/types/eas-responses.ts:34-40` (already exported via `packages/shared/src/index.ts:573`)
- **Why HIGH-confidence**: The shared version is a strict superset of the local one — it adds an optional `hex?: string` on `value`. The admin file only reads `field.name` and `field.value?.value` (Assessment.tsx:230), so the extra optional field is irrelevant to existing usage.
- **Action taken**: removed local interface, added `type EASDecodedField` to the existing `@green-goods/shared` import block.
- **Import sites updated**: 1 (the file itself).
- **Risk note**: shared `EASDecodedField` is already used elsewhere (`packages/shared/src/modules/data/eas.ts`) so it is a well-exercised type — no risk of drift.

### 2. Dead duplicate `RateLimitResult` in agent
- **Old location**: `packages/agent/src/types.ts:256-262` (`export interface RateLimitResult` with `message?: string`)
- **Canonical**: `packages/agent/src/services/rate-limiter.ts:27-36` (`export interface RateLimitResult` without `message`; the rate-limiter call sites widen the return type inline as `RateLimitResult & { message?: string }` at line 133, which is the intentional shape).
- **Why HIGH-confidence**: zero imports of `RateLimitResult` from `agent/src/types.ts` anywhere in the repo. Verified with `grep -rn "import.*RateLimitResult" packages` (no matches outside the rate-limiter file). The agent has no barrel re-export of `types.ts`, so the duplicate is unreachable.
- **Action taken**: removed the dead interface; left a one-line marker comment pointing future readers to the canonical definition in `services/rate-limiter.ts`.
- **Import sites updated**: 0 (none existed).
- **Risk note**: the agent is on the `sensitive` criticality tier, but this delete touches only a dead export — no runtime path, no test path, no schema.

## MEDIUM findings (NOT implemented — flagged for follow-up)

### M1. `MyTrackedPosition` + `TrackedAsset` duplicated inside Endowments view
- `packages/admin/src/views/Endowments/MyPositionsSidebar.tsx:12-14` exports `TrackedAsset` and `MyTrackedPosition`
- `packages/admin/src/views/Endowments/index.tsx:78-89` redeclares both locally (the `index.tsx` copy is missing `chainId`)
- **Why MEDIUM not HIGH**: the entire `MyPositionsSidebar.tsx` file is dead code — no consumer imports `MyPositionsSidebar` or `MyTrackedPosition` anywhere (`grep -rn "from.*MyPositionsSidebar"` returns empty). The duplication is real, but the right cleanup is to delete `MyPositionsSidebar.tsx` entirely (Agent 3 / dead-code territory) rather than wire the live `index.tsx` to it. Two near-identical 100-line `MyTrackedPositionCard` implementations exist; consolidation would merge logic too, not just types.
- **Recommendation**: hand to Agent 3 (dead code) — they should remove `MyPositionsSidebar.tsx` outright. If kept, types should move to `packages/admin/src/views/Endowments/types.ts` (admin-local, not shared — these are vault-UI concepts, not domain types).

### M2. Local `Assessment` shape in `GardenAssessmentsPanel.tsx` overlaps `EASGardenAssessment`
- `packages/admin/src/components/Garden/GardenAssessmentsPanel.tsx:9-14` declares `interface Assessment { id; title?; assessmentType?; createdAt }`
- `packages/shared/src/types/eas-responses.ts:46-60` has `EASGardenAssessment` with most fields PLUS `assessmentConfigCID`, `domain`, etc.
- **Critical mismatch**: `assessmentType?: string` is NOT on shared `EASGardenAssessment`. It is parsed at render-time inside `Assessment.tsx:263` from the decoded JSON. The admin panel receives this from a different upstream (`useGardenAssessments` returns `EASGardenAssessment[]` but the consumer passes a re-shaped object with `assessmentType`).
- **Why not HIGH**: blindly substituting shared `EASGardenAssessment` would either (a) break the optional `assessmentType` reads or (b) require a deeper refactor of the parse pipeline.
- **Recommendation**: either add `assessmentType?: string` to `EASGardenAssessment` (with a clear "post-parse derived" doc comment) OR introduce a `ParsedGardenAssessment` shared type that extends it — this is a design call, not a mechanical merge.

### M3. Repeated inline shape `Array<{ id; title?; assessmentType?; createdAt }>` in `ImpactTab.tsx`
- `packages/admin/src/views/Gardens/Garden/ImpactTab.tsx:22` redeclares the same Assessment shape inline.
- **Why MEDIUM**: same mismatch as M2 — depends on the unified `ParsedGardenAssessment` decision.

### M4. Agent has many `address: string` fields that should be `Address`
- Examples: `packages/agent/src/types.ts:135`, `145`, `201`, plus `gardenAddress: string` / `gardenerAddress: string` in `types.ts:177-180,206,221`.
- Agent runtime files (`db.ts`, `blockchain.ts`, `handlers/*`) are similarly string-typed.
- **Why MEDIUM**: violates Rule 5 (`Address` from shared, not `string`). However, the agent package is `sensitive` per the criticality matrix, the `string` type flows through many runtime/db boundaries (sqlite columns, viem helper inputs, formatAddress signatures), and tightening it requires either widespread casts or coordinated changes in `services/db.ts`, `services/blockchain.ts`, `services/crypto.ts`, and several handlers. Not safe for a mechanical consolidation pass.
- **Recommendation**: scoped follow-up plan in `.plans/agent-address-typing/`.

### M5. Agent `WorkDraftData`, `GardenInfo`, `SubmitWorkParams`, `SubmitApprovalParams`
- `packages/agent/src/types.ts:174-226` defines several blockchain/draft shapes that overlap with shared `WorkJobPayload` (`packages/shared/src/types/job-queue.ts:57`) and shared `Garden` types.
- **Why MEDIUM**: the agent versions use `Hex`/raw strings and have agent-specific fields (`plantSelection`, `plantCount`) that don't map 1:1 to the offline-first job-queue shapes. Merging would either contaminate shared with agent-specific fields or force the agent to round-trip through smart-account-only types it doesn't use. The agent intentionally has its own narrow surface for direct EOA signing flows.

## LOW findings (NOT implemented)

### L1. `ColorScheme` / `ColorAccent` / `AlertVariant`
- `packages/admin/src/components/StatCard.tsx:6` `type ColorScheme = "success" | "warning" | "error" | "info"`
- `packages/admin/src/components/ui/Card.tsx:26` `type ColorAccent = "primary" | "success" | "warning" | "error" | "info"`
- `packages/admin/src/components/ui/Alert.tsx:11` `type AlertVariant = "error" | "warning" | "info" | "success"`
- **Why not consolidate**: each component has its own variant slot tied to local `cva` styling. Unifying them as a "Severity" enum would force every consumer to reason about the broader set even when only 3 of 5 are valid.

### L2. View-local `*SortOrder` aliases
- `packages/admin/src/views/Endowments/index.tsx:77` `type EndowmentsSortOrder = "name" | "tvl"`
- `packages/admin/src/views/Treasury/index.tsx:34` `type TreasurySortOrder = "name" | "tvl"`
- `packages/admin/src/views/Assessments/index.tsx:31` `type SortOrder = "date" | "title"`
- **Why LOW**: trivially small literal unions, locally meaningful, no runtime coupling. Consolidating saves 6 lines but adds an indirection.

### L3. `NavItem` declared in `Sidebar.tsx` and `Sidebar.stories.tsx`
- The `*.stories.tsx` redeclaration is intentional — Storybook stories often mock their own props to avoid leaking story-only fixtures into production types.

## Skipped under guardrails
- `packages/contracts/lib/**` — vendored Solidity.
- `packages/indexer/generated/**` — Envio codegen.
- `packages/shared/src/types/eas.d.ts`, `green-goods.d.ts` — gql.tada generated.
- `packages/agent/src/__tests__/**` — test fixtures and factories.
- All `*.stories.tsx` mock types — Storybook-only.
- Component `*Props` interfaces — legitimate per-component types, not "duplications" in the consolidation sense.

## Files changed
- `packages/admin/src/views/Gardens/Garden/Assessment.tsx` — swap local `EASDecodedField` interface for shared barrel import (net -7 LOC).
- `packages/agent/src/types.ts` — delete dead `RateLimitResult` export, leave one-line locator comment (net -7 LOC).
