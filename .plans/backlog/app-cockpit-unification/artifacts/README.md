# Artifacts: the design lab, the card census and the Storybook captures

Three things live here: an interactive mock for choosing between the options in
[spec.md](../spec.md#decisions-to-resolve), a census of every card the two surfaces draw, and the
rendered evidence the diagnosis rests on.

## The design lab

[design-lab.html](design-lab.html) is one self-contained file. Download it and open it in a browser;
it needs no build and no server. The two typefaces load from Google Fonts and fall back to system
fonts offline.

The stage shows three frames side by side at one scale: the installed app as a 390px phone, the
cockpit as a 390px phone, and the cockpit at 1280px. The controls sit in a dock under the frames.
The dock stays pinned to the bottom of the window, and the frames size themselves to the room above
it, so every control is in view while you look at the frames. The dock's last line gives the scale
in use and describes the option under the pointer. Fit to window scrolls the lab into place. A
phone-width window stacks the frames and folds the dock behind a Controls button.

| Control | What it switches |
|---|---|
| Preset | Today, Recommended, or All shared: sets every fork at once. |
| App screen | Home, Garden (Promises tab), Your Work, Submit Work (Details step), Profile. |
| Cockpit screen | Hub, Garden, Community (Members), Create Assessment, Profile. Both cockpit frames follow it. On the desktop frame the flow opens as the centered dialog and Profile as the right side sheet. |
| Sheet | Opens a bottom sheet on the phones and a dialog on the desktop frame. |
| Theme | Light or dark for the frames. |
| Show | All three frames, the app phone with the cockpit desktop, or the two phones. |
| Controls | Below keeps the dock under the frames. Side moves it to a rail beside them, which leaves the full height to the frames and suits the two-phone view. The rail needs a window at least 1072px wide and scrolls in one shorter than 800px. |
| F1 to F13, Workspace tone | One control per decision in the specification, in number order. Each starts with Today, and a dot marks the recommended option. F13 only shows in the dark theme, so picking one of its options switches Theme to Dark. |
| Copy picks | Copies the fourteen picks as one line of text, for example `Lab picks: F1 Typeface: Jakarta; F2 Ground: Linen; ...`. The picks live only in the browser that made them, so this is how they reach a note, a review or the specification. Where a viewer blocks copying, the line appears selected under the controls instead. |

**It is a mock, not the product.** Each screen is hand-built HTML drawn with the token values and
type sizes read from the component sources named in the specification. It shows direction and
proportion. It proves nothing about the shipped interface. A pick made in it is accepted in
principle and locks only when a before and after pair of the real components has been approved (see
[spec.md](../spec.md#direction-accepted-in-principle)). Sample
names, gardens and addresses are invented.

The choices persist in the browser's local storage under `gg-lab-state-v5`. The block between the
`lab:start` and `lab:end` comments is the lab itself; the rest of the file is the page chrome that
lets it stand alone.

## The card census

[card-census.html](card-census.html) takes the cards object by object: work, commitments, actions,
assessments and hypercerts, gardens, people, jars, vaults and pools, facts, and empty and error
states, then the card primitives. Open it from this folder so it finds its images in `census/`.

- **Today** shows the real components, 45 captures from the deployed Storybook build of 18 October
  2026, headless Chromium at 2x in the light theme. **Evidence class: Storybook**, not a signed-in
  session. Each caption gives the component, its surface, its file and its size, read at `develop`
  `b30ac410f`. Components with no story are listed under each strip.
- **Proposed** draws the same object from the four shared shapes (item row, media card, fact row,
  state block) at the app's density and the cockpit's. Like the lab, it is a mock drawn from the
  tokens.
- **Your design system** comes first. The census reads the lab's saved forks from the same browser
  (`gg-lab-state-v5`) and draws every proposed card with them: typeface, ground, buttons, chips,
  cards, list spacing, desktop card, dark cards and workspace tone. With nothing saved it uses the
  picks recorded on 17 October. A change here is written back to the lab and keeps the lab's other
  settings. When the lab's values differ from the recorded picks, a note lists them and one button
  restores the recorded picks.
- **Status and titles** draws the same five cards with the status in five places: in the corner
  (today), under the title, on the photo, leading the detail line, and as a small label above the
  title. Each column counts the titles it cuts off, and a table repeats the count for English, long
  English, Spanish and Portuguese on hidden copies at the column's width. The recommendation is the
  pill leading the detail line.
- **Every card type** shows each object built from the shapes, one phone wide, with a title-lines
  switch per type. Since version 13 every row card shares one row height (72px by default), one
  title line and one detail line; two title lines stay available per type. A detail that does not
  fit drops out whole, last first.
- **The detail-line rules** (version 14) apply the five rules the maintainer agreed on 18 October
  to every proposed card: each type's details in the spec's order, the status and at most two
  details, nothing the card already shows, short ages and dates, and an action only on the row that
  needs the reader, in its right slot. The most important detail stays beside the status pill and
  shortens if it must. A Detail line switch shows the line as it was before the rules, and a table
  counts the details each version drops or shortens, in all four text sets.
- **Version 15** keeps every row card one height (the action takes the row's right slot instead of
  a line below the text), offers commitments, assessments and jars as item rows only, since they
  have no picture for a media card, adds the maintainer's 15 / 13 title size as the pick, and puts
  Copy picks on the folded tweaker bar.
- **Version 16** records the maintainer's picks, locked on 18 October: the census opens on them and
  marks them with dots, rows with the pill under the title take one fixed 88px height, a jar row
  carries one detail, and the rules box adds one pill per card.
- **The card tweaker** sits in a rail beside the census on a wide screen and folds into a panel at
  the bottom on a narrow one. Its live preview, pinned above the dials, draws the section in view or
  a chosen card type at the app's or the cockpit's density, with that type's title lines beside it.
  Its dials set the status layout, the detail line, the sample text, the row photo, the row height,
  the title and detail sizes, whether rows without a photo show an icon, where "Confirming…" shows,
  light or dark cards and which surface the object sheets show. Each object also has its own options and title lines beside its
  Proposed heading. A dot marks the pick, or the recommendation where nothing is decided. Copy picks
  puts every choice on one line, starting `Census picks:`, with the same fallbacks as the lab. The
  census's own choices persist under `gg-card-census-v2`.

The Spanish and Portuguese status words and progress lines come from the product's translation
files; titles, names and amounts are invented.

## The captures

**Evidence class: Storybook.** Every image under `captures/` is the deployed Storybook build at
design.greengoods.app, rendered by headless Chromium (Playwright) on 2026-10-09, phone frames at
390×844 and 2x, in light theme unless the name says dark. None of it is authenticated-session proof,
and a deployed Storybook can lag `develop`.

Read these limits before leaning on a frame:

- The app's Home and Profile frames are the `client-pwa-protectedsurfaces` story shells. They mock a
  header, a card and a tab row around the real bottom bar; they are not the shipped Home and Profile
  views. The lab's app screens were drawn from the view sources instead.
- The Hub route stories render the cockpit chrome with an empty queue, because the story garden has
  no seeded work. The cockpit's work card was read from its source, not from these frames.
- The green ring on the app sheet's Close button is the focus state after a scripted open.

### The same job on both surfaces

| Installed app | Steward cockpit |
|---|---|
| <img src="captures/pwa-home.webp" width="260" alt="App story shell: white canvas, tinted tabs, three-tab bottom bar"> | <img src="captures/admin-hub-phone.webp" width="260" alt="Cockpit Hub on a phone: linen canvas, garden chip, underline tabs, square filter chips, four-tab bar"> |
| Story shell with the real bottom bar: white canvas, Inter, tinted active tab, solid green counts. | Hub: linen canvas, Plus Jakarta Sans, the garden chip, underline tabs in the workspace blue, 8px filter chips, a blue floating action button, a four-tab bar with a pill highlight. |
| <img src="captures/pwa-profile.webp" width="260" alt="App story shell on the Profile tab"> | <img src="captures/admin-profile-phone.webp" width="260" alt="Cockpit Profile on a phone: square avatar tile, role chips, outlined selection cards"> |
| Story shell on the Profile tab. Filled icons mark the active bar tab. | Profile: a 16px route title with a description, a square avatar tile, grey role chips, outlined selection cards, an outlined pill action. |
| <img src="captures/pwa-sheet.webp" width="260" alt="App bottom sheet: white surface, grip, 18px title, full-width primary"> | <img src="captures/admin-dialog-phone.webp" width="260" alt="Cockpit dialog as a bottom sheet: warm grey surface, 22px title, pill primary"> |
| `PwaSheet`: white surface, a grip, an 18/600 title, a circle close, one full-width 48px primary with the 16px corner. | `AdminDialog` as a bottom sheet: warm grey surface, 16px top corners, a 22/600 title, no grip, a pill primary and a text Cancel in a white footer. |
| <img src="captures/pwa-home-dark.webp" width="260" alt="App story shell in dark theme"> | <img src="captures/admin-hub-phone-dark.webp" width="260" alt="Cockpit Hub on a phone in dark theme"> |
| Dark: near-black stone canvas (`#0C0A09`), mint marks and fills (`#C2F5DA`, DL-088). | Dark: warm brown-black ladder (`#110C08` canvas, `#201913` cards), tonal `-200` fills with `-900` ink (DL-009). |
| <img src="captures/pwa-submit-media.webp" width="260" alt="App Submit Work, Media step"> | <img src="captures/admin-dialog-flow.webp" width="520" alt="Cockpit flow dialog at 1280"> |
| Submit Work, Media step: named steps, the info card, the pinned promise card, a photo, and the fixed bar with three icon circles beside a 48px primary. | Flow dialog at 1280: the same composer grammar (DL-007) in a centered dialog with numbered sections, a hairline header and a pinned footer. |
| <img src="captures/pair-pwa-pool.webp" width="260" alt="App garden page, Promises tab"> | <img src="captures/pair-admin-confirmqueue.webp" width="520" alt="Cockpit Hub Confirm queue"> |
| Garden, Promises: season and campaign cards, rows with the 3px direction edge (DL-052), tinted state chips, the green floating action button. | Hub, Confirm: white 12px cards, a progress bar in the Hub blue, decision rows with two pills. The status chips are the shared `StatusBadge`. |

### The cockpit at desktop width

| Hub at 1280 | Garden at 1280 |
|---|---|
| <img src="captures/admin-hub.webp" width="420" alt="Cockpit Hub at 1280 with an empty queue"> | <img src="captures/admin-garden.webp" width="420" alt="Cockpit Garden at 1280 with elevated white cards"> |
| The review surface fills no button (DL-043). Workspace blue touches only the tab, the actions and the dock pill. | White elevated cards on linen, the garden green in the tab, one filled action and the dock pill. |

### Components, like for like

| Piece | Installed app | Steward cockpit |
|---|---|---|
| Tabs | <img src="captures/pair-pwa-tabs.webp" width="260" alt="App tabs: equal cells, tinted active cell, solid count badges"> | <img src="captures/pair-admin-tabs.webp" width="420" alt="Cockpit tab rail: underline, icons, grey count chips"> |
| Chips | <img src="captures/pair-pwa-chips.webp" width="260" alt="App chips: capsules, selected is a green fill"> | <img src="captures/pair-admin-chips.webp" width="420" alt="Cockpit filter chips: 8px corners, selected is a grey container"> |
| Status badge (one shared component) | <img src="captures/pair-pwa-badges.webp" width="260" alt="StatusBadge on the app surface"> | <img src="captures/pair-admin-badges.webp" width="420" alt="StatusBadge on the cockpit surface"> |
| Fields | <img src="captures/pair-pwa-fields.webp" width="260" alt="App fields: outlined, 16px corner, label above"> | <img src="captures/pair-admin-fields.webp" width="420" alt="Cockpit fields: filled with an underline, floating labels"> |
| A work item | <img src="captures/pwa-workcard-catalog.webp" width="200" alt="App WorkCard catalog: media first, status capsule, coloured edge"> | <img src="captures/pair-workbenchrow.webp" width="420" alt="Shared WorkbenchRow: icon tile, eyebrow, status pill, meta chips"> |
| Bottom bar | <img src="captures/pwa-appbar.webp" width="260" alt="App bottom bar: active tab is a filled icon and a green label"> | <img src="captures/admin-navbar.webp" width="320" alt="Cockpit dock: active tab is a tone pill behind the icon"> |

The work item row shows the shared `WorkCard` in its tall variant and the shared `WorkbenchRow`. The
cockpit's Hub queue renders a third anatomy, `HubWorkCard`, which no story in this capture set shows
populated.

<img src="captures/ds-three-systems.webp" width="720" alt="Storybook design-system page comparing the button systems of the app, the website and the cockpit">

The button systems as measured by the Storybook design-system page: one `Button` module serves the
app and the website, and the cockpit re-skins it through the `--gg-*` tokens in its `index.css`
(DL-031) while keeping `AdminButton` for its own views.
