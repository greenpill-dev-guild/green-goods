# Plan F: High-Value Enhancement Stories

**GitHub Issues**: #393, #430, #433, #388 (priority subset)
**Branch**: per-story branches
**Status**: PLANNED
**Created**: 2026-03-07
**Phase**: 4 (after bugs and polish stabilize)
**Depends on**: Plans A-E for stable foundation

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Only 4 highest-value stories in this phase | Ship stability first, then features |
| 2 | Each story gets its own branch/PR | Independent scope, independent review |
| 3 | Remaining stories (#389-392, #394, #419, #420) deferred to next sprint | Lower urgency, some depend on contract changes |

---

## Priority Stories

### #393 — As a gardener, I want my account identity to persist across sign-ins

**Verified state**:
- Username stored in localStorage (`greengoods_username`)
- Passkey credential stored in localStorage — lost if app/browser data deleted
- Kernel Smart Account with WebAuthn P256 signer
- RP ID hardcoded to `greengoods.app`
- No server-side credential backup

**Scope**:
1. Research: Evaluate recovery options (social recovery, cloud backup, wallet fallback)
2. UX: Add clear warnings before actions that could strand passkey accounts
3. UX: Guide users toward wallet-based login as recovery-friendly alternative
4. Document: How identity continuity works for each auth method

**This is primarily a research + UX story, not a code-heavy implementation.**

---

### #430 — As an operator, I want an all-gardens assessments view in admin

**Scope**:
1. Add "Assessments" entry to admin sidebar (below Gardens)
2. Create assessments list view using `useGardenAssessments()` across all gardens
3. Add filtering (by garden, by date, by status) and sorting
4. Link to assessment detail (in-app or EAS explorer)

**Files**:
- `packages/admin/src/components/Navigation/Sidebar.tsx` — add menu entry
- `packages/admin/src/views/Assessments/` — new view directory
- `packages/admin/src/router.tsx` — add route
- Reuse `packages/shared/src/hooks/assessment/useGardenAssessments.ts`

---

### #433 — As a funder, I want endowment deposits to be reliable and transparent

**Scope**:
1. Fix deposit UI to read current vault state reliably
2. Add "Connect Wallet" prompt when disconnected user taps deposit
3. Show underlying AAVE pool/strategy info in vault detail
4. Validate multisig deposit path (may be research-only for Phase 1)

**Files**:
- `packages/admin/src/components/Vault/DepositModal.tsx`
- `packages/client/src/components/Dialogs/TreasuryTabContent.tsx`
- `packages/shared/src/hooks/vault/useVaultOperations.ts`
- `packages/shared/src/types/vaults.ts` — may need strategy fields

---

### #388 — As an operator, I want a clear explanation when I can't create a garden

**Scope**:
1. Show disabled "Create Garden" button with explanation when user lacks required role
2. Explain which Hats Protocol hat is needed
3. Provide link/guidance on how to request the role

**Files**:
- `packages/admin/src/views/Gardens/` — garden list/empty state
- Hats role checking hooks in shared

---

## Deferred Stories (next sprint)

| # | Title | Why Deferred |
|---|-------|-------------|
| #389 | Update garden domains after creation | Needs domain management contract work |
| #390 | Choose available actions per garden | Low priority per issue notes |
| #391 | Upload garden files/metadata | Infrastructure work |
| #392 | "Other" option for services | Small UX enhancement |
| #394 | Work submissions show action/category | Depends on indexer data |
| #419 | Yield growth visibility | Needs vault history data from indexer |
| #420 | Dune dashboard | External tooling, not code |

## Validation

```bash
bun format && bun lint && bun run test && bun build
```
