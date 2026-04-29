# Client PWA Design-System Transition Spec

## Summary

Migrate the installed client PWA from tracked legacy runtime styling to the Warm Earth
design-system token model. The migration target is not visual sameness. The target is better
cohesion: a clean color foundation (foreground ink for headings, scoped green accent), consistent
PWA drawers, consistent status colors, token-backed motion, reliable media overlays, and lower-risk
cleanup across controls, cards, and forms. Stage 0 through Stage 4 source implementation, local
QA evidence, and automated validation are now complete. On 2026-04-29, the human owner waived
final installed-phone signoff and real media thumbnail/video overlay proof as archive blockers.

## Users

- Primary: gardeners using the installed PWA in the field to review garden context, submit work,
  capture media, and monitor sync/offline state.
- Secondary: operators who occasionally use protected PWA work-review surfaces from mobile.
- Maintainers: engineers and agents implementing future staged commits against a stable repo plan.

## Current-State Evidence

- `packages/client/DESIGN.pwa.md` defines the installed PWA as a mobile field tool with Inter,
  bottom `AppBar`, `SyncStatusBar`, offline behavior, and no browser `SiteHeader`.
- `packages/client/src/routes/PlatformRouter.tsx` routes installed mode to `/home`; browser mode
  routes to `/gardens`.
- `packages/client/src/routes/AppShell.tsx` owns the protected PWA shell and renders `AppBar`,
  `OfflineIndicator`, `JobQueueProvider`, and `WorkProvider`.
- `packages/client/src/routes/PublicShell.tsx` owns the public browser shell and renders
  `SiteHeader`.
- `packages/client/src/__tests__/components/display-mode.test.tsx` already protects the
  browser/PWA chrome split.
- `packages/client/src/styles/typography.css` lines 4-10 set `--color-header-text` to
  `rgb(var(--green-900))` (light) and `rgb(var(--green-200))` (dark); line 23 globally applies
  it to all `h1`-`h6`. This global heading override is the likely root cause of dark-mode
  green-on-green drift and must move to ink/foreground tokens. Because the file is global client
  CSS, the repair affects both PWA and public browser surfaces.
- `scripts/data/design-token-usage-baseline.tsv` tracks current client `legacy-runtime` entries.
  After the Stage 4 pass, no protected PWA client rows remain. The only current client rows are
  deferred public/browser `Hero.tsx` rows (`15`, `16`, `96`, `97`), which remain out of scope for
  this PWA hub.
- `packages/shared/src/styles/theme.css` exposes the runtime tokens this migration must use:
  `--spring-*`, `--color-*`, `--color-material-*`, `--blur-material-*`, `--radius-*`,
  `--color-overlay`, `--primary-action`, and semantic state colors. `primary-action` is the darker
  text-bearing CTA token for protected PWA controls; `success-*` is reserved for resolved states.
- `.claude/skills/design/language.md` and `.claude/skills/design/client-prompt-contract.md`
  establish the PWA motion, material, and client dialect rules.

## Fixed Product Decisions

1. Outcome is better PWA cohesion, not token parity only.
2. Future delivery is one focused commit per stage.
3. Existing PWA bottom-sheet behavior is retained and standardized; do not migrate the drawer
   system wholesale to `DialogShell`.
4. Public browser hero work is out of scope and belongs in a separate future plan.
5. Visual QA requires screenshots for each stage plus explicit documentation of any human-waived
   manual/device proof gaps.
6. Archive readiness requires automated gates, recorded visual evidence, a zero in-scope protected
   PWA baseline, and either completed or human-waived manual/device proof gaps.
7. No public API or type changes are planned by this migration hub.
8. The global heading override in `packages/client/src/styles/typography.css` is in scope as a
   color-foundation repair. Because the file is global client CSS, the repair has cross-shell
   side effects and requires public-browser smoke verification (`/` and `/gardens`) in addition to
   the PWA visual QA suite.
9. Helper CSS or helper modules introduced by this hub must keep `bun run check:design-tokens`
   clean. Raw color, motion, radius, or primitive palette values are not allowed in helper CSS
   that the design-tokens gate skips.

## Semantic Token Decisions

Use this status mapping consistently across the protected PWA:

