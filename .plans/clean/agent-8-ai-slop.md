# Agent 8 — AI Slop & Comment Cleanup

## Summary
- Slop instances found: 421+ (per prior dry-run survey across packages/admin, /shared, /client, /contracts/script)
- Removed comments: 24
- Removed stubs: 0 (all 6 `not implemented` throws are deliberate xstate placeholder actors overridden via `.provide({ actors })` at consumer call sites — DO NOT remove)
- Removed console statements: 2 (replaced `console.debug` with `logger.debug`)
- Edited (concise rewrite): 12 (history docstrings, useScrollToTop, useInstallGuidance, Work providers, useAuth legacy banner, Profile.tsx username comment, Garden/Intro filter comment, Hypercert step-click comment)
- Tests: PASS — 12 pre-existing failures in `useFunderLeaderboard` / `useGardenYieldSummary` / `useProtocolYieldSummary` / `useGardenRoles` / `useVaultOperations` / `usePrimaryAddress` / `useFilteredGardens` are baseline (verified by re-running tests on the stashed pre-edit tree — same 12 failures). None of those test files cover code I touched.
- Total: 36 files modified, ~321 lines removed, ~38 added

## HIGH-confidence removals

### Comments (WHAT-narrators)
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx:45,52,57,88,112,154` — `// Helper to get garden name`, `// Handle resume draft`, `// Handle delete draft`, `// Render loading state`, `// Render empty state`, `// Render drafts list` — all restate identifier or obvious code below
- `packages/client/src/views/Home/index.tsx:46,49,63,66,71,74,79,82,85` — `// Filter state`, `// Use extracted hooks for cleaner logic`, `// Wallet drawer state`, `// UI state from store`, `// Ensure proper re-rendering on browser navigation`, `// Auth state for welcome message`, `// Ref for scrolling to article on card click`, `// Selected garden from URL`, `// Reset loading state when navigating back to home`
- `packages/client/src/views/Home/Garden/Work.tsx:119,125` — `// Handle individual work retry`, `// Process just this job`
- `packages/client/src/views/Garden/Details.tsx:50` — `// Handle location toggle`
- `packages/client/src/views/Garden/Intro.tsx:92` — `// Filter actions by effective domain` (kept the gardens-filter comment because the `domainMask 0/undefined passes` clause is real WHY)
- `packages/client/src/views/Garden/index.tsx:323` — `// Create fallback objects for review step`
- `packages/client/src/views/Login/index.tsx:181,260` — `// Handle auth errors`, `// Render logic`
- `packages/admin/src/components/hypercerts/HypercertWizard.tsx:154,162` — `// Handle browser refresh/close with beforeunload`, `// Handle blocker state - show confirmation dialog`
- `packages/admin/src/components/Hypercerts/Steps/MetadataEditor.tsx:30,113` — `// Convert seconds to milliseconds for Date`, `// Filter out scopes already added`
- `packages/admin/src/components/Work/CookieJarDepositModal.tsx:43,78` — `// Reset form state when modal opens/closes`, `// Clear mutation error when inputs change`
- `packages/admin/src/components/Work/CookieJarWithdrawModal.tsx:43,73` — same two patterns
- `packages/admin/src/components/Work/CookieJarPayoutPanel.tsx:41` — `// Return null when module not configured, still loading, or no jars exist`
- `packages/admin/src/components/Work/WorkCard.tsx:22` — `// Transform EASWork to WorkCardData for the shared component`
- `packages/admin/src/views/Gardens/Garden/CreateAssessment.tsx:322` — `// Reset validation display when step changes`
- `packages/shared/src/providers/Auth.tsx:418,421,434` — `// Clear from machine`, `// Disconnect wallet`, `// Clear query cache` — KEPT the gold-standard "Clear auth mode … but KEEP credential" multi-line WHY comment

### Stubs
- None — every `throw new Error("…not implemented")` (6 sites in `packages/shared/src/workflows/{mintHypercert,createGarden}.ts`) is an xstate placeholder actor overridden via `.provide({ actors })` at the consumer site. They are NOT dead stubs.

### Console statements
- `packages/client/src/views/Profile/AppSettings.tsx:182,187` — `console.debug` → `logger.debug({ error: e })`. Dropped the `import.meta.env.DEV` guard (logger has internal level gating). Logger import already present on line 5.

