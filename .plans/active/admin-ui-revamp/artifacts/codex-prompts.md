# Codex Dispatch Prompts — Admin Ship Sprint

Copy-paste prompts for `codex exec --full-auto` dispatches during the admin ship sprint.

Reference: `.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`

**Worktree convention** (per `feedback_codex_worktree_env.md`):
- One worktree per lane, branched from current branch.
- Symlink `.env` into each worktree so the contracts / agent packages can read it.
- Validate with `tsc` in the worktree before reporting back.
- `--reasoning` is `config.toml`, **not** a CLI flag.

---

## Lane A — Stories + Focused Tests (dispatch Monday AM, head-start optional Sunday PM)

**Branch:** `codex/admin-layout-stories`
**Scope:** stories and tests only, zero visual styling decisions.

```
You are Codex running as a bounded-deterministic worker in the green-goods monorepo.
Your lane is `codex/admin-layout-stories`. Stories and tests only — no visual
styling decisions. Claude applies visual polish separately.

Scope:
1. Add Storybook stories for missing admin layout shells:
   - packages/admin/src/components/Layout/CanvasLayout.tsx
   - packages/admin/src/components/Layout/AccountSurface.tsx
   - packages/admin/src/components/Layout/AccountProfilePanel.tsx
   - packages/admin/src/components/Layout/AccountSettingsPanel.tsx
   - packages/admin/src/components/Layout/CanvasGardenAccessState.tsx (if present)
   - packages/admin/src/components/Layout/CanvasWorkspaceSelectionState.tsx (if present)
   - packages/admin/src/components/Layout/ConnectShell.tsx
   - packages/admin/src/components/Layout/UserAvatar.tsx
   - packages/admin/src/components/Layout/UserMenu.tsx

2. Add missing shared visual stories:
   - packages/shared/src/components/Canvas/LeftSheet.stories.tsx
   - packages/shared/src/components/Canvas/RightSheet.stories.tsx
   - packages/shared/src/components/Canvas/EmptyStateShell.stories.tsx
   - packages/shared/src/components/Canvas/MetaStrip.stories.tsx
   - packages/shared/src/components/Canvas/WorkbenchList.stories.tsx
   - packages/shared/src/components/Canvas/WorkbenchRow.stories.tsx
   - packages/shared/src/components/DomainBadge.stories.tsx
   Do NOT add a story for packages/shared/src/components/Canvas/LeftSheetContext.tsx — it is non-visual.

3. Every story covers this 7-state matrix: default, hover/focus, disabled,
   loading, empty, error, mobile. If a component does not have a meaningful
   rendering of a state (e.g. UserAvatar has no "loading"), document the omission
   with a comment above the story export.

4. Focused tests:
   - sheet render and close behavior (keyboard + focus trap + Escape)
   - layout shell connected/disconnected and empty/populated states
   - any route hardening extraction completed by a Claude handoff (Day 2+)

Hard constraints:
- Follow CLAUDE.md. Run `bun run test` (NOT `bun test`).
- Barrel imports only from @green-goods/shared.
- No edits to:
  - packages/shared/src/components/Canvas/springConfig.ts
  - packages/shared/src/components/Canvas/{LeftSheet,RightSheet,BottomSheet,MainSheet}.tsx (source files — stories only)
  - any packages/admin/src/views/**/index.tsx
  - .claude/**
  - packages/admin/src/components/Layout/*.tsx (source files — stories only, no prop/variant normalization unless Claude explicitly hands off a file)

Validation before commit:
- bun --cwd packages/shared run build-storybook
- bun --cwd packages/shared run check:stories — the failure count must drop
- bun --cwd packages/admin run test passes
- tsc --noEmit in each touched package

Report back with:
- files added/modified
- normalization flags (components where one-off styling duplicates an existing shell prop — do NOT remove, just flag)
- tests added
- remaining check:stories misses (must be out-of-scope non-visual modules only)

Commit style: conventional commits, scope admin or shared. Never amend.
```

