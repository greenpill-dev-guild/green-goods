# V1 Issue Consolidation & Backlog Cleanup

**GitHub Issue**: #424 (tracker)
**Status**: IMPLEMENTED
**Created**: 2026-03-07
**Last Updated**: 2026-03-07
**Completed**: 2026-03-07

## Implementation Plans

| Plan | Phase | Issues | Branch | Depends On |
|------|-------|--------|--------|------------|
| [Plan A: Shared Infrastructure](v1-plan-a-shared-infrastructure.todo.md) | 1 | #404, #431, #411, #406 | `fix/shared-infrastructure` | — |
| [Plan B: Client UX Fixes](v1-plan-b-client-ux.todo.md) | 2 | #383, #408, #428, #429, #381, #378 | `fix/client-ux` | Plan A |
| [Plan C: Admin UX Fixes](v1-plan-c-admin-ux.todo.md) | 2 | #376, #377, #418, #417, #412, #414 | `fix/admin-ux` | Plan A |
| [Plan D: Contract & Cross-Package](v1-plan-d-contracts-crosspackage.todo.md) | 3 | #432, #425, #407 | `fix/contracts-crosspackage` | Plan A |
| [Plan E: Client & Admin Polish](v1-plan-e-polish.todo.md) | 3 | #426, #434, #412, #414 | `polish/v1-ux-cleanup` | Plans B, C |
| [Plan F: Enhancement Stories](v1-plan-f-stories.todo.md) | 4 | #393, #430, #433, #388 | per-story branches | Plans A-E |

## Summary

Cross-reference the UI walkthrough notes against issues #375-#434. Rename, consolidate,
and normalize the backlog so implementation can start from a clean, actionable set.

All 29 walkthrough items were independently investigated against the codebase.
Several issues had incorrect root causes, some bugs are already fixed, and some
"bugs" are actually working-as-intended behavior that needs UX clarification.

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Consolidate by component/view, not severity | Devs fix related issues in one PR touching the same files |
| 2 | Bugs keep `bug(scope):` prefix, polish keeps `polish(scope):` | Conventional Commits parity; stories use "As a..." format |
| 3 | Merge into surviving issue (update body), close others as dupes | Preserves root-cause detail without creating yet more issues |
| 4 | Strip "V1 QA:" prefix from all remaining issues | Not a convention — leftover from the QA pass |
| 5 | Stories must follow "As a [user type], I want..., so I can..." | User's explicit request |
| 6 | Mark fixed issues as closeable with verification notes | Don't keep dead issues open |

---

## Verified Investigation Findings

### Issues Already Fixed (candidates for closing)

| Issue | Title | Finding |
|-------|-------|---------|
| **#405** | Work detail page fails to render | **FIXED** in commit `6a2430d7` (Mar 5). `WorkViewSection` now accepts all 7 `WorkDisplayStatus` values. Regression tests in place. |
| **#427** | Remove production logs | **NO PRODUCTION LOGS FOUND**. Only `console.debug` gated by `import.meta.env.DEV`. May need to verify in actual deployed build or check dependency logs. |

### Issues with Incorrect Root Cause (need body rewrite)

| Issue | Current Claim | Actual Finding |
|-------|--------------|----------------|
| **#378** | "Time spent multiplies input by 60 — bug" | **NOT A BUG**. `normalizeTimeSpentMinutes()` intentionally converts user-entered hours → stored minutes (×60). The issue is **confusing field label/UX**, not broken math. Should be reclassified as `polish(client)`. |
| **#383** | "Logout does not sign out" | **Partially wrong**. Auth state IS properly cleared (tokens, username, React Query cache). The real bug: **service worker caches and IndexedDB aren't cleared on logout**, so cached content lingers for next user on same device. |
| **#384** | "Refresh button not working" | **Button works correctly** — unregisters SW, clears all caches, deletes IndexedDB, reloads. If users report it broken, it may be a race condition or the button not triggering (needs prod testing). |
| **#404** | "eas.ts hardcodes wrong gateway" | **eas.ts no longer has hardcoded gateway** — it imports `resolveIPFSUrl()`. The real issue: **6+ files define gateway lists independently** with slight variations (ipfs.ts, ImageWithFallback, agent, indexer, scripts). Gateway inconsistency is real but the diagnosed root cause is stale. |
| **#407** | "Member count double-counts" | **Dedup IS implemented** via `gardenHasMember()` in `useFilteredGardens`. The bug may be in a different code path (admin-specific card rendering?) or already fixed. |
| **#410** | "Endowment back nav goes to garden instead of list" | **Correct by design** — Vault detail is a sub-view of a specific garden, so back → garden is the right hierarchy. Issue should be closed or re-scoped to "add breadcrumb navigation for endowment context." |

### Issues with Correct Diagnosis (confirmed by investigation)

