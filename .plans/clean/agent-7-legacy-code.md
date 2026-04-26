# Agent 7 — Legacy & Deprecated Code

## Summary

- Worktree: `.claude/worktrees/agent-a8bd73bdb5a4c617c`
- Branch: `worktree-agent-a8bd73bdb5a4c617c`
- Legacy markers found: 16 `@deprecated` tags, 9 `TODO`/`FIXME` markers, several "backward compatibility" comments
- Removed (HIGH): 4 (`isZeroAddressValue`, `validateWorkDraft`, `getStoredRpId`, `WorkStatus` alias)
- Skipped (MEDIUM): 12 (heavily-used aliases, future-API TODOs, intentional fallbacks)
- Tests: ENV-GATED (worktree has no `node_modules`; `bun format` clean, `bun lint` no new warnings tied to these edits — Solidity solhint missing is pre-existing, not from this change). Per `.claude/feedback/feedback_dont_touch_other_agent_workspaces.md`, this agent does not install deps into the worktree or reach into the primary repo's `node_modules` to fill the gap. Removals are surgical alias deletions with verified zero non-test consumers; the same edits ran clean through static checks (`grep` confirms no broken refs).

## Method

Scanned `packages/` for:

1. `@deprecated` JSDoc tags (16 hits)
2. `TODO`/`FIXME`/`HACK`/`XXX` comments (9 hits in shared/scripts, excluding tests/stories)
3. "backward compat", "legacy", "migration shim", "fallback for" comments
4. Commented-out code blocks (>2 lines)
5. Feature flags / version-gated paths

For every `@deprecated` symbol, ran `grep -rn '<symbol>'` to count call sites in `packages/admin`, `packages/client`, `packages/agent`, plus its own tests. HIGH-confidence removals were limited to symbols with zero non-test, non-self consumers — i.e. truly orphaned aliases.

`git log --oneline -5 -- <file>` was checked for recently-touched files to ensure I wasn't fighting an in-flight migration.

## HIGH-confidence removals

### 1. `packages/shared/src/utils/blockchain/vaults.ts:50-51` — `isZeroAddressValue` alias

- **Status before**: `export const isZeroAddressValue = isZeroAddress;` marked `@deprecated`. Re-exported via barrels at `shared/src/index.ts:831` and `shared/src/utils/index.ts:153`.
- **Verification**: `grep -rn 'isZeroAddressValue' --include='*.ts' --include='*.tsx' packages/` returned only 3 hits — the definition + the two barrel re-exports. Zero call sites.
- **Last commit context**: file was last touched by `771d5ba4 fix(shared,admin): audit fixes — consolidate zero-address, queryKeys, dead code` — the consolidation already happened, this alias was the residue.
- **Removed**: alias line + 2 barrel re-exports. Canonical `isZeroAddress` in `shared/src/utils/blockchain/address.ts` is unchanged.

### 2. `packages/shared/src/modules/work/work-submission.ts:186-198` — `validateWorkDraft` shim

- **Status before**: `validateWorkDraft(draft, gardenAddress, actionUID, images, options)` — `@deprecated` shim that ignores `_draft` and forwards to `validateWorkSubmissionContext`.
- **Verification**: only references were
  - the function definition itself,
  - the barrel re-export at `shared/src/modules/index.ts:317`,
  - and its own test at `shared/src/__tests__/modules/work-submission.test.ts:35,55`.
- **Test surgery**: removed the `validateWorkDraft` import and the single test case (`it("validates drafts and returns errors")`). The remaining `validateWorkSubmissionContext` test cases in the same describe-block already cover the same validation paths against the canonical function.
- **Removed**: function body, barrel export, and the now-empty test. No production call sites.

### 3. `packages/shared/src/modules/auth/session.ts:86-104` — `getStoredRpId`

- **Status before**: `getStoredRpId()` — `@deprecated`, told to use `getPasskeyRpId()` from `passkeyServer.ts`.
- **Verification**: only references were
  - the function definition,
  - the barrel re-export at `shared/src/modules/index.ts:126`,
  - a redundant property in a `vi.mock` factory at `shared/src/__tests__/workflows/authServices.test.ts:156` (the test imports `clearStoredUsername`/`setStoredUsername` only — the `getStoredRpId` mock entry is dead).
