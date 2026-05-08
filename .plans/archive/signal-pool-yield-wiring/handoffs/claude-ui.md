# Signal Pool Yield Wiring - ui Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `ui`
**Owner**: `claude`
**Status**: `implemented`
**Branch**: `claude/ui/signal-pool-yield-wiring`
**Depends on**: `contracts`, `state_api`

> **Read first**: Tier-5 conviction-voting wiring landed in commit `a8586c26` (sibling work on the same `/community` surface). See `plan.todo.md` → **"Coordination — Tier 5 Conviction Wiring (2026-05-03)"** (right before Problem Statement) for the adjacency map: `GovernancePanel` already mounts in `CommunityTab`'s governance section; both surfaces consume `pools: GardenSignalPool[]` typed; no scope changes to this hub, only "don't duplicate" guardrails + opportunistic pickup notes.

## What Changed

- `packages/admin/src/components/Garden/GardenCommunityCard.tsx`
  - Calls `useGardenYieldWiringState(gardenId as Address)` and renders a yield-wiring
    section above the existing pool rows when `community` is set and `pools.length > 0`.
  - State rendering:
    - `connected` — neutral row with `RiCheckLine` and `app.community.yield.connected`.
    - `missing-resolver-wiring` / `mismatch` — warning row with `RiAlertLine` and a
      `<Link>` to `repairHref` (`/community/governance?gardenAddress=…`) labeled
      `app.community.yield.connectAction`. The link only renders when
      `wiringState.expectedHypercertPoolAddress` is non-zero, so unknown-pool gardens
      never get a reconnect button.
    - `missing-pool` — info row with `app.community.yield.poolNeedsReview`, no link.
    - `readStatus === "unavailable"` — muted hint with `app.community.yield.unavailable`,
      no link.
  - Existing no-pools branch (`Create Signal Pools`) is unchanged. Wiring section is
    suppressed when `pools.length === 0`.
- `packages/admin/src/components/Garden/GardenYieldCard.tsx`
  - Adds optional `gardenAddress?: Address` prop. When set, calls
    `useGardenYieldWiringState(gardenAddress, { enabled: true })`.
  - Shows a compact wiring band immediately under the card header:
    - `missing-resolver-wiring` / `mismatch` (with known expected pool) — warning
      band with deep-link labeled `app.yield.wiring.repairLink` to
      `/community/governance`. No "Connect to yield" button — the yield card never
      duplicates the primary repair UX.
    - `missing-pool` — muted hint with `app.yield.wiring.poolNeedsReview`.
    - `readStatus === "unavailable"` — muted hint with
      `app.yield.wiring.unavailable`.
- `packages/admin/src/views/Community/components/CommunityTab.tsx`
  - Passes `garden.id as Address` to `GardenYieldCard` as `gardenAddress` so wiring
    status surfaces on the Community tab.
- `packages/admin/src/views/Garden/Strategies.tsx`
  - No code change; the rename is purely an i18n value update.
- i18n
  - `packages/shared/src/i18n/{en,es,pt}.json`:
    - `app.conviction.title`: "Conviction Voting" → "Conviction Strategies" (and
      Spanish/Portuguese equivalents) so the operator-facing title disambiguates from
      vault strategies. The same key is consumed by
      `packages/admin/src/views/Community/components/CommunitySheetDescriptor.tsx`,
      so the right-sheet rail entry inherits the new label.
    - New keys (en/es/pt parity):
      - `app.community.yield.connectAction`, `connected`, `connectedDescription`,
        `mismatch`, `notConnected`, `poolNeedsReview`, `unavailable`.
      - `app.yield.wiring.mismatch`, `notConnected`, `poolNeedsReview`, `repairLink`,
        `unavailable`.

## What Remains

- Storybook stories were intentionally not extended for the new wiring states. The
  shared storybook preview already wraps stories in `withQueryClient` + `withI18n`,
  so the new hook call does not blow up at module load — the query simply stays in
  flight without a wagmi config and the wiring section degrades silently. Driving
  different `wiringStatus` values per story would require MSW or per-story hook
  overrides; this lane defers that to a follow-up if visual review demands it.
- This lane does not add a manual resolver repair mutation. `state_api` decided
  against shipping a write hook in this pass; the deep link routes operators back
  into existing `/community/governance` flows.
- `qa_pass_1` and `qa_pass_2` remain blocked on this lane completing.

## TDD Proof

### RED Command/Result

Command:

```bash
cd packages/admin && bun run test -- src/__tests__/components/Garden/GardenCommunityCard.test.tsx src/__tests__/components/Garden/GardenYieldCard.test.tsx src/__tests__/components/Garden/conviction-title.test.tsx
```