| Meaning | Token Direction | Notes |
|---|---|---|
| Work, pending review, active nav, garden value flow | `primary-*` | Do not map pending work to `success`. |
| Syncing, upload/network activity, informational progress | `information-*` | Replaces primitive blue classes. |
| Offline, pending upload, reconnect needed | `warning-*` | Offline should be calm, not error-red. |
| Completed, connected, eligible, satisfied requirement | `success-*` | Use only when the state is actually resolved/connected. |
| Error, rejected, remove, destructive, recording danger | `error-*` | Replace primitive red utilities. |
| Inactive, unavailable, not connected | neutral text/stroke tokens | Avoid color-only meaning. |
| Media overlay foreground | `static-white` | Use over token overlay or media, not semantic body text. |
| Heading text (`h1`-`h6`) | foreground/ink token | Replace the global green heading override; preserve scoped green only where the design language explicitly intends an accent. |
| Text-bearing CTA on protected PWA surfaces | `primary-action` | Darker than the surface accent green; reserved for buttons/actions that read as text on color. |

Motion mapping:

- Drawer/sheet movement: `--spring-spatial` or `--spring-spatial-slow`.
- Button press, tap feedback, and micro movement: `--spring-spatial-fast`.
- Overlay fades, color changes, focus rings, hover, and blur/material transitions:
  `--spring-effects` or `--spring-effects-fast`.
- Loading indicators, progress bars, and ambient pulse: `--spring-effects-slow`.
- Do not add hardcoded `duration-*`, raw `cubic-bezier`, primitive palette classes, raw hex,
  raw `rgba`, or raw radius literals.

Material mapping:

- Drawer and dialog overlays: `--color-overlay` plus `--blur-material-thick`.
- Text-dense drawer/dialog surfaces: `--color-material-thick` or solid token fallback.
- Standard cards and panels: existing semantic background/stroke tokens unless a material layer
  has a clear purpose.
- Media preview overlays: token overlay plus `static-white` foreground.

Helper module direction:

- Stage 1 introduces a client-internal `pwaStatusStyles` helper exporting class sets for
  `primary`, `information`, `warning`, `success`, `error`, and `neutral` PWA status meanings.
- The helper lives in `packages/client/src` (not in shared) and emits Tailwind class names that
  resolve to existing tokens in `packages/shared/src/styles/theme.css`.
- The helper does not introduce new tokens, raw color, or raw motion that bypass
  `bun run check:design-tokens`.

## Cross-Shell Carve-Out

`packages/client/src/styles/typography.css` is the only file in this hub's scope that intentionally
crosses the PWA/browser shell split. It is imported via global client CSS, so any change to its
global `h1`-`h6` color rule affects every route — both the protected PWA and the public browser
surfaces.

This hub accepts that cross-shell impact for one specific repair: replacing the green heading
override with a foreground/ink token-backed rule. Public browser hero, `SiteHeader`, public garden
browse/detail pages, and editorial browser treatment remain out of scope for this hub.

The cross-shell repair must be verified with both the PWA visual QA suite and a focused
public-browser smoke that captures `/` and `/gardens` at 375x812 in light and dark mode. If the
smoke surfaces any browser-side regression, the smoke evidence must record the regression
explicitly rather than silently absorb it into PWA evidence.

## Functional Requirements

1. Preserve the installed PWA shell contract.
   - `PlatformRouter` remains display-mode based.
   - `AppShell` plus bottom `AppBar` remains the protected PWA shell.
   - Browser/public routes remain on `PublicShell` plus `SiteHeader`.

2. Plan a staged migration that future implementers can execute without re-deciding scope.
   - Stage 0: Plan readiness gate (artifacts only; no source edits).
   - Stage 1: Color foundation (typography.css heading repair plus the `pwaStatusStyles` helper
     applied to protected PWA status surfaces).
   - Stage 2: Drawer and overlay surfaces (material/motion).
   - Stage 3: Loading and media motion (splash/login plus `/garden` media overlays and upload
     progress; preserve distinct reduced-motion and overlay-contrast checks).
   - Stage 4: Lower-risk controls, cards, and forms.

3. Keep implementation scoped to protected PWA runtime files, with one explicit cross-shell
   exception.
   - Public browser files remain out of scope except for `packages/client/src/styles/typography.css`,
     which is global client CSS and is repaired in Stage 1. The repair requires public-browser
     smoke verification on `/` and `/gardens`.
   - Shared source changes require explicit justification if a client-internal helper is not
     sufficient.

