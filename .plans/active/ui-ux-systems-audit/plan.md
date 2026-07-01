# Green Goods — UI/UX & Systems Improvement Plan (detailed, executable)

> **Companion to** [`audit.md`](./audit.md) (findings + rationale). This file is the **what-to-do**: tasks, files, exact changes, acceptance criteria, sequencing.
> **Status:** Plan for review. No code changed yet. **Audited & re-baselined 2026-07-01** against `fe312326` — see the Plan audit log below. All file:line refs are snapshots of that commit; re-verify at wave start (this tree moves daily under concurrent agents).
> **Date:** 2026-06-30 · **Audit pass:** 2026-07-01

---

# Plan audit log (2026-07-01)

An adversarial verification pass re-checked every load-bearing claim against the live tree (3 parallel read-only agents + direct reads; evidence cited per row). Context that forced changes: the tree moved past this plan within 24 hours — `77170588` (2026-07-01) collapsed the AdminDialog size scale to three tiers, `588e613b` + `8aa68f49` already completed parts of Phases 0B/6, and the send/cookie-jar commits the P2 gate waited on have all landed.

## New defects found by this audit

| # | Defect | Evidence |
|---|---|---|
| D1 | **Live dialog-size bug:** `CanvasLayout.tsx:706` passes `size={config?.width === "wide" ? "xl" : "lg"}`, but `AdminDialog.tsx:25` now types `size?: "sm" \| "md" \| "lg"` (changed by `77170588`, which missed this consumer). `"xl"` is a type error, and at runtime `sizeClasses["xl"]` is `undefined` — all four `width:"wide"` flows (Add Member, Work Detail, Create Action, Edit Action) lose their width constraint. | Read first-hand 2026-07-01: `packages/admin/src/components/AdminDialog.tsx:25,71-75`; `packages/admin/src/components/Layout/CanvasLayout.tsx:706` |

→ Now task **P0C.0** + a spawned fix-session chip. This is exactly the class of bug the original static audit could not see; it validates the runtime-census approach (P0C.2).

## Load-bearing claims: verified / refuted

