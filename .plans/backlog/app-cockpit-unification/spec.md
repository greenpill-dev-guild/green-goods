# One Look for the App and the Cockpit — Specification

**Status:** research and design proposal. Thirteen decisions are open and none is accepted.
**Evidence date:** 2026-10-09 for the divergence ledger (code read at `develop` `288e9ab46`), and
2026-10-10 for the component readings behind the design lab. Code references describe the inspected
tree, not a deployment. Recheck them when implementation starts.

The target is the installed app (`packages/client`, PWA presentation) and the steward cockpit
(`packages/admin`). The public website is out of scope except where a shared piece touches it.

## Summary

The two surfaces are not two design systems. They share the colour primitives, the semantic ink and
stone roles, the green action pair, the spring tokens, the status palette, the toast, the alert, the
status badge, the address display, the sheet slots and the icon set. Five decisions taken on
different days make them read as two products:

1. **The typeface:** Inter in the app, Plus Jakarta Sans in the cockpit.
2. **The ground:** a white canvas with white and grey cards in the app, a linen canvas with white
   cards in the cockpit.
3. **The control shape:** 16px corners and capsule chips in the app, pills and 8px chips in the
   cockpit.
4. **The chrome recipes:** tabs, count badges, the navigation highlight, the sheet surface, cards
   and work items, empty states.
5. **The accent model:** one green in the app, a tone per workspace in the cockpit.

The first two carry most of the visual distance and cost only token edits. The third is identity
and stays a dial. The fourth is where new shared elements come from. The fifth is the cockpit's and
stays.

## Evidence and its limits

