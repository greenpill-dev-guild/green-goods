# Admin Design Revamp

**Status**: ACTIVE (Tiers 0–5 landed; cleanup tier ready)
**Created**: 2026-05-02
**Last Updated**: 2026-05-03
**Target**: 2026-05-16 (cleanup tier)
**Anchor doc**: [`docs/admin-revamp/audit.md`](../../../docs/admin-revamp/audit.md)
**Anchor bundle**: [`design_handoff_admin-revamp/`](../../../design_handoff_admin-revamp/)

## Overview

Six-tier execution of the admin design handoff bundle. Tiers 0–5 are complete on `develop`; the cleanup tier collects the explicit deferrals + the cross-agent coordination follow-ups. The audit is the canonical decisions log — every commit references its findings.

## Status Snapshot

| Tier | Lane | Status | Anchor commit | Surface |
|---|---|---|---|---|
| 0 | `tier_0_audit` | ✅ completed | `c228fa12` | `docs/admin-revamp/audit.md` (581 lines, 5 sections) |
| 1 | `tier_1_tokens` | ✅ completed | `c228fa12` | Warm-Earth tokens + tone system + status palette + workspace→tone |
| 2 | `tier_2_atoms` | ✅ completed | `bfa0d28b` | PageHeader / MetaStrip / AdminTabRail / StatusBadge / NavigationBar FAB |
| 3 | `tier_3_organisms` | ✅ completed | `822499d1` | Conviction* components + view-model types |
| 4 | `tier_4_screens` | ✅ completed | `48d09470` | Hub / Garden / Community / Actions recompose + IA changes |
| 5 | `tier_5_wiring` | ✅ completed | `1b054239` + `a8586c26` | Garden Members + conviction adapter hooks + GovernancePanel |
| 6 | `cleanup` | 🟢 ready | (pending) | Test coverage, FAB wiring, pool-config consumption, client-test cleanup |

## Locked Decisions (audit §5)

| # | Decision | Resolution | Tier |
|---|---|---|---|
| 5.1 | Canvas wiring (`#FAF8F5`) | Add to admin design system specifically; client PWA unchanged | Tier 1a |
| 5.2 | Tone vs workspace | Unify under `[data-tone]`; refactor 18 admin/shared consumers | Tier 1c |
| 5.3 | Conviction UI placement | Inside Governance tab (no new routes) | Tier 5 |
| 5.4.1 | Allocator UX | Inline at top of Governance tab | Tier 5 |
| 5.4.2 | Decay UI fidelity | Ship without ghost trailing fill in v1 | Tier 3 |
| 5.4.3 | Dark tone strength | `subtle` default in dark mode | Tier 1a |
| 5.4.4 | FAB on read-only screens | Per handoff responsive rule; opt-in via FabContext | Tier 2e |
| 5.5 | Status palette | Global remap inside `.admin-m3` scope | Tier 1b |
| 5.6 | Garden identity strip | Honor Frontend Rule 17 — drop garden-name re-declaration | Tier 4 |
| IA-Garden | Tab structure | Overview / Activity / Members / Settings (drop Impact) | Tier 4 |
| IA-Community | Tab structure | Treasury / Governance / Payouts / People (rename Members→People) | Tier 4 |

---

## Tier 0 — Audit (✅ completed)

**Output**: `docs/admin-revamp/audit.md` (581 lines).

**Five sections**:
1. Token diff — exhaustive table covering every custom property in `screens/tokens.css` × matching admin/shared tokens.
2. Component map — 28 prototype primitives × existing components (14 drop-in, 7 minor variants, 5 brand new).
3. Screen map — Hub / Garden / Community / Actions: current implementation, v2 spec proposal, smallest delta.
4. Risk list — 9 components with consumer counts (`CanvasRouteFrame`: 20, `Surface`/`Card`: 25+, `AdminTabRail`: 7, etc.).
5. Things to flag back — 7 explicit decision points; all resolved during plan-mode dialogue and recorded in the decisions log.

**Verification**:
- All 5 sections present.
- Every token in `screens/tokens.css` has a row.
- Every primitive in the v2 component-primitive list has a row.
- No code changes elsewhere.

---

## Tier 1 — Tokens (✅ completed, commit `c228fa12`)

Three sub-PRs landed in one commit (28 files, 1228+ insertions).