| Claim (as the plan stated it) | Verdict | Evidence |
|---|---|---|
| **P0A:** all 11 sheet-descriptor flows already render as `AdminDialog` via the `CanvasLeftSheet` bridge | **VERIFIED** | Bridge at `CanvasLayout.tsx:694-712` renders `<AdminDialog>`; `LeftSheetProvider` at `:454`; right-sheet bridge at `:548`. All 11 flows enumerated across the 4 descriptors (Garden `:87,:92`; Hub `:119,:149,:198`; Actions `:40,:47,:90`; Community `:26,:34,:42`) |
| **P0A:** descriptors use a `width` prop (`wide`/default) needing normalization | **VERIFIED**, mapping corrected | Descriptors still pass `width: "wide" \| undefined`; but `wide→xl` is invalid post-`77170588` — both `wide` and default now collapse to `lg` |
| **P0A:** ~2,600 lines deletable | **REFUTED (undercount)** | `wc -l`: sources 1,375 (LeftSheet 265 · RightSheet 256 · BottomSheet 262 · CanvasSheetInternals 464 · LeftSheetContext 128) + tests/stories ≈ 2,539 → **≈ 3,914 total** |
| **P0A:** deletion is safe; `SheetBody/Footer/Divider` keep-list sound | **VERIFIED**, one addition | No client-package imports of the Canvas sheet components; `SheetBody/Footer/Divider` are standalone files, not inside `CanvasSheetInternals.tsx`. **But** both barrels export sheets — `Canvas/index.ts:1-4,29-35` **and** `packages/shared/src/index.ts:16,48-53,66` — root barrel added to P0A.3. `LeftSheetContext` is the **live config channel** (`useLeftSheetConfig`/`useRouteBackedLeftSheetConfig`), deletable only after P0A.2 replaces the plumbing — not optional dead code |
| **P0C:** dialog size taxonomy `sm/md/lg/xl/2xl variant="flow"` | **REFUTED (stale within 24h)** | `77170588` (2026-07-01) collapsed sizes to **3 tiers** `sm/md/lg` with rationale comments (`AdminDialog.tsx:61-75`) + `ADMIN_FLOW_DIALOG_CLASS` for the 3 flow dialogs + `variant: standard\|confirm\|palette\|flow` (`:26`). P0C.1 rewritten to adopt/enforce the shipped system |
| **P0C:** census target list (Submit Work … all confirms) | **REFUTED (incomplete)** | grep found **21 `<AdminDialog` call sites**; the hand list missed ~10: `GardenDomainEditor:107`, `MembersModal:61`, `ManageRolesModal:32`, `CommandPalette:91`, `MintingDialog:31`, `CreateListingDialog:131`, CookieJar Deposit/Withdraw/Manage modals (`:111/:101/:110`), `CampaignCookieJarPanel:1936`, `GardenWorkspaceContent:109`, `ManageMembers.tsx:23,37`, `AddMemberModal:110` — plus `AdminConfirmDialog` and `DiscardChangesDialog` (`1d6030c4`) sites |
| **P0C.3:** Create Assessment renders `<AdminDialog open>` unconditionally at `:200`; stale-domain crash guarded | **VERIFIED**, state moved | Now `CreateAssessment.tsx:205`: `<AdminDialog open size="lg" variant="flow" tone="hub">`. Reworked since the audit by `f035855f`, `1d6030c4`, `b028b4da` — the reported bug may already be fixed; **no open/close regression test or story exists** either way |
| **P0B:** design contract still contradicts shipping code | **STALE — largely done** | `588e613b` (2026-06-30) already landed "Side sheets are retired" (`prompt-contract.md:27`) + palette cleanup. Remainder re-scoped in P0B.1 |
| **P0B:** palette hardcodes "13"; `AdminSortSelect`/`AdminViewActions` undocumented | **VERIFIED** | `prompt-contract.md:123` lists 13; filesystem has **15** `Admin*.tsx` components |
| **P0B:** `--color-primary` caveat missing from both prompt contracts | **VERIFIED** | Present in `language.md:248`, `quick-reference.md:16`, `DESIGN.md:111`; absent from `prompt-contract.md` and `client-prompt-contract.md` |
| **P0B:** concentricity lacks a concrete example; motion schemes under-documented in contracts | **VERIFIED** | `language.md:146-154` (no before/after CSS); Motion Schemes fully specified at `language.md:186-197` — contract should reference, not duplicate |
| **P1:** Linear-routing block duplicated in 5 skills | **VERIFIED**, refs corrected | `audit:358`, `clean:456`, `principles:184`, `architecture:185`, `debug:486` — near-verbatim core with per-skill deltas (extraction must preserve the deltas) |
| **P1:** `audit/SKILL.md:130` references a non-existent script | **VERIFIED** | `node .claude/scripts/check-i18n-completeness.mjs` — script absent; real gate `packages/shared/src/__tests__/i18n/locale-coverage.test.ts` exists (4 checks: parity `:354-389`, counts `:405-410`, source-usage `:412-434`, identical-string quality `:437-449`) |
| **P1:** validation pipeline duplicated in 5 skills | **VERIFIED (undercount)** | Also in `ops/SKILL.md:46,228`, `ops/git-workflow.md:202`, `ops/ci-cd.md:212,273` → 6+ files, 10+ instances |
| **P1:** `posthog-questions` = 683 lines | **VERIFIED**, split unsafe | Exactly 683. **Gap found:** live growth-pulse cloud routine reads HogQL **verbatim from `SKILL.md` on origin/main at runtime** (`growth-pulse.md:99,340`; `qa-triage-pulse.md:71`) — a file split breaks production. P1.4 re-scoped to in-place restructure |
| **P1:** `status` skill has a confusing "mode table" | **REFUTED (wrong anchor)** | No mode table exists; `status/SKILL.md` has a Time Budget table (`:55`) and Example Shape (`:98`). Task re-anchored |
| **P2 gate:** wait for in-flight `b28bb303`/`571ac75f`/`8a1c3af5` | **STALE — all landed** | All three in develop history; wallet work continued after (`216f6d8f` Tokens tab, `e852853f` Balance view, `c9b51259` persistent toasts, `ada19893` two-tier toast policy). Gate reworded to re-baseline + concurrency check |
| **P2:** flow refs + shared hooks + no primitive name collisions | **VERIFIED**, small fixes | `CookieJarTab :109-134/:141/:150/:233`, `PublicCookieJarCard :613-630/:665-680`, `SuccessBody :499-552` exact; `AmountStep` drifted to `:104-126`. All named hooks exist; `FormattedAmountInput`/`useFormattedAmountInput`/`WalletConnectButton`/`TransactionSuccessAffordance` are free names. Shared dir is **`components/Form/`** (capital F) — plan said `form/`. `CampaignCookieJarInlineActions` is inline in `PublicCookieJarCard.tsx:434-576`, not a file |
| **P3.1:** Surface bypass at `ActionDetail:93,133`, `Assessment:154`, SignalPool, Vault | **PARTIAL** | `ActionDetail.tsx:93,133` confirmed `<Surface>`; `Assessment.tsx:154` is a raw span (no Surface); SignalPool/Vault don't import Surface. Task made grep-driven |
| **P3:** `.canvas-route-card` asymmetric padding; `main px-5`; AdminCard has no compact variant | **VERIFIED** | `index.css:1231` `padding: 0.875rem 1rem 1.25rem`; `CanvasLayout.tsx:488` `px-5`; `AdminCard.tsx` default `p-4`, variants `filled/elevated/outlined`, no density variant |
| **P4.2:** Garden skeletons lack copy | **REFUTED** | `Garden/index.tsx:54-96` IntroSkeleton **has** explanatory copy. Target dropped; AmountStep/CookieJarTab skeletons kept (re-verify at impl) |
| **P4.5:** Back can silently discard the amount | **REFUTED in code** | Back preserves state (`SendTab.tsx:126-129` only switches steps); reset happens on success only (`:101`). Reframed to verify-live |
| **P4:** onboarding dead-end, aria gaps, silent offline disables | **VERIFIED** | `GardenList.tsx:106-114` (no CTA); `AppBar.tsx:89-98` (aria-selected, no `aria-current`); `Home/index.tsx:213-216` (silent pull-to-refresh disable); `QRScanner.tsx:128-133` (unlabeled `<video>`, biome-ignore acknowledges); `ReviewStep.tsx:125-127` (offline warning only at review) |
| **P5.1:** 163 em-dashes; ~5–8 public-facing candidates | **REFUTED (both numbers)** | Actual **156** occurrences (en 55 / es 46 / pt 55). Of the 7 named candidate keys, **only `app.home.work.offlineInfo` contains an em-dash**. Real public-facing set ≈ **50 keys** (33 `public.*` + 17 `app.*`). Scope re-locked with Afo: review all ~50 |
| **P6.1:** v1-0.mdx narrates 5 domains vs 4 in code | **STALE — largely done** | `8aa68f49` (2026-06-27) added the reconciliation note at `v1-0.mdx:183-185`; remainder = present-tense fencing of `:189-332` |
| **P6.3:** Assessment definition risks reversed reading | **STALE — already fixed** | `glossary-community.md:51` + `:182` are explicitly baseline-first: "…it is **not** a review of submitted Work (that is Work Approval)" (`8aa68f49`). Verify-only |
| **P6.4:** capital-ordering note missing from design-research | **REFUTED — already present** | `design-research.md:81-82` carries the presentational-vs-enum note. Marked ALREADY-DONE |
| **P6.2:** entity-matrix `unlisted: true` vs CLAUDE.md citation | **VERIFIED**, ref fixed | `entity-matrix.mdx:5` `unlisted: true`; citation is `CLAUDE.md:106` (plan said `:96`) |
| Misc | fixed | knip exists (`package.json:210`) so P0A.3's knip acceptance is real; **no `check:skills` script exists** (P1 verification hedge removed); open-decision hook is `useEthUsdPrice` (not `useEthUsdConversion`) |

## Corrections to audit.md (recorded here; audit.md body kept as the historical record)

- "Verified this session" table: em-dash count **163 → 156** (55/46/55).
- F6.4 refuted — the design-research note exists (`:81-82`).
- F6.3 was already resolved by `8aa68f49` before/while the audit ran.
- F4.2's Garden-skeleton example and F4.5's back-discard premise don't hold in code.
- F3.1's Assessment/SignalPool/Vault file refs are wrong (only ActionDetail confirmed).
- Phase 2's "in-flight collision" commits have all landed; the standing risk is *concurrent sessions*, not those commits.

## What changed in this plan and why

