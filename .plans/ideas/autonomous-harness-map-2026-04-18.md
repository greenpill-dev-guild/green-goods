# Autonomous Harness Map

**Date**: 2026-04-18
**Status**: promoted to active hub `autonomy-harness-rollout`
**Active Hub**: `.plans/active/autonomy-harness-rollout/`
**Origin**: Afo's deep-dive request after reviewing four Nate B. Jones transcripts. Two independent research passes — Claude (Opus 4.7, 1M context) and Codex — run against the Green Goods repo. This file synthesizes both, incorporates Afo's specialized-design-agent insight, and proposes the concrete next steps.

> Promotion note: this file remains the research map. Live lane state and execution status now live in
> `.plans/active/autonomy-harness-rollout/`.

---

## 1. Operating principles (Nate's framing, used as lens)

1. **Karpathy loop** — minimalism is the magic: one editable surface + one scorable metric + one time budget + keep/revert.
2. **Agent-native infrastructure** — tool overhead dominates wall-clock. Humans as handoff are the bottleneck.
3. **Skills as substrate** — agents call them, not humans. Descriptions are routing signals; skills must be testable like APIs.
4. **Bigger models force simplification** — scaffolding compensates for yesterday's limits. Delete, don't wrap.

---

## 2. Cross-analysis: Claude ∩ Codex

### 2.1 Strong convergence (both found independently)

- Green Goods is **ahead on substrate, behind on loop closure**.
- `.plans/clean/` has done the analysis (17 dead files, 45 unused exports, 75 unused types); execution gate never closed.
- Shared bloat is real: **151,973 LOC**, 1,024-line barrel export, 44% of monorepo TS.
- Design is the biggest hurdle — not because the system is weak, but because **3 of 4 review lenses** are human-eye-only (Spatial, Ecosystem **Proposed**; Compliance **Partial**; only Regenerative + cross-cutting token lint are **Wired**).
- Three natural Karpathy loops: **Cleanup, UI/Design, Bug triage**.
- Meta-agent traces (`.plans/`, ADRs, git) are strong; task-agent **model traces** (prompt / response / reasoning) are absent. `packages/agent` DOES have operational + audit logging via [`logger.ts`](../../packages/agent/src/services/logger.ts) and [`ai.ts`](../../packages/agent/src/services/ai.ts) — what it lacks is captured LLM interaction turns, which is what a meta-agent would need to optimize it.

### 2.2 Complementary findings

**Codex caught that Claude missed:**
- ⚠️ `plan-hub.mjs validate` **crashes**. **VERIFIED**: `scripts/plan-hub.mjs:435` throws `TypeError: Cannot read properties of undefined (reading 'startsWith')` because `.plans/active/client-z-index-sweep/status.json` has no `handoff` field on any lane. This blocks the machine-readable workflow layer any routine would depend on.
- Stale docs: `docs/docs/builders/agentic/spec-engineering.mdx` still references 6 agent specs; `.claude/evals/README.md` says `triage` and `code-reviewer` were retired 2026-04-17.
- ⚠️ Internally inconsistent agent-eval story: docs + eval README say `triage` / `code-reviewer` retired, but `.github/workflows/claude-agent-evals.yml` **still exists** — meta-traces are stale, routines would optimize against ghosts.
- Stale Claude audit findings (corrected against current repo):
  - `useTxErrorMessages` **IS** exported — verified at `packages/shared/src/index.ts:485`.
  - `Hub/index.tsx` already imports `useMediaQuery` from shared; remaining local duplicate is in [`packages/admin/src/components/Layout/CanvasLayout.tsx:44`](../../packages/admin/src/components/Layout/CanvasLayout.tsx).
- `.plans/superpowers/specs/2026-04-15-design-system-creative-briefs-design.md` — Codex referenced this but glob finds nothing at that path; may have moved or been archived.
- **Skill count correction**: Claude said "69 skills"; the correct count is **19 top-level skills** in `.claude/skills/*/` (architecture, audit, clean, contracts, data-layer, debug, design, indexer, ops, plan, principles, react, review, ship, status, stitch, testing, ui, web3). The 69 figure was total markdown files across all skill dirs including supporting docs.

**Claude caught that Codex missed:**
- 3 critical silent-failure mutation bugs in live code: `Work.tsx:280-289`, `CreateListingDialog.tsx:93-98`, `JobQueue.tsx:265-267`.
- Quantitative metrics ARE in place (Lighthouse thresholds, contracts gas profiling per-function, realism-audit phased enforcement 70→90%). Karpathy-grade scorable metrics.
- 6 GB of worktree `node_modules` bloat in `.claude/worktrees/`.
- **326** defensive early-exit guards, **802** optional-chains on trusted data, **292** try/catch blocks, **7** custom Error classes — video-4 "delete the scaffolding" targets.
- `packages/agent` Telegram bot has zero **model trace** capture (operational + audit logs exist; prompt/response/reasoning-trace surface does not).
- Only 2 agents in `.claude/agents/` (`cracked-coder`, `oracle`) — no meta-agent/task-agent split.

