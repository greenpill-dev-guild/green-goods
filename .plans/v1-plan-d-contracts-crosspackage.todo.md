# Plan D: Contract & Cross-Package Fixes

**GitHub Issues**: #432, #425, #407
**Branch**: `fix/contracts-crosspackage`
**Status**: PLANNED
**Created**: 2026-03-07
**Phase**: 3 (after Plans A-C stabilize)
**Depends on**: Plan A (shared infrastructure) for clean shared imports

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | CookieJar cap change is contract-level + admin UI | Need both `setDefaultMaxWithdrawal` and a UI control |
| 2 | Gardens Protocol community name needs contract investigation first | Must trace what name is passed during `mintGarden()` |
| 3 | Member dedup may be a no-op — verify before fixing | Investigation found dedup exists; admin path may differ |

---

## Issues

### #432 — CookieJar withdrawal cap too low and not configurable

**Verified state**:
- `CookieJar.sol:108` — `defaultMaxWithdrawal = 0.01 ether` (hardcoded in setup)
- `CookieJar.sol:225-226` — `setDefaultMaxWithdrawal()` exists but is `onlyOwner`
- `CookieJar.sol:266` — new jars inherit `defaultMaxWithdrawal`
- Admin UI: `CookieJarWithdrawModal.tsx:186-195` — "Max" button respects cap
- No per-garden/per-asset override exists

**Steps**:
1. **Investigate**: Is 0.01 ETH appropriate for DAI? (0.01 DAI is ~$0.01 — way too low for DAI payouts)
   - The cap is in native token units, but CookieJar supports multiple assets
   - Need per-asset max withdrawal or at least different defaults per asset type
2. **Contract change**: Add `setMaxWithdrawalForJar(jarId, amount)` or make `defaultMaxWithdrawal` per-asset
3. **Admin UI**: Add a "Configure withdrawal cap" control in the garden endowment/payout settings
4. **Migration**: Call `setDefaultMaxWithdrawal()` on existing deployment to raise the DAI cap immediately

**Files**:
- `packages/contracts/src/modules/CookieJar.sol`
- `packages/admin/src/components/Work/CookieJarWithdrawModal.tsx`
- `packages/admin/src/components/Work/CookieJarPayoutPanel.tsx`

---

### #425 — Gardens Protocol conviction voting community shows wrong name

**Verified state**:
- Garden names come from user input at creation, stored via indexer
- The conviction voting community is created during `mintGarden()` on the Gardens Protocol
- Need to trace: what name parameter is passed to Gardens Protocol community creation

**Steps**:
1. **Investigate**: Read `GardenToken.sol` and `useCreateGardenWorkflow.ts` to find where the community creation call is made
2. **Identify**: What name is being passed — is it the garden name, a default, or something else?
3. **Fix**: Ensure the correct garden name is passed to the Gardens Protocol community creation
4. **Verify**: Check existing gardens on Gardens Protocol to confirm the fix

**Files**:
- `packages/contracts/src/Garden.sol` (GardenToken)
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts`
- Gardens Protocol community interface

---

### #407 — Garden card member count double-counts (needs verification)

**Verified state**:
- `gardenHasMember()` utility in shared DOES deduplicate
- `useFilteredGardens.ts:52-58` uses this correctly
- Bug may be in admin-specific garden card rendering

**Steps**:
1. **Verify**: Find the admin garden card's member count display — does it use the shared dedup or its own sum?
2. **If bug exists**: Fix admin card to use shared dedup logic
3. **If already fixed**: Close issue with verification comment

**Files**:
- `packages/admin/src/components/Cards/` or similar — garden card component
- `packages/shared/src/utils/index.ts` — `gardenHasMember()`

---

## Test Strategy

- **#432**: Fork test for new withdrawal cap logic; admin integration test for UI control
- **#425**: Manual verification on Gardens Protocol after fix
- **#407**: Unit test for member count dedup in admin context

## Validation

```bash
bun format && bun lint && bun run test && bun build
```