### Tier 1a — Additive admin tokens
- New `:root` block in `packages/admin/src/index.css` with Warm-Earth aliases (`--canvas`, `--ink`, `--stone`, `--surface-*`, `--hairline*`, `--outline*`).
- Hub green role chain (`--g-action`, `--g-action-hover`, `--g-action-ring`, `--g-soft-bg`, `--g-soft-fg`, `--g-on-action`).
- Radius aliases (`--r-xs..xl, --r-full`) → `--admin-radius-*`.
- Warm-shadow elevation (`--e1, --e2, --e3, --e-float`) parallel to `--m3-elevation-*`.
- Typography alias `--font-sans` → `--font-heading`.
- Tone system: `[data-tone="hub|garden|community|actions"]` with `--tone-canvas` per tone; `[data-tone-strength="off|subtle|default"]` multiplier; dark mode default `subtle`.
- New Storybook reference page `AdminRevampTokens.stories.tsx` covering all tokens × tone strength matrix.

### Tier 1b — Status palette admin-scoped remap
- Inside `.admin-m3`: `--orange-*` → handoff amber values; `--red-*` → handoff red; `--sky-*` → handoff azure (`#3B82F6`).
- `--information-*` aliased to `--sky-*` so info badges shift too.
- Client PWA scales unchanged.

### Tier 1c — Workspace → Tone unification
- Renamed `[data-workspace]` → `[data-tone]` and `--ws-*` → `--tone-*` across 18 source files (admin + shared) via sed.
- Renamed `--workspace-tint` / `--workspace-accent` → `--tone-tint` / `--tone-accent`.
- All consumers (`AccountSettingsPanel`, `UserAvatar`, `AccountProfilePanel`, `AdminAccessStateRenderer`, `CanvasLayout`, `IndexRoute.stories`, `NavigationBar`, `WorkbenchRow`, `BottomSheet`, `RightSheet.stories`, `BottomSheet.stories`, `LeftSheet.stories`, `AppBar`, `AppBar.test`, plus `theme.css` lines 880–886) updated.
- Same `var(..., fallback)` behavior — client PWA unaffected.

---

## Tier 2 — Atoms + Molecules (✅ completed, commit `bfa0d28b`)

Five sub-PRs in one commit (5 files, 192+ insertions).

### Tier 2a — PageHeader eyebrow slot
`packages/admin/src/components/Layout/PageHeader.tsx` — added `eyebrow?: ReactNode` prop. Renders as 11px caps label above the title in canvas variant. Backward-compatible with all 23 existing consumers.

### Tier 2b — MetaStrip density variant
`packages/shared/src/components/Canvas/MetaStrip.tsx` — added `density: "pill" | "inline"` prop. `pill` (default) preserves the original soft-pill rendering. `inline` renders mid-dot separated text.

### Tier 2c — AdminTabRail tone-tinted underline
`packages/admin/src/components/AdminTabRail.tsx` — active indicator now reads `--tone-primary` with `--m3-primary` fallback. Picks up the per-view accent automatically when a `[data-tone]` ancestor is set.

### Tier 2d — StatusBadge conviction states
`packages/shared/src/components/StatusBadge.tsx` — added `ConvictionStatus` type (`accruing | passing | funded | withdrawn | expired`) + a third discriminated-union variant `ConvictionStatusBadgeProps`. Each state has icon + WCAG-compliant color.

### Tier 2e — FAB responsive wrapper
`packages/shared/src/components/Canvas/NavigationBar.tsx` — FAB hidden at ≥1024px (desktop carries inline header actions instead). Floating FAB+speed-dial now shows for all breakpoints below 1024px (was <600px). Removed dead desktop-docked FAB rendering. FabContext opt-in unchanged: zero registered actions → no FAB on any breakpoint.

---

## Tier 3 — Organisms (✅ completed, commit `822499d1`)

Net-new components (11 files, 815 insertions).

**New directory**: `packages/shared/src/components/Conviction/`

