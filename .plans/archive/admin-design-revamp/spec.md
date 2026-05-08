# Admin Design Revamp Spec

## Summary

Six-tier execution of the admin design handoff (`design_handoff_admin-revamp/`). Tiers 0–5 are landed (six commits on `develop`); cleanup tier collects the deferred follow-ups + the cross-agent coordination work. The audit at `docs/admin-revamp/audit.md` is the canonical decisions log and is referenced from every commit.

## Delivery Target

- Tiers 0–5: **landed 2026-05-02 / 2026-05-03**.
- Cleanup tier: complete by **2026-05-16**, contingent on `signal-pool-yield-wiring` UI lane landing first (unblocks the conviction pool-config wiring follow-up).

## Users

- Primary: solo founder + early admin operators of pilot gardens.
- Secondary: parallel agents working on `signal-pool-yield-wiring`, public homepage editorial polish, and (downstream) `yield-split-ui`.

## Functional Requirements

1. Warm-Earth token aliases (`--canvas`, `--ink`, `--stone`, `--g-action`, `--r-*`, `--e*`, `--font-sans`, surface aliases) live in admin scope; `packages/shared/src/styles/theme.css` runtime values for client PWA are not modified.
2. Tone-aware atmosphere via `[data-tone="hub|garden|community|actions"]` selectors at the canvas root, with `off | subtle | default` strength axis (subtle default in dark mode).
3. Status palette (`--orange-*`, `--red-*`, `--sky-*`) shifts to handoff values inside `.admin-m3` scope only; `--information-*` aliased to `--sky-*` so info badges shift too.
4. Workspace tinting unified under `[data-tone]`: legacy `[data-workspace]` selectors removed; `--ws-*` tokens renamed to `--tone-*` across 18 admin/shared source files.
5. Atoms + molecules:
   - `PageHeader` gains an `eyebrow?: ReactNode` slot.
   - `MetaStrip` gains a `density: "pill" | "inline"` variant.
   - `AdminTabRail` indicator picks up `--tone-primary` (with `--m3-primary` fallback).
   - `StatusBadge` gains a `convictionStatus` discriminated-union variant (5 states).
   - `NavigationBar` FAB hides at ≥1024px; floating FAB+speed-dial below; opt-in via `FabContext`.
6. Organisms (`packages/shared/src/components/Conviction/`):
   - `<ConvictionMeter />` — single-bar accrual + threshold tick + accrual rate + ETA; near-threshold pulse.
   - `<WeightAllocator />` — list of proposals with sliders summing to ≤100%; over-budget warning.
   - `<ProposalCardConviction />` — composes title + summary + ConvictionMeter + StatusBadge.
   - View-model types: `ConvictionProposal`, `ConvictionAllocations`, `ConvictionProposalStatus`, `ConvictionPoolConfig`.
7. Screen recompose:
   - Hub: eyebrow "Workbench" + sticky + refresh button moved from `toolbar` slot to `actions` slot.
   - Actions: eyebrow "Catalog".
   - Garden: tabs restructure to **Overview / Activity / Members / Settings**; drop "impact" tab (Hub abstracts it); add Activity (placeholder) + Members (real roster) tabs; legacy `/garden/impact/*` routes retained for URL stability and fall back to overview view.
   - Community: rename Members tab → People (label only; internal id stays "members"); eyebrow "Engagement"; `MetaStrip` garden-name re-declaration dropped per Frontend Rule 17.
8. Conviction adapter hooks (`packages/shared/src/hooks/conviction/`):
   - `useConvictionProposalsForPool(poolAddress, gardenId, voterAddress?)` composes registered hypercerts + weights + member power + hypercert metadata into `ConvictionProposal[]`.
   - `useConvictionWeightAllocator(poolAddress, voterAddress)` is the optimistic-state container with 400ms debounce + signed-delta computation + flush().
9. Pure utilities (`packages/shared/src/utils/conviction/`):
   - `percent-points.ts`: bidirectional points↔percent translation + `percentMapToSignedDeltas`.
   - `derivation.ts`: `deriveThreshold` / `deriveConvictionPercent` / `deriveDailyAccrual` / `deriveProposalStatus`.
10. `<GovernancePanel />` mounts inside `CommunityTab`'s `governance` section, additive to the existing role-summary card.
11. Sibling agents have a coordination contract in their plans; `signal-pool-yield-wiring/plan.todo.md` carries the live coordination section dated 2026-05-03.

## Non-Functional Constraints

- **Package boundaries**: admin and shared only; no client PWA changes.
- **Token discipline**: handoff values never hardcoded inline; always referenced via `var(--*)`.
- **Multi-agent safety**: every tier commit explicitly attributes other-agent work and never stages files outside locked scope (audit §5 + Tier 4 IA decisions).
- **Audit fidelity**: every flagged decision in audit §5 is either fixed or explicitly deferred with reasoning in the commit message.
- **TDD**: deferred for Tiers 1–5 (visual + structural work — verified via lint + build + Storybook); **required** for cleanup tier's conviction utilities (the math is silently-wrong-vote territory).
- **Coordination obligation**: when this work needs to cross another agent's plan, the coordination note lands in *their* plan file (this hub does not own their decisions). The pattern is established at `signal-pool-yield-wiring/plan.todo.md` § "Coordination — Tier 5 Conviction Wiring".

## Package / Lane Mapping

| Lane | Surface | Status |
|---|---|---|
| `tier_0_audit` | `docs/admin-revamp/audit.md` | completed |
| `tier_1_tokens` | `packages/admin/src/index.css`, `packages/admin/src/styles/admin-m3-tokens.css`, 18 admin/shared `.tsx` rename targets | completed |
| `tier_2_atoms` | `PageHeader`, `MetaStrip`, `AdminTabRail`, `StatusBadge`, `NavigationBar` | completed |
| `tier_3_organisms` | `packages/shared/src/components/Conviction/`, `packages/shared/src/types/conviction.ts` | completed |
| `tier_4_screens` | `views/{Hub,Actions,Garden,Community}/index.tsx` + `GardenWorkspaceContent.tsx` + `garden.utils.ts` + `useGardenWorkspaceController.ts` + `routes/views.tsx` | completed |
| `tier_5_wiring` | `packages/shared/src/utils/conviction/`, `packages/shared/src/hooks/conviction/{useConvictionProposalsForPool,useConvictionWeightAllocator}.ts`, `views/Community/components/{GovernancePanel.tsx,CommunityTab.tsx}` + Garden Members roster | completed |
| `cleanup` | Deferred follow-ups (see [handoffs/claude-cleanup.md](handoffs/claude-cleanup.md)) | ready |

## Risks

- Sibling-agent collisions on `/community` if coordination notes drift — mitigated by mutual `plan.todo.md` updates and the pattern established with `signal-pool-yield-wiring`.
- Conservative `FALLBACK_POOL_CONFIG` in `useConvictionProposalsForPool` produces approximate threshold/accrual values — visible to operators until the pool-config hook lands. Mitigated by clearly-marked TODOs in `derivation.ts` + the in-UI footer note in `GovernancePanel`.
- 21 pre-existing client-homepage tests failing (from commit `0b4a67e8`) — masks fully-green ship-pipeline for admin work; cleanup lane addresses by filing a separate `/audit-then-ship --lens=review` pass.
- "Funded" status in `ConvictionProposalStatus` has no on-chain signal yet — currently always `funded=false`; contract-level matched-funding lands later.