---

## Lane B — Day 1 Triage + GreenWill Phase 0 Readiness

**Branch:** none for triage; `codex/greenwill-phase-0-prep` for deploy script scaffolding if needed.

```
You are Codex, running Day 1 triage + GreenWill Phase 0 readiness for the
admin ship sprint.

Part 1 — Bug triage (read-only writes only to the artifact file below):

Produce `.plans/active/admin-ui-revamp/artifacts/bug-triage-2026-04-20.md`
with one entry per bug for #385, #428, #431.

Per entry:
- link to the GitHub issue (gh issue view)
- suspected files (greps, code reads)
- complexity estimate (S/M/L)
- whether the likely fix conflicts with Claude-owned Day 1/Day 2 files:
  - packages/shared/src/components/Canvas/springConfig.ts
  - packages/shared/src/components/Canvas/{LeftSheet,RightSheet,BottomSheet,MainSheet}.tsx
  - packages/admin/src/components/Layout/*.tsx
  - packages/admin/src/views/{Hub,Garden,Community,Actions}/index.tsx
- first hypothesis for root cause if evident
- NO CODE CHANGES. Triage only.

Part 2 — GreenWill Phase 0 deployment readiness (dry-run; no broadcast):

Produce `.plans/active/admin-ui-revamp/artifacts/greenwill-deploy-readiness-2026-04-20.md`.

Required content:
1. Audit `packages/contracts/script/deploy.ts` — confirm it supports (or needs
   scaffolding to support) a `badge-locks` or similar target for deploying 6
   soulbound Unlock locks via the Unlock factory, and a `badge-schemas` target
   for registering one shared `GreenGoodsBadge` EAS schema UID (per reputation-
   badging D11: distinguished per badge by the attestation `badgeType` field,
   not per-badge schema UID). Reference `.plans/active/reputation-badging/plan.todo.md`
   §0.2 / §0.3 for the exact badge IDs, expirations, and schema shape.

2. Enumerate the 6 badges with decisions per reputation-badging plan:
   - verified-gardener (lifetime, on-event)
   - impact-verified (lifetime, on-event)
   - garden-operator (expiration=0, manager-revoked)
   - active-contributor (expiration=1y)
   - stewardship (lifetime, daily)
   - community-builder (lifetime, daily)

3. Dry-run output: run the deployment path with dry-run / no-broadcast flag
   appropriate to deploy.ts. Paste the dry-run output as a fenced block.
   Do NOT broadcast. Do NOT mutate packages/contracts/deployments/*.json.

4. Current GreenWill UI render path:
   - trace `useGreenWillBadgeDefinitions` / `useGreenWillBadges` /
     `useGreenWillRecentGrants` from shared → indexer query or EAS query or
     Unlock query
   - what do they return today against current Arbitrum state? (likely empty
     or misconfigured — report the actual behavior)
   - empty/loading/error risks worth tightening before demo

Hard constraints:
- Never use raw `forge`. Use `bun script/deploy.ts` workflow per CLAUDE.md.
- Do NOT broadcast anything in this lane.
- Do NOT edit packages/contracts/deployments/42161-latest.json.
- No edits to .claude/**, no edits to the indexer package.

Validation:
- Any new script file compiles via `tsc --noEmit`.
- Dry-run output pasted verbatim into the readiness note.

Report back with:
- both artifacts written
- whether Phase 0 can be broadcast cleanly Day 2, or blockers that must be resolved first
- whether the existing UI will render meaningfully against real deployments (empty-until-issued is acceptable)
```

---

## Lane B — Day 2 Phase 0 Broadcast (dispatch only after Claude signals admin stable)

**Branch:** `codex/greenwill-phase-0-deploy`

