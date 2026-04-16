# Admin UI Revamp — Orchestration Guide

Claude-orchestrated build: Claude Code drives the entire process, dispatching Codex tasks via `codex exec`, working on UI tasks itself, reviewing Codex output, and managing merges.

## How It Works

```
You ──tell Claude──► "Execute Phase 1a"
                          │
                          ├── creates worktrees
                          ├── dispatches Codex tasks (codex exec --full-auto) in background
                          ├── works on UI tasks itself (foreground or own worktree)
                          ├── monitors Codex completion
                          ├── reviews Codex diffs
                          ├── merges in dependency order
                          └── runs gate checks
                          │
You ◄──reports──────── "Phase 1a complete. Gate check: ✅"
```

**Claude** does the work and orchestration. **You** approve merges and make judgment calls.

## Agent Capabilities

Both run fully local via native Mac apps with full repo access and worktree support.

**Codex (GPT 5.4)** — dispatched via `codex exec --full-auto`. Works autonomously in its own worktree. Can't ask questions. Best for: hooks, stores, tests, mechanical transforms.

**Claude Code (Opus 4.6)** — interactive. Iterates on design, runs Storybook, debugs failures. Dispatches and reviews Codex. Best for: components, layouts, multi-file refactors, responsive UI.

## Codex Dispatch Pattern

Claude creates a worktree, runs Codex in background, collects structured results:

```bash
CODEX=/Applications/Codex.app/Contents/Resources/codex
SCHEMA=.plans/active/admin-ui-revamp/handoffs/codex-result-schema.json

# 1. Create worktree branch off feature branch
git worktree add /tmp/gg-codex-<task> -b codex/<task>/<phase> feature/admin-ui-revamp

# 2. Dispatch Codex (background — Claude continues working)
$CODEX exec \
  --full-auto \
  -C /tmp/gg-codex-<task> \
  -o /tmp/gg-codex-<task>/codex-result.md \
  --output-schema $SCHEMA \
  "<prompt from codex-tasks.md>"

# 3. When done, review structured result + diff
cat /tmp/gg-codex-<task>/codex-result.md
git -C /tmp/gg-codex-<task> diff feature/admin-ui-revamp...HEAD --stat

# 4. If good, merge into feature branch
git checkout feature/admin-ui-revamp
git merge codex/<task>/<phase> --no-ff -m "feat(shared): <description>"

# 5. Clean up worktree
git worktree remove /tmp/gg-codex-<task>
git branch -d codex/<task>/<phase>
```

Multiple Codex tasks run in parallel — each in its own worktree, each as a background process.

> **Note:** `codex exec` sessions do NOT appear in the Codex desktop app. Claude monitors progress via the `-o` result file and git diff. All orchestration feedback flows through the Claude conversation.

## Monitoring Codex Tasks

Claude uses `run_in_background` when dispatching Codex. The system automatically notifies Claude when each task completes. The review flow:

1. **On completion notification** — read the structured result file (`codex-result.md`)
2. **Check status field** — `success` / `partial` / `failed`
3. **If success** — review `git diff`, verify `tests_passed: true`, check for `issues`
4. **If partial/failed** — read `issues` array, decide: fix manually, re-dispatch with refined prompt, or skip
5. **Merge or escalate** — merge good results, flag problems to user

The `--output-schema` flag ensures Codex returns structured JSON (status, files changed, tests passed, issues) instead of free-form text, making automated review reliable.

## Branch Strategy (D57)

```
main
  └── feature/admin-ui-revamp              ← long-lived feature branch
        ├── codex/factory/phase-1a          ← Codex worktree: networkMode
        ├── codex/store/phase-1a            ← Codex worktree: useAdminStore
        ├── codex/permissions/phase-1a      ← Codex worktree: toolbar permissions
        ├── codex/labels/phase-1a           ← Codex worktree: route-labels
        └── (Claude works directly on feature branch or own worktree)
```

Merge order: hooks/state first → UI second → tests/verification last.
Each phase merges to main as a separate commit for independent rollback.

---

## Pre-Flight

