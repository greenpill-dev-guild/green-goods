# Agent 7: Legacy & Deprecated Code Findings

## HIGH-CONFIDENCE (verified obsolete, safe to remove)

### H1. Deprecated TestHelper class and Privy-era test exports
**File:** `tests/helpers/test-utils.ts` (lines 753-807)
**What:** `TestHelper` class (extends `ClientTestHelper`), `TestAccount` interface, `getTestAccount()` function
**Why added:** Backward compat during migration from Privy auth to passkey auth
**Status:** Zero consumers in any test spec. `ClientTestHelper` is the active class.
**Action:** Remove all legacy exports section (lines 753-807)

### H2. Deprecated `validateWorkDraft` function
**File:** `packages/shared/src/modules/work/work-submission.ts` (lines 186-198)
**What:** Deprecated wrapper that delegates to `validateWorkSubmissionContext`
**Why added:** Backward compat during work submission refactor
**Status:** Only used in its own test (`work-submission.test.ts:55`). Not exported from top-level barrel. No external consumer.
**Action:** Remove function + its test + its barrel export from `modules/index.ts:317`

### H3. Dead `WorkDraftDB` type re-export
**File:** `packages/shared/src/types/index.ts` (line 219)
**What:** `WorkDraft as WorkDraftDB` re-exported from job-queue types
**Status:** Zero imports anywhere in the codebase.
**Action:** Remove the re-export line

### H4. Dead `WorkDraft` type alias in `job-queue.ts`
**File:** `packages/shared/src/types/job-queue.ts` (lines 211-214)
**What:** `export type WorkDraft = WorkDraftRecord` marked as deprecated
**Status:** Only consumed by the dead `WorkDraftDB` re-export above. No direct imports.
**Action:** Remove the type alias

### H5. `signInWithPasskey` legacy alias in Auth context
**File:** `packages/shared/src/providers/Auth.tsx` (lines 105, 591)
**What:** Alias of `loginWithPasskey` in AuthContext interface and implementation
**Status:** Zero consumers in client, admin, or tests.
**Action:** Remove from interface (line 105) and implementation (line 591)

### H6. Stale "Privy ID" comment
**File:** `packages/shared/src/types/domain.ts` (line 111)
**What:** `id: string; // Privy ID` — Privy is no longer used
**Action:** Update comment to `// User identifier` or `// Indexer gardener ID`

### H7. Legacy `PRIVY_` env prefix in admin vite config
**File:** `packages/admin/vite.config.ts` (line 46)
**What:** `envPrefix: ["VITE_", "PINATA_", "PRIVY_", "SKIP_"]` — `PRIVY_` no longer exists
**Status:** No `PRIVY_*` environment variables anywhere in codebase or `.env.schema`.
**Action:** Remove `"PRIVY_"` from the array

### H8. `Capital` re-export shim in `greengoods.ts`
**File:** `packages/shared/src/modules/data/greengoods.ts` (lines 20-21)
**What:** `// Re-export Capital for backward compatibility` then `export { Capital };`
**Status:** One consumer (`useActionOperations.ts:14`) imports Capital from here. But Capital is already exported from `types/domain` and `types/index`. The consumer can import from `../../types/domain` instead.
**Action:** Remove re-export from greengoods.ts, update the single consumer

## MEDIUM (likely obsolete but needs judgment)

### M1. `useWork` backward-compat combined hook and `WorkContext`
**File:** `packages/shared/src/providers/Work.tsx` (lines 110-124, 154-162, 362-363, 419)
**What:** Legacy combined context (`WorkContext`) and `useWork()` hook marked `@deprecated`
**Status:** Actively consumed by `client/views/Garden/index.tsx` and its test. Removing requires refactoring the client view to use `useWorkSelection` + `useWorkFormContext` instead.
**Recommendation:** Not safe to remove without client refactoring. Flag for future cleanup.

