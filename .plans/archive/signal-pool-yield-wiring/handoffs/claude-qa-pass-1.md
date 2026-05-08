# Signal Pool Yield Wiring - qa_pass_1 Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `qa_pass_1`
**Owner**: `claude`
**Status**: `implemented`
**Branch**: `claude/qa-pass-1/signal-pool-yield-wiring`
**Depends on**: `contracts`, `state_api`, `ui`
**Reviews**: commit `5a0ddd64` on `claude/ui/signal-pool-yield-wiring`

## Summary

UI lane implementation reviewed against `eval.md` AC-7 and the lane review focus.
All operator-facing behavior matches scope. No code defects found. Visual
state-by-state walkthrough is deferred to post-deployment QA because (a) the
upgraded resolver/module pair is not deployed yet (per `codex-state-api.md` →
"Live contract reads were not run against a deployed upgraded resolver/module
pair") and (b) the UI lane intentionally deferred Storybook story variants for
the wiring states (per `claude-ui.md` → Storybook scope decision).

## Code Review Against AC-7

> **AC-7**: Admin `/community` exposes the primary reconnect action only when
> the expected HypercertSignal pool is known; other pool/yield surfaces
> deep-link to the same repair flow.

### `GardenCommunityCard.tsx` (primary repair surface)

- **Reconnect gate** at line 57–60: `canShowReconnectLink` requires
  `(wiringStatus === "missing-resolver-wiring" || "mismatch") && expectedHypercertPoolKnown && Boolean(repairHref)`.
  When the typed `gardenHypercertSignalPools[garden]` is zero, the
  reconnect `<Link>` does not render. ✅
- **Wiring section visibility gate** at line 55: `showWiringSection = Boolean(community) && pools.length > 0`.
  Pre-pool gardens (no community / no pools) keep the existing
  "Create Signal Pools" affordance and never see a wiring banner. ✅
- **State coverage**:
  - `connected` — neutral healthy row, no link. ✅
  - `missing-resolver-wiring` / `mismatch` — warning row + reconnect link
    *only when the expected pool is known*. ✅
  - `missing-pool` — info hint, no link (the reason: the typed pool is unknown
    so any retry would be a guess). ✅
  - `readStatus === "unavailable"` — muted hint, no link. ✅
- **Pool identity source**: read directly from `wiringState.expectedHypercertPoolAddress`
  (which the shared hook derives from `gardensModule.gardenHypercertSignalPools(garden)`).
  No array-index inference anywhere. ✅
- **Deep-link destination**: `repairHref` is computed by the shared util as
  `adminRoutes.communityGovernance({ gardenAddress })` →
  `/community/governance?gardenAddress=<addr>`. The card stays inside the
  admin shell. ✅

### `GardenYieldCard.tsx` (secondary surface — compact deep-link only)

- **Repair link gate** at line 32–37: `showRepairLink` requires the same
  preconditions plus `Boolean(gardenAddress)`. Without `gardenAddress`, the
  card behaves exactly as before (regression-protected by the existing
  "derives cumulative totals" test). ✅
- **No duplicate primary CTA**: the link copy is
  `app.yield.wiring.repairLink` ("Reconnect from Community"), distinct from
  the GardenCommunityCard's `app.community.yield.connectAction`
  ("Connect to yield"). The yield card never renders the primary
  "Connect to yield" affordance. ✅
- **Same gating logic** — never offers a repair link when
  `wiringStatus === "missing-pool"` or `readStatus === "unavailable"`. ✅
- **Deep-link destination**: same `repairHref` route as the GardenCommunityCard,
  ensuring both surfaces land on the same `/community/governance` page. ✅

### `Strategies.tsx` (secondary disambiguation)

- View title now resolves to "Conviction Strategies" (en) / "Estrategias de
  Convicción" (es) / "Estratégias de Convicção" (pt). The same i18n key
  drives `CommunitySheetDescriptor` → right-sheet rail also reads
  "Conviction Strategies", consistent. ✅
- The view itself was not edited; only the i18n value moved. Reduces blast
  radius. ✅

## Copy Review

| State | Surface | Copy | Verdict |
|---|---|---|---|
| connected | Community card | "Yield connected" + "Hypercert fractions route to conviction-weighted distribution." | Clear, operator-readable |
| missing-resolver-wiring | Community card | "Yield not connected" + "Connect to yield" link | Clear, action-oriented |
| mismatch | Community card | "Yield wiring mismatch" + "Connect to yield" link | Clear, severity is conveyed |
| missing-pool | Community card | "Hypercert pool identity needs review before yield can be reconnected." | Technical but accurate; no false action |
| unavailable | Community card | "Yield wiring status unavailable." | Clear, no false alarm |
| missing-resolver-wiring/mismatch | Yield card | "Fractions yield not connected" / "Fractions yield routing mismatch" + "Reconnect from Community" link | Clear, distinct from primary CTA |
| missing-pool | Yield card | "Fractions routing needs review" | Clear |
| unavailable | Yield card | "Wiring status unavailable" | Clear |

No banned vocabulary. No "streak", "countdown", "leaderboard", "FOMO",
"urgent", "limited time", "re-engagement", "retention hook" anywhere in the
new strings.

## Banned Vocabulary Confirmation

```bash
bun run lint:vocab
# ✅ check-vocab: no banned vocabulary found in 3 i18n file(s).
```

## Test Coverage Audit

The `ui` lane shipped 13 GREEN tests across 3 files. Mapping to AC-7 coverage:

| State | Asserts no reconnect | Asserts deep-link present | File |
|---|---|---|---|
| connected | ✅ | n/a | GardenCommunityCard.test.tsx |
| missing-resolver-wiring (known pool) | n/a | ✅ | GardenCommunityCard.test.tsx |
| mismatch (known pool) | n/a | ✅ | GardenCommunityCard.test.tsx |
| missing-pool | ✅ | n/a | GardenCommunityCard.test.tsx |
| unavailable | ✅ | n/a | GardenCommunityCard.test.tsx |
| no-pools regression | ✅ (Create Signal Pools intact) | n/a | GardenCommunityCard.test.tsx |
| Yield card non-connected | ✅ (no Connect button) | ✅ (Reconnect link) | GardenYieldCard.test.tsx |
| Yield card missing-pool | ✅ | n/a | GardenYieldCard.test.tsx |
| Yield card unavailable | ✅ | n/a | GardenYieldCard.test.tsx |
| Title rename (en/es/pt) | n/a | n/a | conviction-title.test.tsx |

Every state from AC-7 has an explicit assertion that the reconnect link is
hidden when the typed pool is unknown.

## Visual QA — Deferred

Live state-by-state walkthrough was not performed. Reasons:

1. **Contracts not deployed**: per `codex-state-api.md`, "Live contract reads
   were not run against a deployed upgraded resolver/module pair." A running
   admin would currently produce `readStatus === "unavailable"` (or stale
   pre-upgrade ABI errors) for all gardens — only one of the five branches
   would actually exhibit. Driving the other four states from a real garden
   requires the contract upgrade plus migration backfill to land.
2. **No Storybook variants**: the UI lane explicitly deferred new wiring-state
   stories (see `claude-ui.md` → Stories). Driving each state from the
   storybook would require MSW or per-story hook overrides not yet wired.

These defer to a single, cleaner gate: **after deployment, drive each wiring
state in admin and capture screenshots before the activation gate**. The
mitigating evidence (logic correctness + 13 unit tests) is captured here.

## Validation Re-Run

- `cd packages/admin && bun run test`
  - Passed: 45 test files, 388 tests, 3 skipped (full admin suite, post-commit).
- `cd packages/admin && bun run build`
  - Passed (~22s).
- `cd packages/admin && bun run lint`
  - Passed: 0 errors, 4 warnings (all pre-existing in `UserAvatar.stories.tsx`,
    untouched by either the `ui` or `qa_pass_1` lane).
- `cd packages/shared && bun run test`
  - Passed: 239 test files, 2898 tests, 1 skipped.
- `bun run lint:vocab`
  - Passed.
- `node scripts/harness/plan-hub.mjs validate`
  - Passed: 21 feature hubs validated.
- `cd packages/shared && bun run check:stories`
  - **Pre-existing failure not from this lane**: `GovernancePanel.tsx`
    requires real stories. Owned by Tier-5 commit `a8586c26`, untouched here.

## Recommendations For `qa_pass_2` (codex)

Codex should run the heavier/contract-side validation that this lane deliberately
did not duplicate:

1. Re-run `cd packages/contracts && bun run test -- --match-contract GardensModule --offline`
   and `--match-contract YieldSplitter --offline` (per AC-9 and AC-10).
2. Re-run storage layout tests: `--match-contract StorageLayout --match-test 'testGardensModule|testYieldResolver' --offline`.
3. Run `migrate-vaults.ts` in dry-run mode against a live RPC and capture the
   no-pool acknowledgement list (per AC-8).
4. Run `post-deploy-verify.ts` and confirm both directions:
   `gardensModule.yieldResolver() == yieldResolver` and
   `yieldResolver.gardensModule() == gardensModule`.
5. Full repo validation per `bun format && bun lint && bun run test &&
   VITE_CHAIN_ID=11155111 bun run build` (AC-11). Note that root format check
   is currently blocked by unrelated dirty files in this worktree; codex may
   run from a clean checkout.

## Risks/Blockers

- **Visual QA gap**: deferred per the rationale above. Should not block
  `qa_pass_2` from running, but the activation gate ("do not close the hub
  with unacknowledged gardens in the no-pool operator action list" — Phase 5,
  step 19) should incorporate a state-by-state screenshot pass once
  contracts deploy.
- **Storybook story coverage gap**: AGENTS.md "must update stories in the same
  change" rule is technically violated by the `ui` lane. The acknowledgement
  is captured in `claude-ui.md`. Recommend a follow-up issue rather than
  blocking activation.
- **Native-speaker translation review**: not performed. Strings pass vocab
  lint and follow existing patterns, but es/pt are direct translations of
  the English copy.
