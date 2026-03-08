# Plan D: Contract & Cross-Package Fixes

**GitHub Issues**: #432, #425, #407
**Branch**: `fix/contracts-crosspackage`
**Status**: IN PROGRESS
**Created**: 2026-03-07
**Updated**: 2026-03-08
**Phase**: 3 (after Plans A-C stabilize)
**Depends on**: Plan A (shared infrastructure) for clean shared imports

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | CookieJar cap change is contract-level + admin UI | Need both `setDefaultMaxWithdrawal` and a UI control |
| 2 | Gardens Protocol community name needs contract investigation first | Must trace what name is passed during `mintGarden()` |
| 3 | Member dedup may be a no-op — verify before fixing | Investigation found dedup exists; admin path may differ |
| 4 | Contract fix for #425 already done — name passed as param | `config.name` is passed directly to `gardensModule.onGardenMinted()` |
| 5 | Individual jar caps updatable via 1Hive `updateMaxWithdrawalAmount()` | No new contract needed — shared hook `useCookieJarUpdateMaxWithdrawal` already wraps it |
| 6 | Raise default from 0.01 to 100 tokens | $100 stablecoin default is reasonable; ETH jars need manual reduction via UI |

---

## Issues

### #432 — CookieJar withdrawal cap too low and not configurable

**Status**: DONE

**Investigation findings**:
- `CookieJar.sol:108` — `defaultMaxWithdrawal = 0.01 ether` (hardcoded in setup) → **raised to 100 ether**
- `CookieJar.sol:225-226` — `setDefaultMaxWithdrawal()` exists but is `onlyOwner`
- `CookieJar.sol:266` — new jars inherit `defaultMaxWithdrawal`
- 1Hive CookieJar supports `updateMaxWithdrawalAmount()` on individual jars
- Shared hooks `useCookieJarUpdateMaxWithdrawal` and `useCookieJarUpdateInterval` already exist
- Admin UI manage modal showed cap read-only — now has inline editing

**Changes made**:
- [x] Raised `defaultMaxWithdrawal` from `0.01 ether` to `100 ether` in `CookieJar.sol`
- [x] Updated unit tests to match new default (67/67 pass)
- [x] Added per-jar max withdrawal and interval editing to `CookieJarManageModal.tsx`
- [ ] **Migration (manual)**: Call `setDefaultMaxWithdrawal(100 ether)` on deployed CookieJarModule

**Files changed**:
- `packages/contracts/src/modules/CookieJar.sol`
- `packages/contracts/test/unit/CookieJarModule.t.sol`
- `packages/admin/src/components/Work/CookieJarManageModal.tsx`

---

### #425 — Gardens Protocol conviction voting community shows wrong name

**Status**: ALREADY FIXED (verified)

**Investigation findings**:
- Contract fix is already in place: `Garden.sol:410` passes `config.name` directly to `gardensModule.onGardenMinted()`
- `Gardens.sol:590` uses `_communityName: name` — the parameter is used correctly
- Historical bug was `_resolveCommunityName()` reading from uninitialized GardenAccount
- Remediation script `scripts/generate-garden-name-safe-txs.ts` exists for fixing existing on-chain communities

**No code changes needed** — contract already fixed. Remediation script handles existing communities.

**Files (reference only)**:
- `packages/contracts/src/tokens/Garden.sol` — fix already in place
- `packages/contracts/src/modules/Gardens.sol` — name passed correctly
- `scripts/generate-garden-name-safe-txs.ts` — generates Safe TX batch for existing communities

---

### #407 — Garden card member count double-counts (needs verification)

**Status**: DONE

**Investigation findings**:
- Bug confirmed in `GardenSummaryList.tsx:104` — naively summed `operatorCount + gardenerCount + evaluatorCount`
- Client card and shared card both use `buildGardenMemberSets()` correctly
- Admin gardens list (`index.tsx`) correctly shows separate role counts

**Changes made**:
- [x] Fixed `GardenSummaryList.tsx` to use `buildGardenMemberSets()` for deduped member count
- [x] Tooltip still shows correct per-role breakdown (unchanged)
- [x] Type-checks pass

**Files changed**:
- `packages/admin/src/components/Dashboard/GardenSummaryList.tsx`

---

## Bonus Fixes

### Deploy.s.sol pre-existing compilation errors

- [x] Removed duplicated pool retry block (lines 732-755)
- [x] Added missing `InvalidSeedRoleAddress` and `SeedRoleGrantFailed` error declarations

---

## Test Strategy

- **#432**: ✅ 67/67 CookieJar unit tests pass with new default
- **#425**: No test changes needed — contract fix already verified
- **#407**: Admin type-check passes; dedup logic uses battle-tested `buildGardenMemberSets()`

## Validation

```bash
bun format && bun lint && bun run test && bun build
```