### 2.3 Mild divergence

- Codex framed bloat as **boundary bloat** (module/barrel surfaces). Claude framed it as **defensive scaffolding** (guards, error wrappers). Both real, orthogonal.
- Codex prioritized **stale docs** as primary hygiene issue. Claude prioritized **unapplied `.plans/clean/` findings**. Both gate autonomy.

---

## 3. Afo's key new insight: specialized lanes per design facet

> "One agent only does animation. One agent only does layout. One agent only does coloring and styling."

UI drifts because a single design agent holds too many facets in context at once: layout, interaction, materials, motion, typography, accessibility, implementation fidelity. Each is subjectively different, has its own metric, and depends on a different eval. This maps onto Nate's **meta-agent / task-agent split** — separation lets each specialize.

**Codex's sharpening** (accepted): design work is a **staged composition** of semi-independent systems, and the ordering matters. Interaction decisions come before styling; motion is verified only after layout and state are stable. A single "make this UI good" prompt collapses all of this into one fuzzy objective, which is why it drifts.

### 3.1 The six design lanes (Codex's decomposition)

`.claude/skills/design/` and `.claude/skills/ui/` already contain the knowledge substrate for every lane. The bones are in place — the gap is execution wiring, not theory.

| # | Lane | Output | Knowledge source | Metric signal |
|---|---|---|---|---|
| 1 | **intent / paradigm** | surface brief (paradigm + shell + palette) | [`design/SKILL.md`](../../.claude/skills/design/SKILL.md), [`ARCHITECTURE.md`](../../.claude/skills/design/ARCHITECTURE.md) | correct paradigm declared; component palette from Canonical list |
| 2 | **layout / structure** | wireframe / DOM skeleton | [`spatial.md`](../../.claude/skills/design/spatial.md), review-checklist Lens 2 | no overflow at 320/768/1280; correct depth hierarchy; one dominant workspace |
| 3 | **interaction / state** | state map + play functions | [`interaction.md`](../../.claude/skills/design/interaction.md) | Storybook play functions / Playwright flows pass; focus + keyboard paths work |
| 4 | **visual system** | color / material / radius / tokenized styling | [`materials.md`](../../.claude/skills/design/materials.md), [`language.md`](../../.claude/skills/design/language.md) | token-only usage; 4-role volume ratios; contrast; `lint:vocab` clean; `check:design-tokens` clean |
| 5 | **motion** | transitions + feedback timing | [`interaction.md`](../../.claude/skills/design/interaction.md), [`ui/view-transitions.md`](../../.claude/skills/ui/view-transitions.md) | `--spring-*` only; reduced-motion honored; no layout-shift jank |
| 6 | **verification** | screenshots + diff review + a11y gate | [`ui/storybook-testing.md`](../../.claude/skills/ui/storybook-testing.md), [`ui/compliance.md`](../../.claude/skills/ui/compliance.md) | Chromatic diff under threshold; Storybook a11y addon passes; viewport coverage |

Coordination glue already exists: [`defect-grammar.md`](../../.claude/skills/design/defect-grammar.md) + `data-component` DOM emission + Chrome MCP. No new routing logic needed.

### 3.2 What to build

Pilot each lane as a **lane-scoped specialist profile**, but **do not** add new `.claude/agents/*.md` surfaces yet. During the proving phase, keep these as prompt/profile artifacts under the active feature plan or automation prompt files while the existing plan-hub lanes remain authoritative. A meta-agent (Claude Code default) routes via `defect-grammar.md` — already mapping casual terms ("the card feels tight") to component + region + lane.

**Ordering matters**: lanes 1–3 must be stable before lane 4 (visual) earns meaningful work, and lane 5 (motion) is verified last. A coloring pass on an unstable layout is rework. The execution order in §6 reflects this.

### 3.3 Control-surface decisions (adopted in this revision)

This plan now makes four explicit decisions so it can run on the **current** repo harness instead of assuming a parallel one:

1. **`status.json` and `plan-hub.mjs` stay authoritative** for queue state. This plan does **not** introduce new top-level lane names into the live plan-hub schema.
2. **`D.*` and `T.*` are loop families, not plan-hub lanes.** During the pilot they nest inside the existing five authoritative lanes:
   - `ui` hosts D.1-D.5 surface work
   - `state_api` hosts Loop A cleanup, Loop B bug triage, and shared test refactors
   - `contracts` remains unchanged unless a loop touches Solidity
   - `qa_pass_1` hosts T.2/T.3 behavior sweeps and human-reviewed D.6 proving checks
   - `qa_pass_2` confirms regressions, metric deltas, and keep/revert outcomes
