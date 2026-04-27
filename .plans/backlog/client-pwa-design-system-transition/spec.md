# Client PWA Design-System Transition Spec

## Summary

Create the implementation plan for migrating the installed client PWA from tracked legacy runtime
styling to the Warm Earth design-system token model. The migration target is not visual sameness.
The target is better cohesion: consistent PWA drawers, consistent status colors, token-backed
motion, reliable media overlays, and lower-risk cleanup across controls, cards, and forms. This
hub plans the future work only; it does not implement component changes.

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
- `scripts/data/design-token-usage-baseline.tsv` tracks current client `legacy-runtime` entries.
  The largest current PWA hotspots are:
  - `packages/client/src/views/Home/WorkDashboard/Icon.tsx`
  - `packages/client/src/components/Navigation/TopNav.tsx`
  - `packages/client/src/components/Layout/Splash.tsx`
  - `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
  - `packages/client/src/views/Garden/Media.tsx`
  - `packages/client/src/components/Dialogs/ModalDrawer.tsx`
  - `packages/client/src/components/Dialogs/DraftDialog.tsx`
  - `packages/client/src/views/Home/Garden/Work.tsx`
  - `packages/client/src/views/Home/WorkDashboard/index.tsx`
- `packages/shared/src/styles/theme.css` exposes the runtime tokens this migration must use:
  `--spring-*`, `--color-*`, `--color-material-*`, `--blur-material-*`, `--radius-*`,
  `--color-overlay`, `--primary-action`, and semantic state colors.
- `.claude/skills/design/language.md` and `.claude/skills/design/client-prompt-contract.md`
  establish the PWA motion, material, and client dialect rules.

## Fixed Product Decisions

1. Outcome is better PWA cohesion, not token parity only.
2. Future delivery is one focused commit per stage.
3. Existing PWA bottom-sheet behavior is retained and standardized; do not migrate the drawer
   system wholesale to `DialogShell`.
4. Public browser hero work is out of scope and belongs in a separate future plan.
5. Visual QA requires screenshots for each stage plus final installed-phone PWA signoff.
6. Archive readiness requires automated gates, recorded visual evidence, and phone signoff.
7. No public API or type changes are planned by this migration hub.

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

## Functional Requirements

1. Preserve the installed PWA shell contract.
   - `PlatformRouter` remains display-mode based.
   - `AppShell` plus bottom `AppBar` remains the protected PWA shell.
   - Browser/public routes remain on `PublicShell` plus `SiteHeader`.

2. Plan a staged migration that future implementers can execute without re-deciding scope.
   - Stage 1: drawer and overlay surfaces.
   - Stage 2: PWA status style map.
   - Stage 3: splash and loading motion.
   - Stage 4: media overlays and upload progress.
   - Stage 5: lower-risk controls, cards, and forms.

3. Keep future implementation scoped to protected PWA runtime files.
   - Public browser files are mentioned only as out of scope.
   - Shared source changes require explicit justification if a client-internal helper is not
     sufficient.

4. Define visual QA as a required part of the future implementation contract.
   - Stage screenshots are recorded in `handoffs/qa-evidence/`.
   - Final installed-phone signoff is required before archive.

5. Keep design-system validation tied to repo gates.
   - Token usage baseline entries must be removed only when future implementation actually fixes
     the corresponding raw usage.
   - `bun run check:design-generated` runs for every implementation stage because the generated
     client PWA token audit is sourced from `packages/client/src`; regenerate generated artifacts
     only when that check proves drift.

## Protected PWA Baseline Census

The current `legacy-runtime` client baseline must be treated as an implementation checklist, not
only as background evidence. Future owners must refresh this census before editing source files,
then remove baseline rows only after the corresponding raw usage is fixed.

Public/browser rows are included here so they are intentionally deferred rather than accidentally
left ambiguous. They remain out of scope for this PWA hub.

| Baseline file | Baseline rows | Stage assignment | Required treatment |
|---|---:|---|---|
| `packages/client/src/components/Actions/Button/Base.tsx` | `23`, `163` | Stage 5 | Routine button motion and destructive hover token cleanup. |
| `packages/client/src/components/Cards/Action/ActionCard.tsx` | `24`, `25` | Stage 5 | Card motion cleanup without broad redesign. |
| `packages/client/src/components/Cards/Action/ActionCardSkeleton.tsx` | `26` | Stage 5 | Skeleton motion cleanup; verify perceived layout stability. |
| `packages/client/src/components/Cards/Base/Card.tsx` | `27` | Stage 5 | Routine card press/motion token cleanup. |
| `packages/client/src/components/Cards/Garden/GardenCardSkeleton.tsx` | `28` | Stage 5 | Skeleton motion cleanup. |
| `packages/client/src/components/Cards/Work/DraftCard.tsx` | `29` | Stage 5 | Draft card warning surface and motion cleanup. |
| `packages/client/src/components/Communication/Progress/Progress.tsx` | `30` | Stage 2 | Form progress motion/status cleanup for `/garden` work capture. |
| `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` | `31`, `164`-`169` | Stages 1 and 2 | Drawer timing plus conviction/eligibility status colors. |
| `packages/client/src/components/Dialogs/DraftDialog.tsx` | `32`-`34`, `170` | Stage 1 | Overlay, content motion, close control, and material cleanup. |
| `packages/client/src/components/Dialogs/ModalDrawer.tsx` | `35`, `171`-`173` | Stage 1 | Bottom-sheet overlay, tab motion/focus, and intentional `maxHeight` fix. |
| `packages/client/src/components/Display/Accordion/Faq.tsx` | `36`, `37` | Stage 5 | Accordion motion and icon color cleanup. |
| `packages/client/src/components/Errors/AppErrorBoundary.tsx` | `38`, `39` | Stage 5 | Error recovery button motion cleanup. |
| `packages/client/src/components/Features/Garden/Gardeners.tsx` | `40`, `41`, `174`, `175` | Stages 1 and 5 | Dialog overlay in Stage 1; member controls in Stage 5. |
| `packages/client/src/components/Inputs/Clipboard/AddressCopy.tsx` | `42` | Stage 5 | Small control motion cleanup. |
| `packages/client/src/components/Inputs/PullToRefresh.tsx` | `43` | Stage 5 | Pull-to-refresh motion cleanup. |
| `packages/client/src/components/Layout/Hero.tsx` | `44`, `45`, `176`, `177` | Deferred browser/public | Explicitly out of scope; belongs with public browser hero plan. |
| `packages/client/src/components/Layout/Splash.tsx` | `46`-`54` | Stage 3 | Splash/login loading motion and reveal stability. |
| `packages/client/src/components/Navigation/SiteHeader.tsx` | `178` | Deferred browser/public | Explicitly out of scope; public browser shell stays separate. |
| `packages/client/src/components/Navigation/Tabs/StandardTabs.tsx` | `55` | Stage 2 | Tab state motion cleanup. |
| `packages/client/src/components/Navigation/TopNav.tsx` | `56`, `179`-`186` | Stage 2 | Nav status map, badge/focus states, and notification entry point. |
| `packages/client/src/routes/RequireAuth.tsx` | `187` | Stage 3 | Auth loading spinner token cleanup. |
| `packages/client/src/styles/animation.css` | `130` | Stage 2 | Work-confirmed/status animation color projection cleanup. |
| `packages/client/src/views/Garden/Details.tsx` | `188` | Stage 5 | Form toggle motion/foreground cleanup. |
| `packages/client/src/views/Garden/index.tsx` | `189` | Stage 4 | Recording stop icon foreground cleanup in work capture. |
| `packages/client/src/views/Garden/Media.tsx` | `57`, `58`, `190`-`192` | Stage 4 | Media overlays, static foreground, and compression progress. |
| `packages/client/src/views/Home/Garden/Assessment.tsx` | `193`-`195` | Stage 5 | Assessment code/status color cleanup. |
| `packages/client/src/views/Home/Garden/Notifications.tsx` | `59`, `60` | Stage 2 | Pending-review notification status and action motion cleanup. |
| `packages/client/src/views/Home/Garden/Work.tsx` | `61`-`63` | Stage 1 | Work approval drawer overlay, motion, and footer material cleanup. |
| `packages/client/src/views/Home/GardenFilters/index.tsx` | `64` | Stage 5 | Filter option button motion cleanup. |
| `packages/client/src/views/Home/index.tsx` | `65`, `196` | Stage 2 | Home filter icon state/focus cleanup. |
| `packages/client/src/views/Home/WalletDrawer/Icon.tsx` | `66`, `197`, `198` | Stage 2 | Wallet drawer icon state and badge contrast cleanup. |
| `packages/client/src/views/Home/WorkDashboard/Drafts.tsx` | `199`-`202` | Stages 2 and 5 | Draft status colors in Stage 2; card details in Stage 5. |
| `packages/client/src/views/Home/WorkDashboard/Icon.tsx` | `67`, `203`-`213` | Stage 2 | Work dashboard status map and focus/icon states. |
| `packages/client/src/views/Home/WorkDashboard/index.tsx` | `214` | Stage 1 | Work dashboard bottom-sheet overlay cleanup. |
| `packages/client/src/views/Home/WorkDashboard/Uploading.tsx` | `68`, `215` | Stage 2 | Upload/sync status map and control motion cleanup. |
| `packages/client/src/views/Login/components/LoadingSplash.tsx` | `69`, `70` | Stage 3 | Loading splash motion cleanup. |
| `packages/client/src/views/Profile/ENSSection.tsx` | `216` | Stage 5 | ENS success/status icon cleanup. |
| `packages/client/src/views/Profile/GardensList.tsx` | `71` | Stage 5 | Profile garden list control motion cleanup. |

## Stage Mapping

### Stage 1 - Drawer And Overlay Surfaces

Primary targets:

- `packages/client/src/components/Dialogs/ModalDrawer.tsx`
- `packages/client/src/views/Home/WorkDashboard/index.tsx`
- `packages/client/src/components/Dialogs/DraftDialog.tsx`
- `packages/client/src/views/Home/Garden/Work.tsx`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- `packages/client/src/components/Features/Garden/Gardeners.tsx`

Planned direction:

- Add a client-internal drawer style helper or constants module only if it reduces duplication
  across `ModalDrawer` and `WorkDashboard`.
- Apply token-backed overlay and material styles to the existing PWA drawer pattern.
- Align close timing to the active spring token rather than hardcoded `300`.
- Treat `ModalDrawer.maxHeight` as an intentional layout behavior fix if still present; preserve
  focus traps, escape handling, body scroll lock, and other drawer semantics.

Risks:

- Overlay opacity/material changes can make dense drawer content feel too light or too heavy.
- Work approval drawer is workflow-critical and needs mobile visual signoff.

### Stage 2 - PWA Status Style Map

Primary targets:

- `packages/client/src/components/Navigation/TopNav.tsx`
- `packages/client/src/components/Communication/Progress/Progress.tsx`
- `packages/client/src/views/Home/WorkDashboard/Icon.tsx`
- `packages/client/src/components/Navigation/Tabs/StandardTabs.tsx`
- `packages/client/src/views/Home/WorkDashboard/Uploading.tsx`
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- `packages/client/src/views/Home/index.tsx`
- `packages/client/src/views/Home/WalletDrawer/Icon.tsx`
- `packages/client/src/views/Home/Garden/Notifications.tsx`
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx`
- `packages/client/src/styles/animation.css`