1. **P0C.0 added** — live `size="xl"` bug (D1); fix-session chip spawned so it doesn't wait for this plan.
2. **P0C.1 rewritten** — adopt + enforce the shipped 3-tier/flow-class/variant taxonomy instead of inventing a five-tier one deleted the same day.
3. **P0C.2 expanded to the grep-derived census (21+ sites) and split into two passes** — baseline now (Wave A), re-verify after P0A/P0C.4. Decided with Afo.
4. **P0A re-anchored and gated** — corrected size mapping, ~3,900-line count, root-barrel prune, LeftSheetContext ordering; starts only on a quiet tree (a regression-fix session is live on admin surfaces).
5. **P0B re-scoped to the delta** after `588e613b`; **P0B.6 (stretch machine checks) restored** from the audit so the cut is conscious.
6. **P1.4 re-scoped to in-place restructure** (live-routine constraint); **P1.2 consumer list expanded** (ops files); **P1.5 re-anchored**; **P1.7 added** (`.claude/rules` drift audit — never covered by the skills audit).
7. **P2 gate reworded** (commits landed → re-baseline + concurrency); path/name fixes (`components/Form/`, `useEthUsdPrice`, toast policy note).
8. **P3.1 made grep-driven; P3.5 added** (admin-wide loading/error/empty sweep — a gap against ask #1 a static audit can't close).
9. **P4.2/P4.5 corrected** to what the code actually shows.
10. **P5.1 rewritten** around the corrected inventory (~50 public-facing keys, not ~5–8).
11. **P6.1/P6.3/P6.4 marked ALREADY-DONE or re-scoped** with evidence.
12. **Cross-cutting rules added:** re-baseline at wave start; runtime-proof rule (no "flow works" claim without authenticated-Brave evidence).

---

## Decisions locked with Afo
- **Scope:** full detail across all six phases.
- **Admin sheets:** **finish the dialog migration** (Phase 0A; investigation showed it's dead-indirection removal, not a UX rewrite).
- **Em-dashes (re-locked 2026-07-01 on corrected data):** review **all ~50 public-facing keys** (`public.*` + user-visible `app.*`); convert where the sentence reads better; admin/status strings untouched. (The original "~5–8" came from an undercount.)
- **Sequence:** foundation-first, with the runtime dialog census promoted to Wave A (2026-07-01).
- **Dialog census:** two passes — baseline now, re-verify after P0A/P0C.4.
- **posthog-questions:** restructure in place; never split while the live routine reads it from origin/main.
- **Already-done tasks:** rows kept with **ALREADY-DONE** markers + evidence (traceability over leanness).

## How to read this
- Task IDs: `P<phase>.<n>`. Effort: **S** = hours · **M** = 1–2 days · **L** = multi-day.
- Each task: **change** · **files** · **acceptance**. "Reuses" / "Depends on" call out ordering.
- `critical` marks paths under the repo's criticality matrix (wallet/cookie-jar/contracts) — needs `web3`/`mutation-reliability` review depth, no log-only error handling.
- **`RUNTIME-QA`** marks tasks whose acceptance can only be proven live: `bun run dev` + authenticated Brave QA profile (admin `:3002`, client `:3001`). Code reading alone cannot close them.
- **ALREADY-DONE** marks tasks completed by parallel work before execution started; evidence in the row. Re-verify, don't re-do.

## Global critical path (execution waves)
```
Wave A (start now, read-only or no-collision):
    P0C.0 (xl-size hotfix verify/fix — may already be fixed by the regression session)
    P0C.2 pass 1 (runtime dialog census — read-only QA)
    P0C.3 (re-reproduce Create Assessment; fix only if it still reproduces)
    P0C.1 (document the shipped dialog standard)
    P1   (skills cleanup)
Wave A' (quiet-tree gate):
    P0A  (sheet migration) — GATE: regression-fix session landed AND no concurrent
         session touching packages/admin or shared Canvas (git log + coordination check)
Wave B (after P0A):
    P0B  (contract truth-up delta)
    P0C.4 (reconcile all dialogs to the standard) → P0C.2 pass 2 (re-verify census)
    P3   (admin polish, incl. P3.5 state sweep)
Wave C (re-baseline gate):
    P2   (shared funding primitives) — GATE: re-verify every ref at HEAD; confirm no
         concurrent session on wallet-drawer / Public component paths
Wave D (after P2):  P4 (PWA), P5 (editorial) — both consume P2 primitives
Wave E (last):      P6 (docs)
```
**Global rule:** at each wave start, re-baseline the wave's file:line refs against HEAD and check `git log --since` for overlapping landed work. This plan's refs are 2026-07-01 snapshots of a tree that moves daily under concurrent agents.

---

# PHASE 0A — Finish the admin sheet → AdminDialog migration  `critical-adjacent` · Wave A′ (quiet-tree gate)

**Why:** The design contract says "side sheets are retired" (true in the contract since `588e613b`), but the `LeftSheet`/`RightSheet`/`BottomSheet` renderers + the `CanvasLeftSheet` bridge still exist in shared. Verified: **all 11 sheet-descriptor flows already render as `AdminDialog`** through the bridge (`CanvasLayout.tsx:694-712`) — this is dead-indirection removal, not a behavioral rewrite. Removing it makes the contract true and deletes **≈3,900 lines** (1,375 source + ~2,539 tests/stories).

> **Scope caveat:** the census here covers only the *sheet-descriptor inspector* flows. The Hub full-surface flows (Submit Work, Create Assessment, Create Hypercert) are a separate `ActionFlowShell`-in-`AdminDialog` path — they live in **Phase 0C**, along with the dialog-consistency work.

**Keep (do not touch):** `SheetBody` / `SheetFooter` / `SheetDivider` (standalone files, verified NOT defined inside `CanvasSheetInternals.tsx`; 13 admin importers), `useSheetOrchestrator(+Store)`, `ADMIN_RIGHT_SHEET_REGISTRY`, route-parsing in `sheetRegistry.ts`. Right-sheet Profile/Settings/Notifications already render as `AdminDialog` (`CanvasLayout.tsx:548`) — no change.

**Ordering constraint (corrected):** `LeftSheetContext.tsx` is the *live* config channel (`useLeftSheetConfig` / `useRouteBackedLeftSheetConfig`) that descriptors publish through — it is **not** optional dead code. It can only be deleted after P0A.2 replaces that plumbing.

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P0A.1** (M) | Normalize the 4 view descriptors onto the **shipped 3-tier scale**: drop the `width: "wide"` prop entirely (post-`77170588`, `wide` and default both resolve to `lg` — the distinction no longer exists); emit `AdminDialog` props (incl. `tone`) directly. If the census (P0C.2) shows any inspector flow should be `md`, set it explicitly per the P0C.1 taxonomy. | `views/Garden/components/GardenSheetDescriptor.tsx` (`:87,:92`), `views/Hub/components/HubSheetDescriptor.tsx` (`:119,:149,:198`), `views/Actions/ActionsSheetDescriptor.tsx` (`:40,:47,:90`), `views/Community/components/CommunitySheetDescriptor.tsx` (`:26,:34,:42`) | All 11 flows (Add Member, Hypercert, Work Detail, Certification, History, Action Create/Detail/Edit, Vault, Strategies, Signal Pool) open as `AdminDialog` with a **valid** size (`sm/md/lg`) + tone; route-backed deep-links still work. `RUNTIME-QA` |
| **P0A.2** (M) | Collapse the `CanvasLeftSheet` bridge — render `AdminDialog` directly from the (now-normalized) descriptor config in `CanvasLayout`; replace the `LeftSheetProvider` / `useLeftSheetConfigValue` / `useRouteBackedLeftSheetConfig` plumbing (this is what unlocks deleting `LeftSheetContext.tsx` in P0A.3). Confirm at impl whether descriptors keep shape (preferred) or feed a thin `useAdminDialogDescriptor`. | `packages/admin/src/components/Layout/CanvasLayout.tsx` (bridge `:694-712`, provider `:454`, right-sheet bridge `:548`) | No `CanvasLeftSheet`; left-inspector flows render via the same `AdminDialog` path as right-sheet; `bun run --filter @green-goods/admin test` green. |
| **P0A.3** (S) | Delete dead renderers + their tests/stories; prune **both** barrels. | Delete `packages/shared/src/components/Canvas/{LeftSheet,RightSheet,BottomSheet,CanvasSheetInternals}.tsx` + their `*.stories.tsx`/`*.test.tsx`; delete `LeftSheetContext.tsx` (after P0A.2); prune `Canvas/index.ts` (`:1-4,:29-35,:50-53`) **and** `packages/shared/src/index.ts` (`:16,:48-53,:66`) | ≈3,900 lines removed; `bun build` + `knip` (root devDep, `package.json:210`) show no dangling imports/exports; client build unaffected (verified: zero client imports of these components). |
| **P0A.4** (S) | Update tests/stories that referenced sheets. | `__tests__/components/CanvasLayout.test.tsx`, `__tests__/routes/sheet-registry.test.ts`, `__tests__/routing/route-folding.test.ts`, `GardenSheetDescriptor.test.tsx`, `ActionsSheetDescriptor.stories.tsx` | All pass; story coverage gate (`check:stories`) green. |

**Gate before starting:** regression-fix session landed; `git log --since` shows no other session mid-flight on `packages/admin/**` or `packages/shared/src/components/Canvas/**`; working tree quiet on those paths.
**Verification:** Storybook (`:3004`) for each descriptor's dialog at mobile + desktop; authenticated Brave QA on admin (`:3002`) for the route-backed flows (deep-link, close-nav, tone). **Order:** P0A.1 → P0A.2 → P0A.3 → P0A.4.

---

# PHASE 0B — Design-contract truth-up + agentic guards  (Wave B, after P0A)

**Why:** Close the remaining contract/doc gaps so agents inherit reality. Note: the headline rewrite **already happened** — `588e613b` (2026-06-30) landed "Side sheets are retired" (`prompt-contract.md:27`) and dropped sheets from the palette. What remains is the delta below. Token layer healthy (2.4.0 in both skills).

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P0B.1** (S) **largely ALREADY-DONE** (`588e613b`) | Remainder: after P0A deletes the components, do a verify pass over both contracts for any surviving live-sheet reference, and reconcile the scoped notes in `language.md`/`quick-reference.md` ("the client PWA still uses sheets") — verified: client imports **zero** shared Canvas sheet components, so that note refers to the client's own drawer patterns; reword to say exactly that. | `.claude/skills/design/prompt-contract.md`, `client-prompt-contract.md`, `language.md`, `quick-reference.md` | No contract text implies the shared Canvas sheets still exist; the client-drawer note names what it actually means. |
| **P0B.2** (S) | Add `AdminSortSelect` + `AdminViewActions` to the palette; replace the hardcoded "13" with a filesystem-derived count (or drop the number). Verified: palette lists 13 (`prompt-contract.md:123`), filesystem has **15**. | `prompt-contract.md:123`, `design/ARCHITECTURE.md` | Palette lists all 15 real primitives; no stale count. |
| **P0B.3** (S) | Add the Never-Rename guard: `--color-primary` is the canonical **tertiary accent** token. Verified present in `language.md:248` / `quick-reference.md:16` / `DESIGN.md:111`, absent from both contracts. | `prompt-contract.md`, `client-prompt-contract.md` | Caveat present in both contracts. |
| **P0B.4** (M) | Add a **concentricity reference block** (before/after CSS + concrete px) to `language.md` (`:146-154` currently has pitfalls but no CSS example); document the 4-role volume hierarchy as a review-time principle with an explicit "no automated checker yet" note (unless P0B.6 ships). | `.claude/skills/design/language.md`, `quick-reference.md` | Concrete copy-able example; honest enforcement note. |
| **P0B.5** (S) | Add short **Motion Scheme** + **Workspace Tone** (`[data-tone]`→`--tone-*` fallback) subsections to the contract — **reference** the full spec at `language.md:186-197`, don't duplicate it. | `prompt-contract.md` | Both documented with token names + pointer to the canonical spec. |
| **P0B.6** (L) **STRETCH — optional** (restored from audit so the cut is conscious) | Machine design checks: a Storybook/CI lint flagging a child radius token ≥ its parent's, and a color-volume reporter for the 80/8/3/1 hierarchy. Skip without guilt if Wave B runs long. | new script under `scripts/` (needs a durable caller per repo rules — wire into `check:design-*` family) | Lint catches a seeded violation; reporter runs on at least one admin view. |

**Verification:** `bun run check:design-md`, `check:design-generated`, `check:design-tokens`, `lint:vocab` all green.

---

# PHASE 0C — Admin dialog system: standardize + runtime QA / repair  (census + P0C.0/1/3 start NOW; reconcile after P0A)

**Why:** Admin action dialogs are not yet a *system*: `77170588` gave AdminDialog a principled 3-tier scale, but consumers assign sizes ad hoc (and one — the left-sheet bridge — passes an invalid size **today**, see D1), the chrome/CSS isn't verified consistent across all ~21 dialog call sites, and Create Assessment was reported broken. The static audit missed all of this because it never ran the UI. This phase adopts the shipped standard, audits every dialog at runtime, and repairs the broken/inconsistent ones.

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P0C.0** (S) **NEW · Wave A** `debug` | Fix the **live invalid-size bug**: `CanvasLayout.tsx:706` maps `width:"wide"` → `size="xl"`, which no longer exists (`AdminDialog.tsx:25`) — the four "wide" flows render with no width constraint. **First check the concurrent regression session hasn't already fixed it** (`git log -3 -- packages/admin/src/components/Layout/CanvasLayout.tsx`); if not, change to `"lg"`. (A fix-session chip was also spawned 2026-07-01.) | `packages/admin/src/components/Layout/CanvasLayout.tsx:706` | Admin typecheck passes; Add Member / Work Detail / Create Action / Edit Action open width-constrained. `RUNTIME-QA` |
| **P0C.1** (S) **REWRITTEN · Wave A** | Codify the **shipped** standard (do not invent tiers): 3-tier size scale `sm`=confirm/alert · `md`=single-purpose action (one form, one concern) · `lg`=richer single-view content (rationale comments at `AdminDialog.tsx:61-75`); multi-step flows use `ADMIN_FLOW_DIALOG_CLASS` + `variant="flow"` (Submit Work, Create Assessment, Create Hypercert); `variant: standard\|confirm\|palette\|flow`; `tone` required on portaled dialogs (portal escapes `[data-tone]` — `AdminDialog.tsx:34-42`). Document in the contract + add **enforcement**: a grep-or-test guard that no consumer passes an out-of-scale size or ad-hoc `max-w-*` override (except the flow class). Honor `.claude/rules/frontend-design.md` Rule 14 (mobile modal safety). | `components/AdminDialog.tsx` (source of truth, mostly done), `.claude/skills/design/prompt-contract.md`, small guard test/script | One documented standard; every size choice traceable to action type; guard fails on a seeded violation. |
| **P0C.2** (M) **EXPANDED, two-pass** `debug` | **Runtime dialog census** — with `bun run dev` + authenticated Brave on admin (`:3002`), open **every** dialog and record: opens from its real trigger? · size ∈ scale? · tone correct in-portal? · chrome (header/close/footer/padding/scrim)? · Esc + scrim + close behavior? · focus trap sane? · body scroll correct? · 375px mobile OK (Rule 14)? · loading/error/empty states inside the dialog? **Census set = grep-derived, not a hand list:** the 21 `<AdminDialog` sites — the 11 descriptor flows via the two bridges (`CanvasLayout.tsx:548,:699`) + `GardenDomainEditor:107` · `AddMemberModal:110` · `MembersModal:61` · `ManageRolesModal:32` · `CommandPalette:91` · `MintingDialog:31` · `CreateListingDialog:131` · `WithdrawModal:136` · `DepositModal:174` · `GardenWorkspaceContent:109` · `SubmitWork:1069` · `CreateAssessment:205` · `CreateHypercert:51` · `CookieJarDepositModal:111` · `CookieJarManageModal:110` · `CookieJarWithdrawModal:101` · `CampaignCookieJarPanel:1936` · `ManageMembers:23,37` — **plus** all `AdminConfirmDialog` and `DiscardChangesDialog` (`1d6030c4`) call sites (grep at execution). | — (produces `.plans/active/ui-ux-systems-audit/dialog-census.md`) | **Pass 1 (Wave A):** every dialog has a recorded pass/fail row — the step the static audit skipped. **Pass 2 (after P0A + P0C.4):** same checklist re-run, all rows green. `RUNTIME-QA` |
| **P0C.3** (M) **Wave A** `debug` | **Create Assessment "doesn't open."** **Re-reproduce FIRST** — the flow was reworked after the report (`f035855f` full-surface flows, `1d6030c4` discard-confirm, `b028b4da` draft-clear), so the bug may be fixed or morphed. Current state: route `/hub/assess/create` mounts `CreateAssessment` → `<AdminDialog open size="lg" variant="flow" tone="hub">` unconditionally (`CreateAssessment.tsx:205`). If it still reproduces: trace trigger (`cockpit.hub.action`/`fab.create-assessment`) → navigation → mount → render on the live surface; fix the actual cause. If it doesn't: close with runtime evidence. **Either way:** add the missing open/close regression test + story (none exists — verified). | `views/Hub/CreateAssessment.tsx`, Hub trigger (`views/Hub/**`), `useCreateAssessmentController` (shared); new test/story | Create Assessment opens reliably from its real trigger, proven in authenticated Brave; regression guard exists. `RUNTIME-QA` |
| **P0C.4** (M) **Wave B (after P0A)** | Reconcile every census dialog to the P0C.1 standard — including the ~10 the original plan missed (domain editor, roles, members, jars, minting, listing, palette, workspace settings). Remove per-consumer size guesses (ties into P0A.1). | the 4 descriptors + the census call sites above | Every dialog opens at its standard size with consistent chrome, verified in authenticated Brave at mobile + desktop (census pass 2). `RUNTIME-QA` |

**Process fix (so this doesn't recur):** any "dialogs/flows work" claim requires a **runtime open-every-dialog pass**, not code reading. The static-only audit is what let Create Assessment slip — and what let D1 ship for a day.

---

# PHASE 1 — Skills cleanup  (Wave A; no collisions, start now)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P1.1** (S) | Extract the duplicated Linear-routing block to a shared fragment; reference it from the 5 consumers. **Preserve the per-skill deltas** (debug's Customer-Need intake, architecture's label specifics) — extract the invariant core only. | new `.claude/context/linear-routing-rules.md`; edit `audit/SKILL.md:358`, `clean/SKILL.md:456`, `principles/SKILL.md:184`, `architecture/SKILL.md:185`, `debug/SKILL.md:486` | One source of truth for the core; consumers reference it and keep only their deltas inline. |
| **P1.2** (S) | Extract the validation-pipeline command to a shared fragment; reference from **all** consumers — the audit undercounted: also `ops/SKILL.md:46,228`, `ops/git-workflow.md:202`, `ops/ci-cd.md:212,273`. | new `.claude/context/validation-pipeline.md`; edit `ship`, `clean`, `audit-then-ship`, `plan`, `testing`, **`ops` (SKILL + git-workflow + ci-cd)** | `bun format && bun lint && bun run test && bun build` defined once; grep finds no stray inline copies. |
| **P1.3** (S) | Fix the broken i18n reference: `audit/SKILL.md:130` runs `node .claude/scripts/check-i18n-completeness.mjs` — script doesn't exist. Repoint to the real gate: `packages/shared/src/__tests__/i18n/locale-coverage.test.ts` (4 checks; runs under `bun run test`). | `audit/SKILL.md:130` | Referenced check exists and runs. |
| **P1.4** (M) **RE-SCOPED** | **Restructure `posthog-questions/SKILL.md` in place** (683 lines): add a TOC + consistent per-question anatomy + a clearly fenced privacy section. **Do NOT split into separate files** — the live growth-pulse cloud routine reads HogQL blocks *verbatim from this file on origin/main at runtime* (`docs/routines/growth-pulse.md:99,340`; `qa-triage-pulse.md:71` also references it), so moving HogQL out of `SKILL.md` breaks production. | `.claude/skills/posthog-questions/SKILL.md` only | Navigable in-file structure; every HogQL block still in `SKILL.md` byte-identical; `growth-pulse.md`/`qa-triage-pulse.md` references still resolve. |
| **P1.5** (M) **RE-ANCHORED** | Add a skill-selection decision tree to `index.md` (has tables, no tree — verified); clarify `debug` (passive/immediate) vs `audit-then-ship` (explicit/gated) precedence; make the `status` skill's usage modes explicit — note: there is **no existing "mode table"** to rewrite (`status/SKILL.md` has a Time Budget table `:55` + Example Shape `:98`); author the modes section fresh. | `.claude/skills/index.md`, `status/SKILL.md` | A reader picks the right skill without reading implementations. |
| **P1.6** (S) | Document the lens dependencies (`review` folds in architecture/principles/testing/audit — `review/SKILL.md:94-100` + activation matrix `:108-174`). | frontmatter or new `.claude/context/skill-dependencies.md` | Dependencies explicit. |
| **P1.7** (S) **NEW** | Audit `.claude/rules/*.md` (5 files: contracts, frontend-design, indexer, react-patterns, typescript) against current code — the skills audit never covered them. E.g. `frontend-design.md` teaches `PageHeader`/`Card.Header` idioms that may predate the admin M3 redesign; verify each rule's referenced components/paths exist and reflect current practice; fix or fence what drifted. | `.claude/rules/*.md` | Every rule's referenced component/path resolves; drifted rules corrected or explicitly scoped (e.g. "client-only"). |

**Verification:** grep shows no duplicated rule blocks; every referenced script/path resolves. (No `check:skills` script exists — verified; don't cite one.)

---

# PHASE 2 — Shared funding & transaction primitives  `critical` · Wave C · GATED

> ⚠️ **Gate (reworded 2026-07-01):** the previously named in-flight commits (`b28bb303`, `571ac75f`, `8a1c3af5`) **have all landed** — and wallet work continued after them (`216f6d8f` Tokens tab, `e852853f` Balance view, `c9b51259` persistent approval toasts, `ada19893` two-tier toast policy). The live gate is: **(1)** re-verify every file/line ref below against HEAD at wave start; **(2)** confirm no concurrent session is mid-flight on `views/Home/WalletDrawer/**` or `components/Public/**` (git log + coordination).

**Why:** Five flows (endow / donate / claim / PWA cookie-jar withdraw / PWA send) re-implement amount-input, wallet-connect, and tx-feedback. Extract three primitives and adopt them so the cookie jar reads as one concept and the funding flows converge. (Verified: the five flows and their shared hooks all exist; the three primitive names are unclaimed across packages/.)

**Primitive APIs (verified against tree):**
- **`FormattedAmountInput` + `useFormattedAmountInput(value, decimals, maxAmount?)`** → `{ parsedAmount, formatErrorId, exceeds, isEmpty }`. **Lives in `packages/shared/src/components/Form/`** (capital F — the existing dir with 23 components; do not create a lowercase `form/`). Use **semantic tokens** (`border-error-light`, not utility classes) so it compiles under shared's own Tailwind build (shared-scan gotcha).
- **`WalletConnectButton`** (label transitions connect→submitting→primary, consistent loading). **Lives in `packages/client/`** (depends on `useAuth()`); accepts `className` for editorial vs standard styling.
- **`TransactionSuccessAffordance`** (`mode: screen | toast | receipt | none`). **Lives in `packages/shared/src/components/feedback/`** (extends the existing `TxInlineFeedback` pattern there). Display only — each flow keeps its own reset callback. **Toast mode must ride the two-tier `toast.service` policy** (`ada19893`; timers are service-owned — see memory note on the pause latch), never raw library toasts.

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P2.1** (M) | Build `FormattedAmountInput` + `useFormattedAmountInput` (fold in `validateDecimalInput`/`normalizeDecimalInput` from `utils/blockchain/vaults.ts` + `parseUnits`). | new `packages/shared/src/components/Form/FormattedAmountInput.tsx`; export via barrel | Unit tests for parse/validate/max/empty; renders with semantic tokens. |
| **P2.2** (M) `critical` | Adopt in **Send** first (validation already structured in `Send/validation.ts` → `validateSendAmount`). | `views/Home/WalletDrawer/Send/AmountStep.tsx:104-126`, `Send/validation.ts` | Review-step gating unchanged; send tests pass. `RUNTIME-QA` |
| **P2.3** (M) `critical` | Adopt in **PWA cookie-jar withdraw**, **donate**, **claim**. | `views/Home/WalletDrawer/CookieJarTab.tsx:109-134`; `components/Public/PublicCookieJarCard.tsx` deposit `:665-680` + claim `:613-630` | Max button + inline errors preserved; withdraw/deposit/claim behavior unchanged. `RUNTIME-QA` |
| **P2.4** (M) | Build `TransactionSuccessAffordance`; adopt in **Endow** (replace `SuccessBody`, `PublicFundingCard.tsx:499-552`); **decide donate/claim success** (toast vs panel — Open Decisions #1). | new shared component; `components/Public/PublicFundingCard.tsx` | Endow success unchanged visually; donate/claim get the chosen affordance. |
| **P2.5** (M) | Build `WalletConnectButton` (client); adopt in Endow/Donate/Claim for consistent connect-loading. | new `packages/client/src/components/WalletConnectButton.tsx`; the 3 editorial flows | Endow's "Preparing wallet…" inconsistency resolved; one connect UX. `RUNTIME-QA` |

**Verification:** `bun run test` (shared + client); authenticated Brave QA on PWA (`:3001` `?presentation=pwa`) for send + cookie-jar; editorial (`:3001` browser) for endow/donate/claim; confirm `critical` hooks' error paths still surface (not log-only).

---

# PHASE 3 — Admin polish (non-sheet)  (Wave B; parallel-safe with P0B)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P3.1** (S) **grep-driven** | Replace shared `<Surface>` / ad-hoc `<div className="p-4">` in admin views with `AdminCard`. Confirmed site: `views/Actions/ActionDetail.tsx:93,133`. The audit's other anchors were wrong (`Garden/Assessment.tsx:154` is a raw span; SignalPool/Vault don't import Surface) — run `rg -n "from.*Surface|<Surface" packages/admin/src/views/` at execution and convert every hit. | `ActionDetail.tsx` + grep results | Zero shared-`Surface` imports in admin views; spacing matches M3. |
| **P3.2** (M) | Add `AdminCard variant="compact"` (p-3); remove per-view `className="p-3"` overrides. (Verified: `AdminCard.tsx` default `p-4`, variants `filled/elevated/outlined`, no density option.) | `components/AdminCard.tsx`; consumers in `views/Garden/components/OverviewTab.tsx`, Hub modals | No padding overrides; one density ladder. |
| **P3.3** (S) | Normalize `.canvas-route-card` padding to symmetric (currently `0.875rem 1rem 1.25rem`, `index.css:1231`); reduce mobile gutters (`CanvasLayout.tsx:488` `px-5` → responsive). | `packages/admin/src/index.css:1231`, `CanvasLayout.tsx:488` | 375px viewport gutters reduced; symmetric card padding. `RUNTIME-QA` |
| **P3.4** (S) | Sweep raw type utilities → M3 (`text-title-*`/`label-*`); unify icon sizes; add missing `sm:` breakpoints; `aria-current` on nav; empty-state type. | `views/Garden/Assessment.tsx:148` (raw `text-xs` cluster), `CanvasWorkspaceSelectionState.tsx:35` (`text-lg font-semibold`), et al. | Consistent type/icon/breakpoints; nav announces active. |
| **P3.5** (M) **NEW** `RUNTIME-QA` | **Admin-wide loading/error/empty-state sweep.** `a8791b7d` standardized pending-button spinners; views and dialogs remain unaudited. For every admin view + dialog (reuse the P0C.2 census set for dialogs): does it render an intentional loading state, a human error state, and a designed empty state? Record gaps, fix them with the canonical primitives (`AdminLinearProgress`, `Alert`/status patterns, empty-state type from P3.4). | admin views + census dialogs; table appended to `dialog-census.md` | Every admin view/dialog shows intentional loading, error, and empty states, verified live at `:3002`. |

**Verification:** Storybook geometry guard; authenticated Brave QA on admin at mobile + desktop. **Gotcha:** author any new utilities in admin JSX/CSS, not shared (Tailwind v4 shared-scan).

---

# PHASE 4 — PWA flows, onboarding & wallet  (Wave D, after P2; reuses its primitives)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P4.1** (M) | Add a first-run / join-a-garden path from the empty garden list (gated on the onboarding product decision — Open Decisions #2). Verified: `GardenList.tsx:106-114` renders the empty message with no CTA. | `views/Home/GardenList.tsx:106`, `views/Home/index.tsx`, `views/Login/index.tsx` | New user has a clear CTA, not a dead end. `RUNTIME-QA` |
| **P4.2** (S) **corrected** | Add explanatory copy to the skeletons that lack it. ~~`views/Garden/index.tsx:53-96`~~ **dropped — refuted:** IntroSkeleton already has copy (`:54-96`). Remaining targets (re-verify at impl): `Send/AmountStep.tsx:40-45`, `CookieJarTab.tsx:233-243`. | `Send/AmountStep.tsx`, `CookieJarTab.tsx` | Every remaining skeleton states what's loading. |
| **P4.3** (M) `critical` | Surface offline state inline + early (not just review step); explain disabled withdraw + pull-to-refresh. Verified refs: offline warning only at `Send/ReviewStep.tsx:125-127`; disabled withdraw `CookieJarTab.tsx:150-169`; silent pull-to-refresh disable `Home/index.tsx:213-216`. | `Send/ReviewStep.tsx` (move earlier in the flow), `CookieJarTab.tsx:150`, `Home/index.tsx:213` | Offline reason shown before action attempt. `RUNTIME-QA` |
| **P4.4** (M) | a11y sweep: `aria-current="page"` on AppBar tabs (`:89-98` has `aria-selected` only); `role="group"` on token list (`AmountStep.tsx:34`); `aria-label` on QR `<video>` (`QRScanner.tsx:128-133`, biome-ignore currently acknowledges the gap); mark + explain the cookie-jar "purpose" field (`CookieJarTab.tsx:141-148`). | `components/Layout/AppBar.tsx:89`, `Send/AmountStep.tsx:34`, `Send/QRScanner.tsx:128`, `CookieJarTab.tsx:141` | axe clean on these; required field marked. |
| **P4.5** (S) **reframed** | Success/back ergonomics, verified live first: code shows Back **preserves** the amount (`SendTab.tsx:126-129`) and reset fires only on success (`:101`) — the audit's "back silently discards" premise doesn't hold in code. Verify the actual lived flow in Brave; add a brief success confirmation before auto-reset; fix any *real* data-loss path found. | `Send/SendTab.tsx:43-129` | Success acknowledged before reset; no silent data loss (proven live, not assumed). `RUNTIME-QA` |

**Verification:** authenticated Brave QA on PWA; axe/keyboard pass; offline simulation.

---

# PHASE 5 — Editorial copy & flows  (Wave D, after P2)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P5.1** (M) **REWRITTEN — corrected inventory** | Em-dash pass over **all public-facing strings**. Verified inventory (2026-07-01): **156** em-dashes total (en 55 / es 46 / pt 55 — not 163); the public-facing set is **~50 keys** (33 `public.*` + 17 user-visible `app.*`), not "~5–8"; and 6 of the 7 keys previously named here contain **no** em-dash (only `app.home.work.offlineInfo` does). At execution: enumerate with `grep -n '—' packages/shared/src/i18n/en.json` filtered to `public.*`/`app.*`; review each; convert to period/colon **where the sentence reads better** (the dash stays where it's doing real work); mirror en+es+pt. Admin/status strings untouched. | `packages/shared/src/i18n/{en,es,pt}.json` | Every public-facing em-dash reviewed with keep/convert recorded; **locale-coverage test passes**; `lint:vocab` clean. |
| **P5.2** (S) | Human-grounding rewrites of cold strings (keys verified to exist): `public.fund.card.conversionUnavailable` ("ETH price unavailable"), `public.fund.card.wethUnavailable`, `public.fund.endowments.connect.lede`. | `en/es/pt.json` | Warmer copy; passes `lint:vocab`; mirrored in 3 locales. |
| **P5.3** (M) | Funding-surface state fixes: donate "you've contributed X" echo; stale-price severity (>2 min); real-time (onBlur) validation; explicit endowment-panel close while wallet modal opens; endowment-data error state. **Sequencing:** these edit the same files P2.3/P2.4 adopt primitives in — land after P2's adoption, not alongside. | `components/Public/{PublicCookieJarCard,PublicFundingCard,PublicEndowmentPanel}.tsx` | Each state present and verified. `RUNTIME-QA` |
| **P5.4** | Flow unification — **inherited from P2** (donate/claim success affordance, unified connect). | — | Covered by P2. |

**Verification:** `bun run test` (locale-coverage + components); `bun run lint:vocab`; authenticated Brave QA on editorial. **Hard constraint:** every `en.json` edit needs es+pt mirrors and must pass the 4-part locale gate.

---

# PHASE 6 — Documentation  (Wave E, last; reflects the now-coherent system)

| Task | Change | Files | Acceptance |
|---|---|---|---|
| **P6.1** (S) **re-scoped** | The reconciliation note **already exists** at `v1-0.mdx:183-185` (`8aa68f49`, 2026-06-27: four implemented, five specified, domain 5 deferred). Remaining scope: fence the present-tense 5-domain narrative at `:189-332` so sections read as historical spec, not current behavior. | `docs/docs/builders/specs/v1-0.mdx:189-332` | No unfenced present-tense claim of 5 live domains; count matches `packages/shared/src/types/domain.ts` (SOLAR/AGRO/EDU/WASTE). |
| **P6.2** (S) | Resolve entity-matrix status: either `list: true` or remove/caveat the CLAUDE.md citation. Verified: `entity-matrix.mdx:5` `unlisted: true`; citation at `CLAUDE.md:106` (not `:96`). | `docs/docs/builders/integrations/entity-matrix.mdx:5`, `CLAUDE.md:106` | No "canonical reference" pointing at an unlisted draft. |
| **P6.3** (—) **ALREADY-DONE** (`8aa68f49`) | Glossary Assessment definition is already baseline-first and explicitly disambiguated from Work Approval (`glossary-community.md:51,182`: "…it is **not** a review of submitted Work (that is Work Approval)"). Verify-only at execution; optional micro-polish if a sentence still reads dense. | — | Confirmed correct; no reversed-order reading possible. |
| **P6.4** (—) **ALREADY-DONE** | Capital-ordering note (presentational vs enum) already present at `design-research.md:81-82`. No work. | — | Confirmed present. |
| **P6.5** (M) **re-scoped** | Add a 3-sentence intro above the architecture diagram (verified absent before `:47`; the mermaid itself has color-coded subgraphs + styles `:105-108` — assess at impl whether a textual legend still adds value) + a reader-routing map (by persona) to the docs home. | `docs/docs/builders/architecture.mdx:47`, docs home | Diagram introduced; readers routed by persona. |

**Verification:** Docusaurus build (`:3003`); link check; re-grep domain/capital claims against `domain.ts`.

---

## Cross-cutting constraints (every phase)
- **Re-baseline rule:** at each wave start, re-verify the wave's file:line refs against HEAD and `git log --since` for overlapping landed work — this plan's refs are 2026-07-01 snapshots of a multi-agent tree.
- **Runtime-proof rule:** any "flow works / dialog opens / state renders" acceptance requires authenticated-Brave evidence (`RUNTIME-QA` tags); static reads alone cannot close those tasks. This generalizes the P0C process fix — a static-only pass is how Create Assessment and D1 slipped.
- **i18n:** `en.json` edits require es+pt mirrors and must pass `packages/shared/src/__tests__/i18n/locale-coverage.test.ts`; copy must clear `lint:vocab`.
- **Tailwind v4 shared-scan:** utilities authored in `packages/shared/src/` don't compile into admin/client — use semantic tokens in shared components, or author utilities in the consumer.
- **Design-token gate:** never put `#<number>` PR refs in source comments; run `check:design-tokens` before pushing token/CSS work.
- **Multi-agent repo:** stay on the current branch; stash unknown diffs (don't revert); P0A and P2 must not start on a moving tree (see their gates).
- **Global gate per PR:** `bun format && bun lint && bun run test && bun build` + the `/ship` gate.
- **Census artifact:** dialog census lives at `.plans/active/ui-ux-systems-audit/dialog-census.md` (pass 1 + pass 2 + P3.5 state table).

## Remaining open product decisions (don't block planning; resolve before the relevant phase)
1. **Donate/claim success affordance (P2.4):** transient toast (matches current) vs a small success panel/receipt like endow? Affects P2.4 + P5.4 scope.
2. **Onboarding join path (P4.1):** is there a defined "request/join a garden" flow to wire to, or is that undecided product scope? P4.1 can't fully land without this.
3. **Endow denomination reuse:** keep USD↔WETH toggle endow-only, or generalize `useEthUsdPrice` for future multi-asset donate? (Deferred; not required this pass.)

## Suggested first move
Start **Wave A** now: **P0C.0** (verify/fix the live xl-size bug — or confirm the regression session got it), **P0C.2 pass 1** (runtime dialog census — read-only, immediately surfaces any other live breakage), **P0C.3** (re-reproduce Create Assessment), and **P1** (skills). **P0A** follows as soon as the quiet-tree gate clears — it's still the highest-value single change (≈3,900 dead lines out, contract made true), it just must not land on top of the regression-fix session.