4. Define visual QA as a required part of the implementation contract.
   - Stage screenshots are recorded in `handoffs/qa-evidence/`.
   - Stage 1 visual QA includes the public-browser smoke for `/` and `/gardens` to verify the
     global heading repair did not regress browser typography.
   - Stage 3 preserves separate reduced-motion verification (loading) and overlay-contrast-over-
     real-thumbnails verification (media); the real-thumbnail/video overlay proof gap was waived
     by the human owner on 2026-04-29.
   - Final installed-phone signoff was waived by the human owner on 2026-04-29.

5. Keep design-system validation tied to repo gates.
   - Token usage baseline entries must be removed only when implementation actually fixes
     the corresponding raw usage.
   - `bun run check:design-generated` runs for every implementation stage because the generated
     client PWA token audit is sourced from `packages/client/src`; regenerate generated artifacts
     only when that check proves drift.
   - Helper modules introduced by Stage 1 must keep `bun run check:design-tokens` clean.

## Protected PWA Baseline Census

The current `legacy-runtime` client baseline must be treated as an implementation checklist, not
only as background evidence. Future owners must refresh this census before editing source files,
then remove baseline rows only after the corresponding raw usage is fixed.

Public/browser rows are included here so they are intentionally deferred rather than accidentally
left ambiguous. They remain out of scope for this PWA hub.

Rows below reflect the current output of
`rg -n "packages/client/src" scripts/data/design-token-usage-baseline.tsv` after the 2026-04-28
Stage 4 controls/forms pass. `fixed in Stage N` means the corresponding row was removed from the
TSV only after the raw usage was actually eliminated. `semantic target` means the file had no
current TSV row but remained in scope for behavior/status consistency.

`packages/client/src/styles/typography.css` does not have a `legacy-runtime` baseline row because
it used token references rather than raw literals — but it was the source of dark-mode green-on-
green heading drift and was treated as a foundation file in Stage 1.

