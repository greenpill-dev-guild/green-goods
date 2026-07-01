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

## Wave A′ (gated)

| Task | Status | Evidence |
|---|---|---|
| P0A.1–P0A.4 sheet migration | ⬜ gate not yet evaluated | — |

## Wave B / C / D / E

Not started. See plan.md for task tables.

## Notable systemic findings (for Afo)

1. **Admin package has no working whole-package typecheck.** `packages/admin/package.json` build runs `tsc --noEmit -p packages/admin/tsconfig.json`, but that file is solution-style (`files: []` + references) and plain `-p` checks nothing (verified: `--listFiles` → 0). Running the app config directly trips over `ox` package .ts sources (bundler-resolution setting). This is how the invalid `size="xl"` shipped through a green Ship Gate. Not fixed in Wave A (untangling tsc resolution is its own task); the guard test covers the dialog scale specifically.