### M2. `createPasskey` / `clearPasskey` legacy aliases in Auth context
**File:** `packages/shared/src/providers/Auth.tsx` (lines 106-107, 592-593)
**What:** `createPasskey: createAccount` alias and `clearPasskey` function
**Status:** `createPasskey` (the alias) is listed in mock-factories.ts but zero UI consumers. `clearPasskey` is real functionality but never called from any component. However, `clearPasskey` is a valid API for session management.
**Recommendation:** Remove `createPasskey` alias (HIGH). Keep `clearPasskey` as it's a real function even if currently unused from UI.

### M3. Client backward-compat re-export shim files
**Files:**
- `packages/client/src/components/Inputs/Select/Select.tsx`
- `packages/client/src/components/Inputs/Select/FormSelect.tsx`
- `packages/client/src/components/Inputs/TextField/Input.tsx`
- `packages/client/src/components/Inputs/TextField/Text.tsx`
- `packages/client/src/components/Communication/Badge/Badge.tsx`
- `packages/client/src/components/Display/Image/ImageWithFallback.tsx`
- `packages/client/src/components/Dialogs/ImagePreviewDialog.tsx`
**What:** Simple re-exports from `@green-goods/shared` marked "backward compatibility"
**Status:** Actively consumed throughout the client via barrel exports. They serve as the local import path.
**Recommendation:** Not dead — these are a structural pattern. "Backward compatibility" comment is misleading; these are the client's component architecture. Could be simplified but not safely removed without migrating all client imports.

### M4. `WorkMetadataV1` type and `isV1Metadata` guard
**Files:** `packages/shared/src/types/domain.ts:438`, `packages/client/src/views/Home/Garden/WorkViewSection.tsx:59`
**What:** Old metadata shape for rendering legacy attestations
**Status:** Required for displaying work submitted with the v1 schema (on-chain data). NOT removable.
**Recommendation:** Keep. On-chain backward compatibility is mandatory.

### M5. `WorkDraft` type alias in `domain.ts`
**File:** `packages/shared/src/types/domain.ts` (line 390)
**What:** `export type WorkDraft = WorkSubmission;` marked deprecated
**Status:** Heavily used (30+ imports across shared, client, admin). Not safe to remove without a large migration.
**Recommendation:** Keep for now. Would need a codemod to rename all `WorkDraft` to `WorkSubmission`.

### M6. `AUTH_MODE_STORAGE_KEY` re-export from Auth.tsx
**File:** `packages/shared/src/providers/Auth.tsx` (line 620)
**What:** Re-exports `AUTH_MODE_STORAGE_KEY` and `AuthMode` "for backwards compatibility"
**Status:** These are re-exported through barrel exports. The canonical source is `modules/auth/session.ts`. The re-export is redundant but not harmful.
**Recommendation:** Can remove but low impact.

## LOW (possibly still needed)

### L1. `createAssessment.ts` type re-exports
**File:** `packages/shared/src/workflows/createAssessment.ts` (line 5)
**What:** `export type { AssessmentWorkflowParams, CreateAssessmentForm } from "../types/domain";`
**Status:** These types are already exported from `types/index.ts`. The re-export is for consumers who import directly from this workflow module.
**Recommendation:** Keep — these are convenience re-exports for module consumers.

### L2. Agent crypto legacy key migration
**File:** `packages/agent/src/services/crypto.ts` (lines 204-225)
**What:** `getPrivateKey()` handles both encrypted and legacy unencrypted key formats
**Status:** This is active graceful degradation for migrating agent keys. Has tests. Intentional.
**Recommendation:** Keep — this is legitimate migration logic.

### L3. `.cursorrules` file
**File:** `packages/contracts/.cursorrules`
**What:** Cursor editor configuration file with deployment readiness rules
**Status:** Project uses Claude Code (CLAUDE.md). Could be legacy from Cursor usage.
**Recommendation:** Low priority — may still serve other editors or team members.

### L4. Commented-out EIP-5792 code in transaction senders
**Files:** `packages/shared/src/modules/transactions/embedded-sender.ts` (lines 55-62)
**What:** Commented code showing planned EIP-5792 sendCalls implementation
**Status:** Intentional placeholder documenting the future API usage pattern. Related TODOs reference actual planned work.
**Recommendation:** Keep — this is documentation of planned implementation.