Planned direction:

- Add a client-internal `pwaStatusStyles` map for the fixed semantic mapping in this spec.
- Replace primitive emerald/blue/orange/amber/gray usage where it represents PWA status.
- Preserve bright primary green for active nav, pending work, badges, progress, and value flow.

Risks:

- Mapping pending work to `success` would falsely imply completion.
- Mapping every green value to warning/success would weaken the garden value-flow rhythm.

### Stage 3 - Splash And Loading Motion

Primary targets:

- `packages/client/src/components/Layout/Splash.tsx`
- `packages/client/src/views/Login/components/LoadingSplash.tsx`
- `packages/client/src/routes/RequireAuth.tsx`

Planned direction:

- Replace raw `duration-*`, `transition-all`, and local easing choices with spring-token
  classes or inline token style where needed.
- Preserve fixed-height and max-height reveal behavior that prevents login layout shifts.
- Use effects springs for opacity and color; use spatial springs only for actual movement.

Risks:

- The username input, passkey info callout, and error reveal can become jumpy if the reserved
  space behavior is removed.

### Stage 4 - Media Overlays And Upload Progress

Primary targets:

- `packages/client/src/views/Garden/Media.tsx`
- `packages/client/src/views/Garden/index.tsx`
- Related shared media preview only if future implementation proves the protected PWA flow depends
  on it.