```
You are Codex executing GreenWill Phase 0 deployment. Claude has signaled
admin route composition is stable. This is a chain-state-changing operation.

Prerequisites verified:
- Arbitrum RPC env vars present (.env symlinked into this worktree).
- Deployer address funded on Arbitrum.
- Dry-run output from the readiness artifact matches what is about to be broadcast.

Scope:
1. Broadcast 6 soulbound Unlock locks on Arbitrum via the Unlock factory:
   - verified-gardener, impact-verified, garden-operator, active-contributor,
     stewardship, community-builder
   - transferrable=false
   - expirations per readiness note (active-contributor=1y, garden-operator=0,
     others=lifetime)
   - default lock managers sourced from `deploymentDefaults.badgeLockManagers`
2. Register one shared `GreenGoodsBadge` EAS schema per reputation-badging D11
   (distinguish per badge by the `badgeType` field, not per-badge schema UID).
   Schema string: `string badgeType, address recipient, uint40 earnedAt,
   string evidenceUri, uint8 tier`. Resolver `0x0`, `revocable=true`.
3. Record addresses in `packages/contracts/deployments/42161-latest.json` using the
   repo-true deployment-file convention:
   - `unlock.factory`, `unlock.publicLockVersion`, `unlock.managerDefaults`, and
     `unlock.locks.{verifiedGardener,activeContributor,stewardship,gardenOperator,communityBuilder,impactVerified}`
   - `schemas.greenGoodsBadgeSchemaUID` for the shared schema UID, with sibling
     `schemas.greenGoodsBadgeSchema`, `schemas.greenGoodsBadgeName`, and
     `schemas.greenGoodsBadgeDescription` — mirroring the existing
     `schemas.workSchemaUID` / `schemas.workApprovalSchemaUID` /
     `schemas.assessmentSchemaUID` sibling pattern already written by
     `packages/contracts/script/Deploy.s.sol`.
4. Commit: `feat(contracts): deploy GreenWill Phase 0 — 6 soulbound locks + shared GreenGoodsBadge EAS schema on Arbitrum`

Hard constraints:
- Use `bun script/deploy.ts ... --network arbitrum --broadcast` per CLAUDE.md.
- Never raw forge.
- Do NOT touch admin or shared packages.
- Do NOT update the indexer config.
- If any of the 6 deployments fails, STOP and report — do not partial-commit
  mixed-state deployment artifacts.

Validation:
- `bun run build:full` on contracts post-deploy confirms artifacts rebuild.
- Verify each recorded address is a contract on Arbitrum (basic `cast code`
  or equivalent check).
- `packages/contracts/deployments/42161-latest.json` is valid JSON and all 12
  fields are populated with non-zero addresses.

Report back with:
- tx hashes for all 12 broadcasts
- the 12 final addresses
- any gas/cost notes worth flagging
```

---

## Lane B — Day 2/3 Live-Data Validation

**Branch:** `codex/greenwill-live-data-validation`

```
You are Codex validating GreenWill UI against real Phase 0 deployments.
No fixture mode, no new components.

Scope:
1. Confirm `packages/admin/src/views/Actions/GreenWillPanel.tsx` and
   `packages/client/src/views/Profile/Badges.tsx` read from the real deployment
   addresses now recorded in `packages/contracts/deployments/42161-latest.json`.
2. Run the admin and client apps against Arbitrum. Capture the render for each
   of these states:
   - no badges issued yet (expected empty state)
   - a loading flash while queries resolve
   - error state if the EAS/Unlock query fails
3. Tighten only the loading/error/empty messages, copy, or conditional rendering
   that look obviously broken against real data. NO new components. NO visual
   restyling. NO unrelated refactors.
4. Save a validation note at
   `.plans/active/admin-ui-revamp/artifacts/greenwill-live-data-validation.md`
   with screenshots or DOM snapshots per state.

Hard constraints:
- No indexer changes.
- No edits to .claude/**.
- No fixture runtime paths.
- If the real-data render is fundamentally broken (e.g. address mismatch, hook
  returning undefined), STOP and report — do not patch around it.

Validation:
- `bun --cwd packages/admin run test` passes.
- `bun --cwd packages/client run test` passes.

Report back with:
- the validation note path
- files touched (should be minimal: GreenWillPanel.tsx, Badges.tsx, maybe a
  shared hook for loading/error messages)
- any residual issues blocking demo
```