### History comments
- `packages/contracts/script/deploy.ts:3-18` — 16-line "Legacy entry point... Refactored into..." block + `// Load environment variables`, `// Delegate to new modular CLI`, `// Main execution` WHAT comments → 3-line "Backward-compat shim that delegates to ./deploy/cli." docstring + bare imports
- `packages/contracts/script/deploy/cli.ts:14-21` — "Refactored from monolithic deploy.js into modular structure..." → "Main CLI entry. Shared NetworkManager, AnvilManager, and DeploymentAddresses are constructed once and injected into every deployer..."
- `packages/contracts/script/deploy/gardens.ts:10-14` — "Extracted from deploy.js - handles deployment of individual gardens" → "Deploys individual gardens via forge script."
- `packages/contracts/script/deploy/core.ts:11-15` — "Extracted from deploy.js - handles deployment of core protocol contracts" → "Deploys the core protocol contracts."
- `packages/contracts/script/deploy/actions.ts:18-22` — "Extracted from deploy.js - handles deployment of actions from config" → "Deploys actions defined in a JSON config."
- `packages/contracts/script/deploy/anvil.ts:5-11` — "Extracted from deploy.js to handle Anvil process management. Tracks spawned child processes and registers cleanup handlers..." → trimmed to 2 lines preserving the "tracks/registers" WHY
- `packages/contracts/script/utils/validation.ts:1-6` — "Extracted from deploy.js to provide reusable validation..." → "Reusable validation for garden configs, action configs, and capital types."
- `packages/contracts/script/utils/network.ts:71-76` — "Consolidates network configuration handling that was previously duplicated across deploy.js, garden-manager.js, and action-manager.js" → "Single source of truth for RPC URL resolution and chain-id normalization across all deploy subcommands."

## Edited comments (concise rewrites)

### `packages/shared/src/hooks/app/useScrollToTop.ts:3-12`
- Was: 9-line block with "Use this in views that should always start at the top (e.g., Garden, Work detail). This replaces scroll logic that was previously in useNavigateToTop, which caused a visible flash..."
- Now: 5-line block focused on WHY (`useLayoutEffect → before paint → prevents flash`)

### `packages/shared/src/hooks/app/useInstallGuidance.ts:239`
- Was: `// Was previously installed - show "Open App" as primary` (ambiguous — describes user state but reads like code history)
- Now: `// User has already installed the PWA — primary CTA is "Open App", not "Install".`

### `packages/shared/src/providers/Work.tsx:110,362`
- Was: `// Legacy context for backward compatibility` / `// Legacy combined value for backward compatibility`
- Now: `// Combined context retained for consumers of useWork().` / `// Combined value for consumers using useWork() (selection + form merged).`

### `packages/shared/src/hooks/auth/useAuth.ts:133-135`
- Was: 3-line `// =====` banner + `// LEGACY EXPORTS (kept for backwards compatibility)` + `// =====` around a single re-export
- Now: 1-line `// Re-exported for backwards compatibility with old import sites.`

### `packages/shared/src/modules/transactions/embedded-sender.ts:52-62`
- Was: 11-line aspirational EIP-5792 commented-out code block (sendCalls + getCallsStatus snippet)
- Now: 1-line `// TODO: Replace with EIP-5792 sendCalls + paymasterService once @wagmi/core/experimental is stable.`

### `packages/admin/src/components/hypercerts/HypercertWizard.tsx:473-474`
- Was: `// Handle clicking on completed steps in the step indicator\n  // stepIndex is 0-based (from FormWizard), workflow uses 1-based steps`
- Now: `// stepIndex is 0-based (from FormWizard); workflow uses 1-based steps.` (kept the WHY, dropped the WHAT preamble)

### `packages/client/src/views/Profile/index.tsx:46`
- Was: `// Get user-set username (only if not auto-generated)`
- Now: `// Skip auto-generated passkey usernames so we don't display them as user-set names.`

### JSDoc trim — full file rewrites (preserve `@example` only where it teaches)
- `packages/shared/src/utils/eas/explorers.ts` — 86 → 41 lines. Removed every `@param chainId - The chain ID where...` / `@returns The complete EAS explorer URL` block. Kept the function bodies and the inline mainnet-vs-subdomain comment.
- `packages/shared/src/utils/blockchain/address.ts` — 125 → 79 lines. Removed `@param a - First address` / `@param b - Second address` / `@returns true if equal` blocks. Preserved `@example` blocks for `compareAddresses`, `isUserAddress`, `isAddressInList`, `truncateAddress` (each shows actual usage). Replaced the `normalizeAddress` 12-line block with a 1-line WHY comment about the two-overload shape.
- `packages/shared/src/utils/blockchain/chain-registry.ts:83-121` — Trimmed `@param chainId - The chain ID to look up` blocks from `getChainConfig`, `getNetworkName`, `getEASName`, `getBlockExplorer`. Kept the 1-line WHY comment on `getChainConfig` (about default fallback).
- `packages/shared/src/utils/action/parsers.ts` — 74 → 40 lines. Trimmed `@param compositeId` / `@returns numeric actionUID` blocks. Preserved the file-level `@module` doc and the `parseActionUID` `@example` block (shows the `"chainId-uid"` format).
- `packages/shared/src/utils/eas/transaction-builder.ts:16,31,52` — Removed `"EAS attestation request structure (internal)"`, `"Build an EAS attestation request"`, `"Build transaction parameters for an EAS attestation (internal helper)"` docstrings on internal helpers. Kept the function-level docs that explain UX/gas batching rationale (`buildBatchApprovalAttestTx`, `buildBatchWorkAttestTx`).
- `packages/shared/src/utils/compression.ts:13-26` — Removed `"Check if native compression streams are supported"` and `"Combine multiple Uint8Array chunks..."` blocks (identifier already conveys intent). Kept the file-level `@module` + `@see MDN` doc.