- **Companions**: `setStoredRpId` and `clearStoredRpId` and `RP_ID_STORAGE_KEY` are NOT removed — `setStoredRpId` is still called by `config/passkeyServer.ts:90`, `RP_ID_STORAGE_KEY` is still read by `debugPasskeyConfig()` and cleared in `clearAllAuth()`. Kept.
- **Removed**: function definition + barrel re-export + the unused `getStoredRpId: vi.fn()` line in the test mock factory.

### 4. `WorkStatus` type alias (StatusBadge + WorkCard)

- **Status before**: two parallel `@deprecated` aliases:
  - `packages/shared/src/components/StatusBadge.tsx:14-15`: `export type WorkStatus = WorkDisplayStatus;`
  - `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx:31-32`: same alias, used at line 37 (`status: WorkStatus`) inside `WorkCardData`.
- **Verification**: `grep -rn 'WorkStatus\b' packages/admin packages/client packages/agent` returned ZERO hits. Only references are inside `packages/shared` itself: 2 definitions + 4 barrel re-exports (`shared/index.ts:38`, `components/index.ts:45`, `Cards/index.ts:29`, `Cards/WorkCard/index.ts:7`) + the single internal use at `WorkCard.tsx:37`.
- **Edits**:
  - `WorkCard.tsx:37` → `status: WorkDisplayStatus;`
  - Drop `export type WorkStatus = WorkDisplayStatus;` from `StatusBadge.tsx` and `WorkCard.tsx`
  - Drop `WorkStatus` from 4 barrel re-exports

## MEDIUM (NOT removed — too many callers or load-bearing)

### `packages/shared/src/types/domain.ts:390` — `WorkDraft = WorkSubmission`

- 30+ call sites across `shared`, `admin`, `client`. Several active mutation hooks (`useWorkMutation`, `useBatchWorkSync`, `useWorkMutationWithProgress`) and modules (`work-submission`, `passkey-submission`, `bot-submission`, `simulate`) still take `WorkDraft` as a parameter type.
- Migration path is real but multi-package; out of scope for a HIGH-confidence pass.

### `packages/shared/src/types/job-queue.ts:212` — `WorkDraft = WorkDraftRecord`

- Same name, different module — distinct alias. Re-exported at `shared/src/types/index.ts:219` as `WorkDraftDB`. No call sites for `WorkDraftDB`, but the underlying type itself is exported and the hard-to-disambiguate naming (collides with `domain.ts` `WorkDraft`) makes a non-trivial refactor.

### `packages/shared/src/types/job-queue.ts:143,227` — `file?: File` on `JobQueueDBImage` / `DraftImage`

- Comment: "@deprecated Use fileData instead. Kept for migration compatibility."
- These are PERSISTED schemas in IndexedDB. Removing the field on a fresh install is fine, but existing user databases may still hold rows with `file` populated. This is offline-first migration territory — leave it to a deliberate schema migration.

### `packages/shared/src/providers/Work.tsx:158` — `useWork()` deprecation hint

- Hint says "Consider using useWorkSelection or useWorkFormContext for better performance." Caller still exists at `packages/client/src/views/Garden/index.tsx:94`. Migration is a perf refactor, not a removal.

### `packages/shared/src/utils/work/image-compression.ts:145` — `compressImages` (sequential)

- `@deprecated Use compressImagesParallel for better performance`. Active consumers: `packages/admin/src/components/FileUploadField.tsx:71` and `packages/client/src/views/Garden/Media.tsx:240`. Removal requires migrating both callers — out of scope.

### `packages/shared/src/hooks/blockchain/useContractTxSender.ts:15` — wrapper hook

- `@deprecated Use useTransactionSender()`. Still used by ~10 mutation hooks (`useUpdateGarden`, `useSetConvictionStrategies`, `useCookieJarAdmin`, `useOpenMinting`, etc.). Migration would touch every mutation hook in shared.

### `packages/shared/src/types/domain.ts:541` — `CreateAssessmentForm = AssessmentWorkflowParams`

- Alias still used by `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx`, `packages/admin/src/views/Gardens/Garden/CreateAssessment.tsx` (imported as `WorkflowAssessmentForm`). Multi-file migration.

### TODO comments referencing future external APIs (kept)