Result before implementation:

- Exit: failed as expected (script exit code 1).
- 11 failed / 2 passed (13 total).
- Failures:
  - `GardenCommunityCard.test.tsx` — 6 failures because the component did not yet
    render any `useGardenYieldWiringState`-driven section.
  - `GardenYieldCard.test.tsx` — 2 wiring deep-link tests failed because the
    component had no `gardenAddress` prop and rendered no compact wiring band. The
    existing "derives cumulative totals" test continued to pass (default mock kept
    it green, as planned).
  - `conviction-title.test.tsx` — 3 failures, one per locale, because
    `app.conviction.title` still resolved to "Conviction Voting" / "Votación por
    Convicción" / "Votação por Convicção".

### GREEN Command/Result

Command:

```bash
cd packages/admin && bun run test -- src/__tests__/components/Garden/GardenCommunityCard.test.tsx src/__tests__/components/Garden/GardenYieldCard.test.tsx src/__tests__/components/Garden/conviction-title.test.tsx
```

Result after implementation:

- Exit: passed.
- 13 tests passed across 3 files (0 failed, 0 skipped).
- Coverage:
  - GardenCommunityCard: connected, missing-resolver-wiring, mismatch, missing-pool,
    unavailable, no-pools regression.
  - GardenYieldCard: cumulative totals (existing), wiring deep-link (non-connected),
    missing-pool muted hint, unavailable muted hint.
  - conviction-title: en, es, pt rendering of "Conviction Strategies".

## Validation

- `cd packages/admin && bun run test`
  - Passed: 45 test files, 388 tests, 3 skipped.
- `cd packages/admin && bun run build`
  - Passed (TypeScript type-check + Vite production build, completed in ~22s).
- `cd packages/admin && bun run lint`
  - Passed: oxlint reported 4 warnings, 0 errors. None of the warnings are in
    files this lane touched (they pre-exist in `UserAvatar.stories.tsx`).
- `cd packages/shared && bun run test`
  - Passed: 239 test files, 2898 tests, 1 skipped.
- `bun run lint:vocab`
  - Passed: no banned vocabulary in 3 i18n files.
- `node scripts/harness/plan-hub.mjs validate`
  - Passed: validated 21 feature hubs.
- `bunx @biomejs/biome format <touched files>`
  - Passed: no fixes applied (after a one-time formatter pass).
- `cd packages/shared && bun run check:stories`
  - **Pre-existing failure not from this lane**: fails on
    `admin/views/Community/components/GovernancePanel.tsx — required Storybook
    surface(s) missing real stories`. `GovernancePanel` was added by commit
    `a8586c26` ("feat(shared,admin): conviction-voting wiring + GovernancePanel
    (Tier 5)"); `git diff --name-only HEAD -- ...GovernancePanel.tsx` confirms
    this lane did not touch it. The Tier-5 lane owns that gap.
- `bun run format:check` (root)
  - Not re-run; root format check is already blocked by unrelated dirty files in
    the worktree. Targeted format on owned files (above) is the proof.

### Lane test placement note

`packages/admin/package.json` `test` script excludes `src/__tests__/views/**` from
the default run. The `conviction-title` test was therefore placed under
`__tests__/components/Garden/` to ensure it actually runs in the default suite. A
view-path test would have silently skipped and produced false GREEN evidence.

### Existing test-mock note

The existing `GardenYieldCard.test.tsx` `vi.mock("@green-goods/shared", ...)` block
was extended to default-mock `useGardenYieldWiringState` to
`{ wiringState: undefined, wiringStatus: undefined, repairHref: undefined,
isLoading: false }`. This keeps the original "derives cumulative totals" test green
once the component invokes the hook. Per-test cases override the mock via
`vi.mocked(useGardenYieldWiringState).mockReturnValue(...)`.

## Risks/Blockers

- Storybook stories for the new wiring states are deferred. Visual QA on the
  wiring states currently relies on unit tests; QA pass 1 may want to drive each
  state in a running admin instance against a deployed upgraded resolver/module
  pair to confirm copy + spacing.
- Translations for the new strings are direct equivalents of the English copy;
  they have not been reviewed by a native speaker. Vocab lint passes.
- The hook is invoked unconditionally in `GardenCommunityCard` using
  `gardenId as Address`. If a future caller passes a non-address `gardenId`, the
  query may produce noisy errors. This matches the existing convention used in
  `Strategies.tsx:46` (`useConvictionStrategies(gardenId as Address)`).
- The dirty worktree contains unrelated drift from other lanes/agents. This lane
  did not modify those files; root `bun run format:check` is blocked by them, so a
  targeted format run on owned files is the canonical proof.