### `packages/contracts/script/deploy/gardens.ts:28,75,142,151`
- Was: 4 separate `@param X - Y` blocks restating method param names
- Now: One-line summaries (`/** Deploy a garden from a JSON config file. */`, `/** Execute a forge script with the configured network and env. */`, etc.)

## Kept (legitimate WHY comments, business invariants)

Verified during the sweep — these are not slop and stay:

- `packages/shared/src/modules/job-queue/index.ts:25-42` — `createOfflineTxHash` warning: "never submit synthetic hash to RPC"
- `packages/shared/src/hooks/work/usePlatformStats.ts:96-99` — explains why `enabled: gardenAddresses.length > 0` was removed (TQ v5 placeholderData data loss). Load-bearing.
- `packages/shared/src/utils/errors/contract-errors.ts:23-30,183` — operational doc (cast sig, last-updated date) + legacy selector label (required to decode old attestations)
- `packages/shared/src/utils/eas/encoders.ts:360` — labels the legacy v1 format branch in a two-format ternary
- `packages/shared/src/utils/storage/file-serialization.ts:76` — labels the legacy File-object branch with the iOS caveat
- `packages/shared/src/utils/styles/theme.ts:89`, `packages/shared/src/hooks/app/useTheme.ts:59` — `// Legacy browsers` labels for `matchMedia.addListener` fallback branches
- `packages/shared/src/workflows/authMachine.ts:1-36` — state-machine contract overview
- `packages/shared/src/utils/scheduler.ts:1-12,99-104` — public-API ergonomics doc + background-priority delay rationale
- `packages/shared/src/utils/time.ts:1-19,64-68` — Temporal-API rationale + seconds-vs-ms heuristic with `1e12` threshold
- `packages/shared/src/providers/Auth.tsx:228-231,424-426,442-444,530` — AppKit connector-id uncertainty, "KEEP credential on logout" rationale, external-actor race notes
- `packages/shared/src/modules/transactions/embedded-sender.ts:1-15` — module-level explanation of why this is NOT gas-sponsored yet
- `packages/shared/src/modules/translation/browser-translator.ts:4,13` — labels old `window.translation` vs new `window.ai.translator` feature-detect branches
- `packages/shared/src/config/blockchain.ts:170-184` — RPC URL pattern-matching branches (each tied to an actual branch)
- All `// eslint-disable-next-line <rule> -- <reason>` comments — each carries inline reason
- All `// @ts-expect-error <reason>` comments — each explains the escape hatch
- All file-level `// =======` / `// ----` section banners in multi-export files (`packages/shared/src/utils/index.ts` barrel, Canvas components, Admin\* palette) — navigation aids in wide files
- `packages/admin/src/components/hypercerts/HypercertWizard.tsx:158` — `// Modern browsers ignore custom messages, but this triggers the dialog` — explains the `event.returnValue = ""` pattern
- `packages/client/src/views/Garden/Intro.tsx:96` — kept the `// Gardens without a domainMask (0 or undefined) pass through all filters.` because that's a real domain invariant (rewritten from "Filter gardens by selected domain; gardens without a domainMask...")
- `packages/admin/src/components/hypercerts/HypercertWizard.tsx:473` — kept the `0-based vs 1-based stepIndex` note because it's a real off-by-one risk

## Deferred / Skipped

- AdminTextField.tsx + AdminListItem.tsx inner-function dash dividers (flagged in §9 of the prior report) — files appear to have been split/relocated since the prior sweep. Not investigated further; out of scope as a comment-only cleanup. Should be caught in the next "split this component" refactor.
- `WorkDetail/helpers.tsx` — flagged in the prior report at `packages/admin/src/views/Garden/WorkDetail/helpers.tsx:104` — file no longer exists in the current tree.
- `CommandPalette.tsx` lines flagged in the prior report — file is now 179 lines (was 400+), the specific lines no longer apply.
- The remaining ~200 WHAT-narrator hits across `shared/providers/`, `shared/hooks/`, `shared/modules/` were intentionally NOT swept. The prior advisor recommendation was to land the views/utils sweep first, then revisit the higher WHY-comment density layers separately. This commit follows that recommendation.

## Test result
PASS for the slop-cleanup change. 12 baseline failures unchanged (verified pre/post-edit on the same node_modules install). All failures are in vault/yield/garden/roles hook tests; none of those files were touched in this cleanup.