| Baseline file | Baseline rows | Stage assignment | Required treatment |
|---|---:|---|---|
| `packages/client/src/styles/typography.css` | foundation file (no TSV row) | Stage 1 - complete | Global green heading rule replaced with foreground/ink token; verified with PWA Storybook and public browser smoke. |
| `packages/client/src/components/Communication/Progress/Progress.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Form progress status now uses `pwaStatusStyles`. |
| `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` | fixed/semantic target (no current TSV row) | Stage 1 - complete; Stage 2 - complete | Conviction/eligibility/yield status colors now use `pwaStatusStyles`; drawer material behavior is covered through the shared `ModalDrawer` Stage 2 treatment. |
| `packages/client/src/components/Navigation/Tabs/StandardTabs.tsx` | fixed/semantic target (no current TSV row) | Stage 1 - complete | Tab active/count/loading state now uses `pwaStatusStyles` and token-backed transition styles. |
| `packages/client/src/components/Navigation/TopNav.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Nav status map, badge/focus states, and notification entry point now use `pwaStatusStyles`. |
| `packages/client/src/routes/RequireAuth.tsx` | semantic target (no current TSV row) | Stage 1 - complete | Auth loading spinner color now uses `pwaStatusStyles`. |
| `packages/client/src/styles/animation.css` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Work-confirmed/status animation color projection now uses existing `--color-primary-alpha-*` aliases without adding a new gradient baseline hit or raw primary alpha. |
| `packages/client/src/views/Home/Garden/Notifications.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Pending-review notification status/action styling now uses `pwaStatusStyles` and token-backed transitions. |
| `packages/client/src/views/Home/index.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Home filter icon/focus/badge state now uses `pwaStatusStyles`. |
| `packages/client/src/views/Home/WalletDrawer/Icon.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Wallet drawer icon state and badge contrast now use `pwaStatusStyles`. |
| `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Draft destructive/status icon color now uses `pwaStatusStyles`; broader draft card treatment remains Stage 4 only if future baseline drift reappears. |
| `packages/client/src/views/Home/WorkDashboard/Icon.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Work dashboard status map and focus/icon states now use `pwaStatusStyles`. |
| `packages/client/src/views/Home/WorkDashboard/PendingTab.tsx` | fixed in Stage 1 (no current TSV row) | Stage 1 - complete | Pending sync/review status badges now use `pwaStatusStyles`. |
| `packages/client/src/components/Cards/Base/Card.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Routine card press/motion now uses spring-token transition classes. |
| `packages/client/src/components/Cards/Work/DraftCard.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Draft card warning surface and motion now use radius/spring token classes. |
| `packages/client/src/components/Dialogs/DraftDialog.tsx` | fixed in Stage 2 (no current TSV row) | Stage 2 - complete | Overlay, content motion, close control, and material cleanup now use `pwaDrawerStyles`/`pwaStatusStyles`. |
| `packages/client/src/components/Dialogs/ModalDrawer.tsx` | fixed in Stage 2 (no current TSV row) | Stage 2 - complete | Bottom-sheet overlay, material surface, close timing, and `maxHeight` behavior are token-backed. |
| `packages/client/src/components/Errors/AppErrorBoundary.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Error recovery button motion now uses spring-token transition classes. |
| `packages/client/src/components/Features/Garden/Gardeners.tsx` | fixed in Stage 4 (no current TSV row) | Stage 2 - complete; Stage 4 - complete | Dialog overlay/close chrome fixed in Stage 2; member controls now use token radius/focus/motion classes. |
| `packages/client/src/components/Inputs/Clipboard/AddressCopy.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Small control motion/focus cleanup now uses token radius, spring effects, and `pwaStatusStyles`. |
| `packages/client/src/components/Inputs/PullToRefresh.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Pull-to-refresh indicator motion now uses spatial spring tokens. |
| `packages/client/src/components/Layout/Hero.tsx` | `15`, `16`, `96`, `97` | Deferred browser/public | Explicitly out of scope; belongs with public browser hero plan. |
| `packages/client/src/components/Layout/Splash.tsx` | fixed in Stage 3 (no current TSV row) | Stage 3 - complete | Splash/login loading motion and reveal stability now use spring-token transition classes; Storybook reduced-motion screenshot evidence is recorded. |
| `packages/client/src/views/Garden/Media.tsx` | fixed in Stage 3 (no current TSV row) | Stage 3 - complete | Media overlays, requirement badge, recording state, static foreground, and compression progress now use `pwaStatusStyles`, token overlay, and spring tokens; real-thumbnail/video contrast proof was waived by the human owner on 2026-04-29. |
| `packages/client/src/views/Garden/index.tsx` | semantic target (no TSV row) | Stage 3 - complete | Media action-bar image/camera/mic/stop icons now use `pwaStatusStyles` token classes. |
| `packages/client/src/views/Home/Garden/Assessment.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Assessment evidence/document/status links now use `pwaStatusStyles.primary.text`. |
| `packages/client/src/views/Home/Garden/Work.tsx` | fixed in Stage 2 (no current TSV row) | Stage 2 - complete | Work approval drawer overlay, feedback drawer material/motion, action bar material, and close behavior now use `pwaDrawerStyles`. |
| `packages/client/src/views/Home/GardenFilters/index.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Filter option button motion/selected state now uses spring tokens and `pwaStatusStyles`. |
| `packages/client/src/views/Home/WorkDashboard/index.tsx` | fixed in Stage 2 (no current TSV row) | Stage 2 - complete | Work dashboard bottom-sheet overlay/material and close timing now use `pwaDrawerStyles`. |
| `packages/client/src/views/Login/components/LoadingSplash.tsx` | fixed in Stage 3 (no current TSV row) | Stage 3 - complete | Loading splash motion and spinner color now use spring tokens and `pwaStatusStyles`. |
| `packages/client/src/views/Profile/ENSSection.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | ENS success/status icon now uses `pwaStatusStyles.success.icon`. |
| `packages/client/src/views/Profile/GardensList.tsx` | fixed in Stage 4 (no current TSV row) | Stage 4 - complete | Profile garden refresh control now uses token radius, spring effects, and `pwaStatusStyles` focus. |

## Stage Mapping

### Stage 0 - Plan Readiness Gate

This is a planning-only stage. No source files are edited.

Required actions:

- Refresh the protected PWA baseline census above before any source edit. If baseline line numbers
  or files have changed since the last update, update this spec.
- Confirm the working tree is clean, or that any local diff is intentionally scoped to this hub.
  Stash unrelated drift; do not absorb broad shared/admin/product changes into this migration.
- Confirm the cross-shell carve-out for `typography.css` is acknowledged by the implementer.
- Confirm `bun run check:design-generated` is the gate that triggers `bun run design:generate` —
  do not regenerate artifacts proactively.

Exit criteria:

- Census refreshed.
- Working tree confirmed clean or intentionally scoped.
- Stage 1 implementer is ready to start with no surprise drift.

### Stage 1 - Color Foundation

Primary targets:

- `packages/client/src/styles/typography.css`
- `packages/client/src/components/Navigation/TopNav.tsx`
- `packages/client/src/components/Navigation/Tabs/StandardTabs.tsx`
- `packages/client/src/views/Home/WorkDashboard/Icon.tsx`
- `packages/client/src/views/Home/WorkDashboard/PendingTab.tsx`
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` (status portions only)
- `packages/client/src/components/Communication/Progress/Progress.tsx`
- `packages/client/src/styles/animation.css`
- `packages/client/src/routes/RequireAuth.tsx`
- `packages/client/src/views/Home/index.tsx`
- `packages/client/src/views/Home/WalletDrawer/Icon.tsx`
- `packages/client/src/views/Home/Garden/Notifications.tsx`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` (status portions only)

Planned direction:

- Replace the global green heading rule in `typography.css` with a foreground/ink token rule.
- Add a client-internal `pwaStatusStyles` helper exporting class sets for `primary`,
  `information`, `warning`, `success`, `error`, and `neutral`.
- Apply the helper to protected PWA status surfaces above.
- Preserve bright primary green for active nav, pending work, badges, progress, and value flow.
- Use `primary-action` for text-bearing CTAs that read as text-on-color.
- Capture cross-shell smoke screenshots for `/` and `/gardens` after the typography.css repair.

Risks:

- Cross-shell typography.css edit could regress public browser pages; the public-browser smoke
  for `/` and `/gardens` is the mitigation gate.
- Mapping pending work to `success` would falsely imply completion.
- Helper CSS that bypasses `check:design-tokens` is forbidden.

### Stage 2 - Drawer And Overlay Surfaces

Primary targets:

- `packages/client/src/components/Dialogs/ModalDrawer.tsx`
- `packages/client/src/views/Home/WorkDashboard/index.tsx`
- `packages/client/src/components/Dialogs/DraftDialog.tsx`
- `packages/client/src/views/Home/Garden/Work.tsx`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` (drawer portions only)
- `packages/client/src/components/Features/Garden/Gardeners.tsx` (dialog portions only)