| Component | Lines | Purpose |
|---|---|---|
| `ConvictionMeter.tsx` | 150 | Single-bar accrual + threshold tick + accrual rate + ETA. Threshold tick pulses when within 5% of crossing. No decay UI in v1 per audit §5.4.2. |
| `WeightAllocator.tsx` | 185 | List of proposals with sliders summing to ≤100%. Live "X / 100%" indicator; over-budget warning state. |
| `ProposalCardConviction.tsx` | 94 | Composes status pill + conviction meter + supporter count. Replaces nothing — net-new (no `OldTallyCard` to migrate from). |
| `index.ts` | 10 | Barrel exports |

**View-model types** (`packages/shared/src/types/conviction.ts`):
- `ConvictionProposal`
- `ConvictionAllocations`
- `ConvictionProposalStatus`
- `ConvictionPoolConfig` (added in Tier 5 audit pass)

**Storybook coverage**: 7 ConvictionMeter stories (Accruing / NearThreshold / Passing / Funded / Withdrawn / Expired / Stalled / NoLabels), 4 WeightAllocator stories (Default / FullyAllocated / OverBudget / Disabled), 5 ProposalCardConviction stories (Accruing / Passing / Funded / Expired / Interactive).

---

## Tier 4 — Screens + IA (✅ completed, commit `48d09470`)

Four sub-PRs in one commit (9 files, 123 insertions / 70 deletions).

### Tier 4a — Hub recompose
- Eyebrow "Workbench" + sticky.
- Refresh button moved from `toolbar` slot to `actions` slot for cross-screen consistency.

### Tier 4b — Actions recompose
- Eyebrow "Catalog".
- Existing sticky / actions / lifecycle tabs preserved.

### Tier 4c — Garden + IA change
- Tabs restructured: **Overview / Activity / Members / Settings** (Impact dropped — Hub Certify+History abstracts hypercert flow per user direction).
- Added Activity tab (placeholder content; real feed deferred to cleanup).
- Added Members tab (real roster shipped in Tier 5c).
- Drops `MetaStrip` garden-name re-declaration per Frontend Rule 17.
- `GardenWorkspaceView` type updated; `resolveGardenView` updated; `handleTabChange` extended; legacy `/garden/impact/*` route retained for URL stability (falls back to overview view).
- Garden.stories.tsx Impact / HypercertInspector renamed to Activity / Members.

### Tier 4d — Community recompose + Members→People
- Eyebrow "Engagement".
- Members tab label → "People" via new i18n key `cockpit.community.people`. Internal id stays `"members"` (controller, route resolver, and hooks unchanged).
- Drops `MetaStrip` garden-name re-declaration.
- ConvictionMeter / WeightAllocator wiring deferred to Tier 5.

---

## Tier 5 — Wiring + Members (✅ completed, commits `1b054239` + `a8586c26`)

Two passes:

### Tier 5c — Garden Members roster (commit `1b054239`)
`views/Garden/components/GardenWorkspaceContent.tsx` — replaced EmptyState placeholder with real list of `workspace.garden.gardeners` using `AddressDisplay` (ENS resolution + truncation) + inline operator badges. Empty-state path retained for solo gardens.

### Tier 5 audit-then-ship: conviction wiring (commit `a8586c26`)

12-finding audit pass × architecture lens × all 12 locked into scope.

**New pure utilities** (`packages/shared/src/utils/conviction/`):
- `percent-points.ts` — bidirectional points↔percent translation; `percentMapToSignedDeltas` is the testable single source of truth for the on-chain int256 delta math.
- `derivation.ts` — `deriveThreshold` / `deriveConvictionPercent` / `deriveDailyAccrual` / `deriveProposalStatus`. Conservative TODO-flagged defaults until pool-config hook lands.
- `index.ts` barrel.

**New adapter hooks** (`packages/shared/src/hooks/conviction/`):
- `useConvictionProposalsForPool(poolAddress, gardenId, voterAddress?)` — composes `useRegisteredHypercerts` + `useHypercertConviction` + `useMemberVotingPower` + `useHypercerts({gardenId})` for metadata.
- `useConvictionWeightAllocator(poolAddress, voterAddress)` — optimistic state container with 400ms debounce + `flush()` + signed-delta computation. Uses `useTimeout` per CLAUDE.md react-patterns rule 1.

**New view component**: `views/Community/components/GovernancePanel.tsx` — mounted inside `CommunityTab`'s governance section (additive — role summary card kept). Filters pools to `PoolType.Hypercert`; renders `WeightAllocator` (only when signed in) + grid of `ProposalCardConviction`.