Before Phase 1a:
- [ ] Fix H2: Update stale test assertions in ReviewStep/TeamStep (H1 already fixed)
- [ ] Verify: `bun run --filter '@green-goods/admin' build && bun run --filter '@green-goods/admin' test`
- [ ] Merge to main
- [ ] Create feature branch: `git checkout -b feature/admin-ui-revamp`

---

## Phase 1a: Shell Foundation

### Claude's execution plan

When told "Execute Phase 1a":

**Step 1 — Dispatch 4 Codex tasks in parallel (background)**

Create worktrees and run `codex exec --full-auto` for each. All prompts are in `handoffs/codex-tasks.md`. Run these in background while Claude works on UI.

| Task | Worktree | Prompt Source |
|---|---|---|
| networkMode factory (D38) | `/tmp/gg-codex-factory` | Phase 1a → Task 2 |
| Extend useAdminStore (D46) | `/tmp/gg-codex-store` | Phase 1a → Task 1 |
| useEffectiveToolbarPermissions | `/tmp/gg-codex-permissions` | Phase 1a → Task 3 |
| route-labels.ts | `/tmp/gg-codex-labels` | Phase 1a → Task 4 |

**Step 2 — Claude works on UI tasks (foreground)**

While Codex runs in background, Claude builds:
- FloatingToolbar, GardenChip, TopContextBar, SideSheet, BottomSheet, SheetErrorBoundary (all in shared)
- Replace DashboardLayout (remove Sidebar + Header → new spatial layout)
- Create /work, /garden, /community routes
- SettingsSheet shell (user profile, theme, chain info, disconnect)
- Storybook stories (light/dark + mobile viewport)
- i18n keys (~40-45 en strings, es/pt fallbacks)
- Update admin test fixtures for layout removal

Interface contract for permissions hook (Codex is building it):
```typescript
{ showWork: boolean, showGarden: boolean, showCommunity: boolean, showActions: boolean, isLoading: boolean }
```

**Step 3 — Review Codex output as tasks complete**

For each completed Codex task:
1. Read `codex-result.md` from the worktree
2. `git diff feature/admin-ui-revamp...codex/<task>/phase-1a`
3. Check against eval criteria in `eval.md` → Phase 1a
4. Run tests in the worktree: `cd /tmp/gg-codex-<task> && bun run test --filter shared`

**Step 4 — Merge in dependency order**

1. `codex/factory/phase-1a` (networkMode — no deps)
2. `codex/store/phase-1a` (useAdminStore — needs networkMode on useGardens)
3. `codex/permissions/phase-1a` (permissions hook — needs store + gardens)
4. `codex/labels/phase-1a` (route labels — no deps, order flexible)
5. Claude's UI work (components + layout — consumes all hooks)

After each merge, rebase remaining branches if needed.

**Step 5 — Gate check**

```bash
bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build
```

### Phase 1a Gate

- [ ] Sidebar removed, floating toolbar renders
- [ ] /work, /garden, /community routes load
- [ ] Garden chip shows active garden
- [ ] Single-garden user sees static label (no dropdown)
- [ ] Storybook stories render (light/dark + mobile)
- [ ] All existing admin tests pass
- [ ] `bun run build` succeeds
- [ ] No-garden operators see muted toolbar + empty content

---

## Phase 1b: Route Consolidation

### Claude's execution plan

**Step 1 — Dispatch 3 Codex tasks in parallel**

| Task | Worktree | Prompt Source |
|---|---|---|
| Deployment decomposition (D52) | `/tmp/gg-codex-deployment` | Phase 1b → Task 1 |
| Dead code cleanup (D53) | `/tmp/gg-codex-cleanup` | Phase 1b → Task 2 |
| Unit tests | `/tmp/gg-codex-tests` | Phase 1b → Task 3 |

**Step 2 — Claude works on route consolidation (foreground)**

- Fold /assessments, /endowments, /strategies into new routes
- 24-row legacy redirect map (spec §32)
- Role-adaptive toolbar wiring
- Deployer sections in SettingsSheet
- CommandPalette route update + trigger relocation
- Side sheets: work detail, submit-work, action detail, action create/edit
- Verify PostHog `usePageView` auto-tracks new routes