Planned direction:

- Apply token-backed overlay and material styles to the existing PWA drawer pattern.
- Align close timing to the active spring token rather than hardcoded `300`.
- Treat `ModalDrawer.maxHeight` as an intentional layout behavior fix if still present; preserve
  focus traps, escape handling, body scroll lock, and other drawer semantics.
- Add a client-internal drawer style helper or constants module only if it reduces duplication
  across `ModalDrawer` and `WorkDashboard`.

Risks:

- Overlay opacity/material changes can make dense drawer content feel too light or too heavy.
- Work approval drawer is workflow-critical and needs mobile visual signoff.

### Stage 3 - Loading And Media Motion

This stage merges the previous splash/loading and media/upload work. The merge is bookkeeping
only — the two distinct QA contracts (reduced-motion verification for loading; overlay-contrast-
over-real-thumbnails verification for media) remain separate sub-criteria, with the real-media
overlay proof waived by the human owner on 2026-04-29.

Primary targets:

- Loading group:
  - `packages/client/src/components/Layout/Splash.tsx`
  - `packages/client/src/views/Login/components/LoadingSplash.tsx`
- Media group:
  - `packages/client/src/views/Garden/Media.tsx`
  - `packages/client/src/views/Garden/index.tsx`
- Related shared media preview only if later QA proves the protected PWA flow depends
  on it.

Planned direction:

- Loading: replace raw `duration-*`, `transition-all`, and local easing with spring-token classes
  or inline token style. Preserve fixed-height and max-height reveal behavior that prevents login
  layout shifts. Use effects springs for opacity and color; spatial springs only for actual
  movement.
- Media: tokenize video play overlays, image zoom overlays, compression progress, recording
  indicator, video errors, and media requirement badges. Use `static-white` foreground over media
  overlays. Keep blob URL and offline-first media behavior unchanged.

Risks:

- The username input, passkey info callout, and error reveal can become jumpy if the reserved
  space behavior is removed.
- Overlay contrast can regress over bright outdoor photos.
- Upload progress can feel laggy if fast progress is forced into too-slow motion.
- Merging loading and media in one commit risks masking one of the two QA contracts; the eval
  matrix keeps them as separate sub-criteria.

### Stage 4 - Lower-Risk Controls, Cards, And Forms

Primary targets:

- `packages/client/src/components/Actions/Button/Base.tsx`
- `packages/client/src/components/Cards/Action/ActionCard.tsx`
- `packages/client/src/components/Cards/Action/ActionCardSkeleton.tsx`
- `packages/client/src/components/Cards/Base/Card.tsx`
- `packages/client/src/components/Cards/Garden/GardenCardSkeleton.tsx`
- `packages/client/src/components/Cards/Work/DraftCard.tsx`
- `packages/client/src/components/Display/Accordion/Faq.tsx`
- `packages/client/src/components/Errors/AppErrorBoundary.tsx`
- `packages/client/src/components/Features/Garden/Gardeners.tsx` (member controls only)
- `packages/client/src/components/Inputs/Clipboard/AddressCopy.tsx`
- `packages/client/src/components/Inputs/PullToRefresh.tsx`
- `packages/client/src/views/Garden/Details.tsx`
- `packages/client/src/views/Home/GardenFilters/index.tsx`
- `packages/client/src/views/Home/Garden/Assessment.tsx`
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` (card details only)
- `packages/client/src/views/Profile/GardensList.tsx`
- `packages/client/src/views/Profile/ENSSection.tsx`

Planned direction:

- Remove remaining protected-PWA legacy runtime token entries after the core color/status and
  drawer interaction patterns are stable.
- Keep cards and buttons visually familiar unless token migration exposes a clear consistency or
  accessibility issue.
- Avoid changing copy unless needed for accessibility or banned vocabulary.

Risks:

- Broad card/button cleanup can over-animate routine controls.
- Skeleton and loading surfaces may need screenshot checks to avoid perceived layout movement.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Client PWA UI | `ui` | Owns future staged implementation and stage commits. |
| State / API | `state_api` | `n/a`; status mapping must not alter hooks, providers, or queue behavior. |
| Contracts | `contracts` | `n/a`; no on-chain behavior is involved. |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential visual and regression passes after future UI work. |

## Non-Functional Constraints

- Package boundaries: prefer client-internal helpers; reach into shared only for existing exported
  primitives or if duplication cannot be solved safely in client.
- Helper CSS or helper modules introduced by this hub must keep `bun run check:design-tokens`
  clean; raw color, motion, radius, or primitive palette values are not allowed in helper CSS that
  the design-tokens gate skips.
- Offline/sync: do not bypass or alter offline-first queue flows.
- Accessibility: color must not be the sole status indicator; preserve labels, focus traps,
  reduced-motion behavior, and minimum tap targets.
- Localization: any new user-facing string must be added to `en`, `es`, and `pt`.
- Performance: avoid adding new blur layers beyond tokenized overlays; verify media/drawer flows
  on mobile.
- Design system: use existing Warm Earth runtime tokens; do not create new tokens in this plan.

## Human Judgment Points

- Whether visual QA finds any token-correct change that makes the PWA feel worse.
- Whether a specific drawer should stay solid rather than material-backed because text density or
  contrast requires it.
- Whether the `pwaStatusStyles` helper should be promoted to shared after Stage 1 stabilizes (out
  of scope for this hub; flag for a future plan).
- Whether final installed-phone testing is sufficient or a real-world field test is needed before
  archive. Resolved for this hub by the 2026-04-29 human waiver of final installed-phone signoff.
- Whether public browser hero work deserves a separate backlog hub after this PWA hub is accepted.

## Risks

- Risk: Future implementation touches unrelated dirty files or existing admin/shared changes.
  Mitigation: Stage 0 readiness gate; commit by explicit path only.
- Risk: typography.css repair regresses public browser typography.
  Mitigation: required public-browser smoke for `/` and `/gardens` in Stage 1 evidence.
- Risk: The `pwaStatusStyles` helper bypasses `check:design-tokens` by encoding raw values.
  Mitigation: Stage 1 keeps the design-tokens gate in the per-stage validation list and treats
  any failure as a Stage 1 blocker.
- Risk: Stage 3 merge of loading and media masks one of the two distinct QA contracts.
  Mitigation: keep reduced-motion (loading) and overlay-contrast-over-thumbnails (media) as
  separate sub-criteria in eval.md, with the real-media overlay proof waiver documented explicitly.
- Risk: Token cleanup becomes a broad redesign.
  Mitigation: keep each stage tied to the fixed semantic decisions above.
- Risk: Generated audit artifacts create noisy diffs.
  Mitigation: run `bun run check:design-generated` in every implementation stage and
  regenerate only when required.
- Risk: Automated gates pass while mobile usability regresses.
  Mitigation: require screenshots per stage and document any human-waived manual/device proof gap
  rather than claiming proof that was not captured.
