# Client PWA Design-System Transition Evaluation Plan

## Release Gates

1. Plan integrity: this hub remains a backlog plan until implementation is explicitly started.
2. Shell safety: installed PWA and public browser shell behavior remains split.
3. Token compliance: future implementation introduces no new raw hardcoded duration, easing, color,
   radius, overlay, or primitive palette usage outside audited baseline rules.
4. PWA cohesion: drawer material, status colors, loading motion, media overlays, and routine
   controls read as one Warm Earth field-tool system.
5. Evidence quality: every future stage records visual evidence under `handoffs/qa-evidence/`.
6. Archive readiness: automated gates pass, visual evidence is recorded, and final installed-phone
   PWA signoff is documented.

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | Plan hub exists with `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, `status.json`, and handoff placeholders | system | `plan-hub validate` |
| AC-2 | `state_api` and `contracts` lanes are `n/a`; UI and QA lanes remain authoritative | system | `status.json` |
| AC-3 | Drawer/overlay stage uses token-backed material and spring motion without changing non-target drawer behavior; `ModalDrawer.maxHeight` is treated as an intentional layout fix | `ui` | UI handoff plus before/after screenshots |
| AC-4 | PWA status style map is applied consistently to nav, dashboard, sync/offline, success, and error states | `ui` | UI handoff plus screenshots |
| AC-5 | Splash/loading motion uses spring tokens and preserves layout stability | `ui` | UI handoff plus screenshots |
| AC-6 | Media overlays and upload progress use semantic tokens and maintain contrast over real thumbnails | `ui` | UI handoff plus screenshots |
| AC-7 | Lower-risk controls/cards/forms remove remaining protected-PWA baseline entries, or a human explicitly defers a row, without broad redesign | `ui` | token check, refreshed baseline census, and UI handoff |
| AC-8 | Browser/public shell remains untouched by the PWA migration | `qa_pass_1` | display-mode test output and visual note |
| AC-9 | Final installed-phone PWA smoke passes for AppBar, drawer stacking, offline/sync, splash, media, and work review | `qa_pass_2` | `handoffs/qa-evidence/final-phone-signoff.md` |

## Test Strategy

- Unit and integration:
  - `bun run --filter @green-goods/client test`
  - Existing display-mode tests must continue to protect `AppBar`/`SiteHeader` separation.
  - Existing `TopNav`, `DraftDialog`, `UploadingTab`, `Media`, and route tests should be extended
    only if future implementation changes test-observable behavior.
- Design gates:
  - `bun run check:design-tokens`
  - `bun run lint:vocab`
  - `bun run check:design-generated` for every future implementation stage; run
    `bun run design:generate` only when the check reports stale generated artifacts.
- Build:
  - `bun run --filter @green-goods/client build`
- Visual QA:
  - Capture screenshots or DOM-backed evidence for each future stage.
  - Use the matrix below so each screenshot has a concrete route or Storybook story, state setup,
    viewport/device, and known limitation note.

## Executable Visual QA Matrix

| Stage | Required route or story | State / data setup | Viewport / evidence |
|---|---|---|---|
| Stage 1 - drawers | `/home` with WorkDashboard drawer open; `/home/:id/work/:workId` work approval drawer; `Client/Dialogs/ModalDrawer` `WithTabs`, `LongContent`, and `Mobile`; `TopNav` notification drawer with `maxHeight="60vh"` | Seed or mock an operator garden with pending work, long drawer content, empty notifications, and populated notifications | 375x812 and 390x844 screenshots; include before/after notes for the `maxHeight` behavior fix |
| Stage 2 - status map | `/home`; `Client/PWA/ProtectedSurfaces` `Home` and `OfflineAndSyncStatus`; `Shared/Progress/SyncIndicator` `Gallery`; `Client/Layout/AppBar` `StateCatalog` | Cover pending work, syncing, offline, reconnect needed, success/connected, inactive, error, and notification badge states | 375x812 screenshots plus DOM/class evidence for semantic token classes where screenshots are ambiguous |
| Stage 3 - splash/loading | `Client/Layout/Splash` `Default`, `WithUsernameInput`, `Loading`, `WelcomeState`, `WithError`, and `Mobile`; auth loading path through `RequireAuth` when reachable | Cover unauthenticated, loading, joining garden, username input, passkey/info callout, and error reveal states | 375x812 screenshots and a reduced-motion note; confirm reserved height prevents layout jump |
| Stage 4 - media/upload | `/garden` media step; `Client/PWA/ProtectedSurfaces` `GardenWorkCapture`; `Shared/Progress/SubmissionProgress` `Compressing`, `Uploading`, `Complete`, and `Error` | Use at least one bright outdoor thumbnail, one video thumbnail, compression progress, recording active/stop state, and upload error | 375x812 screenshots plus overlay-contrast note against real thumbnails |
| Stage 5 - controls/cards/forms | `/home`, `/home/:id`, `/profile`; `Client/Cards/ActionCard`; `Client/Cards/DraftCard`; relevant filter/profile/control states | Cover populated and empty garden list, active filters, draft card, action card, accordion, address copy, profile ENS state, and assessment detail states | 375x812 screenshots; include note that routine controls did not gain decorative motion |
| Final PWA signoff | Installed-phone PWA smoke across `/home`, WorkDashboard drawer, `/garden`, `/home/:id/work/:workId`, `/profile`, offline/sync transitions, and AppBar visibility/hiding | Real device or simulator installed-mode run with seeded or real data sufficient to exercise core flows | `handoffs/qa-evidence/final-phone-signoff.md` with device, OS/browser, date, actor, screenshots, and limitations |

## QA Evidence Contract

Future screenshots and notes belong under:

```text
.plans/backlog/client-pwa-design-system-transition/handoffs/qa-evidence/
```

Suggested future files:

- `stage-1-drawers.md`
- `stage-2-status-map.md`
- `stage-3-loading-motion.md`
- `stage-4-media.md`
- `stage-5-controls.md`
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
- Confirm stage screenshots exist under `handoffs/qa-evidence/`.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed.
- Confirm trigger branch exists: `claude/qa-pass-1/client-pwa-design-system-transition`.
- Re-run targeted validation.
- Confirm final installed-phone PWA signoff exists before archive.

## Archive Criteria

This hub can move to `.plans/archive/` only after:

- All five future implementation stages are complete or explicitly marked out of scope by a human.
- Token baseline entries fixed by implementation are removed.
- A refreshed protected PWA baseline census shows zero remaining protected PWA `legacy-runtime`
  rows, or every remaining protected PWA row has a human defer note with rationale and owner.
- Public/browser baseline rows remain deferred to a separate public browser/hero plan and are not
  counted as protected PWA closeout blockers for this hub.
- Automated gates listed above pass.
- Stage visual evidence exists.
- Final installed-phone PWA signoff is recorded.
- `status.json` history records the closeout.