**Step 3 — Merge in order**

1. `codex/deployment/phase-1b` (decomposition — independent)
2. Claude's route consolidation (bulk of the work)
3. `codex/cleanup/phase-1b` (deletes orphans from Claude's route changes — AFTER Claude)
4. `codex/tests/phase-1b` last (tests the merged state)

**Step 4 — Gate check**

```bash
bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build
```

### Phase 1b Gate

- [ ] All 24 legacy routes redirect correctly
- [ ] Evaluator wallet sees only Work tab
- [ ] Command palette navigates to /work, /garden, /community, /actions
- [ ] Deployment view decomposed into 3 sub-components in SettingsSheet
- [ ] No orphaned view files for removed routes
- [ ] Treasury card shows yield, cookie jar, strategies
- [ ] `bun run build` succeeds

### Manual task (Afo)
- [ ] Update PostHog dashboards/funnels for new route paths

---

## Phase 2: Cockpit Intelligence

### Claude's execution plan

**Step 1 — Dispatch 6 Codex tasks in parallel**

| Task | Worktree | Prompt Source |
|---|---|---|
| GardenStateStore | `/tmp/gg-codex-garden-state` | Phase 2 → Task 1 |
| useCrossGardenQueue | `/tmp/gg-codex-cross-queue` | Phase 2 → Task 2 |
| URL sync | `/tmp/gg-codex-url-sync` | Phase 2 → Task 3 |
| /community guard | `/tmp/gg-codex-community-guard` | Phase 2 → Task 4 |
| Component promotions | `/tmp/gg-codex-promotions` | Phase 2 → Task 5 |
| Bundle size verification | `/tmp/gg-codex-bundle-check` | Phase 2 → Task 6 |

**Step 2 — Claude works on UI (after state hooks merge)**

- View Transitions API (slide-in/out between routes)
- Mobile bottom nav + keyboard hiding (visualViewport.resize)
- Tonal elevation CSS tokens (6 levels, primary-green tint)
- VaultPositionCard in shared (new read-only component)
- Empty state with Create Garden CTA
- Side sheet ↔ bottom sheet responsive switch
- Side sheet browser history push/pop (D48)
- Command palette fuzzy search + keyboard garden switching
- Settings sheet from top bar icon
- Integrate Codex's GardenStateStore + useCrossGardenQueue

**Step 3 — Merge in order**

1. `codex/garden-state/phase-2` (store — no deps)
2. `codex/url-sync/phase-2` (depends on garden state store)
3. `codex/cross-queue/phase-2` (independent)
4. `codex/community-guard/phase-2` (small, independent)
5. `codex/promotions/phase-2` (shared component moves)
6. Claude's UI work (consumes all above)
7. `codex/bundle-check/phase-2` last (verifies merged state)

**Step 4 — Gate check**

```bash
bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build
```

### Phase 2 Gate

- [ ] Cross-garden queue renders merged items from all gardens
- [ ] View Transitions animate between routes
- [ ] Mobile bottom nav + keyboard hiding works
- [ ] Deep URL /work?garden=X&item=Y opens exact state
- [ ] Browser Back closes side sheet (not navigate away)
- [ ] Tonal elevation visible in dark mode
- [ ] Bundle size: promotions don't increase client bundle
- [ ] `bun run build` succeeds

---

## Phase 3: Public Platform

### Claude's execution plan

**Step 1 — Claude works on public platform (foreground, primary)**

This phase is almost entirely Claude — UI-heavy work modifying the production PWA:
- PublicShell + SiteHeader + AuthHeader
- PlatformRouter isStandalone revision
- AppShell display-mode awareness + data-appbar attribute
- /fund page (stats + gallery + deposit dialogs)
- VaultDepositDialog + CookieJarDepositDialog (new client components)
- /gardens gallery + /gardens/:id detail
- /impact gallery
- /actions public gallery
- Install prompt integration
- Create Garden wizard re-shell
- Landing page LandingHeader removal

**Step 2 — Dispatch Codex i18n task**

| Task | Worktree | Prompt Source |
|---|---|---|
| Phase 3 i18n strings | `/tmp/gg-codex-i18n` | Phase 3 → Task 1 |

**Step 3 — Merge and verify**

1. Claude's client work
2. `codex/i18n/phase-3`
3. Gate check:
```bash
bun format && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build
# Also verify hash router:
VITE_USE_HASH_ROUTER=true VITE_CHAIN_ID=11155111 bun run --filter '@green-goods/admin' build
```

### Phase 3 Gate

- [ ] Browser `/` → /gardens (public gallery)
- [ ] Installed PWA `/` → /home (auth'd dashboard)
- [ ] Mobile browser: hamburger nav, NO bottom nav
- [ ] Installed PWA: bottom nav visible
- [ ] /fund is deposit-only (no withdraw)
- [ ] Connect Wallet on /fund works without redirect to /login
- [ ] All Phase 3 eval criteria pass

### Manual task (Afo)
- [ ] i18n translation pass (es/pt)

---

## Final QA

After all phases merged to feature branch:

**QA Pass 1** — Claude runs full QA against eval.md (acceptance criteria + design quality + quality gates).

**QA Pass 2** — Claude dispatches Codex QA (codex-tasks.md → QA → Task 1) for independent verification.

**Merge to main** when both passes clear.

---

## Codex Dispatch Reference

```bash
# Binary location
CODEX=/Applications/Codex.app/Contents/Resources/codex

# Create worktree + dispatch (run in background from Claude)
git worktree add /tmp/gg-codex-<task> -b codex/<task>/<phase> feature/admin-ui-revamp
$CODEX exec --full-auto -C /tmp/gg-codex-<task> -o /tmp/gg-codex-<task>/codex-result.md "<prompt>"

# Review result
cat /tmp/gg-codex-<task>/codex-result.md
cd /tmp/gg-codex-<task> && git log --oneline feature/admin-ui-revamp..HEAD
cd /tmp/gg-codex-<task> && git diff feature/admin-ui-revamp...HEAD --stat

# Merge if good
git checkout feature/admin-ui-revamp
git merge --no-ff codex/<task>/<phase> -m "feat(scope): description"

# Clean up
git worktree remove /tmp/gg-codex-<task>
git branch -d codex/<task>/<phase>
```

## Codex Prompt Best Practices

Aligned with the [Codex Prompting Guide](https://developers.openai.com/codex/prompting).

Task prompts in `codex-tasks.md` follow the recommended format:

1. **Goal** — what to change or build (1-2 sentences)
2. **Context** — which files to read, which plan docs to reference (Codex reads them directly)
3. **Constraints** — what NOT to do, scope boundaries
4. **Done when** — explicit success criteria including validation commands

Key rules from the guide:
- **Never ask for upfront plans or status updates** — causes early stopping on long rollouts
- **Treat Codex as an autonomous senior engineer** — state the goal, not the steps
- **Bias to action** — `--full-auto` with `approval: never` ensures Codex implements without blocking
- **Personality: pragmatic** — terse, direct, results-focused (set in `~/.codex/config.toml`)
- **Reasoning: xhigh** — appropriate for agentic implementation tasks

What NOT to put in prompts (Codex gets this from AGENTS.md automatically):
- Repo layout, build commands, validation ladder
- Barrel import rules, hook boundary rules
- Package-level conventions (shared/admin/client)
- Step-by-step implementation instructions (let Codex figure out the how)

## Quick Reference

| Need to... | Do this |
|---|---|
| Execute a phase | Tell Claude "Execute Phase X" — it handles everything |
| Check progress | Claude reports as Codex tasks complete |
| Override Codex output | Tell Claude what's wrong — it fixes or re-dispatches |
| Skip a Codex task | Tell Claude to do it directly (may be faster for small tasks) |
| Resolve merge conflict | Claude handles it on the feature branch |
| Something broke | Tell Claude to `/debug` on the feature branch |
| Review before merge | Claude shows you the diff — you approve or reject |