| Issue | Title | Verified? |
|-------|-------|-----------|
| **#376** | Create garden flow broken | ✅ Confirmed: all 4 domains preselected, gardeners listed before operators, explicit Add button required, no operator-is-also-gardener explanation, **infinite re-render loop at line 141-143** |
| **#404** | IPFS images fail to load | ✅ Confirmed: gateway inconsistency across files. `ImageWithFallback` has its own fallback list `[w3s.link, storacha.link, dweb.link]` independent from `ipfs.ts` defaults `[storacha.link, w3s.link, ipfs.io]` |
| **#409** | Endowment TVL overflow | ✅ Combined ETH+DAI string can exceed `line-clamp-2` on StatCard |
| **#411** | Standardize image fallbacks | ✅ `ImageWithFallback` works well (3 gateway retries + letter placeholder), but not all image-bearing components use it consistently |
| **#415** | Asset order inconsistency | ✅ Three different ordering strategies across the same endowment view |
| **#416** | "Pay Gardeners" language | ✅ Still present in CookieJarWithdrawModal and CookieJarPayoutPanel |
| **#417** | Action detail description below fold | ✅ Description is 4th item in 1/3-width sidebar — definitely below fold |
| **#418** | Positions section too tall | ✅ No height constraint, no pagination |
| **#428** | Garden view notification dialog | ✅ NO close button, NO backdrop dismiss. But join button sizing is actually `size="small"` (h-9) — may not be "too big." Garden name uses `line-clamp-1` — truncates rather than wrapping to 2 lines. |
| **#429** | Flash of home view on garden open | ⚠️ Agent found CSS containment approach, but couldn't verify runtime behavior. Needs prod testing. |
| **#431** | Assessment loading inconsistent | ✅ Confirmed: client uses `useGardens()` (nested data), admin uses dedicated `useGardenAssessments()` hook. Client hardcodes mainnet EAS URL regardless of chain. |
| **#432** | CookieJar withdrawal cap | ✅ Default 0.01 ETH hardcoded in contract. `setDefaultMaxWithdrawal()` exists but owner-only. No per-garden config. |
| **#434** | Dashboard card height inconsistency | ✅ Minor: Action cards use fixed heights while Garden/Work cards use container queries. Different `duration-*` values. |

### User Answers to Context Questions (resolved 2026-03-07)

| Issue | Answer | Action |
|-------|--------|--------|
| **#385** | Keep open for now | Keep as-is, Chrome limitation acknowledged |
| **#386** | No repro case, remove it | Close — code looks correct, no evidence of bug |
| **#425** | The issue is the Gardens Protocol conviction voting community name created when a Green Goods garden is minted | Update body — this is about the community name on Gardens Protocol, not our UI |
| **#426** | Text wrapping makes sizing look inconsistent; "join the open garden" = the open gardens section in profile page | Keep — rewrite body to clarify: text wrapping issue + rename profile section |
| **#429** | Still happening — page scrolls to top then goes into garden view | Keep — the flash is a scroll-to-top before navigation, not a component mount issue |

---

## Step 1: Close Already-Fixed Issues

| Issue | Action | Note |
|-------|--------|------|
| **#405** | Close with verification comment | Fixed in `6a2430d7`, regression tests added |
| **#427** | Close OR re-scope to dependency audit | No production logs found in our code; may be from dependencies |

---

## Step 2: Reclassify Misdiagnosed Issues

| Issue | Old Type | New Type | New Title |
|-------|----------|----------|-----------|
| **#378** | bug | polish | `polish(client): Work form "time spent" field label is confusing — hours input stored as minutes` |
| **#383** | bug (logout broken) | bug (cache leak) | `bug(client): Logout doesn't clear service worker caches — stale data persists for next session` |
| **#410** | bug (back nav wrong) | Close or re-scope | Back → garden is correct. If needed: `polish(admin): Add endowment list breadcrumb to vault detail` |

---

## Step 3: Consolidation — Merge Related Issues

### Group A: Client Form & Scroll Bugs
**Surviving issue**: #408 (most detailed root cause)
**Close as duplicates**: #379, #382
**New title**: `bug(client): Mobile form interactions — scroll lock, textarea overflow, and input zoom`
**Body update**: Merge acceptance criteria from #379 (textarea scroll) and #382 (scroll sticks) into #408

### Group B: PWA Lifecycle (REVISED)
**Surviving issue**: #383 (rewritten — see Step 2)
**Close as duplicates**: #384
**Keep or close separately**: #385 (Chrome limitation — may not be actionable)
**New title**: `bug(client): PWA session lifecycle — logout cache leak and stale data persistence`
**Body update**: Focus on the real bug (SW caches not cleared on logout). Note that refresh button works but may need prod verification.