- **Code.** The guides, token files and components listed under [Sources](#sources).
- **Rendered: Storybook.** The deployed Storybook build, headless Chromium through Playwright, phone
  frames at 390×844 and 2x, light and dark. The frames and their captions are in
  [artifacts/README.md](artifacts/README.md#the-captures). This is Storybook evidence, never
  authenticated-session proof, and a deployed Storybook can lag `develop`.
- **Story gaps.** The app's Home and Profile captures are story shells, not the shipped views. The
  Hub route stories render an empty queue, so the cockpit's work card was read from its source.
- **The design lab** ([artifacts/design-lab.html](artifacts/design-lab.html)) is a hand-built mock
  drawn with the token values and type sizes read from the sources. It helps choose a direction. It
  proves nothing about the shipped interface.

Not verified by this research:

- No real device and no authenticated session.
- No Spanish or Portuguese width with a different typeface. The existing copy and layout width
  checks should run before a typeface change is shown as a rendered pair.
- Font loading on a slow connection. The app's preload and its static loading screen would need
  re-timing for a second family.
- Contrast of green text on linen for the app's exact token set. The cockpit's own audit covers the
  cockpit's tokens only.
- A populated Hub queue in Storybook.

## Sources

Read these owners before changing their behaviour. This is a bounded evidence map, not a second
inventory of tokens or components.

| Question | Source and what it settles |
|---|---|
| What is canonical? | Root [DESIGN.md](../../../DESIGN.md): the Warm Earth roles and tokens. The neutral role is linen; the typography table is where the two faces split. |
| What is the app's dialect? | [DESIGN.pwa.md](../../../packages/client/DESIGN.pwa.md): the face, sheet tiers and header, action bars, state anatomy, the mint dark accent. |
| What is the cockpit's dialect? | [packages/admin/DESIGN.md](../../../packages/admin/DESIGN.md): strict Material 3, the compact metric, the four-use tone budget, Controlled Chrome, the radius set. |
| Which decisions are locked? | The [decision log](../../../.claude/skills/design/decision-log.md) and the [frontend rules](../../../.claude/rules/frontend-design.md) (Rules 18 and 19). |
| Where do the runtime tokens live? | Shared [theme.css](../../../packages/shared/src/styles/theme.css) holds the app's white canvas, its hairline and its blue focus ring. The cockpit's remaps, warm ladders and tones are in [index.css](../../../packages/admin/src/index.css) and [admin-m3-tokens.css](../../../packages/admin/src/styles/admin-m3-tokens.css). |
| How does the cockpit re-skin a shared piece? | It sets the family's `--gg-*` tokens once in its `index.css` (DL-031). [AdminDensityScale.guard.test.tsx](../../../packages/admin/src/__tests__/components/AdminDensityScale.guard.test.tsx) pins that block. |
| Tabs | [StandardTabs.tsx](../../../packages/client/src/components/Navigation/Tabs/StandardTabs.tsx) and [AdminTabRail.tsx](../../../packages/admin/src/components/AdminTabRail.tsx). |
| Chips and filters | Shared [Chip.tsx](../../../packages/shared/src/components/Chip.tsx), the app's filter button in [Home](../../../packages/client/src/views/Home/index.tsx) and its [filter sheet](../../../packages/client/src/views/Home/GardenFilters/index.tsx); the cockpit's [AdminFilterChip.tsx](../../../packages/admin/src/components/AdminFilterChip.tsx) and [AdminSortSelect.tsx](../../../packages/admin/src/components/AdminSortSelect.tsx). |
| Count badges | The app's [AppBar.tsx](../../../packages/client/src/components/Layout/AppBar.tsx), the [Your Work launcher](../../../packages/client/src/views/Home/WorkDashboard/Icon.tsx), the [Promises launcher](../../../packages/client/src/views/Home/CommitmentsSheet/Launcher.tsx), the Home filter count, `StandardTabs` and the [AppSheet](../../../packages/client/src/components/Sheets/AppSheet.tsx) tabs; the cockpit's `AdminTabRail`. |
| Cards and work items | [CardBase.tsx](../../../packages/shared/src/components/Cards/CardBase.tsx), the client [Card.tsx](../../../packages/client/src/components/Cards/Card.tsx) and shared [WorkCard.tsx](../../../packages/shared/src/components/Cards/WorkCard/WorkCard.tsx); the cockpit's [AdminCard.tsx](../../../packages/admin/src/components/AdminCard.tsx), [HubWorkCard.tsx](../../../packages/admin/src/views/Hub/components/HubWorkCard.tsx) and the grid in [admin-layout.css](../../../packages/admin/src/styles/admin-layout.css); shared [WorkbenchRow.tsx](../../../packages/shared/src/components/Canvas/WorkbenchRow.tsx). |
| Sheets | Shared [PwaSheet.tsx](../../../packages/shared/src/components/Dialog/PwaSheet.tsx) and [SheetHeader.tsx](../../../packages/shared/src/components/Dialog/SheetHeader.tsx); the cockpit's [AdminDialog.tsx](../../../packages/admin/src/components/AdminDialog.tsx). |
| Bottom bars | The app's `AppBar.tsx` and the cockpit's [NavigationBar.tsx](../../../packages/admin/src/components/Shell/NavigationBar.tsx). |
| What does Storybook already measure? | The design-system pages grade each surface against [rules.ts](../../../packages/shared/.storybook/design-system/rules.ts) and [surfaces.css](../../../packages/shared/.storybook/surfaces.css). |

## The divergence ledger

Every row was read from the shipped CSS and components. "Shared?" says whether one module already
renders on both surfaces. "Proposal" is this research's suggestion; the forks it names are in
[Decisions to resolve](#decisions-to-resolve).

| Element | App today | Cockpit today | Shared? | Proposal |
|---|---|---|---|---|
| Typeface | Inter variable (opsz 14 to 32), loaded in `index.html` | Plus Jakarta Sans 400/500/600/700, imported in `index.css` | No | One family on both (F1). The density presets stay. |
| Type scale | Body 16/24, labels 16 and 14, sheet title 18/600, page title 18 to 24 | Body 14/20, meta 12, labels 14, chips 11, titles 16/600 and 22/600 | Tokens yes, roles no | Keep two density presets (app 16, cockpit 14) on one named role set. |
| Canvas | `--bg-white-0` = `#FFFFFF` | `--m3-surface-container-low` = `#FAF8F5` linen | No | Linen on both; it is the DesignMD neutral (F2). |
| Cards | White with a `#F5F5F4` hairline (1.09:1) and a faint shadow, 24px; work rows 16px with a 2px status edge; grey `#FAFAF9` filled cards | White, elevation 1, 12px (`AdminCard`) | No | One card surface and one work-row anatomy on both; corner per surface, 24 and 16 app, 12 cockpit (F7). |
| Dark ladder | Stone: canvas `#0C0A09`; cards the same `#0C0A09` with a `#292524` hairline | Warm hue 65: canvas `#110C08`, cards `#201913`, ring elevation | No | One warm ladder defined once in `theme.css`, consumed by both (F2). |
| Accent fill | `green-800 #1A7544`, white ink; dark mint `#C2F5DA` with ink | Garden tone `green-800`; dark `green-200` (the same mint) with `green-900` ink | Values yes | Already equal in light. Align the dark ink (one of ink or green-900). |
| Workspace tone | Single green | Hub blue, Garden green, Community amber, Actions purple, Home stone (four-use budget) | No | Keep as cockpit identity. The app's garden pages already match the Garden tone. |
| Buttons | `Button`: 48/44/40/32, 16px corner (12 pressed), weight 400, label 16/14, 48px hit | `AdminButton`: 40/32/28 pills, weight 500, label 14, 44px hit, no morph | Mechanism yes (DL-031 tokens) | Keep the corner per surface; unify weight and the outline token (F3). |
| Outline contrast | Secondary buttons, chips and fields use `--stroke-sub-300` (`#D6D3D1`, 1.49:1 on white) | `--m3-outline` = `neutral-500` (4.8:1) | No | Adopt a control-grade boundary token on both. The app's current boundary fails the 3:1 non-text minimum. |
| Fields | Outlined 16px, 48/44/40, label above at 14/500, two-line message reserve (DL-018) | Filled with an underline (default) or outlined 8px, 44 touch / 40 desktop, floating 12px label, one-line reserve (DL-064) | Control classes yes | Outlined on both, one label and message anatomy; corner per surface (F3). |
| Chips | `Chip`: 32px capsule, white with a stroke, selected = green fill with white text | `AdminFilterChip`: 32px, 8px corners, selected = grey container, no check (DL-065) | No | Capsule on both, one selected treatment (F4). |
| Tabs | `StandardTabs`: tinted active fill plus underline, solid green count badge, 44px rows | `AdminTabRail`: underline rail, tone label, grey count chip that flips to the tone container, 36px | No | The app's equal-width tinted tabs on both; row height per surface (F8). |
| Count badges | Four styles, all solid green: bar 16px 10/700; launchers 18px 12/600 with a white ring; filter count a 10px-tall pill, 10/600; tab 16px 12/500 | Tab chip 18px 12/600, grey container that flips to the tone container | No | One 16px badge, 11/600, solid accent on both (F10). |
| Filter control | Round `IconButton` with a count badge opening a sheet; Your Work uses compact selects | `AdminFilterChip` row plus `AdminSortSelect` inline in the toolbar | No | The app's button on both; scopes move into the sheet (F9). |
| List spacing | 12px between work cards | 14px grid gap; divided `WorkbenchList` for records | No | 12px on both (F11). |
| Work card on desktop | Not rendered on desktop | `HubWorkCard`: 16:9 mosaic on top, three per row at 1280, four from about 1300px | No | Mosaic kept, laid wide on the left, two per row (F12). |
| Dark cards | The canvas colour with a `#292524` hairline | `#201913` on `#110C08`, 6% ring; six lightness points above the canvas | No | Card one step lighter with an 8% ring on both (F13). |
| Status badge | `StatusBadge`: tinted capsule with an icon, sizes xs, sm and md | The same `StatusBadge` | Yes | Already one piece. Proof that the shared route works. |
| Icon buttons | `IconButton` circles 48 to 32, secondary = white with a hairline | `AdminIconButton` circles 40 to 28, state layer only, 44px hit | Mechanism yes | Keep each surface's circles and sizes. The filter trigger follows F9. |
| Bottom bar | Three tabs, white, top corners 16px, filled icon and green label when active, 14px labels | Four tabs plus FAB, 85% surface with 12px blur and a warm shadow; active = tone pill, 12px labels | No (admin forks the shared bar) | Keep each chrome; share the active recipe (pill behind the icon) (F6). |
| Sheets on phones | `PwaSheet`: white, grip, shared header (DL-028), four height tiers, native drag (DL-033) | `AdminDialog`: warm grey `surface-container-high`, 16px top corners, 22px title, no grip | Header slots yes | One sheet surface and header on both (F5). |
| Empty, loading, error | Upper-middle anchor, 14/600 title in sheets (DL-036, DL-056), `AppScreenError` | 72px circle tile, 22/600 title, 16px body (`EmptyState`, Canvas states) | Shell yes | One anatomy with two sizes, driven by the density preset. |
| Focus ring | `--focus-ring` = `blue-500` (blue on a green app) | `--tone-focus-ring` (the workspace tone) | No | The app rings in `--primary-on-surface`; one focus role on both. |
| Motion and press | Press morph, card press-in, haptics (DL-039, DL-041), expressive scheme allowed | Standard scheme, elevation step or ink layer, no lifts | Spring tokens yes | Keep as identity. Nothing to unify. |
| Glass | None in practice (dialogs are solid) | The nav dock only | n/a | Declare it: solid surfaces everywhere, one translucent dock in the cockpit. Retire the unused five-thickness material spec. |

Three measurements behind the rows:

- The app's secondary control boundary is `--stroke-sub-300` (`#D6D3D1`), 1.49:1 on white. The
  cockpit's is `--m3-outline` (`neutral-500`), 4.8:1. The 3:1 minimum for a control boundary is met
  only by the cockpit.
- The app's card hairline is `--stroke-soft-200`, which resolves to `neutral-100` (`#F5F5F4`), 1.09:1
  on white. In dark the app's cards take the canvas colour and a `#292524` hairline.
- The dark accent is already the same mint (`green-200`, `#C2F5DA`) on both surfaces.

## What is already shared

The pieces both surfaces render today are the ones people meet most: `Alert`, `StatusBadge`,
`AddressDisplay`, the toast (DL-060), the list primitives, the sheet body and footer slots,
`ImageWithFallback`, `FileUploadField`, `DatePicker`, the confidence selector, the audio pieces and
the empty-state shell. [GardenChip](../../../packages/shared/src/components/Canvas/GardenChip.tsx) is
shared code that only the cockpit renders today.

The important precedent is how the cockpit handles a shared piece it did not design: it does not
restyle it. It sets the family's tokens once, and every shared button, chip, switch and field lands
on the cockpit's metric (DL-031). Unification is that mechanism applied one level up. The typeface,
the ground, the dark ladder and the chrome recipes become surface tokens too, and each surface sets
its own values for the few that stay different.

## Proposal: one language, two dialects

Three tiers. The first is identical on both surfaces. The second is a short list of dials each
surface sets. The third never crosses.

**Shared core (identical)**

- Ground: linen canvas, white cards, one warm dark ladder.
- One typeface with named roles (title, body, label, meta).
- The status palette and the `StatusBadge` sizes.
- Chips as capsules with one selected treatment.
- Tabs: the app's equal-width tinted cells.
- One count badge.
- One card surface, one work-item anatomy, one list gap.
- A control-grade outline token and one focus-ring role.
- The phone sheet surface and the shared `SheetHeader`.
- Empty, loading and error anatomy in two sizes.
- The garden context chip.
- The bottom bar's active recipe.
- Toasts, alerts, addresses and names, which are already one piece.

**Dialect dials (set per surface)**

- Density: the app keeps a 16px body, 48/44/40/32 controls and a 48px hit area. The cockpit keeps a
  14px body, 40/32/28 controls and a 44px hit area.
- Button corner: 16px in the app (12px while pressed), a pill in the cockpit.
- Card corner: 24px in the app and 16px on its work rows, 12px in the cockpit.
- Work item layout: a row on a phone; the cockpit's mosaic card on desktop.
- Accent model: one green in the app, a tone per workspace in the cockpit on its four-use budget.
- Motion: the app's press morph and haptics; the cockpit's elevation steps.
- Navigation chrome: the app's three-tab solid bar; the cockpit's four-tab bar, dock and speed dial.
- Copy voice: the app speaks to the community, the cockpit to the steward.

**Never crosses**

- Hero moments, haptics and the press listener (app only).
- The speed dial, workspace tone and the one translucent dock (cockpit only).
- The editorial serif (website only).

The levers, ranked by visible change per unit of work:

1. **The typeface.** One font-family declaration per app and the font links in the app's
   `index.html`. The largest visible change on every screen. Every width that was fitted in Inter
   must be re-measured, because Plus Jakarta Sans runs about 5 to 8% wider.
2. **The ground.** Point the app's canvas at linen, its cards at white, and both dark themes at one
   ladder. Token edits only. The risks are contrast on linen and the app's static loading screen,
   which paints its own colours before styles load.
3. **The chrome recipes.** Tabs, chips, the filter button, the count badge, cards and lists, the
   sheet surface, empty states, the bar's active state. Each is a small component or token change,
   but together they touch every route, so they follow the first two.

## Requirements

| ID | Requirement | Basis |
|---|---|---|
| R1 | Layouts, routes, flows and permissions do not change. | Stated direction. |
| R2 | Both surfaces read as one product: one typeface, one ground, shared chrome recipes. | Stated direction; the diagnosis above. |
| R3 | Each surface keeps a recognisable dialect: density, corners, accent model, motion, navigation chrome. | Stated direction ("some variance"). |
| R4 | A shared element is one module that each surface tunes through tokens. Neither surface restyles a shared piece. | DL-031, Rules 18 and 19. |
| R5 | Cards, tabs, the filter control, the count badge, list spacing, the desktop work card and the cockpit's dark cards follow the accepted forks F7 to F13. | Stated direction, items 4 to 11 of the brief. |
| R6 | Control boundaries meet 3:1, text meets its existing contrast floor on the new ground, and one focus-ring role serves both surfaces. | The measurements above; existing accessibility rules. |
| R7 | No fitted width regresses in English, Spanish or Portuguese at phone widths. | Existing width and line rules in the app's design guide. |
| R8 | The work is tracked as part of the Cosmo-Local project once the forks are decided. | Stated direction. |

## Decisions to resolve

Each fork lists its options with the recommendation first, then what it touches and where it
stands. "Stated preference" means the maintainer said so while reviewing the lab; it is not yet an
accepted decision. The lab switches every option live.

| Fork | Recommendation | Standing |
|---|---|---|
| F1 Typeface | Plus Jakarta Sans on both | Open |
| F2 Ground | Linen canvas, white cards, one dark ladder | Leaning: the cockpit's light mode is the look to bring to the app |
| F3 Controls | Corner per surface; unify weight, outline and field anatomy | Open |
| F4 Chips | Capsules on both | Open |
| F5 Phone sheets | One surface and header | Open |
| F6 Bottom bar | Pill behind the active icon on both | Open |
| F7 Cards and rows | One surface and row anatomy, corner per surface | Asked for; where to unify and where to vary is open |
| F8 Tabs | The app's tabs on both, equal width | Stated preference |
| F9 Filter control | The app's filter button on both | Stated preference |
| F10 Count badge | One 16px badge, 11px semibold | Asked to settle on one |
| F11 List spacing | 12px gap on both | Stated: the cockpit list needs a gap; the size is open |
| F12 Desktop work card | Wide, mosaic on the left | Stated preference |
| F13 Dark cards | Card one step lighter | Asked to explore |

### F1 One typeface

- **Plus Jakarta Sans on both** (recommended): the cockpit's face becomes the product face. The app
  keeps its 16px body and its own sizes.
- **Inter on both**: smaller glyphs and optical sizing favour dense small text, but the cockpit
  loses its warmth marker.
- **Keep the split**: fails the goal; every other change then reads as two products in one palette.

Touches the app's `index.html` (font links and the static loading screen), its `index.css`, the root
`DESIGN.md` typography table, `DESIGN.pwa.md`, both prompt contracts, and
[banned-vocabulary.json](../../../scripts/data/banned-vocabulary.json), whose client prompt list
names the cockpit's face as a term to avoid.

### F2 One ground

- **Linen canvas, white cards, one dark ladder** (recommended): the canonical neutral is linen and
  the cockpit already does this. The app's white-on-white cards become white on linen.
- **White canvas on both**: the cockpit loses its warm ground, and white cards on white need a
  shadow or a stronger line everywhere.
- **Keep the split**: the gardener surface stays colder than the steward surface.

Touches the app-scope surface tokens and the dark block in `theme.css`, the static loading screen's
colours, and the app's token audit. Every green-on-surface ratio was measured on white.

### F3 Controls: corners and fields

- **Keep the corner per surface; unify the rest** (recommended): pills stay the cockpit's and 16px
  stays the app's (DL-026 already allows one corner per surface). Both take label weight 500, a
  control-grade outline, and one field anatomy: outlined, label above, one message line.
- **16px everywhere**: the cockpit drops its pills and its shape scale, which reopens the strict
  Material 3 decision.
- **Pills everywhere**: the app's buttons stop matching its fields, the mismatch DL-029 fixed.

The cockpit's filled field with an underline is the most Material-specific piece on either surface.
Its outlined variant already exists, so converging is a default change, not a new component. The
app's secondary boundary should move to a 3:1 token under any option.

### F4 Chips

- **Capsule chips on both** (recommended): the capsule is the language's shape for "pick me", and
  selected stays a solid accent fill.
- **Keep both**: two filter vocabularies for the same job.
- **The app adopts the cockpit's 8px chip**: breaks the capsule rule where it reads best.

DL-065 (no check mark on a selected chip) carries over unchanged.

### F5 Sheets on phones

- **One sheet surface and header** (recommended): a white surface, the grip and the shared
  `SheetHeader` on both. `AdminDialog` keeps its centered desktop form; only its phone presentation
  changes.
- **Keep the cockpit's warm grey sheet**: a steward on a phone sees two sheet materials in one day.
- **The app adopts the cockpit's sheet**: loses the grip and the native drag (DL-033).

The title size stays per density (18px in the app, 22px in the cockpit). Drag-to-dismiss is
behaviour and stays the app's.

### F6 The bottom bar's active state

- **Pill behind the active icon on both** (recommended): the cockpit's recipe, in green in the app.
  Each bar keeps its chrome.
- **Filled icon on both**: the cockpit loses the tone use that orients a steward across workspaces.
- **Keep both**: the most repeated element stays the most different.

The app's bar stays solid. A backdrop blur costs frames on the low-end phones the app targets.

### F7 Cards and rows

- **One card surface and one row anatomy, corner per surface** (recommended): a white card with one
  visible hairline and no drop shadow on both. On a phone a work item is one row on both surfaces
  (media tile, title, status pill, one meta line); on desktop the cockpit keeps its mosaic card
  (F12). The app keeps its corners and its 2px status edge; the cockpit keeps 12px.
- **App cards everywhere**: 24px bordered cards and 88px media rows. The cockpit's phone queue
  loses the mosaic stewards scan.
- **Cockpit cards everywhere**: 12px elevated cards and the mosaic work card on both. The app's
  lists grow about three times taller per item.

A work item has three anatomies today: the shared `WorkCard` row in the app, the cockpit's
`HubWorkCard` mosaic, and the shared `WorkbenchRow` for record lists.

### F8 Tabs

- **The app's tabs on both, equal width** (recommended): `StandardTabs` as shipped. Equal cells, a
  tinted active cell with a 2px underline, a solid count badge, an icon when a tab has one. On
  desktop the row is capped (720px in the lab) so the cells stay readable.
- **The cockpit rail on both**: an underline rail at content width with the grey count chip. The
  app's four garden tabs would scroll at 320px.
- **Keep both**: two tab vocabularies for the same job.

Touches `AdminTabRail`: it gains the equal-width layout and the tinted active cell, and its count
chip becomes the shared badge. The tab height stays per surface (DL-011).

### F9 Filter control

- **The app's filter button on both** (recommended): a round outlined icon button with a count
  badge that opens a sheet of choices. The cockpit's toolbar keeps search and sort inline.
- **Inline chips on both**: the app's Your Work shows scope chips instead of its compact select.
- **Keep both**: the same job has a button in one surface and a chip row in the other.

DL-082 holds under every option: Pending and Approved stay scopes of one list. See the judgment
point below about where those two scopes live.

### F10 Count badge

- **One badge: 16px, 11px semibold, solid accent** (recommended): one size and weight everywhere,
  with a 2px surface ring only where the badge overlaps an icon.
- **The launcher badge everywhere**: 18px, 12px semibold, ringed. It is the one the code already
  calls the notification badge, and it is larger on the bar and in tabs than today's.
- **Keep them**: the same number drawn four ways in the app, five with the cockpit's grey tab chip.

The app draws a count four ways today: 16px with 10px bold on the bottom bar; 18px with 12px
semibold and a white ring on the Your Work and Promises launchers; a 10px-tall pill on the filter
button; 16px with 12px medium in tabs. The Your Work count appears on the bar and on its launcher at
the same time, in two of those styles.

### F11 List spacing

- **12px gap on both** (recommended): the app's gap today. The gap is what makes a card read as a
  card.
- **8px gap on both**: denser; cards start to read as one block on a phone.
- **One divided card on both**: rows inside one card. Suits settings rows, not work items.
- **Keep both**: 12px in the app, 14px in the cockpit's grid, none in its divided record lists.

### F12 Desktop work card

- **Wide, mosaic on the left** (recommended): `HubWorkCard` keeps its media mosaic and lies wide,
  with the title, action, gardener and age beside it. Two cards per row at 1280px instead of three
  tall ones, and about as many cards above the fold.
- **Tall, mosaic on top (today)**: three per row at 1280px, four from about 1300px.

Touches `HubWorkCard`'s layout from the desktop breakpoint and the grid's column rule. Phones keep
the tall card unless F7 says otherwise.

### F13 Dark cards

- **Card one step lighter** (recommended): the cockpit's dark card sits six lightness points above
  the canvas today (`#201913` at 22% on `#110C08` at 16%) with a 6% ring, which is why it blends.
  One ladder step up (`#2A231C`, 26%) with an 8% ring separates the cards and keeps the warm hue.
  Chips and wells on a card move up one step with it.
- **A hairline on today's card**: crisper, but a line around every card on a dark ground reads like
  a wireframe.
- **Lighter and a hairline**: the strongest separation and the busiest.
- **Keep today's**: the blend stays.

Touches the dark surface ladder and the first elevation step in `admin-m3-tokens.css`. With F2's one
ladder the app's dark cards follow the same step.

## Human judgment points

- **Locked decisions this reopens.** Strict Material 3 for the cockpit, including its pills and
  compact metric (DL-010, DL-011, DL-030, Rule 18); the app's corners (DL-029); the cockpit's chip
  (DL-065); and the guides and prompt vocabulary that assign each surface its face. Each accepted
  fork needs a new decision-log row that names what it supersedes.
- **F9 costs a tap.** Pending and Approved are one tap apart in the cockpit's toolbar today. Behind
  a filter button they are two. A steward working a queue may switch scope often, so one option is
  to keep those two scopes inline and use the button for everything else.
- **F8 on desktop.** Equal cells across a 1176px content column are very wide. The lab caps the row
  at 720px; the real cap needs a rendered pair.
- **F7 on the cockpit's phone.** The recommended row removes the mosaic from the phone queue. If
  stewards triage by photo on a phone, the mosaic card should stay there too.
- **The Cosmo-Local demonstration.** Only the token slice is small enough to precede it, and only if
  the width and contrast measurements pass. That call belongs to the maintainer.
- **Protected surfaces.** None of the work touches authentication, the job queue, signing or
  contracts. It touches Shared styles that the public website also reads, so every token change
  needs an explicit surface scope.

## Non-functional constraints

- **Package boundaries.** Tokens live in Shared `theme.css`. The cockpit tunes shared pieces through
  the `--gg-*` block and keeps `AdminButton` for its own views; the app's views keep the shared
  family. No new Shared export is needed for the token slice.
- **Performance.** No backdrop filter on the app's bar or sheets. A second font family must not
  delay first paint: preload it and keep the fallback metrics close.
- **Offline.** No data or queue behaviour changes. The static loading screen is hand-painted and
  must match the new ground and face.
- **Localization.** No new strings are expected. Every fitted width is re-measured in English,
  Spanish and Portuguese.
- **Accessibility.** Control boundaries at 3:1, the badge on the action pair (DL-017), the dark mint
  rules (DL-009, DL-088), unchanged hit areas, and reduced motion unaffected.
- **The public website.** It shares `theme.css` and `Button`. It keeps its own dialect, so app-scope
  changes must not reach it.

## Package and lane mapping

| Area | Lane | Notes |
|---|---|---|
| Surface tokens, shared components, app and cockpit views, guides | `ui` | Every slice in the plan. |
| State and API | `state_api` | Not applicable: no data, hook or store changes. |
| Contracts | `contracts` | Not applicable. |
| Review | `qa_pass_1`, then `qa_pass_2` | Sequential. |

## Risks

- **Width regressions from the typeface.** Measure before proposing, and land the face alone.
- **Contrast regressions** on linen and on a lifted dark card. Re-run the token audits with the
  change.
- **Guard churn.** The checks listed in [eval.md](eval.md#guards-the-work-trips) will fail until
  their expectations move with the change. They are updated, never bypassed.
- **Scope drift into layout.** R1 is an acceptance check, not a hope.
- **A mock is not a component.** The lab approximates proportions. No option is accepted from the
  lab alone.
