# Client PWA Design-System Transition Evaluation Plan

## Release Gates

1. Plan integrity: this hub remains coherent as source implementation moves into QA.
2. Shell safety: installed PWA and public browser shell behavior remains split. The cross-shell
   carve-out for `packages/client/src/styles/typography.css` is the only file allowed to affect
   both shells; that change must include a public-browser smoke verification.
3. Token compliance: implementation introduces no new raw hardcoded duration, easing, color,
   radius, overlay, or primitive palette usage outside audited baseline rules. Helper CSS
   must keep `bun run check:design-tokens` clean.
4. PWA cohesion: heading color foundation, drawer material, status colors, loading motion, media
   overlays, and routine controls read as one Warm Earth field-tool system.
5. Evidence quality: every implementation stage records evidence under `handoffs/qa-evidence/`;
   live screenshot gaps stay explicit until QA closes them.
6. Archive readiness: automated gates pass, visual evidence is recorded, and manual/device proof
   gaps are either documented as complete or explicitly waived by the human owner.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Plan hub exists with `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, `status.json`, and handoff placeholders | system | `plan-hub validate` |
| AC-2 | `state_api` and `contracts` lanes are `n/a`; UI and QA lanes remain authoritative | system | `status.json` |
| AC-3 | Stage 0 readiness gate confirms a refreshed baseline census, clean working tree, cross-shell acknowledgement, and gate-driven regen rule before any source edit | `ui` | UI handoff plus a Stage 0 readiness note in `handoffs/qa-evidence/stage-0-readiness.md` |
| AC-4 | Stage 1 color foundation replaces the global heading override with a token-backed rule, lands the `pwaStatusStyles` helper, and applies it consistently across protected PWA status surfaces; helper keeps `check:design-tokens` clean | `ui` | UI handoff plus screenshots and the public-browser smoke for `/` and `/gardens` |
| AC-5 | Stage 2 drawer/overlay stage uses token-backed material and spring motion without changing non-target drawer behavior; `ModalDrawer.maxHeight` is treated as an intentional layout fix | `ui` | UI handoff plus before/after screenshots |
| AC-6 | Stage 3 loading and media motion uses spring tokens; reduced-motion verification holds for loading; real-media overlay contrast proof is either captured or human-waived | `ui` | UI handoff plus separate loading/media evidence files; local Storybook evidence covers loading/media progress, while the 2026-04-29 human waiver closes the real thumbnail/video proof gap |
| AC-7 | Stage 4 lower-risk controls/cards/forms remove remaining protected-PWA baseline entries, or a human explicitly defers a row, without broad redesign | `ui` | token check, refreshed baseline census, and UI handoff |
| AC-8 | Browser/public shell remains untouched by the PWA migration except for the explicit `typography.css` carve-out, which is verified by the public-browser smoke | `qa_pass_1` | display-mode test output, visual note, and `/`, `/gardens` browser smoke evidence |
| AC-9 | Final installed-phone PWA smoke for AppBar, drawer stacking, offline/sync, splash, media, and work review is either captured or human-waived | `qa_pass_2` | `handoffs/qa-evidence/final-phone-signoff.md` records the 2026-04-29 human waiver |

## Test Strategy

- Unit and integration:
  - `bun run --filter @green-goods/client test`
  - Existing display-mode tests must continue to protect `AppBar`/`SiteHeader` separation.
  - Existing `TopNav`, `DraftDialog`, `PendingTab`, `Media`, and route tests should be extended
    only if implementation changes test-observable behavior.
- Design gates:
  - `bun run check:design-tokens`
  - `bun run lint:vocab`
  - `bun run check:design-generated` for every implementation stage; run
    `bun run design:generate` only when the check reports stale generated artifacts.
- Story gates (run from `packages/shared`):
  - `bun run check:stories`
  - `bun run check:story-quality`
- Build:
  - `bun run --filter @green-goods/client build`
- Visual QA:
  - Capture screenshots or DOM-backed evidence for each implementation stage.
  - Use the matrix below so each screenshot has a concrete route or Storybook story, state setup,
    viewport/device, and known limitation note.
  - Stage 1 must include public-browser smoke for `/` and `/gardens` to verify the cross-shell
    typography.css repair.

## Executable Visual QA Matrix

| Stage | Required route or story | State / data setup | Viewport / evidence |
|---|---|---|---|
| Stage 0 - readiness | None (planning artifacts only) | Refreshed census, clean tree, cross-shell acknowledgement | A short Stage 0 note under `handoffs/qa-evidence/stage-0-readiness.md` recording the readiness check date and outcome |
| Stage 1 - color foundation | PWA: `/home`; `Client/PWA/ProtectedSurfaces` `Home` and `OfflineAndSyncStatus`; `Shared/Progress/SyncIndicator` `Gallery`; `Client/Layout/AppBar` `StateCatalog`. Cross-shell smoke: `/` and `/gardens` in browser mode | Cover pending work, syncing, offline, reconnect needed, success/connected, inactive, error, and notification badge states; capture both shells in light and dark mode for the heading repair | 375x812 PWA screenshots plus DOM/class evidence for semantic token classes; 375x812 public-browser screenshots for `/` and `/gardens` in both light and dark mode |
| Stage 2 - drawers | `/home` with WorkDashboard drawer open; `/home/:id/work/:workId` work approval drawer; `Client/Dialogs/ModalDrawer` `WithTabs`, `LongContent`, and `Mobile`; `TopNav` notification drawer with `maxHeight="60vh"` | Seed or mock an operator garden with pending work, long drawer content, empty notifications, and populated notifications | 375x812 and 390x844 screenshots; include before/after notes for the `maxHeight` behavior fix |
| Stage 3 - loading and media | Loading: `Client/Layout/Splash` `Default`, `WithUsernameInput`, `Loading`, `WelcomeState`, `WithError`, and `Mobile`; auth loading path through `RequireAuth`. Media: `/garden` media step; `Client/PWA/ProtectedSurfaces` `GardenWorkCapture`; `Shared/Progress/SubmissionProgress` `Compressing`, `Uploading`, `Complete`, and `Error` | Loading: cover unauthenticated, loading, joining garden, username input, passkey/info callout, and error reveal states. Media: compression progress, recording active/stop state, upload error, and available media-overlay states | 375x812 screenshots with separate loading and media evidence files; reduced-motion note for loading; note that real bright outdoor thumbnail/video overlay proof was waived by the human owner on 2026-04-29; confirm reserved height prevents layout jump |
| Stage 4 - controls/cards/forms | `/home`, `/home/:id`, `/profile`; `Client/Cards/ActionCard`; `Client/Cards/DraftCard`; relevant filter/profile/control states | Cover populated and empty garden list, active filters, draft card, action card, accordion, address copy, profile ENS state, and assessment detail states | 375x812 screenshots; include note that routine controls did not gain decorative motion |
| Final PWA signoff | Installed-phone PWA smoke across `/home`, WorkDashboard drawer, `/garden`, `/home/:id/work/:workId`, `/profile`, offline/sync transitions, and AppBar visibility/hiding | Real device or simulator installed-mode run with seeded or real data sufficient to exercise core flows, unless human-waived | `handoffs/qa-evidence/final-phone-signoff.md` records the 2026-04-29 human waiver and the proof that remains uncaptured |

## QA Evidence Contract

Future screenshots and notes belong under:

```text
.plans/backlog/client-pwa-design-system-transition/handoffs/qa-evidence/
```

Evidence files:

- `stage-0-readiness.md`
- `stage-1-color-foundation.md`
- `stage-1-browser-smoke.md`
- `stage-2-drawers.md`
- `stage-3-loading.md`
- `stage-3-media.md`
- `stage-4-controls.md`
- `final-phone-signoff.md`

Each evidence note should include:

- Date and actor.
- Route or Storybook story from the visual QA matrix.
- State/data setup used.
- Viewport/device.
- What was verified.
- Known limitations or missing data.
- Screenshot path if a screenshot artifact is committed or attached elsewhere.

## QA Sequence

### Claude QA Pass 1

- Review PWA user experience, visual cohesion, missing requirements, and test gaps.
- Verify the Stage 1 public-browser smoke (`/`, `/gardens`) confirms the typography.css repair
  did not regress browser typography.
- Confirm stage screenshots exist under `handoffs/qa-evidence/`.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm trigger branch exists: `claude/qa-pass-1/client-pwa-design-system-transition`.
- Re-run targeted validation.
- Confirm final installed-phone PWA signoff exists, or that a human waiver is recorded before
  archive.

## Archive Criteria

This hub can move to `.plans/archive/` only after:

- All four implementation stages (Stages 1-4) are complete or explicitly marked out of
  scope by a human; Stage 0 is recorded as run.
- Token baseline entries fixed by implementation are removed.
- A refreshed protected PWA baseline census shows zero remaining protected PWA `legacy-runtime`
  rows, or every remaining protected PWA row has a human defer note with rationale and owner.
- Public/browser baseline rows remain deferred to a separate public browser/hero plan and are not
  counted as protected PWA closeout blockers for this hub. The `typography.css` cross-shell
  exception is documented but does not change this rule.
- Automated gates listed above pass.
- Stage visual evidence exists, including the Stage 1 public-browser smoke.
- Final installed-phone PWA signoff is recorded, or the human owner explicitly waives that proof
  gap in this hub.
- `status.json` history records the closeout.