### Group C: Admin Endowment Layout
**Surviving issue**: #418 (broadest scope)
**Close as duplicates**: #409, #415
**Close or re-scope**: #410 (back nav is correct by design)
**New title**: `polish(admin): Endowment views — overflow, asset ordering, and compactness`
**Body update**: Merge TVL overflow (#409), asset order (#415) into #418. Drop #410 (correct behavior).

### Group D: Admin Action & Payout Polish
**Surviving issue**: #417 (layout is the bigger issue)
**Close as duplicates**: #416
**New title**: `polish(admin): Action detail and payout tab — copy and layout cleanup`
**Body update**: Merge payout language fix (#416) into #417

**Net effect**: Close 6-9 issues (depending on decisions on #385, #405, #410, #427).

---

## Step 4: Title Renames — Strip "V1 QA:" Prefix

| Issue | Old Title | New Title |
|-------|-----------|-----------|
| #377 | V1 QA: Vault withdraw shows "amount exceeds balance"... | `bug(admin): Vault withdraw shows "amount exceeds balance" — decimal precision on small amounts` |
| #378 | V1 QA: "Time spent (hours)" multiplies input by 60... | `polish(client): Work form "time spent" field label is confusing — hours input stored as minutes` |
| #381 | V1 QA: Back navigation from work detail routes to homepage... | `bug(client): Back navigation from work detail routes to homepage instead of garden` |
| #386 | V1 QA: ENS/subdomain assignment not working... | `bug(shared): ENS subdomain assignment not working during garden creation` |

---

## Step 5: Story Format Normalization

All existing story issues already use "As a [user type]..." format ✅

**One conversion needed**:
| Issue | Current Title | New Title |
|-------|--------------|-----------|
| #388 | Admin UX: Role-gating for "Create garden"... | `As an operator, I want a clear explanation when I can't create a garden, so I understand what role is required` |

Add label: `story`, `enhancement`

---

## Step 6: Update Tracker Issue #424

Rewrite #424 body to reflect verified backlog, organized by priority.

### Priority Tiers (REVISED after investigation)

**P0 — Critical Bugs (blocks core user flows)**
- #404 bug(shared): IPFS gateway inconsistency — images fail across both apps
- #376 bug(admin): Create garden flow broken (includes infinite re-render loop)
- #406 bug(shared): Work approval fails with unhelpful error
- #431 bug(shared): Assessment loading/links broken (client hardcodes mainnet EAS URL)

**P1 — Important Bugs (degrades experience)**
- #383 → bug(client): PWA logout cache leak
- #428 bug(client): Garden view notification dialog + controls
- #377 bug(admin): Vault withdraw decimal precision
- #381 bug(client): Back navigation from work detail
- #408 → bug(client): Mobile form interactions (scroll/zoom)
- #432 bug(shared): CookieJar withdrawal cap too low

**P1.5 — Needs Verification (may already be fixed or non-issue)**
- #386 bug(shared): ENS subdomain (code looks correct — needs chain/contract investigation)
- #425 bug(shared): Gardens community name (data source question)
- #407 bug(admin): Member count dedup (logic exists — may be different code path)
- #429 bug(client): Flash of home view (CSS looks correct — needs runtime testing)

**P2 — Polish (visual/UX improvements)**
- #378 → polish(client): Time-spent field label clarity
- #411 polish(shared): Standardize image fallbacks
- #426 polish(client): Garden/profile spacing, copy, controls
- #434 polish(client): Home dashboard card animations
- #412 polish(admin): Garden cards richer stats/tooltips
- #414 polish(admin): Recent Activity richer events
- #418 → polish(admin): Endowment views consolidated
- #417 → polish(admin): Action detail and payout tab

**P3 — Enhancement Stories (new features)**
- #388 → As an operator: clear role-gating explanation
- #389 As an operator: update garden domains
- #390 As an operator: choose available actions per garden
- #391 As an operator: upload garden files/metadata
- #392 As a user: "Other" option for services
- #393 As a gardener: identity persistence across sign-ins
- #394 As an operator: work submissions show action/category
- #419 As an operator: yield growth visibility
- #430 As an operator: all-gardens assessments view
- #433 As a funder: reliable/transparent deposits
- #420 As a team member: Dune dashboard

---

## Step 7: Label Cleanup

- Remove `triage` from all triaged issues
- Add `polish` to #378 (reclassified from bug)
- Add `story`, `enhancement` to #388
- Verify `client`/`admin`/`shared` scope labels match actual code paths

---

## Execution Checklist

- [x] **Get user answers** to questions in "Needs More Context" section
- [x] **Step 1**: Close #405 (fixed), #427 (no logs found), #386 (no repro), #410 (correct by design)
- [x] **Step 2**: Reclassify #378 (bug → polish), rewrite #383 (cache leak)
- [x] **Step 3a**: Update #408 (merge #379, #382) → close #379, #382
- [x] **Step 3b**: Update #383 (rewrite + merge #384) → close #384. #385 kept open.
- [x] **Step 3c**: Update #418 (merge #409, #415) → close #409, #415. #410 closed (by design).
- [x] **Step 3d**: Update #417 (merge #416) → close #416
- [x] **Step 4**: Rename #377, #378, #381, #385
- [x] **Step 5**: Convert #388 to story format
- [x] **Step 6**: Rewrite #424 tracker body
- [x] **Step 7**: Label cleanup (remove triage from 20 issues, add polish/story/enhancement)
- [x] **Step 8**: Update issue bodies with verified root causes (#404, #407, #425, #429, #431, #378)

---

## Final Issue Count (estimated)

| Category | Before | After |
|----------|--------|-------|
| Open bugs | 22 | 12-14 |
| Open polish | 9 | 9-10 |
| Open stories | 10 | 11 (+#388) |
| Closed | 4 | 12-16 |
| **Total open** | **41** | **33-35** |
