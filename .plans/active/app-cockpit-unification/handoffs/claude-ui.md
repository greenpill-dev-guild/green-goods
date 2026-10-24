# One Look for the App and the Cockpit - UI Handoff

## Lane

- Owner: Claude
- Branch: one `feature/` branch per step. Step 1's have merged: `feature/app-cockpit-typeface`
  (#1172), `feature/app-cockpit-type-roles` (#1175), `feature/app-cockpit-type-role-guides`
  (#1176), `feature/app-cockpit-shared-type-roles` (#1188) and
  `feature/app-cockpit-shared-type-role-guides` (#1187). Merged on 23 October: step 1's last,
  `fix/app-vietnamese-font-subset` (#1197); step 2, `feature/app-cockpit-ground-ladder` (#1191)
  with its guides `feature/app-cockpit-ground-ladder-guides` (#1193); step 3,
  `feature/app-cockpit-control-outline` (#1195) with its guides
  `feature/app-cockpit-control-outline-guides` (#1196), both first stacked on step 2's. Step 4:
  `feature/app-cockpit-count-badge` with its guides `feature/app-cockpit-count-badge-guides`.
  Step 7: `feature/app-cockpit-cards-rows` with its guides `feature/app-cockpit-cards-rows-guides`.
- Status: in progress. Steps 1 to 3 merged on 23 October; step 4 was approved on its pair the same
  day; every later step starts on its own approved pair. Still pending: labeled authenticated Brave proof of an installed app's first
  launch with no network (step 1) and of the installed app's status bar, with the iOS check of
  whether its solid status bar follows `theme-color` (step 2).
- Merged on 2026-10-23 in the maintainer's order, each as a merge commit on a green CI Gate at
  its head: #1193 (`5aa98111b`, 21:01:12Z), #1191 (`b7d2aeef4`, 21:03:14Z), #1196 (`cbdb4eeee`,
  21:22:47Z), #1195 (`dcf09f16c`, 21:23:06Z) and #1197 (`aa20babdf`, 21:24:59Z). #1196 and #1195
  were retargeted to `develop` before their bases merged, since a merge deletes its branch and
  closes a pull request still stacked on it, and each took `develop` in before its last CI run.

## Scope

- Deliver the steps in `plan.todo.md` in order, one pull request per step (step 1 took more: the
  face, the cockpit's type roles, their guide wording as a standards-only pull request, and the
  shared components' roles), each against `develop` with `Fixes PRD-<issue>` when the pull request
  completes its issue.
- For each step: Storybook first, the shared recipe or token changed until it matches the approved
  pair, the consuming surfaces picking it up, nothing styled in a view file first.
- Keep the public website on its own dialect, and never restyle a shared piece from the cockpit
  (DL-031).

## Step 1: typeface (PRD-1267)

- Merged, each with `Refs PRD-1267`:
  - greenpill-dev-guild/green-goods#1176, the type role wording in `packages/admin/DESIGN.md`,
    frontend-design Rule 9 and the defect grammar: merge `870600083`, 2026-10-21 23:46:46Z. Review
    split it out of #1175, because `packages/admin/AGENTS.md` keeps the standards and the code they
    govern apart, so it merged first.
  - #1175, the cockpit onto the type roles: merge `cfd1aaf83`, 2026-10-21 23:48:54Z.
  - #1172, the installed app in Plus Jakarta Sans: merge `20d8c8121`, 2026-10-22 00:10:24Z.
  - #1188, the shared components onto the type roles: merge `f305bd7f6`, 2026-10-23 05:10:05Z.
  - #1187, their guide wording: merge `671bc8220`, 2026-10-23 05:36:58Z.
- Served and precached by other work: #1190 (`perf/startup-session-performance`, merge `65df3ad13`,
  2026-10-23 06:13:54Z) serves Inter, Plus Jakarta Sans and Fraunces from
  `packages/client/public/fonts/` (latin and latin-ext), precaches `fonts/pwa.css` and
  `fonts/jakarta-*.woff2`, and its `tests/specs/client.pwa-preview.spec.ts` proves the installed
  face on an offline reload. That is the offline face #1172's review asked for.
- Done:
  - `9ef990bc1` sets the installed app in Plus Jakarta Sans. `index.html` loads the variable face
    (italic, 200 to 800) before Inter and the PWA loading screen names it; `index.css` sets it on
    `:root[data-boot-presentation="pwa"]:not(:has([data-site="website"]))`; Storybook's app scope
    and app body take it in `surfaces.css`. The website keeps Inter.
  - `2cd0ba268` merges `develop`: its status bar meta and standalone `html` floor sit beside step
    1's hunks without a conflict.
  - `829aaf9e9` brings every guide, guard and story that named Inter for the installed app into
    line. Root `DESIGN.md`: the Typography table, and front matter where `body-md`, `label-md` and
    `app-title` name Plus Jakarta Sans and the website's button takes its own Inter role,
    `website-label` (16px, 600, 24px line), as the maintainer chose on 2026-10-21; `token_version`
    2.22.0 and the regenerated projections. DL-095 (the retired Material 3 rule) and DL-096 (the
    typeface) from the step 13 draft, with two corrections: DL-095 cites `prompt-contract.md` §
    Workspace Tone for the tone budget (the draft cited DL-043, the Hub's outlined trio), and DL-096
    carries the measured fit from eval.md. The guides and prompt contracts, "Plus Jakarta Sans" out
    of the client prompt ban list, the Storybook rules, specimens, Overview play, base stylesheet and
    font request (the website's field now carries its own Inter expectation), the docs token page
    and its test, and the comments. The "Português" width note was measured again: 69.1px at 14px
    against the trigger's 66px (68.0px in Inter), still one line, about 10px clear of the chevron.
  - `071ce6d1b`, from review: the Plus Jakarta Sans stylesheet takes a `media` query for installed
    displays and no preload, and the boot detector sets its `media` to `all` wherever it picks the
    installed-app presentation, so a browser tab never waits on the face.
    `presentationTypeface.test.ts` guards the selector and `bootFallback.test.tsx` the detector.
  - #1175's roles: `type-title-lg`, `type-title-md`, `type-title-sm`, `type-body`, `type-label`,
    `type-label-sm`, `type-meta`, `type-meta-sm`, and `type-field` for field text. Each is a
    Tailwind utility reading `--gg-type-<role>-size|line|weight|tracking`: the installed app's
    values in shared `theme.css`, the cockpit's in admin `index.css`, mirrored in Storybook's
    `surfaces.css` and pinned by `AdminDensityScale.guard`. A codemod moved 240 cockpit files off
    the Material aliases and named classes, six unused M3 `.type-*` classes left `utilities.css`,
    and `check:design-tokens` now rejects every font size outside the roles in `packages/admin/src`.
  - The maintainer's picks on rendered pairs (21 October): the shared scale's tracking (-0.006em
    at 14px), one line height per role, titles at weight 600 (the app bar's sheet label and the
    empty-workspace heading moved up from 400), checkbox and choice labels on `type-field` (14px
    from 640px), `type-meta-sm` at 400 unless a chip sets its own weight, the cookie jar payout
    amount at 22px, and card sizes left to the card step.
- The shared components' roles (#1188, #1187): the design gate rendered 20 screens on both
  surfaces at 390 and 1280px in English, Spanish and Portuguese, and compared every text element in
  every story before and after. Two calls had no role that keeps both surfaces as they are, and the
  maintainer chose on the pairs (22 October): status pills and the assessment domain label take
  one size on both surfaces, the cockpit's 11px chip size (`type-meta-sm`; the medium pill
  `type-meta`), so the cockpit's pills stay as they were and the app's shrink from 14 and 12px to
  11px; and the shared field label moves from 18 to 14px, the app's field label. Cockpit titles
  with no weight take 600, as #1175 ruled. The roles are rem where the old scale was px, so these
  texts now follow the reader's text size; at 200% the pending row's pill covers its overflowing
  marker line until step 7 puts the pill under the title.
- Follow-ups the shared roles left, neither filed yet: the client's own 17 files on the shared scale
  (so the scale keeps its tokens and its `cn()` registration), and 98 raw Tailwind sizes in 35
  shared components.
- Finishing step 1 (`Fixes PRD-1267` in #1197, merged 2026-10-23 as `aa20babdf`):
  - #1189 (`feature/app-cockpit-offline-face`, head `27189c373`), which #1190 overtook, conflicted
    with `develop` in seven files and would have added a second copy of the faces under
    `src/styles/fonts/`. The maintainer chose on 2026-10-23 to close it as superseded (closed with
    a note; its branch and worktree are kept) and to port what #1190 lacks as one small pull
    request: #1197 (`fix/app-vietnamese-font-subset`). What it lacked is the vietnamese subset:
    `develop`'s latin-ext ranges skip U+1EA0 to U+1EF1 (ẹ, ọ, ị, ụ), and Google Fonts served that
    subset for all three faces before #1190, Fraunces included, so Yoruba and Igbo names drew those
    letters in a fallback face. #1197 serves the subset for all three faces, precaches the
    installed face's two files through the existing glob (31 entries, 0.70 MiB raw), and extends
    the offline spec. Inter stays out of the precache: under `/home` it draws only in the wallet
    modal, which needs a network. #1189's budget-checker guard was not carried over: on
    `develop`'s build it reports nothing, and it fires only when `fonts/pwa.css` names a face
    outside the `fonts/jakarta-*.woff2` glob (a constructed case: `develop`'s checker passes it,
    #1189's fails it), which a `jakarta-vietnamese-*` file does not do.
  - Brave proof, 2026-10-23, **authenticated Brave** (the maintainer's profile through the Claude
    in Chrome extension, `navigator.brave` true), `develop` `65df3ad13` built for production and
    served by `vite preview` on :4318, `/home/login?presentation=pwa` in a browser tab: online, the
    sign-in screen draws Plus Jakarta Sans; after a reload the worker controls the page and holds
    `fonts/pwa.css` and the four `jakarta-*` files; with the server stopped, a reload renders the
    sign-in screen from the worker, both latin files decode from the precache (27,348 and 29,600
    bytes) and the button draws Plus Jakarta Sans. **Still pending:** the installed app's first
    launch. Installing needs Brave's own install dialog, which the extension cannot click, and the
    session had no desktop control.
- Handed on to step 7: the three texts that newly end in an ellipsis at 320px (eval.md, Typeface).
  Step 7's detail-line rules and its 320px check cover them. PRD-1267's "Done when" still names
  that check, so its closeout says where they went.
- Proof limit for the face and the role names: `not_applicable`. The installed app's font family
  and its loading screen's face change; no behaviour does. Proof is the rendered pair, the
  typeface fit audit and the design and typography guards (eval.md, Design gate for the token
  slices).
- Proof limit for the shared components' roles: `not_applicable`. Class names, type tokens and
  two retired stylesheets change; no behaviour does. Proof is the rendered pairs, the all-story
  comparison, and `check:design-tokens`, whose retired-name sweep now covers `packages/shared`.

## Step 2: ground and dark ladder (PRD-1268)

- `feature/app-cockpit-ground-ladder` from `develop` `65df3ad13`: the four drafts (`437790fea`,
  `b8c200156`, `9b9bb5dc1`, `c1ddb4a38`) replayed with `cherry-pick --no-commit`, keeping
  `develop`'s safe-area line with the canvas swap in `PinnedPromiseCard.tsx`, then finished in
  `c9b1fd66a` (`Fixes PRD-1268` in the pull request):
  - The re-grep found no ground use added since the 20 October gate: every later
    `bg-bg-white-0` in shipped app code is a card, a sheet, a bottom bar or the website. Six app
    story files whose wrappers paint a page, and the garden page's story frame, moved to
    `bg-bg-canvas`.
  - The status bar and the manifest per presentation: the `theme-color` meta carries the
    website's white (`data-light`, `data-dark`) and the installed app's linen and warm floor
    (`data-app-light`, `data-app-dark`); the boot detector points the bar at the app's ground when
    it picks the installed presentation, and shared `theme.ts` keeps it current. The manifest's
    theme and background colours take linen. The colours come from the DesignMD token export:
    `neutral-dark` moved from `#1C1917` to `#110C08`, the floor both surfaces paint, so the two
    `#fff` baseline rows retired, and a manifest test pins the export to the canvas `theme.css`
    paints. The iOS solid status bar is iOS's own; whether it follows `theme-color` needs a device.
  - The error boundary's Retry label took the static white token, retiring its baseline row; the
    seam fingerprint of `shared-commitment-pooling-public` is re-certified (its proof suites, 61
    tests, passed); colons replaced the draft's em dashes; the projections and the docs token
    data are regenerated.
- Merged as #1191 (`Fixes PRD-1268`; `b7d2aeef4`, 2026-10-23 21:03:14Z), with root `DESIGN.md`'s Ground paragraph (`fc65a91d5`)
  in it: the docs token data reads `DESIGN.md`, so a second pull request regenerating it would
  conflict. Push gate on `fc65a91d5`: 18 of 19 selected checks passed, browser-proof manual. The
  first gate run failed docs-authority on this worktree's stale docs install (no `@babel/parser`);
  the maintainer approved a frozen `bun install` here, which also moved Vite to 8.2.4, and the
  lockfile did not change.
- Guides: DL-097 and its lines in `language.md` § Dark Mode Palette, `DESIGN.pwa.md` and the
  cockpit's `DESIGN.md`, with token version 2.23.0, are the standards-only #1193, as #1176 and
  #1187 were. Merge it after #1191.
- Proof: eval.md, Step 2 proof (contrast audit and 76 rendered pairs). TDD `not_applicable`: pure
  styling and the status bar colour, whose unit cases are in `theme.test.ts`,
  `bootFallback.test.tsx` and `pwa-manifest.test.ts`. Pending: browser-proof of the installed
  app's status bar (the authenticated class), and on iOS whether the solid bar follows
  `theme-color` at all.

## Step 3: control outline and focus role (PRD-1269)

- Draft `10f0aa565` on `feature/app-cockpit-token-slice-drafts` replays onto step 2:
  `theme.css` applies cleanly, and the cockpit's `index.css` and Storybook's `surfaces.css` keep
  both sides after `--gg-hit-block` (`develop`'s type role block and the draft's outline).
- Merged as #1195 (`Fixes PRD-1269`; `dcf09f16c`, 2026-10-23 21:23:06Z), first stacked on #1191
  as the maintainer chose on 2026-10-23: one solid 2px ring on `.gg-control`, `.gg-button`, `.gg-chip` and `.gg-switch` in
  the workspace tone in the cockpit and the app's green, switched on by two plain tokens
  (`--gg-focus-ring-width`, `--gg-focus-halo-alpha`) that the installed app and the cockpit set,
  so the public website keeps its halo (A13); the app's buttons at weight 500; root `DESIGN.md`'s
  Controls line. `AdminDensityScale.guard` pins `--gg-control-outline` and both focus tokens, the
  button guard pins the weight, and the Storybook design-system pages expect 500.
- Proof (in #1195): **Storybook**, `:focus-visible` forced through the DevTools protocol on every
  shared control family, light and dark. Before, only icon buttons drew a ring; now every family
  draws 2px. Ring against its ground: the app 5.72:1 (light) and 14.46:1 (dark), the cockpit 7.26
  and 11.83:1. Unselected chip outlines: the app 1.34 to 4.80:1 (light) and 1.51 to 6.14:1 (dark),
  the cockpit 1.92 to 7.83:1 (dark). TDD `proof_limit` with that evidence.
- Guides: DL-098 and its lines, with token version 2.24.0, are the standards-only #1196, stacked
  on #1193 so the two decision-log rows land in order; merged 21:22:47Z as `cbdb4eeee`.

## Step 4: count badge (PRD-1270)

- Design gate on 2026-10-23 ([eval.md](../eval.md#design-gate-for-the-count-badge)), approved
  the same day with all six recommendations
  ([spec.md](../spec.md#count-badge-approved-23-october)).
- `feature/app-cockpit-count-badge`, cut from `develop`: Shared's `CountBadge` on the existing
  `components/Badge/Badge` export (no new export path) and `.gg-count-badge` in `theme.css`, a
  16px capsule with 11px numerals at 600 on `--tone-on-surface-accent` with `--tone-on-action`,
  falling back to the app's green action pair; a `ring` draws 2px of the surface behind it
  (`--gg-count-badge-ring`, the canvas by default, white on the bottom bar). Its consumers: the
  bottom bar (keeps 9+), the Your Work and Promises launchers, Home's filter, a garden's bell in
  `TopNav`, `StandardTabs`, `AppSheet` tabs (`pwaSheetStyles.tabBadge` retired) and
  `AdminTabRail`. Root `DESIGN.md` gains `typography.count` and a Counts line; the unused
  `TabBadge` and `BADGE_TONE_CLASSES` go; the design-system specimen and the tab rail's story
  describe the new badge.
- Proof: a focused `CountBadge` test (nothing below one, the caps, the ring, kept attributes);
  breaking the default cap fails it. The consumers' own tests (StandardTabs, AppSheet, TopNav,
  sheet styles, Home, display mode, AdminTabRail) pass. The look is the approved pairs:
  **mock-auth localhost** for the app and **Storybook** for the cockpit, no authenticated class.
- Guides: DL-099, both surface guides, `language.md`, the prompt contract, the review checklist
  and Rule 18's tone budget (a fifth use: the badge on every tab) are the standards-only
  `feature/app-cockpit-count-badge-guides`, with token version 2.25.0.
- Not in the step: Community's action fill (orange-700) carries white text at 4.0:1; raising it to
  orange-800 takes its own pair.

## Step 5: tabs (PRD-1271)

- `feature/app-cockpit-tabs`, cut from `develop` `d84d48398`: `AdminTabRail` takes the app's
  equal-width tabs at the cockpit's 36px height (F8). Every cell takes an equal share of the row
  and never less than its own icon, label and count; the active cell is tinted with
  `--tone-on-surface-accent` at 10% under the accent label and a 2px underline drawn inside it;
  the count is step 4's `CountBadge`. Labels are 12px below 640px and 14px from 640px at weight
  500 in both states, as the app sets its tabs. Below 640px the row fills the width; from 640px it
  is at most 180px per tab (`--tab-rail-count`) and keeps to the left, its rule included.
- No new tone role: the tint reads the accent that already inks the active label. `--tone-tint`
  is a deleted role, and `--tone-surface-tint-color` feeds only the canvas wash.
- The rule is an inset line, so the active underline covers it inside the scrollport, and the
  focus ring draws inside the cell, where the scroll container no longer clips it.
- Phones: at 320px the Hub's four cells (icon, label and count), Actions' five and the protocol
  garden's four-tab Community row cannot hold equal cells, so those rows scroll there, as they
  did before. Put to the orchestrator on 23 October with two alternatives (wrapping labels, and
  hiding the Hub's icons on phones); it took this rule, option 1, for the maintainer's review after
  merge, and DL-100 records it as a measured deviation from the 18 October pick.
- Proof: two `storybook-ci` stories on the rail. `EqualCellsOnDesktop` checks four 180px cells in
  a 720px row at its left edge, with the tint and underline following the selection;
  `FullWidthOnAPhone` checks Portuguese Garden labels whole at 12px across a 296px row with no
  scroll. Removing the row cap fails the first. The design-system tab expectation takes 12px
  below 640px and weight 500, and the `PageHeader` stories render the real rail in place of
  hand-drawn underline tabs. Rendered pairs: Storybook for the cockpit, mock-auth localhost for
  the app ([eval.md](../eval.md#step-5-proof-tabs)).
- Guides: DL-100 and its lines are the standards-only `feature/app-cockpit-tabs-guides`.
- Found, not changed: the app's Promises sheet clips Portuguese "Em andamento" at 390 and 320px
  and Spanish "Por confirmar" at 320px. `TabBadge` itself left with #1204; the three Garden files
  that still name `TabBadgeSeverity` use it to type the Attention Needed alerts.

## Step 6: capsule chips (PRD-1272)

- The pick (F4) was locked on 18 October; the pairs are acceptance evidence
  ([eval.md](../eval.md#step-6-proof-capsule-chips)).
- `feature/app-cockpit-chips`, cut from `develop` `5c76ca2b6` and merged with `d84d48398`:
  `AdminFilterChip` is a 32px capsule (`--m3-shape-full`) whose selected state fills with
  `--tone-action` and labels in `--tone-on-action`, with no outline and no check mark (DL-065);
  its neutral state layer paints beneath the label (`m3-state-layer-beneath`, #1206) and its
  focus ring is a 2px outline 2px off the chip. `AdminInputChip` takes the capsule in its own
  commit. Storybook: a `WorkspaceToneMatrix` story in the CI run, the capsule in
  `ADMIN.chip()`, and the Admin pages' tone cards and shape notes.
- Proof: the CI story walks all four workspace tones in light and dark by keyboard (capsule, tone
  pair, focus outline, widths that hold when the selection moves); the admin tests that render
  both chips pass. The look is the pairs: **Storybook** for the cockpit and **mock-auth localhost**
  for the app's unchanged chips, no authenticated class. TDD `not_applicable` (styling only).
- Guides: DL-101 and the sixth tone use in Rule 18, both surface guides' lines, the prompt
  contract, the review checklist, `implementation.md` and `language.md` are the standards-only
  `feature/app-cockpit-chips-guides`, with token version 2.26.0.
- Not in the step: the shared `Chip` the cockpit renders (`ConfidenceSelector`, `AssetSelector`)
  still selects in the app's green, not the workspace tone.

## Step 7: cards, rows and list gap (PRD-1273)

- `feature/app-cockpit-cards-rows`, cut from `develop` and brought up to `ce0d71953` (#1206):
  - **One card surface.** `.gg-card` in Shared `theme.css`: the 24px corner (`--gg-card-radius`), a
    1px edge, the card fill, and a faint shadow in light only (`--gg-card-shadow`). Only the cockpit
    declares `--gg-card-surface`, `--gg-card-edge` and `--gg-card-fill` (admin `index.css`, mirrored
    in Storybook's `surfaces.css` and pinned by `AdminDensityScale.guard`), so the app's scopes
    resolve their own white and stroke, and both surfaces measure the same card and edge in dark.
    `data-edge` draws the 2px status edge. The five card primitives (client `Card`, `AdminCard`,
    Shared `Surface`, `CardBase`, Shared `Card`) take the surface and keep their exports for step 19.
  - **The item row.** `ItemRow` and `ItemRowSkeleton` on the new leaf export
    `@green-goods/shared/components/Cards/ItemRow/ItemRow` (the `cards` barrel does not resolve in
    the client and admin Vitest aliases): 88px, an 88px photo or a 56px icon tile, a one-line title
    in the new card title role (`type-card-title`: 15px at 500 in the app, 13px at 600 in the
    cockpit), one status pill under it, at most two details on one 11px line that drop whole when
    they do not fit (a first detail too long on its own ends in an ellipsis), the row's one action in
    its right slot, and a 16px corner. Stories: `Shared/Cards/ItemRow`; the fit helper
    `packages/shared/.storybook/itemRowFit.ts` checks 88px rows and lines that never wrap or cut.
  - **On the row now:** Shared `WorkCard` (who · age, ages always a short number, the photo count on
    the photo; in the app, feedback in the age's place, never a second pill), the app's pending and
    draft rows (`PendingCard`, `DraftCard`), and the cockpit's
    queue below 600px (`HubWorkQueue` renders the work row, with `hubWorkTitle()` shared with
    `HubWorkCard`, and loads with five row skeletons).
  - **List gap.** `--gg-list-gap` (12px) on the garden's Work tab, Your Work's lists and the cockpit's
    queue grid.
- Proof: focused tests for the row's API, the work row's short ages in three languages, the app's
  work and pending rows, the cockpit's phone queue and the card surface, and the Storybook story
  tests of the row, the work row and the pending row, whose fit checks run in English, Spanish and
  Portuguese at both surfaces' phone widths. The look is the pairs: **mock-auth localhost** for the
  app and **Storybook** for the cockpit, no authenticated class
  ([eval.md](../eval.md#step-7-build-cards-rows-and-list-gap)).
- Guides: DL-102, both surface guides, Rules 8 and 18, `language.md` and the review checklist are the
  standards-only `feature/app-cockpit-cards-rows-guides` (#1218), with token version 2.29.0,
  provisional: the merge takes the next free number.
- Calls the pairs raise, each with a recommendation in the pairs artifact: the pending rows' long
  "when you're connected" reasons drop the saved time on three or four of six kinds at 390px and end
  in an ellipsis in Portuguese; feedback takes the age's place on every work row, and at 320px a
  completed row drops it; the proof and promise markers become a mark on the photo (DL-061 marked
  proof in words); a completed row without feedback shows its age, not "Review added to the garden
  record"; a nested card in the cockpit takes the same 24px card; and the card title keeps each
  surface's title weight.
- Open call from Codex's review of #1224: on a phone the Hub queue's work row shows the work's own
  title, so a search that matches only its action title lists rows with no matching text, where
  the desktop card names the action. Naming the action on the row needs a third detail or a new
  title rule, so it waits for the maintainer.

## Step 9: phone sheets (PRD-1275)

- F5 was locked on 18 October, so the pairs ([eval.md](../eval.md#step-9-proof-phone-sheets)) are
  acceptance evidence, not a gate. Built on `feature/app-cockpit-phone-sheets`, cut from
  `develop` `d84d48398`.
- Shared: the grip is `SheetGrip`, a named export on the existing `components/Dialog/SheetHeader`
  leaf (no new export path), a drag region only when a sheet binds the gesture to it; the bottom
  sheet's material is one `[data-sheet-surface]` rule in `utilities.css` that `PwaSheet` carries
  too, reading `--gg-sheet-fill` and `--gg-sheet-edge` with the installed app's values as
  fallbacks; `SheetHeader` gains a `target` line between the title and the description and reads
  `--gg-sheet-title-size` and `--gg-sheet-title-line`; the scroll-edge hairline and its cover
  follow the sheet's own edge and fill.
- Cockpit: below 640px `AdminDialog` and `AdminSideSheet` carry the material and the grip, which
  marks the sheet and does not drag it, and their header is the shared `SheetHeader` through
  `AdminDialogHeader` (the dialog's header, centered or phone, in one place). Flows and the command
  palette keep their own header under the grip, with the dialog's close moved down below it.
  `index.css` sets the four `--gg-sheet-*` tokens (the card step and its hairline, re-declared in
  the dark block, and the 22px dialog title), mirrored in Storybook and pinned by
  `AdminDensityScale.guard`. From 640px nothing changes.
- Proof: focused tests run the same behavior on both presentations (focus lands on Close when the
  dialog opens and returns to the opener through `finalFocusRef`; Close and Escape close it;
  `preventClose` holds both), and pin the phone anatomy (the material attribute, a grip without a
  drag region, the shared header's order and accessible description, the side sheet's phone form),
  `SheetHeader`'s target line, `SheetGrip`'s grab region and the CSS contracts. Storybook geometry
  stories pin the phone header, grip, 22px title and white surface, and the flow's close under the
  grip. The look is **Storybook** (cockpit) and **mock-auth localhost** (app) pairs; no
  authenticated class is involved.
- Guides: DL-104 and its wording in both surface guides, the prompt contract, Rule 18's elevation
  line, the review checklist, `language.md`, `implementation.md` and `interaction-patterns.md`
  are the standards-only `feature/app-cockpit-phone-sheets-guides`, with token version 2.26.0.
- Open: whether the grip also drags the sheet closed in the cockpit.
- Not in the step: the centered dialog's header keeps 24px of right padding from 640px, so a long
  title can run under its close button (a desktop defect on `develop`); the cockpit sheet's enter
  keyframe keeps its 2% overshoot, which DL-033 removed from the app's sheet. Storybook's dark
  `--surface-raised` mirror (neutral-900, where the cockpit uses the card step) skewed the dark
  pairs' footer, so the step corrects it.

## Step 21: bottom bar active pill (PRD-1288)

- `feature/app-cockpit-bar-pill`, cut from `develop` `d84d48398`: `AppBar` draws each tab's line
  icon in a 56 × 32 slot (`data-slot="icon"`) that paints `--primary-container` behind it, with the
  icon in `--primary-container-foreground`, when the tab is active, and the active label
  (`data-slot="label"`) in ink at weight 600. The filled icons are gone. The bar's padding goes from
  12 to 8px, so it stays 69px. Shared `theme.css` sets the pair in the app presentation only:
  green-100 behind green-900, swapped in dark, the cockpit's Garden pill.
- Proof: the pairs ([eval.md](../eval.md#step-21-proof-the-bottom-bars-pill)), **mock-auth
  localhost** for the app and **Storybook** for the cockpit, which did not change. No authenticated
  class: the bar is outside the browser-proof paths. The display-mode test asserts `aria-current`,
  and the story's plays guard the pill and the 69px.
- Guides: DL-107 and the wording in both surface guides, `language.md`, the client prompt contract
  and root `DESIGN.md`'s Quick Token Reference are the standards-only
  `feature/app-cockpit-bar-pill-guides`.
- Not in the step: the active tab hid its keyboard focus ring, and the other tabs drew the
  browser's default ring rather than the app's focus role. `fix/app-bar-focus-ring` gives every
  tab the app's ring on keyboard focus, pinned by the story's `KeyboardFocus` play
  ([eval.md](../eval.md#step-21-proof-the-bottom-bars-pill)).

## Step 10: outlined fields (PRD-1276)

- `feature/app-cockpit-outlined-fields`, cut from `develop` `5c76ca2b6`: the cockpit's
  `AdminTextField`, `AdminTextArea`, `AdminSelect`, `AdminInlineField` and `AdminFieldGroup` take
  the app's anatomy, the label above (`gg-field-label`, 14px / 500), an outlined 8px box on the
  responsive tier, and the shared message line (`gg-field-message`), which reserves
  `--gg-field-message-lines` lines; the cockpit sets two after the 640px measurement
  ([eval.md](../eval.md#step-10-proof-outlined-fields)). The filled look and its `variant` prop go.
- Shared: the date picker always renders its line, and its error takes the family's red;
  `FormFieldWrapper` and `FormattedAmountInput` read the same line, so the app's reserve becomes the
  per-surface setting with no visual change (0% on every app pair). Every cockpit row with an
  action beside a field (fourteen components, in three layouts) keeps its relation to the box, and
  the sign-in field reserves no message line.
- Proof: TDD `required`, RED and GREEN in the eval section; the browser-mode stories and the
  design-system pages; the pairs, **Storybook** for the cockpit and **mock-auth localhost** for the
  app, no authenticated class.
- Guides: DL-105 and its lines are the standards-only `feature/app-cockpit-outlined-fields-guides`.
- Open: `FileUploadField` keeps its help above the upload well; the Seed step's Amount and Due
  errors can fall back to Zod's English.

## Step 14: fact rows (PRD-1280)

- `feature/app-cockpit-fact-rows`, cut from `develop` at `3c4fd4b62`:
  - **The shape.** `FactList` (a `<dl>`, its own card or inset in a frame that exists) and `FactRow`
    (`label`, `value`, `valueTitle`, `description`, `icon`, `action`, `labelId`) on the new leaf
    `@green-goods/shared/components/Cards/FactRow`; rules `.gg-fact-*` in Shared `theme.css`. A
    label is `type-label-sm` in the sub ink and a value `type-body` at 500, and the rows share one
    label column through subgrid. A row with no value is a setting whose label takes
    `gg-field-label`. Stories: `Shared/Cards/FactRow`.
  - **Moved onto it**, every review, detail and settings screen that lists facts on both surfaces;
    the pull request lists each row and why the rest stayed.
  - **Left out**: the public website's editorial rows, metric strips with large numbers, the
    assessment outcome legend, `PoolTarget`, the cockpit's setup checklist, rows that open a record,
    step 18's position stat rows, step 19's `StatCard`, and the account status rows (`AccountRow`,
    `SignedOutRow`, the Profile's `AccountInfo`).
- Proof: focused tests for every screen whose test read the old rows, the FactRow story plays, and
  142 rendered pairs, **Storybook** for the cockpit and the app's components and **mock-auth
  localhost** for the Profile's settings, no authenticated class
  ([eval.md](../eval.md#step-14-build-fact-rows)).
- Guides: DL-109, root `DESIGN.md`, both surface guides, Rules 9 and 15, the cockpit's prompt
  contract, the design architecture map and the defect grammar are the standards-only
  `feature/app-cockpit-fact-rows-guides` (#1232). No token change.
- Calls the pairs raise, each with a recommendation in the pairs artifact: values sit left in one
  column; the label column follows the labels rather than the mock's fixed split; divided rows make
  long reviews taller; the Profile's settings become one card while its account, garden and help
  cards stay; the send review's Change moves to an icon button; the account status rows stay status
  cards; and pool readiness now shows its words.

## Step 19: unused card code (PRD-1286)

- Two passes, because steps 14 to 18 move card consumers in parallel. The first pass is
  `feature/app-cockpit-unused-card-code`, cut from `develop` `a3645441c`; its guide wording is the
  standards-only `feature/app-cockpit-unused-card-code-guides`, merged as #1235.
- **Removed, nothing rendered them:** `CardBase` with Shared's own `Card` and their header, title,
  body and footer parts, `cardVariants` and `surfaceCardVariants` (and the
  `./components/Cards/CardBase` export, so the API index and the four seam fingerprints are
  regenerated); `StatCard`; `ProposalCardConviction` (the Governance panel draws its own proposal
  rows); the list toolbar and sort control, `ListToolbar` and `SortSelect`, which the cockpit's
  `AdminSearchToolbar` and `AdminSortSelect` replaced (the Hub's sort choices keep their own type,
  and their three strings stay, since the cockpit's controls read them); and the work row's
  `getStatusBorderClass`, unused since the row's status edge became `data-edge` (DL-102). Their
  stories go with them, and the Foundation token story draws its panels on `.gg-card`.
- **Solid, as DL-108 requires:** `Surface` draws its four levels solid and drops its glass
  elevations and the `solid-*` names (`FormFlow` asks for `raised`), so the Hub's empty, error and
  loading frame (`EmptyStateShell` on the ground level) loses its 8px blur and its gradient its
  alpha; the garden menu takes the chip's own raised surface (`--surface-raised`), with its
  divider on the surface's hairline so it still shows on the dark card; the cockpit's AppBar and
  single-action FAB tooltips take `AdminTooltip`'s solid inverse surface; and the app's install
  and offline strips are opaque with no blur. The `glass-ground`, `glass-floating` and
  `glass-overlay` utilities, the Glass story and the two glass tokens nothing read are gone, and
  the `theme.css` comments point at surfaces.md § Solid Surfaces.
- Proof: the Shared, app and cockpit suites and typechecks, and the pairs, **Storybook** for the
  cockpit and the strips' stories and **mock-auth localhost** for the app's strips
  ([eval.md](../eval.md#step-19-proof-unused-card-code-and-solid-surfaces)). No authenticated
  class: none of the changed files is on a browser-proof path.
- **The second pass**, after steps 14 to 18 merge: `VaultPositionCard`, which nothing renders
  (step 18's object); `WorkbenchRow`, which nothing renders, and the `glass-raised` that
  `WorkbenchCard` and `WorkbenchList` still carry (step 16's records); and the two app wrappers
  that share their Shared card's name, `GardenCard` and the work row's `Cards/Work/WorkCard`
  module (step 16 makes the garden card a media card).
- Not in the step: Shared's `MainSheet` still carries `glass-surface` and renders only in cockpit
  stories; the cockpit's glass guard in `check-tokens.sh` scans `packages/admin/src` only, which is
  how the glass in Shared and the app went unflagged; and when the app is offline in a mobile
  browser the 16px offline strip covers only the top of the 24px install strip.

## TDD Proof

- Lane mode: `required` in `status.json`, because step 1's offline face changes service-worker
  behaviour. Its RED and GREEN proof follow the testing contract and are recorded with
  `node scripts/harness/plan-hub.mjs record-tdd` before the lane closes.
- Recorded with `record-tdd` on 2026-10-23, after the maintainer chose to close #1189 and port its
  vietnamese subset (#1197), with `develop`'s `tests/specs/client.pwa-preview.spec.ts`
  (`55b0b9b86`) and the policy's command `PLAYWRIGHT_JSON_OUTPUT_FILE=<file> bun run browser e2e
  --preset pwa-preview -- --workers=1 --reporter=line,json`, run in this worktree:
  - RED at `671bc8220` (`develop` just before #1190) with that spec file checked out over it:
    1 failed, at spec line 95, `page.evaluate: TypeError: Failed to fetch`, when the offline page
    fetches `/fonts/jakarta-latin-normal.woff2`: no face is served or precached. The offline
    shell's earlier assertions pass.
  - GREEN at `develop` `65df3ad13`: 1 passed (55.3s).
  - #1197's dot-below assertion: 1 failed at spec line 138 with its faces removed, and 1 passed
    with them (1.2m).
- RED and GREEN: not applicable to the token slices themselves (pure styling).
- Proof limit: step 1's face and role names and step 2 `not_applicable`; step 3's solid focus ring
  is rendered-only behaviour and records `proof_limit` with its rendered evidence. Step 4's badge
  is a styling recipe with one small component: its rules have a focused test (a mutated cap
  fails it, the restored one passes), and its look is `proof_limit` on the approved pairs.
  Step 5 changes the tab rail's structure, so its layout has behaviour proof in the browser: the
  two layout stories above, with the cap mutated away the desktop one fails; selection, keyboard
  and the accessible names keep their existing story and unit tests. Its look is `proof_limit` on
  the rendered pairs.
  Step 21's bar pill is styling, `not_applicable` for RED and GREEN: its story plays fail when the
  12px padding or the pill's fill comes back, and its look is `proof_limit` on the pairs.
- Step 7: tests written beside the code, then replayed against `develop`'s components (the branch's
  tests over `ce0d71953`'s source, swapped into the worktree): 15 of 52 failed across the 7 files,
  each on step 7's behaviour (short ages, one pill, the row's details and Discard, the phone queue's
  rows and skeletons, the card surface, the cockpit's new tokens), 3 of them only because they read
  the title from the row's title slot; the ItemRow file failed to import. All pass on the branch. The
  feedback test, added after the replay, fails with the row's feedback fallback removed and passes
  restored. The look is `proof_limit` on the pairs.

## Validation Receipt

Latest, the face's merged head (#1172):

- Tested implementation commit SHA: `10694c2b3`, the develop merge that #1172 merged as, on a clean
  tree with the rig's capture story moved out.
- Run at (UTC): 2026-10-21 23:59:28 to 2026-10-22 00:02:28.
- Exact command(s): `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts
  --test-path client:src/__tests__/bootFallback.test.tsx --test-path
  client:src/__tests__/presentationTypeface.test.ts --test-path
  client:src/__tests__/config/sharedLink.test.ts --test-path
  docs:src/components/docs/designTokens.test.ts --test-path
  shared:src/__tests__/styles/utilities.test.ts --test-path
  shared:src/__tests__/styles/buttonShape.guard.test.ts --test-path
  agent:src/__tests__/locale-terms.test.ts --test-path agent:src/__tests__/i18n.test.ts`.
- Result: 17 of 17 passed fresh: format, lint, test-quality, shared-test, client-test,
  client-build, agent-test, docs-authority, docs-test, staged-modules, source-structure, ontology,
  agent-guidance, story-quality, storybook-build, docs-generated and em-dashes. browser-proof is
  pending (manual and advisory; see the pull request). CI Gate then passed on the same head.
- Validated paths: #1172's branch against `develop` at `cfd1aaf83`.
- Worktree identity command and result: `git rev-parse --show-toplevel && git branch
  --show-current` gave `.claude/worktrees/app-cockpit-unification` and
  `feature/app-cockpit-typeface`, at `10694c2b3`.
- #1175 and #1176 record their own gates in their pull request descriptions.

Earlier, the face's first gate:

- Tested implementation commit SHA: step 1's face and guides, `9ef990bc1` and `829aaf9e9`; the gate
  ran at head `b0fb7f4dc` on a clean tree.
- Run at (UTC): 2026-10-21, 08:03 to 08:08.
- Exact command(s): `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts
  --test-path shared:src/__tests__/styles/buttonShape.guard.test.ts --test-path
  docs:src/components/docs/designTokens.test.ts --test-path agent:src/__tests__/i18n.test.ts
  --test-path agent:src/__tests__/locale-terms.test.ts`, then each check it left unrun by its own
  command from `scripts/data/validation-policy.json`.
- Result: format, lint, test-quality, shared-test, client-build and agent-test passed in the gate.
  docs-authority failed on this worktree's linked installs: `docs/scripts/docs-audit.mjs` imports
  `@babel/parser` 8.0.4, which `develop` added to the docs package on 2026-10-18 and the main
  checkout's store lacks. Run separately, everything else passed: docs-authority's other tests and
  generate check, docs-test, staged-modules, source-structure, ontology, agent-guidance,
  story-quality, docs-generated, em-dashes and storybook-build. The Design workflow's checks
  (DesignMD and docs projections, `design.md lint` on the five guides, design tokens, vocabulary,
  guidance examples and links) passed on the same content before the commit. Not run locally: the
  docs audit; CI runs it. browser-proof is pending (manual and advisory; see the pull request).
- Validated paths: the branch against `develop`: step 1's code, guides, guards, stories, generated
  files and these hub records.
- Worktree identity command and result: `git rev-parse --show-toplevel && git branch
  --show-current` gave `.claude/worktrees/app-cockpit-unification` and
  `feature/app-cockpit-typeface`.

## Task Record

Task record: PRD-1266 steps 1 to 3 (PRD-1267, PRD-1268, PRD-1269) | Type: feature | Outcome: partial: steps 1 to 3 merged; the installed-app Brave proof and step 2's browser-proof remain
Agent/model: Claude Code / claude-opus-5-5 | Coverage: the 2026-10-23 continuation, from the maintainer's handoff to the five merges

| Phase | Start → end (UTC) | Result / evidence or blocker |
|---|---|---|
| Investigate | 2026-10-23T17:18:34Z → unknown | The hub, the token-slice drafts and #1189 against `develop` after #1190 |
| Implement (step 2) | unknown → 17:46:11Z | The four drafts replayed and finished; the first commit attempt |
| Wait | 17:46:11Z → 18:26:51Z | The signing key had lapsed in its agent; resolved when the maintainer unlocked it |
| Verify (step 2) | unknown → 18:27:14Z, mostly inside the wait | Contrast audit and rendered pairs ([eval.md](../eval.md#step-2-proof-ground-and-dark-ladder)), the Brave tab proof, the offline face's RED and GREEN ([TDD Proof](#tdd-proof)) |
| Publish (step 2) | 18:27:14Z → 18:51:18Z | `c9b1fd66a` to `fc65a91d5`; #1191 opened 18:41:02Z, its guides #1193 at 18:51:18Z |
| Wait | 18:33:08Z → 18:34:23Z | Three maintainer decisions: #1189, a frozen install for the gate, stacking step 3; resolved, and #1189 closed at 18:34:57Z |
| Implement, verify, publish (step 3 and the vietnamese subset) | 18:51:18Z → 19:20:18Z | `be3747bd9` to `1f00b560e`; #1195 opened 19:11:40Z, #1196 19:13:12Z, #1197 19:20:18Z |
| Publish (hub record) | 19:25:09Z → 19:36:04Z | `2d5710501` and this record, pushed to #1191 |
| Verify and fix (current-head CI and review) | 19:25Z → 21:22:34Z | The shared-link boot harness (`a0ecdc1ed`); from review, white on the lifted status fills (`4b1bea68a`), the browser tab's dark ground (`4b641bc0b`), a nested dark outline (`bd90cf7b9`) and the toast tone (`6ca6c24b7`); `develop`'s parity self-test (`2e6bdcfe4`); the SiteHeader story's wait for the desktop breakpoint (`4b261d405`); Playwright runner-setup failures rerun |
| Wait | 19:42:59Z → 20:57:54Z | The merge decision; resolved by the maintainer's approval, relayed by the coordinating session |
| Publish (merges) | 21:01:12Z → 21:24:59Z | Five merges in the maintainer's order (see Lane) |

Human corrections: 0 observed (the coordinating session asked at 20:47:29Z for the SiteHeader failure to be fixed or named as a blocker rather than rerun); attention: unknown.

## Risks / Blockers

- The garden-scoped PWA Home builds in parallel on these tokens and recipes and must not restyle
  them; coordinate through merges to `develop`, tokens first.
- The pairs rig and its frames stay outside Git: the app frames show public gardens' photos.
- Since 21 October the worktree has its own frozen install of `develop`'s lockfile. The docs audit
  runs here (it passed in the gate on `10694c2b3`), and installs no longer resolve outside the
  worktree, the reason Storybook's story tests once needed a temporary `fs.allow`.
- The rig's capture story, `packages/admin/src/views/__capture__/CockpitLocales.stories.tsx`, stays
  untracked. Move it out of the worktree before a push gate and back afterwards.