3. **New specialist prompts stay outside `.claude/agents/*.md` for now.** Promoting them into first-class agent specs is a separate docs/eval/guidance migration.
4. **Coverage is a scheduled floor, not the inner loop.** `bun run test` stays the fast iterative gate; coverage runs move to nightly or pre-merge.

---

## 4. The autonomy map

### Tier 0 — Minimum unblockers (ship before the first loop)

| # | Item | Effort | Blocks |
|---|---|---|---|
| 0.1 | Fix `scripts/plan-hub.mjs:435` — validator crashes on missing `handoff`. Make graceful (skip lanes without `handoff`) OR require `handoff` in schema AND backfill | 15 min | all routines (can't trust machine state) |
| 0.2 | Backfill `handoff: "handoffs/<slug>.md"` on `client-z-index-sweep/status.json` lanes | 5 min | validator run |
| 0.3 | Reconcile docs + CI truth about agent surfaces in one pass: retire stale six-agent docs, align `.claude/evals/README.md`, and update `.github/workflows/claude-agent-evals.yml` so the repo stops describing one world and running another | 30 min | agent fidelity; CI truthfulness |
| 0.4 | Refresh the baseline against the current branch tip: re-run `.plans/clean/`, close resolved findings, and re-verify the 3 silent-failure mutation bugs before using the audit as fuel | 45 min | cleanup loop |
| 0.5 | Govern the 2 ungoverned `describe.skip` blocks (`contracts.greenwill.test.ts:10`, `useGreenWillHooks.test.tsx:91`) — add issue link + owner + expiry comments, OR unskip them | 10 min | test hygiene lane (T.4); `check-test-quality.sh` passes |
| 0.6 | Clear the currently-failing tests identified by Codex (`springConfig.test.ts`, `CanvasLayout.test.tsx`, `workspace-state.test.tsx`, 5× `fund.test.tsx`) OR convert them from implementation-locks to behavior-asserts | 60 min | T.1 / T.2 / T.3 baselines must be green before loops start |
| 0.7 | Adopt the test-loop policy: coverage is a **scheduled floor**, not the inner loop. `bun run test` stays the fast iterative gate; coverage runs move to nightly or pre-merge | 10 min | inner-loop speed (currently 108s shared coverage alone) |
| 0.8 | Define a memory policy instead of committing repo memory by default: `.plans/` remains repo truth; any `.claude/agent-memory` pilot stays environment-local until freshness, expiry, and ownership rules exist | 15 min | memory / trace reuse without stale context rot |

**Useful but not blocking the first closed loop:**

- Reconcile doc drift between [`packages/admin/AGENTS.md`](../../packages/admin/AGENTS.md) and [`packages/admin/vitest.config.ts`](../../packages/admin/vitest.config.ts)
- Fix the remaining `useMediaQuery` duplicate in [`packages/admin/src/components/Layout/CanvasLayout.tsx:44`](../../packages/admin/src/components/Layout/CanvasLayout.tsx)

### Tier 1 — Foundation loops (pure metrics, no subjectivity)

#### Loop A: Cleanup

- **Editable surface**: one module cluster at a time (e.g., `packages/shared/src/hooks/<hook-family>/**`)
- **Metric (single composite)**: `knip` unused count + `tsc --noEmit` error count + `oxlint` error count — lower is better
- **Time budget**: 30 min
- **Revert trigger**: `bun run test` fails, bundle size grows > 1%, new lint errors in unchanged files
- **Keep trigger**: composite drops AND all gates pass
- **Harness**: `cracked-coder` in a worktree (already configured)
- **Fuel (ready today)**: `.plans/clean/agent-1-deduplication.md`, `.plans/clean/agent-3-dead-code.md`

#### Loop B: Bug triage

- **Editable surface**: one failing test file + its target source file
- **Metric**: target test goes red → green without regressing other tests
- **Time budget**: 60 min
- **Revert trigger**: any other test regresses, or fix touches files outside declared surface
- **Harness**: `cracked-coder` TDD flow (default)
- **First inputs**: the 3 verified silent-failure mutation bugs in [`packages/shared/src/providers/Work.tsx:280`](../../packages/shared/src/providers/Work.tsx), [`packages/shared/src/providers/JobQueue.tsx:265`](../../packages/shared/src/providers/JobQueue.tsx), [`packages/admin/src/components/Hypercerts/CreateListingDialog.tsx:93`](../../packages/admin/src/components/Hypercerts/CreateListingDialog.tsx)

#### Loop C: Test-quality lanes — **Codex's 4-lane split**

Codex's sharper framing: testing isn't one lane. It's **four**, each with a dedicated metric and editable surface, plus a cross-cutting hygiene requirement. Coverage is a **floor, not the inner loop** — shared coverage alone takes ~108s, which is too slow for iterative auto-improvement. Move coverage to a scheduled lane (nightly or pre-merge), not the per-change cycle.

Numbers (Codex-audited, Claude-verified):
- **Shared**: 210 test files, ~52.6k test LOC, 121 hook tests, **18 files over 500 LOC**
- **Admin**: 39 test files, ~8.7k LOC
- **Client**: 43 test files, ~8.1k LOC
- **74 tests** in admin/client mock `@green-goods/shared` **wholesale** (verified via grep) — the clearest coverage-vs-confidence smell

##### T.1: Shared contract lane

- **Surface**: `packages/shared/src/__tests__/{hooks,providers,workflows,utils}/**`
- **Metric**: `critical_shared_failing_tests` — count of failing tests in contract surfaces (auth, workflows, offline queueing, blockchain, vaults). **Target: 0.** Currently non-zero (`springConfig.test.ts` fails on motion-constant changes).
- **Budget**: 45 min per run
- **Revert trigger**: new failures on unchanged contract surfaces, or `bun run test` runtime grows > 20%
- **Fuel**: §9 brittleness-heavy tests (`query-keys.test.ts` 1,564 LOC / 143 tests, `springConfig.test.ts` exact-constant asserts)

##### T.2: Admin behavior lane

- **Surface**: `packages/admin/src/__tests__/{components,workspace*,routing*,views*}/**`
- **Metric**: `admin_behavior_failing_tests` — count of failing tests in canvas / router / workspace state. **Target: 0.** Currently failing: `CanvasLayout.test.tsx`, `workspace-state.test.tsx`.
- **Budget**: 30 min
- **Revert trigger**: wholesale barrel-mock count grows (should only shrink from current 74), new failures on unchanged admin surfaces
- **Rule**: replace wholesale `vi.mock('@green-goods/shared')` with **edge mocks** (mock the data boundary, not the entire shared barrel). Reference patterns: `packages/admin/src/__tests__/components/hypercerts/MetadataEditor.test.tsx` (current anti-pattern) and `packages/client/src/__tests__/components/Cards.test.tsx` (same).

##### T.3: Client journey lane

- **Surface**: `packages/client/src/__tests__/{views,flows,pages}/**`
- **Metric**: `client_journey_failing_tests` — count of failing page-level user flows. **Target: 0.** Currently: 5 failures in `fund.test.tsx`.
- **Budget**: 30 min
- **Revert trigger**: new failures on unchanged journey flows, flakiness rate rises
- **Gap**: no integration-level coverage for offline work submission + background sync (the user's offline-first priority). Adding even one end-to-end test here is higher value than 200 more query-key assertions.

##### T.4: Test hygiene lane (cross-cutting)

- **Surface**: all `__tests__/` trees across `shared/admin/client`
- **Metric (composite, lower is better)**: `check-test-quality.sh` violations + ungoverned `.skip` count + runtime warning count (`act(...)` / Lit / Radix / source-map / translation warnings)
- **Current state**: `check-test-quality.sh` **fails** on ungoverned skips in `contracts.greenwill.test.ts:10` and `useGreenWillHooks.test.tsx:91` (both `describe.skip` with no owner/issue/expiry). Traces are noisy — hurts agent readability (Nate's video-2 "clean eval output" requirement).
- **Rule**: every `.skip` MUST have issue link + owner + expiry comment (the pattern `MembersModal.test.tsx` already uses).
- **Budget**: 30 min
- **Revert trigger**: new ungoverned skips introduced, or new warning categories added to stdout

##### Visual / a11y lane

Fits under **D.6 Verification** (§4 Tier 2). Codex flags it as absent — [`storybook.yml`](../../.github/workflows/storybook.yml) builds Storybook but does not run visual diffing or a regression gate. D.6 cannot run unattended until Chromatic (or equivalent) is wired.

### Tier 2 — Design specialist lanes (Codex's 6-lane staging)

During the pilot, each lane is a prompt/profile artifact kept under the active feature's `artifacts/` directory or under `.plans/_automation/` prompts. Do **not** add new committed `.claude/agents/*.md` files until docs, eval workflow, and guidance-consistency surfaces are intentionally migrated.

Each lane profile should still have:
- **Scoped editable surface** — cannot edit outside its lane
- **Lane-specific prompt** — references only its knowledge file(s)
- **Karpathy triplet** below
- Emit output per §5

If the pilot works, a separate migration plan can decide which specialists become first-class agent specs.

**Ordering rule**: unit of work is "one lane on one surface," not "the whole screen." Lane N's metric assumes lanes 1 through N−1 are stable on that surface.

#### D.1: Intent / paradigm lane

- **Surface**: `.plans/active/<feature>/brief.md` + `.plans/active/<feature>/spec.md` (markdown only)
- **Metric**: brief declares paradigm (Command / Ambient / Data Landscape / Conversational), shell (Admin / Client), and component palette; all three drawn from Canonical lists
- **Budget**: 15 min
- **Revert**: any referenced component not in Canonical palette, or paradigm contradicts shell identity
- **Knowledge**: [`design/SKILL.md`](../../.claude/skills/design/SKILL.md), [`ARCHITECTURE.md`](../../.claude/skills/design/ARCHITECTURE.md), [`prompt-contract.md`](../../.claude/skills/design/prompt-contract.md)
- **Output handed to**: D.2

#### D.2: Layout / structure lane — **SHIP FIRST (per Codex)**

- **Surface**: view composition files (`packages/admin/src/views/<view>/**` or `packages/client/src/views/<view>/**`), CSS Grid declarations, container / padding / radius
- **Metric**: Playwright viewports pass at 320/768/1280; no overflow; concentricity rule holds (`child_radius = parent_radius − padding`); hit-target ≥ 44px on all interactive elements; one dominant workspace per region
- **Budget**: 25 min
- **Revert**: viewport tests fail, route anatomy breaks (Admin `TopContextBar` / `MainSheet` / `Nav` relationship), or component from non-Canonical palette introduced
- **Knowledge**: [`spatial.md`](../../.claude/skills/design/spatial.md), review-checklist Lens 2
- **Why first**: everything else assumes a stable layout. Styling or motion work on shifting DOM is rework.
- **Output handed to**: D.3

#### D.3: Interaction / state lane

- **Surface**: component state props, play functions in `*.stories.tsx`, hook wiring inside view files
- **Metric**: Storybook `play()` functions pass, Playwright keyboard flow passes (Tab / Shift-Tab / Enter / Escape), error + empty + loading states declared
- **Budget**: 20 min
- **Revert**: existing tests regress, focus trap broken in dialogs, keyboard path fails
- **Knowledge**: [`interaction.md`](../../.claude/skills/design/interaction.md), [`ui/compliance.md`](../../.claude/skills/ui/compliance.md)
- **Output handed to**: D.4

#### D.4: Visual system lane (color / material / radius)

- **Surface**: view TSX class attributes + `packages/shared/src/styles/theme.css` (tokens only)
- **Metric**: `bun run check:design-tokens` passes, `bun run lint:vocab` passes, 4-role volume ratios on touched views (canvas 80–90% / ink 8–15% / stone 3–5% / accent 1–3%) via Chrome MCP DOM sample, contrast ≥ WCAG AA on all text pairings
- **Budget**: 20 min
- **Revert**: any raw color / radius / material value introduced, ratio violation, contrast failure
- **Knowledge**: [`materials.md`](../../.claude/skills/design/materials.md), [`language.md`](../../.claude/skills/design/language.md), [`quick-reference.md`](../../.claude/skills/design/quick-reference.md)
- **Typography nested here** (not a separate lane per Codex): zero hardcoded font-sizes, admin surfaces = Plus Jakarta Sans, client surfaces = Inter
- **Output handed to**: D.5

#### D.5: Motion lane

- **Surface**: transitions and animation hooks, motion tokens in `theme.css`
- **Metric**: zero raw `cubic-bezier` / `duration` in touched files (only `--spring-*` tokens), `prefers-reduced-motion` guard present, no cumulative layout shift during animation (Lighthouse CLS < 0.15 held)
- **Budget**: 15 min
- **Revert**: raw motion value introduced, reduced-motion test fails, CLS regresses
- **Knowledge**: [`interaction.md`](../../.claude/skills/design/interaction.md), [`ui/view-transitions.md`](../../.claude/skills/ui/view-transitions.md)
- **Output handed to**: D.6

#### D.6: Verification lane

- **Surface**: read-only across everything the previous lanes touched + Storybook stories + Chromatic / Playwright snapshots
- **Metric**: Chromatic diff within threshold, Storybook a11y addon passes, viewport screenshots at 320/768/1280 match baseline or are approved
- **Budget**: 10 min
- **Revert**: visual diff exceeds threshold without approval, a11y violation introduced
- **Knowledge**: [`ui/storybook-testing.md`](../../.claude/skills/ui/storybook-testing.md), [`ui/compliance.md`](../../.claude/skills/ui/compliance.md), review-checklist Lens 4
- **Prerequisite**: Chromatic + `paradigm-*` story tags not yet wired — blocker for this lane to run unattended

#### Meta-agent (design orchestrator)

Routes via existing `defect-grammar.md`. When Afo says *"the card feels tight on Hub"*:

1. Resolve defect via Chrome MCP (`data-component="AdminCard"`, region="Hub", workspace="admin")
2. Classify lane (spacing → D.2, color → D.4, motion → D.5, focus → D.3)
3. Dispatch matching specialist in worktree
4. Review specialist's emit output
5. Accept, revert, or escalate to D.6 verification

### Tier 3 — Trace-capture layer (Telegram bot autonomy)

Blocker for any `packages/agent` auto-improvement. Separate plan:

- Wrap Telegraf handlers with request/response sink (Langfuse / Langsmith / local JSONL to `.plans/agent-traces/`)
- Emit `{ user_intent, tool_calls, final_output, satisfaction_signal }`
- Weekly review-agent consumes traces, proposes harness edits

---

## 5. Emit contract (every loop writes this)

Per Nate's "traces are everything": every routine run emits to stdout AND `.plans/_automation/runs/<timestamp>-<loop>.jsonl`:

```json
{
  "loop": "cleanup | bug | t1-shared | t2-admin | t3-client | t4-hygiene | d1-paradigm | d2-layout | d3-interaction | d4-visual | d5-motion | d6-verification",
  "surface": ["absolute/path/to/file.ts"],
  "metric_before": 47,
  "metric_after": 38,
  "tests_passed": true,
  "warning_count_before": 83,
  "warning_count_after": 12,
  "decision": "keep | revert | bail",
  "revert_reason": null,
  "duration_seconds": 1247,
  "notes": "..."
}
```

Warning-count fields added because Codex flagged noisy test traces (`act(...)` / Lit dev-mode / Radix dialog / translation / source-map warnings) as an agent-readability problem per Nate video 2's "clean eval output" requirement. A passing suite full of warnings is not a good autonomous eval.

This matches Codex's "what changed / what metric moved / what failed / what was reverted" emit ask.

---

## 6. Recommended execution order

Order updated per Codex: **layout first, not coloring** — because D.4 visual work on an unstable layout is rework, and D.2 layout has the cleanest metric (viewport + overflow + concentricity) that is testable without Chromatic wiring.

| Step | Target | Duration | Proves |
|---|---|---|---|
| 1 | **Tier 0** minimum unblockers (plan-hub fix + status backfill + docs/CI truth pass + skip governance + failing-test cleanup + inner-loop policy + memory policy) | 1 session (~2.5 hrs) | Unblocks the first closed loop without waiting on a broader harness rewrite |
| 2 | **Loop A Cleanup** — pick one hook family from `.plans/clean/agent-3` | 1 week | Pattern works end-to-end; cheapest and most objective |
| 3 | **Loop C/T.4 Test hygiene** — govern skips, clean warnings, wire `check-test-quality.sh` into the `ship` skill / pre-merge validation ladder | 1 week | Clean eval output unlocks every later loop (agent-readable traces) |
| 4 | **Loop B Bug** — onboard the 3 silent-failure mutation bugs (`Work.tsx:280`, `JobQueue.tsx:265`, `CreateListingDialog.tsx:93`); add regression tests as part of the fix | 1 week | TDD loop works; clears known pain |
| 5 | **Loop C/T.1 Shared contract lane** — start with `packages/shared/src/__tests__/hooks/` (121 hook tests, 18 files over 500 LOC); compress `query-keys.test.ts` (1,564 LOC → behavioral subset) | 1–2 weeks | Shared is the dominant lane; biggest ROI on quality |
| 6 | **Loop C/T.2 + T.3** admin behavior + client journey lanes — replace wholesale barrel mocks with edge mocks; fix `fund.test.tsx` five failures | 1–2 weeks | App-package test confidence lifts; integration coverage on offline sync arrives |
| 7 | **D.2 Layout lane** — first design specialist | 1–2 weeks | Lane specialization works on most-stable-first lane |
| 8 | **D.4 Visual lane** — second design specialist (layouts must be stable first) | 1 week | Token discipline scales; 4-role volume enforcement lands |
| 9 | **D.3 / D.5 / D.6** rollout + defect-grammar orchestrator wiring + Chromatic wiring for D.6 | 1 month | Full design autonomy |
| 10 | **D.1 Paradigm lane** — wired last as the new-feature entry point | 1 week | Brief → spec → execution chain closes |
| 11 | **Tier 3** trace layer for Telegram agent | 1 month | Task-agent autonomy unlocked |

**Sequencing rationale**: Test hygiene (T.4) now comes **before** the other test lanes because clean eval output is a prerequisite for *any* loop's emit contract to be readable. Without T.4, composite metric deltas get drowned in warning noise.

---

## 7. What this is NOT

- **Not an active plan** — no `brief.md` / `spec.md` / `plan.todo.md` / `status.json` yet. When a loop is picked up, promote to `.plans/active/<loop-slug>/` and scaffold.
- **Not a replacement for interactive work** — interactive remains primary; routines reduce drift between sessions and close long-running optimization windows while Afo sleeps.
- **Not compute-hungry** — each loop is bounded 10–60 min on existing model plan.

---

## 8. Open decisions for Afo

1. **First closed loop** — start with Cleanup, Test hygiene, or Bug triage. Recommendation in this revision: **Cleanup first**, then T.4 hygiene, then Bug.
2. **First design pilot surface** — pick one concrete surface, not a whole package. Recommendation: one admin canvas surface with layout pain, likely `/hub` or one Hub subview.
3. **Chromatic / visual regression wiring** — D.6 Verification is blocked without it. Budget this as a separate small plan before D.2 goes autonomous, or accept human-eye verification on D.2 outputs during the proving phase.
4. **query-keys.test.ts compression** — 1,564 lines, 143 tests, asserts deprecated behavior. Option A: compress in one PR. Option B: mark deprecated tests with owner/expiry and let them age out.
5. **Edge-mock migration scope** — 74 wholesale `vi.mock('@green-goods/shared')` call sites. Recommendation: migrate per `__tests__/` subdirectory in T.2 / T.3 runs, measured by "wholesale-barrel-mock count" going down.

---

## 9. Test-quality appendix (for Loop C)

Per Afo's concern: "*we seem to have a lot there; I want to make sure our tests are quality and not creating false positives.*" This appendix records a targeted test-quality audit across `shared / admin / client` (contracts excluded — coverage there is strong and trusted).

### 9.1 Headline verdicts

| Package | Test count | Verdict |
|---|---|---|
| `packages/shared` | ~223 | **Mixed** — solid error/utility tests undermined by excessive mocking in hooks & providers |
| `packages/admin` | ~39 | **Low-value-heavy** — component tests heavily mocked; stubs tested in place of behavior |
| `packages/client` | ~44 | **Low-value-heavy** — weak assertions (`toBeTruthy`, `toBeDefined`), shallow DOM checks |

Numerically large (≈306 tests). Quality-light. Large test counts alone don't protect the product.

### 9.2 Top 5 test-quality smells (verified by audit)

1. **Over-mocking the module under test**
   - `packages/shared/src/__tests__/hooks/useActionOperations.test.ts:16-66` — mocks wagmi + contract utils + simulation + error parsing + toast + react-query (6+ layers). Tests mock behavior, not hook logic. Refactor-proof in the worst way.

2. **Weak assertions on existence, not behavior**
   - `packages/shared/src/__tests__/providers/WorkProvider.test.tsx:214-217` — `expect(result.current).toBeDefined()`, `expect(result.current.form).toBeDefined()`. Passes as long as the object exists, regardless of correctness.
   - Also: `packages/admin/src/__tests__/components/CreateAction.test.tsx:164` (`toBeInTheDocument()` on mocked stub), `packages/shared/src/__tests__/stores/useGardenStateStore.test.ts:66` (`.toBeTruthy()`).

3. **Asserting delegation instead of value**
   - `packages/shared/src/__tests__/hooks/hypercerts/useCreateHypercertWorkflow.test.ts:95-117` — 4 tests verify `mockNextStep / mockPreviousStep / mockSetStep / mockReset` were called once. None assert the hook returns the right step value. Testing delegation ≠ testing behavior.

4. **Entire component trees mocked in unit tests**
   - `packages/admin/src/__tests__/components/CreateAction.test.tsx:21-147` — mocks `@green-goods/shared`, `FormWizard`, `PageHeader`, step components, react-intl, icons, hooks all as stubs. Zero confidence; refactors pass the test regardless of correctness.

5. **Real timers in async tests (flakiness risk)**
   - `packages/shared/src/__tests__/providers/JobQueueProvider.test.tsx:96` — `await new Promise((r) => setTimeout(r, 100))`.
   - Also in `createGardenMachine.test.ts`, `createAssessmentMachine.test.ts`. Should use `vi.useFakeTimers()`.

### 9.3 Under-tested critical flows (false-negative risk)

1. **Offline work submission + background sync** — `modules/job-queue/` (draft DB, executors, media manager) has **zero tests**. Only `JobQueueProvider` mocked tests exist. Silent sync failures, orphaned drafts, and race conditions are all uncaught.
2. **Hypercert mint workflow** — validation logic (`validateAllowlist`, `canProceed` for steps 2–3) is **mocked out** in the only workflow test. Malformed hypercerts slip through.
3. **Auth state restoration (passkey + smart account)** — `authServices.test.ts` mocks Pimlico + viem AA + permissionless SDK. If any of those change shape, tests stay green; users get logged out.

### 9.4 Three concrete follow-ups (fuel for Loop C)

1. **Rewrite 8–12 over-mocked hook tests** — start with `useActionOperations.test.ts`. Mock at the `simulateTransaction` boundary, not wagmi. Test success path, simulation failure, wallet-not-connected branches. Not mock call counts. **Effort**: ~4 hrs. **Confidence**: high.
2. **Add strong-assertion helpers to shared test utilities** — `packages/shared/src/__tests__/test-utils/` should export functions like `expectWorkForm(form)` that check specific shapes, not `toBeDefined()`. Replace 20+ weak-assertion instances. **Effort**: ~2 hrs.
3. **Add one real offline-sync integration test** — no mocking of job-queue internals. Real IndexedDB, simulated network transitions, verify queue flush. **Effort**: ~3 hrs. **Confidence**: high.

### 9.5 What this does NOT say

- **Contracts tests are good** — 320 test files, Foundry + realism audit + gas profiling + phased enforcement. Not audited here because Afo is confident in them and the evidence supports that confidence.
- **Not all 306 tests are bad** — foundational error-handling tests (mutation-error-handler, extract-message) and type-validation tests (domain-types, query-keys) are solid. The problem is concentrated in the hook + component layer.

### 9.6 Codex's complementary test-lane findings

Codex ran a deeper test-lane audit with concrete numbers and additional surface-area findings. Folded in here to avoid losing signal.

**Structural reality (verified):**

| Package | Test files | Test LOC | Hook tests | Files over 500 LOC |
|---|---|---|---|---|
| shared | 210 | ~52,600 | 121 | **18** |
| admin | 39 | ~8,700 | n/a | — |
| client | 43 | ~8,100 | n/a | — |

- **74 test files** in admin/client directly `vi.mock('@green-goods/shared')` wholesale (verified via grep, Codex counted 73; within rounding).
- `query-keys.test.ts` = **1,564 lines, 143 tests** (verified) — Codex: still asserts deprecated behavior; overspecified contract test.
- `springConfig.test.ts` = 16 lines — brittle because it asserts exact motion constants. When the design system moved tokens, the test failed without any user-visible regression.

**Currently-failing tests (pre-loop baseline):**

- `packages/shared/src/__tests__/components/Canvas/springConfig.test.ts` — coverage failure on motion-constant change
- `packages/admin/src/__tests__/components/CanvasLayout.test.tsx` — admin coverage failure
- `packages/admin/src/__tests__/workspace-state.test.tsx` — admin coverage failure
- `packages/client/src/__tests__/views/fund.test.tsx` — **5 failures** in client coverage

These must be either fixed or converted from implementation-locks to behavior-asserts before the test lanes can run autonomously. See Tier 0.9.

**Ungoverned skips (Codex-verified):**

- `packages/shared/src/__tests__/utils/contracts.greenwill.test.ts:10` — `describe.skip("utils/blockchain/contracts GreenWill surface")` — no owner/issue/expiry
- `packages/shared/src/__tests__/hooks/greenwill/useGreenWillHooks.test.tsx:91` — `describe.skip("hooks/greenwill")` — no owner/issue/expiry

`check-test-quality.sh` already fails on these. Pattern to follow: `packages/admin/src/__tests__/components/MembersModal.test.tsx` uses `// skip: issue #123, owner @afo, expires 2026-05-01` style comments.

**Doc drift:**

- [`packages/admin/AGENTS.md`](../../packages/admin/AGENTS.md) describes a broader exclusion story than [`packages/admin/vitest.config.ts`](../../packages/admin/vitest.config.ts) actually enforces. Fix in Tier 0.10.

**Trace noise (agent-readability issue):**

Codex flagged passing tests emitting:
- `act(...)` warnings (React testing library)
- Lit dev-mode warnings
- Radix dialog warnings
- Translation / auth logs
- Source-map noise

Per Nate video 2, agents running autonomous loops need clean eval output. Warning-laden "pass" signals confuse automated judgment. T.4 hygiene lane's warning-count metric targets this directly.

**Coverage timing (why coverage is not the inner loop):**

- Shared coverage run alone: ~108s before failure
- Admin + client coverage: similarly slow and noisy

Decision in Tier 0.11: coverage becomes a **floor + scheduled lane**, not the iterative dev cycle. `bun run test` (no coverage) remains the fast inner loop; `bun run test:coverage` runs nightly or at pre-merge.

**Positive substrate (worth protecting during loops):**

- [`packages/shared/src/__tests__/test-utils/index.ts`](../../packages/shared/src/__tests__/test-utils/index.ts) is a real central substrate — Loop C's assertion helpers (§9.4 action 2) should live there.
- [`scripts/check-test-quality.sh`](../../scripts/check-test-quality.sh) is an existing quality guardrail — T.4's metric is largely "this script passes + warning count + governed-skip count."
- Skip governance pattern already exists where applied. Make it universal.

### 9.7 The sharpened "one point" (Codex)

> *"The repo does not need more tests first. It needs a sharper distinction between contract tests, behavior tests, visual tests, and test debt, with one explicit metric per lane. That's the move that makes the suite more useful for autonomous development instead of just larger."*

This is the core reframe that turns Loop C from one fuzzy metric into four scorable lanes (T.1–T.4) plus D.6 Verification for visual/a11y.
