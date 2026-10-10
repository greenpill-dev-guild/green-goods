# Artifacts: the design lab and the Storybook captures

Two things live here: an interactive mock for choosing between the options in
[spec.md](../spec.md#decisions-to-resolve), and the rendered evidence the diagnosis rests on.

## The design lab

[design-lab.html](design-lab.html) is one self-contained file. Download it and open it in a browser;
it needs no build and no server. The two typefaces load from Google Fonts and fall back to system
fonts offline.

The stage shows the installed app as a 390px phone beside the cockpit at 1280px. The Stage control
switches to two phones or to all three frames. Every frame scales to fit the window.

| Control | What it switches |
|---|---|
| Preset | Today, Recommended, or Everything shared: sets every fork at once. |
| App screen | Home, Garden (Promises tab), Your Work, Submit Work (Details step), Profile. |
| Cockpit screen | Hub, Garden, Community (Members), Create Assessment, Profile. The desktop frame follows it: the flow opens as the centered dialog and Profile as the right side sheet. |
| Sheet | Opens a bottom sheet on the phones and a dialog on the desktop frame. |
| Theme | Light or dark for the frames. |
| F1 to F13, Workspace tone | One group per decision in the specification. A dot marks the recommended option. |

**It is a mock, not the product.** Each screen is hand-built HTML drawn with the token values and
type sizes read from the component sources named in the specification. It shows direction and
proportion. It proves nothing about the shipped interface, and no option in it is accepted until a
before and after pair of the real components has been reviewed (see [eval.md](../eval.md)). Sample
names, gardens and addresses are invented.

The choices persist in the browser's local storage under `gg-lab-state-v4`. The block between the
`lab:start` and `lab:end` comments is the lab itself; the rest of the file is the page chrome that
lets it stand alone.

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