---

## Lane B — Stretch: verified-gardener evaluator (only on Claude re-sequence)

**Branch:** `codex/greenwill-verified-gardener`
**Dispatch only if Claude explicitly approves after admin gates are green.**

```
You are Codex wiring the first GreenWill evaluator against existing garden
onchain data. This is a stretch task — admin must already be shipped.

Scope (from .plans/active/reputation-badging/plan.todo.md §2.1):
1. Create `packages/agent/src/badges/_registry.ts` (if not present) with the
   `BadgeDefinition` interface.
2. Implement `verified-gardener` evaluator: on-event, reads from existing garden
   action completion data on Arbitrum. When a gardener has >=1 accepted work
   submission, grant the verified-gardener Unlock key + write the EAS attestation
   via the trusted attester address.
3. Minimal `greenwillIssuer.ts` main loop: scan existing garden action data,
   identify eligible recipients, issue badges. Idempotency: track issued keys via
   the onchain Unlock lock state, not a side store.
4. Run the issuer once against real Arbitrum state and report how many badges
   were issued.

Hard constraints:
- Do NOT touch the indexer.
- Do NOT add runtime fixture paths.
- Use the trusted attester key from `.env` — no key in source.
- Barrel imports only from @green-goods/shared.
- Logger from shared, not `console.log`.
- If the issuer encounters an error mid-run, STOP and roll back any partial
  state before reporting.

Validation:
- `bun --cwd packages/agent run test` passes.
- `bun --cwd packages/agent run build` passes.
- Issued badges are visible in `GreenWillPanel.tsx` against live data.

Report back with:
- evaluator file path
- issuer file path
- count of badges issued + recipient addresses
- any gas or error events worth flagging
```

---

## Lane C — Hub + Garden Hardening (dispatch per-file only after Claude handoff)

**Branch:** `codex/admin-hub-garden`

```
You are Codex hardening a composed admin route. Claude has committed the route
composition for the specific file being handed off to you — do not edit any
other route file in this lane.

File handed off: <Claude fills in the file path at dispatch time, e.g. packages/admin/src/views/Hub/index.tsx>

Scope:
1. Pull the latest branch state from Claude's composition commit.
2. Extract bounded subcomponents from the handed-off route file. Target: no
   child component should exceed ~300 LOC; natural boundaries include per-tab
   content, per-section panels, per-dialog shells.
3. Wire concrete state handling for:
   - connected / disconnected
   - loading (skeleton or spinner as appropriate)
   - empty (use shared EmptyStateShell if it fits)
   - error (catch + display; use `parseContractError` for contract errors)
   - permission-constrained (hide > dim per D18)
4. Add focused tests per extracted component.

Hard constraints:
- Do NOT change visual styling, padding ownership, shell composition, or spring
  configs. Those are Claude's.
- Do NOT edit files outside the handed-off route file and its new subcomponents.
- Barrel imports only from @green-goods/shared.
- Logger from shared.
- Follow Rules 1–13 in `.claude/rules/react-patterns.md` and TypeScript rules 4, 5, 11, 12.

Validation:
- `bun --cwd packages/admin run test` passes.
- `bun --cwd packages/admin run build` passes.
- `tsc --noEmit` clean.

Report back with:
- extracted subcomponents
- tests added
- any state/permission gaps surfaced during extraction
```

---

## Lane D — Community + Actions Hardening (dispatch per-file only after Claude handoff)

**Branch:** `codex/admin-community-actions`

Same prompt as Lane C, with file path adjusted to `packages/admin/src/views/Community/index.tsx` or `packages/admin/src/views/Actions/index.tsx` at dispatch time.