**Tightened**: `CommunityTab.pools` `unknown` → `GardenSignalPool[]`.

**Storybook**: `GovernancePanel.stories.tsx` with 3 fixtures (NoPool / ActionPoolOnly / WithHypercertPool).

**Audit findings** (all 12 addressed): #1 adapter, #2 derivation, #3 percent↔points, #4 optimistic state, #5 metadata source, #6 status mapping, #7 view extraction, #8 type tightening, #9 Storybook integration, #10 indexer-lag pattern, #11 metadata composition placement, #12 naming clarification.

**Inline blocker resolved**: `RiVoteLine` (non-existent in @remixicon/react) → `RiUserVoiceLine`. Caught by `bun run build`; fixed in same turn.

**Ship-pipeline status at Tier 5 commit**:
- Format: PASS
- Lint: PASS (165 pre-existing solhint warnings, 0 errors from this work)
- Tests: PARTIAL (346/367 — 21 pre-existing client-homepage failures, see cleanup C1)
- Build: PASS (54.33s, full workspace)

---

## Cleanup Tier — open work

Detailed work breakdown lives in [`handoffs/claude-cleanup.md`](handoffs/claude-cleanup.md). Summary:

### Independent (do anytime)

| ID | Item | Effort | Anchor |
|---|---|---|---|
| A1 | Vitest coverage for `percent-points.ts` | ~30 min | `packages/shared/src/utils/conviction/percent-points.ts` |
| A2 | Vitest coverage for `derivation.ts` | ~30 min | `packages/shared/src/utils/conviction/derivation.ts` |
| A3 | Integration test for `useConvictionWeightAllocator` round-trip | ~1 hr | `packages/shared/src/hooks/conviction/useConvictionWeightAllocator.ts` |
| A4 | FAB action registration per view (Hub/Garden/Community/Actions) | ~2 hrs | `views/{Hub,Garden,Community,Actions}/index.tsx` |
| A5 | Garden Members tab role chips beyond operator | ~1 hr | `views/Garden/components/GardenWorkspaceContent.tsx` |
| A6 | Stats slot for Garden + Community headers | ~30 min ea | `views/{Garden,Community}/index.tsx` |

### Blocked on `signal-pool-yield-wiring/ui` lane landing

| ID | Item | Anchor |
|---|---|---|
| B1 | Pool config consumption — retire `FALLBACK_POOL_CONFIG` | `useConvictionProposalsForPool.ts:149`, `derivation.ts` formulas |
| B2 | Per-member supporter count — replace `countSupporters` 1-or-0 placeholder | `useConvictionProposalsForPool.ts:167` |
| B3 | Threshold formula — port from contract reverse-engineering | `derivation.ts:61` (`deriveThreshold`) |

Coordination annotation already landed in `.plans/active/signal-pool-yield-wiring/plan.todo.md` § "Coordination — Tier 5 Conviction Wiring (2026-05-03)" + `handoffs/claude-ui.md` "Read first" callout.

### Separate audit-then-ship pass

| ID | Item |
|---|---|
| C1 | 21 failing client-homepage tests from commit `0b4a67e8`. File as `/audit-then-ship --lens=review --no-ship` against that commit's diff. |

---

## Cross-Agent Coordination

This hub publishes coordination contracts into sibling plans rather than maintaining its own inbound queue.

| Sibling feature | Coordination location | Status |
|---|---|---|
| `signal-pool-yield-wiring` | `.plans/active/signal-pool-yield-wiring/plan.todo.md` § "Coordination — Tier 5 Conviction Wiring (2026-05-03)" + `handoffs/claude-ui.md` "Read first" callout | landed 2026-05-03 |

When `signal-pool-yield-wiring/ui` lane lands, this hub's cleanup tier picks up B1–B3.

---

## Files Summary

### Created (this hub)

