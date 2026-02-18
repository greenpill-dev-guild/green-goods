# Teams Execution Prompt: Frontend Flows Remediation

> Copy-paste this into Claude Code to execute the plan with `/teams ship`.

---

## Prompt

```
/teams ship frontend-flows-remediation

Execute the plan at `.plans/frontend-flows-remediation.md` in phased order.

## Context

This plan addresses 67 findings (5 Critical, 16 High, 26 Medium, 20 Low) from a deep frontend review of 6 flows: work submission, work approval, garden creation, assessment creation, yield/vault deposit, and hypercert minting.

## Phase Execution

Execute phases 1-3 in order. Phases 4-5 are optional stretch goals. Each phase must pass its validation gate before the next phase begins.

### Phase 1: Critical Fixes (middleware-driver + app-driver)

**middleware-driver** owns:
- **1.1**: Refactor assessment XState machine to `setup()` + invoked actors. Remove `window.ethereum`. Use `useWalletClient()` from Wagmi. Move `CreateAssessmentForm` type to `types/`. Reference `createGarden.ts` and `mintHypercert.ts` as target patterns.
  - Files: `shared/src/workflows/createAssessment.ts`, `shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts`
  - [scope:middleware] [gate:required] [check:full]

- **1.2**: Stabilize hypercert mint machine — use `useRef` for `walletClient`, `smartAccountClient`, `eoaAddress`. Machine `useMemo` should only depend on `chainId`. Read from refs inside actor implementations.
  - Files: `shared/src/hooks/hypercerts/useMintHypercert.ts`
  - [scope:middleware] [gate:required] [check:full]

**app-driver** owns:
- **1.3**: Add missing `ApprovalJobPayload` type import.
  - Files: `client/src/views/Home/Garden/Work.tsx:326`
  - [scope:client] [gate:required] [check:quick]

**Validation gate**: `cd packages/shared && bun run test && cd ../client && bun build`

### Phase 2: High-Priority Fixes (middleware-driver + middleware-observer + app-driver + app-observer)

**middleware-driver** owns:
- **2.1**: Add `toastService.error()` for mint failures in `useMintHypercert.ts:436-449`
- **2.2**: Standardize error handling — migrate `useWorkMutation`, `useBatchWorkApproval`, `useBatchWorkSync`, `useWorkApprovals` to `createMutationErrorHandler()`. Convert dynamic import in `createGardenOperation.ts:307` to static.
- **2.4**: Add `isMounted` guard to `useWorkImages.ts:35-58` (use `useAsyncEffect`)
- **2.5**: Fix `useGardenAssessments.ts` — remove `limit` from query key or pass to `queryFn`
- **2.6**: Extract `estimateCCIPFee()` helper in `useCreateGardenWorkflow.ts`
- All [scope:middleware] [gate:required] [check:full]

**middleware-observer** owns:
- **2.3**: Fix `Address` type imports across all shared hooks (list in plan 2.3)
- **2.7**: Add `useTimeout` + `INDEXER_LAG_FOLLOWUP_MS` to `useBatchWorkApproval.ts`
- **2.12**: Add `waitForTransactionReceipt()` in `useMarketplaceApprovals.ts:65-71`
- All [scope:middleware] [gate:required] [check:full]

**app-driver** owns:
- **2.10**: Fix blank screen on garden not found — `client/views/Home/Garden/index.tsx:146`
- **2.11**: Replace `console.debug` with `logger.debug()` in `client/views/Profile/Account.tsx:405`
- Fix `Address` imports from `viem` in `client/views/Home/Garden/index.tsx:31` and `client/views/Home/WorkDashboard/index.tsx:38`
- All [scope:client] [gate:required] [check:quick]

**app-observer** owns:
- **2.8**: i18n pass on admin views — Assessment.tsx, WorkDetail.tsx, Actions/*.tsx, Contracts/index.tsx, Deployment/index.tsx, HypercertDetail.tsx marketplace section. Use `intl.formatMessage()` with proper message IDs.
- **2.9**: Add component-level error boundaries in admin — Detail.tsx, WorkDetail.tsx, CreateAssessment.tsx
- Fix `Address` imports from `viem` in `admin/views/Gardens/Garden/Hypercerts.tsx:11` and `HypercertDetail.tsx:21`
- All [scope:admin] [gate:required] [check:full]

**Validation gate**: `bun format && bun lint && bun run test && bun build`

### Phase 3: Medium-Priority (middleware pair + app pair)

**middleware pair** owns: 3.5, 3.6, 3.10-3.13, 3.18 (timer cleanups, stale closures, silent catches, non-null assertions)
**app pair** owns: 3.1-3.4, 3.7-3.9, 3.14-3.17 (accessibility, responsive tables, focus traps, loading states, touch targets)

See `.plans/frontend-flows-remediation.md` Phase 3 for full file list.

**Validation gate**: `bun format && bun lint && bun run test && bun build`

## Rules

1. Read the full plan at `.plans/frontend-flows-remediation.md` before starting
2. Each lane observer must validate driver's work before marking tasks complete
3. All code must pass `bun format && bun lint` before PR
4. Follow architectural rules in `.claude/rules/architectural-rules.md`
5. Use `bun run test` (NOT `bun test`) for all test runs
6. Import hooks from `@green-goods/shared` barrel only (Rule 11)
7. Use `Address` from `@green-goods/shared` not `viem` (Rule 5)
8. Use `createMutationErrorHandler()` for all new error handling (Rule 4)
9. Use `useTimeout()` / `useDelayedInvalidation()` for all timers (Rule 1)
10. Reference existing patterns: `createGarden.ts` for XState, `useAllocateYield.ts` for error handling, `useHypercertDraft.ts` for drafts
```
