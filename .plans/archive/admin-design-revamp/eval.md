# Admin Design Revamp — Evaluation Criteria

## Tier 0 — Audit
- [x] `docs/admin-revamp/audit.md` exists with all 5 sections (token diff, component map, screen map, risk list, things to flag back).
- [x] Decisions log records each §5 flag-back with the chosen option inline (locked 2026-05-03).

## Tier 1 — Tokens
- [x] Warm-Earth admin aliases resolve in DevTools on every admin route (`--canvas`, `--ink`, `--stone`, `--g-action`, `--r-*`, `--e*`).
- [x] Status palette inside `.admin-m3` resolves to handoff values (verify via DevTools on a warning badge).
- [x] `[data-workspace]` selectors removed; `grep -rn 'data-workspace' packages/admin/src packages/shared/src` returns zero hits.
- [x] Client PWA visually unchanged on a warning surface (e.g., `/community/[garden]/work` route).

## Tier 2 — Atoms + Molecules
- [x] `PageHeader` `eyebrow` slot renders above the title in canvas variant; backward-compatible (no consumer regressions).
- [x] `MetaStrip density="inline"` renders mid-dot separated text; `"pill"` (default) preserves original anatomy.
- [x] `AdminTabRail` active-indicator color picks up `--tone-primary` when a `[data-tone]` ancestor is set.
- [x] `StatusBadge convictionStatus="accruing"` (etc.) renders with the correct icon + color per state.
- [x] `NavigationBar` FAB hidden at ≥1024px; floating FAB+speed-dial below; zero registered actions = no FAB on any breakpoint.

## Tier 3 — Organisms
- [x] `ConvictionMeter` renders bar + threshold tick + accrual rate + ETA across 7 Storybook variants.
- [x] `WeightAllocator` enforces ≤100% with over-budget warning state.
- [x] `ProposalCardConviction` composes status pill + meter + supporter count.
- [x] View-model types exported from `@green-goods/shared`.

## Tier 4 — Screens + IA
- [x] Hub eyebrow = "Workbench"; refresh button in `actions` slot; `sticky` enabled.
- [x] Actions eyebrow = "Catalog".
- [x] Garden tabs: Overview / Activity / Members / Settings (no Impact).
- [x] Community tab label "People" (internal id stays "members").
- [x] Legacy `/garden/impact/*` URLs do not 404.
- [x] No `MetaStrip` garden-name re-declaration on Garden + Community headers (Frontend Rule 17).

## Tier 5 — Wiring
- [x] `<GovernancePanel />` mounts inside `CommunityTab` governance section.
- [x] `useConvictionProposalsForPool` composes hypercert metadata correctly (verify in Storybook with `WithHypercertPool` story).
- [x] `useConvictionWeightAllocator` debounces saves at 400ms; signed-delta math via `percentMapToSignedDeltas`.
- [x] Garden Members tab renders real `garden.gardeners` roster with operator badges.
- [x] Twelve audit findings from /audit-then-ship pass all addressed in commit `a8586c26`.

## Cleanup — landed (2026-05-04 / 2026-05-05 on `release/1.1.0`)

- [x] **A1** Vitest coverage for `percent-points.ts` (round-trip identity, signed-delta correctness, budget=0 edge cases) — commit `8405bce1`, 30 cases.
- [x] **A2** Vitest coverage for `derivation.ts` (status mapping per branch, percent clamping, near-threshold detection) — commit `8405bce1`, 20 cases.
- [x] **A3** Integration test for `useConvictionWeightAllocator` (allocate → debounce → save → refetch round-trip) — commit `8405bce1`, 11 cases.
- [x] **A4** FAB action registration wired in each of Hub / Garden / Community / Actions per the v2 spec dial composition — commit `6b9faa65`. Hub + Actions FAB already wired pre-cleanup; Garden extended with edit/invite/distribution; Community extended with new-proposal/add-member/manage-vault. 16 unit cases pin action ids + navigation targets.
- [x] **A5** (handoff catalog item beyond eval scope) Garden Members tab role chips beyond operator — commit `47c4de59`, 9 unit cases. Owner / operator / evaluator / gardener / funder chips per row.
- [x] **A6** (handoff catalog item beyond eval scope) Stats slot for Garden + Community headers — commit `49d61acf`, 9 unit cases. `MetaStrip density="inline"` with three at-a-glance stats per surface; honors Frontend Rule 17.

## Cleanup — deferred (durable backlog)

- [x] **B1** Pool config hook consumed by `useConvictionProposalsForPool`; `FALLBACK_POOL_CONFIG` retired. **Deferred** to [`.plans/backlog/conviction-pool-config-onchain/`](../../backlog/conviction-pool-config-onchain/brief.md) — `decay()` + `pointsPerVoter()` are readable but `memberCount` has no on-chain enumeration; partial fix would regress conviction-percent math.
- [x] **B2** Per-member supporter count surfaced via new hook; `countSupporters` 1-or-0 placeholder retired. **Deferred** to [`.plans/backlog/conviction-supporter-count-indexer/`](../../backlog/conviction-supporter-count-indexer/brief.md) — needs new `Allocation` Envio entity OR new contract view.
- [x] **B3** Threshold formula ported into `deriveThreshold`. **Deferred** to [`.plans/backlog/conviction-threshold-formula-port/`](../../backlog/conviction-threshold-formula-port/brief.md) — `HYPERCERT_SIGNAL_POOL_ABI` exposes neither `threshold()` nor `minThresholdPoints()`.
- [ ] **C1** 21 client-homepage test failures (commit `0b4a67e8`). **Deferred** — out of scope for `admin-design-revamp` branch boundary; file as separate `/audit-then-ship --lens=review --no-ship` pass.

## QA

- [x] **qa_pass_1** Provisional pass: A4/A5/A6 desktop browser verified, targeted vitest 88+9 passed, plan-hub clean. See [`handoffs/claude-qa-pass-1.md`](handoffs/claude-qa-pass-1.md). Anchored in commit `518f6c96`.
- [x] **qa_pass_2** Pass: full regression scan (admin 407 passed / 0 failed; shared 3000 passed / 1 pre-existing unrelated failure), production build clean, design-token + vocab validators clean. See [`handoffs/claude-qa-pass-2.md`](handoffs/claude-qa-pass-2.md). Anchored in commit `c9dc575e`.

## Validation Commands

```bash
# Format + lint (admin + shared)
bun format && bun lint

# Full test suite (currently 21 client failures pre-date this work)
bun run test

# Full workspace build
bun run build

# Design-system specific
bun run check:design-tokens   # spec ↔ theme.css drift (per CLAUDE.md)
bun run lint:vocab            # banned-vocabulary check
```
