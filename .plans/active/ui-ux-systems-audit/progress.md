# UI/UX & Systems Improvement — Execution Progress

> Running log per task: status + evidence. Companion to [plan.md](./plan.md).
> Branch cadence: one branch/PR per wave, targeting develop.

## Session log

- **2026-07-01** — Wave A started on `feature/uiux-wave-a-dialog-census-skills`. Plan docs committed to develop as `4de4ac19` and pushed.

## Wave A

| Task | Status | Evidence |
|---|---|---|
| Plan docs commit | ✅ done | `4de4ac19` pushed to develop (fast-forward from `fe312326` — no concurrent work had landed) |
| P0C.0 xl-size fix | ✅ code landed; runtime proof pending census | Bug confirmed live at HEAD (no fix-chip landed; `git log` on CanvasLayout showed last touch `5a9ce4d0`, pre-baseline). Fixed in `f18df850`; CanvasLayout tests 24/24 green. **Finding:** admin `bun build`'s tsc step checks 0 files (solution-style tsconfig + plain `-p`) — that's how `xl` shipped; guard test is the durable check. |
| P0C.1 dialog standard | ✅ done | Contract § "Dialog size & variant standard" added; stale `2xl` fixed in prompt-contract.md, ui/SKILL.md, admin.mdx, packages/admin/AGENTS.md (`3bc1ecb7`, separate from code per AGENTS.md standards-vs-code rule). Guard test `AdminDialogStandard.guard.test.ts` (3/3): anchors scale to sizeClasses, self-checks seeded violations, sweeps consumers. Caught + fixed a real violation: CampaignCookieJarPanel `sm:max-w-3xl` → `size="lg"` (`f18df850`). |
| P0C.2 census pass 1 | ✅ done | `dialog-census.md` pass-1 written. Runtime-interacted 4 highest-risk dialogs on admin :3002 in authenticated Brave (Create Assessment flow, DiscardChangesDialog, CommandPalette, Add Member via bridge) — **screenshot confirms the shared AdminDialog chrome renders correctly** (scrim, centering, header/body/footer, close, garden-green tone). Remaining 17 config-verified (size/variant/tone from source; share the proven shell) + honestly blocked rows: `/actions` (QA wallet lacks protocol-admin), Work/Assessment queues (EAS not indexed → empty on fork). **Methodology caveat recorded:** driven tab is `document.hidden` so CSS animations freeze → `opacity:0` + exit-node-lingers are hidden-tab artifacts (screenshot is ground truth), functional columns unaffected. **Finding → P0C.4:** descriptor-bridge flows all render `lg` (bridge hardcodes it post-fix); Add Member should be `md` per taxonomy. |
| P0C.3 Create Assessment | 🔶 static half done; runtime repro pending | Plan claim "no test/story exists" was stale — `b028b4da` added CreateAssessmentDialog.test.tsx (mount + discard) and Hub.stories.tsx:103 covers the route. **New bug found + fixed**: default form's placeholder SMART-outcome row made `isDirty` always true → every untouched close raised the Discard prompt (clean-close unreachable). Fixed in controller + added clean-close regression test (Escape on pristine → no prompt → `/hub/work`). 3/3 green (`22876c94`). |
| P1.1 Linear-routing fragment | ✅ | `.claude/context/linear-routing-rules.md` created; 5 consumers reference it, deltas preserved (audit's template sections, architecture's label pairings, debug's Customer-Need shape) |
| P1.2 validation-pipeline fragment | ✅ | `.claude/context/validation-pipeline.md`; grep proves exactly 1 full-pipeline definition remains (the fragment); intentional partials kept (clean baseline, ci-cd quick check) |
| P1.3 i18n script ref fix | ✅ | audit/SKILL.md now runs `bun run --filter '@green-goods/shared' test src/__tests__/i18n/locale-coverage.test.ts` — command verified green (12/12) before writing it in |
| P1.4 posthog-questions restructure | ✅ | In-place only: 17-question index table + hard privacy banner. Diff shows 0 SQL lines touched; 17 sql blocks intact; headings unchanged; no version bump (navigation-only change per the file's own versioning policy); last_updated bumped |
| P1.5 skill-selection tree | ✅ | index.md decision tree + debug-vs-audit-then-ship precedence added. Status-skill half closed as ALREADY-DONE: modes are explicit at SKILL.md:37-43 (invocation), :53-61 (time budget), :129-148 (mode notes) — the audit's "ambiguous modes" claim doesn't hold at HEAD |
| P1.6 lens dependencies | ✅ | review/SKILL.md frontmatter `dependencies: ["architecture","principles","testing","audit"]` (matches existing pattern in other skills); frontmatter check green |
| P1.7 .claude/rules audit | ✅ | contracts.md/indexer.md/typescript.md verified live (all scripts+helpers exist). **Drift fixed**: frontend-design Rules 1/2 (no view imports PageHeader — re-anchored to CanvasRouteFrame/CanvasRouteHeader + AdminViewActions), Rule 14 (dialog primitives own mobile safety; ad-hoc max-w now guard-failed), Rules 15/16 (FormField/Alert import from shared, not `@/components/ui`); react-patterns Rule 13 (provider chains rewritten to actual entry files incl. route-level WalletRuntimeProviders) |

### Wave A PR + ship gate

- **PR [#602](https://github.com/greenpill-dev-guild/green-goods/pull/602)** opened, targets develop.
- Ship Gate green on Wave A's own code: `bun format` ✓ · `bun lint` (0 errors) ✓ · `bun run test` (8 pkgs exit 0; admin 468) ✓ · `bun run build` ✓ · `check:design-md` ✓ · `check:design-tokens` ✓ · `check:stories`+`check:story-quality` ✓.
- **Pre-existing develop blocker discovered:** develop's required **CI Gate** (aggregates Design Guardrails + Storybook, `.github/workflows/ci-gate.yml:53`) is **red for every PR** from 4 debts admin-merged past it. I cleared 3 (the admin-dialog Storybook debts, in Wave A's domain — commit `c3c82062`). The 4th remains: **Design Guardrails / `SendTab.tsx:238`** — `bg-primary-base text-static-white` (bright-green + white) is an unapproved contrast-risk; the sanctioned fix is `text-primary-accent-foreground`, which resolves to `--green-950` (dark green), i.e. **a real visual change to a `critical` wallet CTA on another session's landed file → Afo decision, not bundled into Wave A.** Until resolved, #602's CI Gate stays red on this one inherited item (Wave A's own code passes everything).

## Wave A′ (gated) — P0A sheet migration

**Gate: PASSED** (evaluated 2026-07-01). Working tree clean on `packages/admin/**` + `packages/shared/src/components/Canvas/**`; develop static at plan-docs commit; no admin/Canvas commits in the last 73 min except mine; other branches 2-3 days stale; codex worktrees stale on their branches.

**Admin typecheck baseline captured** (advisor's load-bearing prerequisite): `bun build` does NOT typecheck admin (solution-style tsconfig + `-p` → 0 files; that's how `size="xl"` shipped). `tsc -b packages/admin/tsconfig.json` gives a real check but surfaces ~385 pre-existing `.stories.tsx`/lib-target errors. Baseline saved to `admin-tsc-baseline.txt` (509 lines); **exactly 1 pre-existing error in P0A's blast radius** (`CanvasLayout.tsx:199 'sheetLayerRoot' unused` — P0A should remove it). P0A proof = `tsc -b` diff shows **zero new errors** over baseline. Wiring a permanent admin-typecheck gate = scope expansion → flag to Afo.

Dispatched a focused subagent (id `aaad82a6ef4f083f5`) for the refactor; verifying its output myself + owning runtime QA.

| Task | Status | Evidence |
|---|---|---|
| P0A.1 normalize descriptors | ✅ (verified) | 4 descriptors drop `width`, emit `size`+`tone` into the admin-local channel. |
| P0A.2 collapse CanvasLeftSheet bridge | ✅ (verified) | Subagent moved the `LeftSheetContext` plumbing admin-local to `components/Layout/leftSheetChannel.tsx` (carries size+tone as AdminDialog props, keeps hook names). `CanvasLayout` renders `LeftInspectorDialog` → `<AdminDialog size={config?.size ?? "lg"} tone={config?.tone ?? fallbackTone}>`. Read every line; clean. |
| P0A.3 delete renderers + prune barrels | ✅ (verified) | Deleted LeftSheet/RightSheet/BottomSheet/CanvasSheetInternals/LeftSheetContext + 4 stories + 6 tests; pruned all 3 barrels. Net −3,243 lines. KEEP list intact (SheetBody/Footer/Divider, right-sheet descriptor/orchestrator system, which have zero imports of the deleted renderers — verified). |
| P0A.4 update tests/stories | 🔄 subagent finishing (round 2) | **Its first pass was INCOMPLETE — I caught 9 downstream files still referencing deleted symbols** via the typecheck-signature diff (3 stories import deleted `RightSheet` → TS2305; 3 stories assert `data-component="LeftSheet"/"BottomSheet"` now rendering as AdminDialog; 2 moved-symbol imports; 6 dead CSS rules). Resumed the subagent with the precise list + production AdminDialog patterns + "rewire, don't gut assertions." **Then: my final verification (typecheck-diff zero-new, admin+shared tests, build, story CI) + RUNTIME QA of the 11 inspector flows in Brave.** |

**Verification method that caught the gap:** `tsc -b` signature-diff (`file(line,col):TScode`, message stripped to kill TS union-order noise) vs `admin-tsc-baseline.txt`. Real new errors = 3× TS2305 `RightSheet` + 4× benign `DiscardChangesDialog.stories` story-noise.

### Afo decisions — ANSWERED (2026-07-01)
1. **SendTab CI:** "do the best option that keeps our UI consistent" → I'll evaluate live in Brave: the sanctioned `text-primary-accent-foreground` is dark-green (low contrast on green), so "keep UI consistent" likely means restyling the CTA to an approved darker-green surface that keeps legible white text (matching other primary CTAs), QA'd live — decide at Wave C/D when I'm in the client surface. Handle as a small separate `fix(client)` to unblock develop's CI Gate.
2. **P2.4 donate/claim success:** **transient toast** (via two-tier toast.service). Simplifies P2.4 + P5.4 — no receipt to build.
3. **P4.1 onboarding:** **no product-defined flow yet** → add a first-run CTA routing to the best existing surface (browse public gardens / login-to-join), flag where a real join flow is still needed. Don't invent a join mechanism.

## Pending Afo decisions (batched for when Afo returns)

1. **SendTab CI unblock (Design Guardrails):** approve the `text-static-white`→`text-primary-accent-foreground` (dark-green) swap on the Send CTA, keep white via an audited exception, or a different treatment? Blocks develop's CI Gate for all PRs.
2. **P2.4 donate/claim success affordance:** transient toast (current) vs a success panel/receipt like endow?
3. **P4.1 onboarding join path:** is there a product-defined "request/join a garden" flow to wire to?

## Wave B / C / D / E

Not started. See plan.md for task tables.

## Notable systemic findings (for Afo)

1. **Admin package has no working whole-package typecheck.** `packages/admin/package.json` build runs `tsc --noEmit -p packages/admin/tsconfig.json`, but that file is solution-style (`files: []` + references) and plain `-p` checks nothing (verified: `--listFiles` → 0). Running the app config directly trips over `ox` package .ts sources (bundler-resolution setting). This is how the invalid `size="xl"` shipped through a green Ship Gate. Not fixed in Wave A (untangling tsc resolution is its own task); the guard test covers the dialog scale specifically.

---

## Final session consolidation (2026-07-01, end of execution session)

### PR map (merge in this order)

1. **[#606](https://github.com/greenpill-dev-guild/green-goods/pull/606)** `fix/develop-ci-gate-debts` → develop — **merge FIRST.** Clears the two pre-existing debts (Send CTA contrast + stale GardenVaultView test) that make develop's required CI Gate red for every PR.
2. **[#602](https://github.com/greenpill-dev-guild/green-goods/pull/602)** Wave A → develop (also carries a cherry-pick of the #606 fixes so its own CI runs green pre-merge; squash dedupes).
3. **[#603](https://github.com/greenpill-dev-guild/green-goods/pull/603)** Wave A′ (P0A, −3,405 LOC) — stacked on #602; retarget to develop after #602 merges.
4. **[#604](https://github.com/greenpill-dev-guild/green-goods/pull/604)** Wave B (P0B/P0C.4/P3) — stacked on #603; retarget after #603.
5. **[#605](https://github.com/greenpill-dev-guild/green-goods/pull/605)** Wave E (P6 docs) → develop — independent; goes green once #602 (story-coverage fixes) + #606 (debts) are in develop.

### Wave C / D — explicitly NOT executed this session

- **P2 (Wave C)**: the implementation subagent was **stopped by Afo** mid-build; its work is cancelled and nothing landed. The branch `feature/uiux-wave-c-funding-primitives` holds only a census-docs commit (superseded by this branch). All P2 prep is banked for the next session: anchors re-verified at HEAD, primitive APIs locked in plan.md, **decisions resolved** (donate/claim success = transient toast via toastService; SendTab contrast fix landed separately in #606 — remove it from P2's scope).
- **P4 + P5 (Wave D)**: not started (sequenced after P2). Prepared inputs live in `session-state.md`: P4 anchors re-verified (GardenList "mine" empty state has no CTA; client AppBar tabs lack `aria-current`; QR `<video>` unlabeled), P5.1 em-dash review complete (53 keys inventoried; convert set ≈8 keys with es+pt mirrors; keep set recorded), P4.1 decision resolved (no product join-flow — CTA to an existing surface + flag the gap).
- **P3.5** (admin state sweep) + census pass-2 leftovers: RUNTIME-QA, carried as pending-stable-browser (the browser-control safety classifier flapped repeatedly; hidden-window animation caveat documented in dialog-census.md).
- **P0B.6** (stretch machine checks): consciously skipped per the plan's skip-without-guilt clause.

### Standing follow-ups (not plan tasks, discovered this session)

1. **Admin has no working whole-package typecheck** — `bun build`'s tsc step checks 0 files (solution-style tsconfig + plain `-p`). Baseline + signature-diff pattern established (`admin-tsc-baseline.txt`); wiring a real gate (fix `ox` resolution, exclude stories or add storybook types) is its own task.
2. **Storybook `test:stories:ci` play-function timeouts** on #602's first run (~15 admin canvas stories, all ~5s = timeout signature, on stories the branch didn't touch). Fresh CI run triggered by the cherry-pick push will give a second data point; if it repeats, suspect CI-runner resource contention, not the stories.
3. Vault Deposit dialog rides the neutral `home` tone (not `community`) — a deliberate default, logged as a consistency nit.
4. GardenVaultView legacy test was fixed in #606; the P0A subagent also flagged it as a task chip earlier — chip can be dismissed once #606 merges.

## P5.1 em-dash review log (2026-07-01, Wave D)

53 en keys carried em-dashes (33 `public.*` / 17 `app.*` / 3 other). Decision per class:

**Converted (8 keys, en+es+pt mirrored):** `public.gardenDialog.notes.empty` + `.helper` (period/comma read better), `app.error.boundary.action.copyManual` (period), `app.garden.settings.bannerDraft` (dash → `·` middot: compact status caption), `app.garden.settings.saveFailedMessage` (period), `app.home.work.offlineInfo` + `.pendingUpload` (period — the plan's named candidate), `app.login.toast.fallbackAccountDescription` (appositive comma).

**Kept (dash is doing real work):** all 9 editorial `§ NN — title` kickers (typographic register of the public site), persona role/body lines (`public.home.personas.*` — intentional editorial voice), glossary term bodies (`public.glossary.term.*`), fund/actions ledes, `app.admin.*` strings (admin untouched per plan scope), `app.admin.work.submit.review.empty` (a literal `—` empty-value placeholder, presentational), and `app.admin.assessment.*` placeholders (admin + example-text register).

**P5.2 warm rewrites (en+es+pt):** `public.fund.card.conversionUnavailable` ("ETH price unavailable" → "Waiting on the ETH price…" — it's a submit-label, must stay short), `public.fund.card.wethUnavailable` (human phrasing + a next step), `public.fund.endowments.connect.lede` (functional → warm, names what the reader gets).
