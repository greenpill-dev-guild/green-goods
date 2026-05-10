# Client PWA Native Feel Remediation Plan

**Feature Slug**: `client-pwa-audit`
**Stage**: `active`
**Status**: `DONE`
**Last Updated**: `2026-05-10`
**Target**: unset; when chosen, update this file and `status.json.workflow.target_date`.

## Research / Plan Gate

- [x] Preserve existing audit evidence in `findings.md` and `lanes/`.
- [x] Preserve Wave 1 as complete in `session-state.md`.
- [x] Lock next remediation slice: native installed PWA coherence.
- [x] Record architecture decision: migrate PWA drawer behavior toward one shared gesture-capable sheet contract.
- [x] Keep this update plan-hub-only; runtime implementation starts in later stacked slices.

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Transactional PWA toasts localize via existing factories | `ui` | Wire React callsites and provider-ref event callbacks | Ready |
| One gesture-capable sheet contract covers PWA drawers | `ui` | Adapt shared sheet behavior into a PWA-compatible API | Ready |
| WorkDashboard no longer hand-rolls the drawer pattern | `ui` | Migrate WorkDashboard to the shared sheet API | Ready |
| Raw PWA Radix dialogs are removed from DraftDialog and Gardeners member detail | `ui` | Migrate to canonical dialog/sheet path | Ready |
| Reduced-motion users do not wait on JS close timers | `ui` | Mirror shared sheet reduced-motion timing behavior | Ready |
| Route motion can express forward/back/fade | `ui` | Add typed route-transition helper or callsite convention | Ready |
| Haptics respect shared user preference | `ui` | Replace direct vibration calls and add Profile toggle | Ready |
| Remaining PWA aria labels are localized | `ui` | Lift labels/status strings into `en`, `es`, and `pt` | Ready |
| PWA routing docs match live loaders | `ui` | Update `DESIGN.pwa.md` wording | Ready |
| Mobile proof covers native feel | `qa_pass_1`, `qa_pass_2` | Verify drag, safe area, AppBar overlap, route direction, and reduced motion | Completed with proof limits |

## Lane Checklists

### UI / Shared PWA Implementation (`claude/ui/client-pwa-audit`)

- [x] Start from `handoffs/claude-ui.md`.
- [x] Add RED proof for static toast preset callsites and reduced-motion drawer delay.
- [x] Wire PWA transactional toasts through localized factories without changing toast IDs.
- [x] Establish the shared PWA sheet API and tests before migrating consumers.
- [x] Migrate current drawer consumers and WorkDashboard to the sheet API.
- [x] Migrate `DraftDialog` and Gardeners member detail off raw Radix.
- [x] Replace direct `navigator.vibrate` calls with shared haptic helpers.
- [x] Add a localized Profile haptics preference control.
- [x] Add typed route-transition usage for forward/back/fade flows.
- [x] Lift remaining hardcoded PWA aria/status labels to `en`, `es`, and `pt`.
- [x] Correct `packages/client/DESIGN.pwa.md` routing wording.
- [x] Record GREEN proof with targeted tests and `record-tdd`.

### State / API

- [ ] No separate state/API lane is planned.
- [ ] If implementation discovers shared state shape changes beyond toast/haptics helpers, reopen this lane before coding those changes.

### Contracts

- [ ] No contracts lane is planned.

### QA Pass 1 (`claude/qa-pass-1/client-pwa-audit`)

- [x] Review UI behavior, design-system fit, localization, accessibility, and native-feel quality.
- [x] Run mobile viewport/browser proof for drag-to-dismiss, focus behavior, safe-area spacing, AppBar overlap, route transition direction, haptics toggle, and reduced motion.
- [x] Confirm public browser and admin surfaces were not pulled into scope.
- [x] Write `handoffs/claude-qa-pass-1.md`.

### QA Pass 2 (`codex/qa-pass-2/client-pwa-audit`)

- [x] Start after QA Pass 1 completes.
- [x] Re-run targeted tests and design gates.
- [x] Re-check `status.json` and handoff evidence.
- [x] Confirm proof limits are explicit before closeout.
- [x] Write `handoffs/codex-qa-pass-2.md`.

## Validation

- Plan hub: `node scripts/harness/plan-hub.mjs validate`
- Targeted tests: client presentation-mode routing, display mode, PWA status styles, drawer styles, shared PWA utilities, and sheet orchestration
- New component tests: localized toast factories/callsites, sheet drag dismissal, reduced-motion immediate close, focus trap, Escape/backdrop close
- Design gates: `bun run check:design-generated`, `bun run check:design-tokens`, `bun run lint:vocab`, shared `bun run check:stories`, shared `bun run check:story-quality`
- Manual/mobile proof: drag feel, safe-area spacing, AppBar overlap, route transition direction, haptics toggle, reduced-motion snap behavior