Planned direction:

- Tokenize video play overlays, image zoom overlays, compression progress, recording indicator,
  video errors, and media requirement badges.
- Use `static-white` foreground over media overlays.
- Keep blob URL and offline-first media behavior unchanged.

Risks:

- Overlay contrast can regress over bright outdoor photos.
- Upload progress can feel laggy if fast progress is forced into too-slow motion.

### Stage 5 - Lower-Risk Controls, Cards, And Forms

Primary targets:

- `packages/client/src/components/Actions/Button/Base.tsx`
- `packages/client/src/components/Cards/Action/ActionCard.tsx`
- `packages/client/src/components/Cards/Action/ActionCardSkeleton.tsx`
- `packages/client/src/components/Cards/Base/Card.tsx`
- `packages/client/src/components/Cards/Garden/GardenCardSkeleton.tsx`
- `packages/client/src/components/Cards/Work/DraftCard.tsx`
- `packages/client/src/components/Display/Accordion/Faq.tsx`
- `packages/client/src/components/Errors/AppErrorBoundary.tsx`
- `packages/client/src/components/Features/Garden/Gardeners.tsx`
- `packages/client/src/components/Inputs/Clipboard/AddressCopy.tsx`
- `packages/client/src/components/Inputs/PullToRefresh.tsx`
- `packages/client/src/views/Garden/Details.tsx`
- `packages/client/src/views/Home/GardenFilters/index.tsx`
- `packages/client/src/views/Home/Garden/Assessment.tsx`
- `packages/client/src/views/Home/WorkDashboard/Drafts.tsx`
- `packages/client/src/views/Profile/GardensList.tsx`
- `packages/client/src/views/Profile/ENSSection.tsx`

Planned direction:

- Remove remaining protected-PWA legacy runtime token entries after the core interaction patterns
  are stable.
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
- Whether final installed-phone testing is sufficient or a real-world field test is needed before
  archive.
- Whether public browser hero work deserves a separate backlog hub after this PWA hub is accepted.

## Risks

- Risk: Future implementation touches unrelated dirty files or existing admin/shared changes.
  Mitigation: stage this hub and later implementation commits by explicit path only.
- Risk: Token cleanup becomes a broad redesign.
  Mitigation: keep each stage tied to the fixed semantic decisions above.
- Risk: Generated audit artifacts create noisy diffs.
  Mitigation: run `bun run check:design-generated` in every future implementation stage and
  regenerate only when required.
- Risk: Automated gates pass while mobile usability regresses.
  Mitigation: require screenshots per stage and final installed-phone PWA signoff.