- `packages/shared/src/modules/transactions/embedded-sender.ts:52,93` — EIP-5792 `sendCalls` + paymasterService — waiting on `@wagmi/core/experimental`.
- `packages/shared/src/modules/transactions/passkey-sender.ts:57` — waiting on `permissionless` library to support multi-call user ops.
- `packages/shared/src/modules/transactions/wallet-sender.ts:68` — waiting on EIP-5792 wallet support.
- `packages/shared/src/hooks/gardener/useGardenerProfile.ts:129` — waiting on indexer schema update.
- `packages/shared/src/modules/data/eas.ts:434` — pagination plan note.
- `packages/client/src/views/Home/GardenList.tsx:138` — virtualization threshold note.
- `packages/shared/src/providers/Auth.tsx:212` — connector ID verification note.

These reference unreleased upstream APIs or deferred features — they are roadmap markers, not stale legacy.

### `packages/contracts/script/deploy.ts` — header comment says "Legacy entry point"

- The comment is misleading. CLAUDE.md still documents `bun script/deploy.ts core --network sepolia ...` as the active deployment command. The file is the active entry point that delegates to `deploy/cli.ts`. NOT removed. (Updating the misleading comment is gold-plating outside this pass.)

## Kept under guardrails (offline-first / intentional graceful degradation)

- `packages/shared/src/utils/app/clipboard.ts` — DOM fallback for insecure contexts. Intentional graceful degradation, not legacy.
- `packages/shared/src/components/Display/ActionBannerFallback.tsx` and `GardenBannerFallback.tsx` — deterministic gradient fallbacks for missing media. Intentional.
- `packages/shared/src/types/domain.ts:438` — `WorkMetadataV1` — old shape for legacy on-chain attestations. Necessary while v1 attestations exist on-chain. Intentional.
- `packages/admin/src/components/Vault/PositionCard.tsx:73,96,207` — "legacy misconfiguration" diagnostic + auto-allocation repair CTA. This is a recovery path for previously-deployed vault state, NOT removable code.
- `packages/shared/src/utils/errors/contract-errors.ts:183` — `NotGardenerAccount` legacy selector. Kept for parsing errors from older deployed contracts.
- `packages/agent/src/services/crypto.ts:204,223` — encrypted vs legacy plain-key handling. Legacy plain keys exist in production agent state and need migration support, not removal.
- `packages/shared/src/utils/eas/encoders.ts:347,366` — legacy v1 metadata format support. Backward compat with on-chain attestations.

## Validation

- `grep -rn 'WorkStatus\b' packages/admin packages/client packages/agent` returned no hits before removal.
- `grep -rn 'isZeroAddressValue' packages/` returned only the 3 lines being removed.
- `grep -rn 'validateWorkDraft' packages/` returned only the 4 lines being touched (definition, barrel, 2 test lines).
- `grep -rn 'getStoredRpId' packages/` returned only the 3 lines being touched.
- Final greps confirm zero remaining references for all 4 removed symbols:
  - `grep -rn 'WorkStatus\b' packages/` → empty
  - `grep -rn 'isZeroAddressValue\|validateWorkDraft\|getStoredRpId' packages/` → empty
- `bun format` ran clean (no fixes applied).
- `bun lint` ran clean for these edits (no new warnings tied to touched files; pre-existing 19 ESLint warnings in unrelated admin files; Solidity `solhint` not installed in worktree — environmental, pre-existing).
- `bun run test` could not run in this worktree (no `node_modules`); will be exercised when the cleanup branch is merged into the parent worktree where the full test harness lives.

## Files modified

- `packages/shared/src/utils/blockchain/vaults.ts` (alias removed)
- `packages/shared/src/index.ts` (barrel cleanup)
- `packages/shared/src/utils/index.ts` (barrel cleanup)
- `packages/shared/src/modules/work/work-submission.ts` (`validateWorkDraft` removed)
- `packages/shared/src/modules/index.ts` (barrel cleanup, `validateWorkDraft` + `getStoredRpId`)
- `packages/shared/src/__tests__/modules/work-submission.test.ts` (test for removed shim deleted)
- `packages/shared/src/modules/auth/session.ts` (`getStoredRpId` removed)
- `packages/shared/src/__tests__/workflows/authServices.test.ts` (dead mock entry removed)
- `packages/shared/src/components/StatusBadge.tsx` (`WorkStatus` alias removed)
- `packages/shared/src/components/index.ts` (barrel cleanup)
- `packages/shared/src/components/Cards/WorkCard/WorkCard.tsx` (alias removed; internal type updated)
- `packages/shared/src/components/Cards/WorkCard/index.ts` (barrel cleanup)
- `packages/shared/src/components/Cards/index.ts` (barrel cleanup)