```
.plans/active/admin-design-revamp/
├── brief.md
├── spec.md
├── plan.todo.md           ← this file
├── status.json
├── eval.md
└── handoffs/
    ├── README.md
    └── claude-cleanup.md

docs/admin-revamp/
└── audit.md               ← Tier 0 deliverable

packages/shared/src/utils/conviction/
├── percent-points.ts
├── derivation.ts
└── index.ts

packages/shared/src/components/Conviction/
├── ConvictionMeter.tsx
├── ConvictionMeter.stories.tsx
├── WeightAllocator.tsx
├── WeightAllocator.stories.tsx
├── ProposalCardConviction.tsx
├── ProposalCardConviction.stories.tsx
└── index.ts

packages/shared/src/hooks/conviction/
├── useConvictionProposalsForPool.ts
└── useConvictionWeightAllocator.ts

packages/admin/src/components/
└── AdminRevampTokens.stories.tsx

packages/admin/src/views/Community/components/
├── GovernancePanel.tsx
└── GovernancePanel.stories.tsx
```

### Modified (this hub)

```
packages/admin/src/index.css                                    (Tier 1: large additions)
packages/admin/src/styles/admin-m3-tokens.css                   (Tier 1c: --ws- → --tone-)
packages/admin/src/components/Layout/PageHeader.tsx             (Tier 2a: eyebrow slot)
packages/admin/src/components/AdminTabRail.tsx                  (Tier 2c: tone-tinted underline)
packages/admin/src/components/Layout/CanvasLayout.tsx           (Tier 1c: data-workspace → data-tone)
packages/admin/src/components/Layout/AdminAccessStateRenderer.tsx (Tier 1c)
packages/admin/src/components/Layout/AccountProfilePanel.tsx    (Tier 1c)
packages/admin/src/components/Layout/AccountSettingsPanel.tsx   (Tier 1c)
packages/admin/src/components/Layout/UserAvatar.tsx             (Tier 1c)
packages/admin/src/components/AdminButton.tsx                   (Tier 1c)
packages/admin/src/components/Action/{Details,Media}ConfigSection.tsx (Tier 1c)
packages/admin/src/components/Garden/{GardenDomainEditor,AddMemberModal}.tsx (Tier 1c)
packages/admin/src/components/Hypercerts/{CreateListingDialog,MintingDialog,MarketplaceApprovalGate}.tsx (Tier 1c)
packages/admin/src/views/Hub/index.tsx                          (Tier 4a)
packages/admin/src/views/Hub/components/HubWorkCard.tsx         (Tier 1c)
packages/admin/src/views/Actions/index.tsx                      (Tier 4b)
packages/admin/src/views/Garden/index.tsx                       (Tier 4c)
packages/admin/src/views/Garden/Garden.stories.tsx              (Tier 4c: Impact → Activity/Members)
packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx (Tier 4c + Tier 5c)
packages/admin/src/views/Community/index.tsx                    (Tier 4d)
packages/admin/src/views/Community/components/CommunityTab.tsx  (Tier 5: GovernancePanel mount + pool typing)
packages/admin/src/routes/views.tsx                             (Tier 4c: activity/members routes)
packages/admin/src/routes/IndexRoute.stories.tsx                (Tier 1c)
packages/shared/src/styles/theme.css                            (Tier 1c: --ws- → --tone-)
packages/shared/src/components/Canvas/{AppBar,NavigationBar,WorkbenchRow,BottomSheet}.tsx (Tier 1c + Tier 2e)
packages/shared/src/components/Canvas/{BottomSheet,RightSheet,LeftSheet}.stories.tsx (Tier 1c)
packages/shared/src/components/Canvas/MetaStrip.tsx             (Tier 2b)
packages/shared/src/components/StatusBadge.tsx                  (Tier 2d)
packages/shared/src/__tests__/components/AppBar.test.tsx        (Tier 1c)
packages/shared/src/types/conviction.ts                         (Tier 3 + Tier 5: types + doc header)
packages/shared/src/types/index.ts                              (Tier 3: type exports)
packages/shared/src/index.ts                                    (Tier 3 + Tier 5: barrel exports)
packages/shared/src/components/index.ts                         (Tier 3: Conviction barrel)
packages/shared/src/hooks/index.ts                              (Tier 5: adapter hook exports)
packages/shared/src/hooks/admin-ui/garden/garden.utils.ts       (Tier 4c: GardenWorkspaceView)
packages/shared/src/hooks/admin-ui/garden/useGardenWorkspaceController.ts (Tier 4c: handleTabChange)
```

### Untouched (intentionally — out of scope)

```
packages/client/                — except shared barrel exports referenced from admin
packages/contracts/             — no contract changes
packages/indexer/               — no indexer changes
```
