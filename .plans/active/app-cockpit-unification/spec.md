# One Look for the App and the Cockpit — Specification

**Status:** research and design proposal. On 18 October the maintainer locked the picks for the
thirteen forks, the workspace tone and the cards, and then the three questions still open. No
implementation has started.
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

## Direction accepted in principle

Recorded on 2026-10-10. The maintainer chose an option for each fork in the design lab, handed the
choices over with its Copy picks control, and answered two questions about their standing. This
section records what was chosen. The recommendations and their reasoning stay under
[Decisions to resolve](#decisions-to-resolve).

**Standing.** Locked on 18 October. The maintainer pasted the card picks from the census and asked
to lock them, then chose to lock the lab picks the census line does not cover as well (F5, F6, F8,
F9 and F10). Every pick in the table below and every card pick under
[Card picks, locked on 18 October](#card-picks-locked-on-18-october) is now the specification. The
lab and the census are mocks, so the before and after pairs of the real components stay as each
delivery step's acceptance evidence; a pair that shows a problem reopens that one pick, not the
rest. (Until 18 October every pick was accepted in principle and a pick was to lock on its approved
pair.)

**The cockpit's Material 3 rule is retired.** Asked how that rule should read once the app's tabs,
chips, cards and sheets move into the cockpit, the maintainer chose to retire it: the cockpit
becomes the app's language at a denser setting, and its guide and prompt contract are rewritten
around that. The options passed over were keeping Material 3 with named shared pieces, and keeping
it strict so that only tokens cross.

On 17 October the maintainer pasted a revised set of picks from the lab. It changed three forks: the
bottom bar takes the pill on both (F6, previously each bar kept its own active state), the app's
cards go everywhere (F7, previously one surface with a corner per surface), and the list gap is
12px (F11, previously 8px). The table shows the current picks.

| Fork | Pick | Against the recommendation |
|---|---|---|
| F1 Typeface | Plus Jakarta Sans on both | Same |
| F2 Ground | Linen canvas, white cards, one dark ladder | Same |
| F3 Controls | Corner per surface; weight, outline and field anatomy unified | Same |
| F4 Chips | Capsules on both | Same |
| F5 Phone sheets | One surface and header | Same |
| F6 Bottom bar | Pill behind the active icon on both | Same (revised 17 October) |
| F7 Cards and rows | The app's cards everywhere | Differs: the recommendation was one surface with a corner per surface (revised 17 October) |
| F8 Tabs | The app's tabs on both, equal width | Same |
| F9 Filter control | Keep each surface's control | Differs: the recommendation was the app's button on both |
| F10 Count badge | One 16px badge, 11px semibold | Same |
| F11 List spacing | 12px gap on both | Same (revised 17 October) |
| F12 Desktop work card | Wide, mosaic on the left | Same |
| F13 Dark cards | Card one step lighter | Same |
| Workspace tone | A tone per workspace in the cockpit | Same |

What the two differing picks change:

- **F7.** The app's cards go everywhere: 24px cards with a visible edge and a faint shadow, 16px
  work rows with the 2px status edge, tinted information cards, and a 3px border to mark a selected
  card. The cockpit gives up its 12px raised card. On a phone the cockpit's queue takes the app's
  work row and loses the photo grid; on desktop the cockpit keeps its wide photo-grid card (F12) in
  the app's card style.
- **F9.** Neither filter control changes its form. The app keeps its round button and sheet. The
  cockpit keeps its inline chips and sort, and those chips take the capsule shape and the selected
  fill from F4. Pending and Approved stay one tap apart, and nothing new opens from a button on
  desktop.

What the retired rule means against these picks. The maintainer confirmed this reading when asked:
the picks stand. As revised on 17 October, they keep several things that Material 3 used to justify
in the cockpit: its pills (F3), its tone pill in the bar (F6, which the app now takes in green), its
inline filter row (F9) and its tones. They now stand as the cockpit's own dials, kept because they
were chosen. What leaves with the rule is the filled field with an underline, elevation as the card
surface, the 12px card corner, the 8px chip, the underline tab rail, the grey count chip and the
warm grey phone sheet. The cockpit's Material-named tokens keep their names: its views already use the shared
token names, so the layer is an internal detail, and a name changes only if a step has to touch it.
The type role names are settled below.

**Changes without a fork.** Four proposals in the [ledger](#the-divergence-ledger) have no control
in the lab. The maintainer accepted all four on the same terms as the picks:

- **Focus ring.** The app's ring moves from blue to its own green. The cockpit keeps ringing in the
  workspace tone. One focus role serves both.
- **Empty, loading and error states.** One anatomy in two sizes, set by each surface's density.
- **Type role names.** Title, body, label and meta on both surfaces, each at its own sizes. They
  replace the cockpit's Material role names.
- **Glass.** Solid surfaces everywhere. The cockpit's dock stays the one translucent piece, and the
  unused five-thickness material spec leaves the design guide.

**What a pair must show.** Each delivery step is accepted on a before and after pair of the ten
screens the lab draws, rendered from the real components. In the app: Home, a garden page, Your Work, Submit Work and
Profile. In the cockpit: Hub, Garden, Community, Create Assessment and Profile. Each is shown at
390, 768 and 1280px, in light and dark, with Spanish and Portuguese wherever text must fit. A width
a surface does not support is recorded as not applicable. Every other route gets its own pair before
a rule rolls out to it.

**Timing.** The maintainer wants as much of the delivery sequence as fits to land before the
Cosmo-Local demonstration. That is an aim, not an authorization. This record saves the plan, and no
implementation has started.

**Tracking.** On 17 October the maintainer chose the active release project for the Linear records
over the Cosmo-Local project named earlier, because the 15 October four-goal plan gave PWA and admin
delivery to the release project. The parent is PRD-1266, with one sub-issue per delivery step.
PRD-1261, a bounded pass that aligns the member promise and work journey with its steward review,
applies the accepted direction to those journeys and stays a separate issue.

**Cards and code structure, accepted in principle on 17 October.** A census of `develop` at
`b30ac410f` on 17 October counted 107 distinct card, row and tile components: 14 in Shared, 64 in
the app and 35 in the cockpit. They sit on five card primitives, and the three in Shared have no
real use in either app:

| Card primitive | Used in |
|---|---|
| The app's `Card` | about 14 files |
| `AdminCard` | 41 files |
| Shared `Surface`, built on the glass tiers being retired | a few cockpit files |
| Shared `CardBase` and Shared's own `Card` | none |

Each object has several designs. Work has three: the app's row card (Shared `WorkCard`, wrapped by
an app `WorkCard` that resolves names), the upload-queue card (`PendingCard`, `DraftCard`) and the
cockpit's photo-grid card (`HubWorkCard`). Commitments have five rows and cards in the app and two
rows inside a pool card in the cockpit. Picking an action uses `ActionCard` in the app and
`AdminSelectableCard` in the cockpit. Assessments and hypercerts use an inline card in the app and
`WorkbenchCard` in the cockpit. Jars and vaults have ten cards and rows in the app, counting the
public site, and three in the cockpit. About eleven local label-and-value rows, three `EmptyState`
components and about eight local state cards repeat the rest. Behind the names, nearly all of them
take one of four shapes. The maintainer chose, each on the research's recommendation:

- **Four shared shapes.** An item row (media on the left, then title, status, one line of detail
  and an action), a media card (a photo or banner first), a fact row (a label and its value) and a
  state block (empty, loading, error or not ready) live in Shared, each at two densities. Every
  object's card is built from them. Parts unique to one object stay with it: the cockpit's act
  phase line, the upload-queue states and the photo grid. With F7 set to the app's cards, the item
  row looks like the app's work row, which Shared's `WorkCard` already renders. Shared's
  `WorkbenchRow` already takes the item row's props (eyebrow, title, description, meta, status,
  icon or thumbnail, selected), so its interface is the starting point; nothing renders it today.
- **The cockpit's controls fold into the shared family, phased.** With Material 3 retired, the
  cockpit renders the shared controls tuned by its own token block, the mechanism DL-031 already
  uses for the shared pieces it renders. One control family moves at a time, after the card work.
  Today `AdminButton` appears in 111 cockpit files, `AdminTextField` in 44, `AdminCard` in 41 and
  `AdminDialog` in 31. This reverses Rule 18's "AdminButton only" invariant and the cockpit clause
  of Rule 15, and the design token check's wrapper-adoption sweep, which today fails shared fields
  in the cockpit, has to turn around with it.
- **One home per object.** The four shapes live in one Shared folder. An object's card moves into
  Shared when both surfaces render it, and route assembly stays in each app's `views/`. Files move
  with the step that consolidates their object, not in one restructuring. Shared exports each
  component path by name, so every new Shared path is an export decision under the
  [export taxonomy](../../../.claude/context/codebase-architecture.md#export-taxonomy).
- **Tracking.** The new work joins this plan as steps 14 to 20 and is filed under PRD-1266.

The public website keeps its editorial cards. Only the shared pieces it already renders change.

**The detail line, agreed and then locked with the card picks on 18 October.** Asked how cards can stop their detail
lines wrapping, the maintainer agreed to five rules. Version 13 of the census already keeps the line
to one line and drops whole details from the end instead of cutting words; the rules decide what
it drops, and make dropping rare.

1. Each card type orders its details by importance, so the least useful detail is last and drops
   first.
2. A detail line holds the status and at most two details. A third fact belongs on the item's own
   page.
3. A detail never repeats what the card already shows: the lead icon says offer or request, the chip
   says a person's role, and the chrome names the garden, except in a list that mixes gardens.
4. Ages and dates take their short forms in every language ("2 hr. ago", "hace 2 h", "há 2 h";
   "24 Oct", without the weekday). An age is always a number, "1 day ago" and never "yesterday",
   the wording the maintainer chose for every card on 18 October.
5. A list row opens its item when tapped. An action stays on a row only where the row needs the
   reader, and then it takes the row's right slot, in place of the chevron, so the row keeps its
   height. (Revised on 18 October: the rule first put the action below the text, which made that
   one card taller.)

The order each type follows, locked with the card picks on 18 October:

| Card type | Detail line, most important first | Moves out of the line |
|---|---|---|
| Work | who · age | The garden name, except in a list that mixes gardens; the photo count, onto the photo |
| Commitments | due date · other person | Offer or request (the lead icon); "4 of 10 taken" (the promise's page) |
| Actions | what it asks for ("2 photos") | The domain (the banner's chip) |
| Assessments and hypercerts | date · outcomes or units | The kind, when the icon shows it |
| Gardens | members · place | Stewards and "open to join" (the garden's page) |
| People | one count ("12 works") | The role (the chip) |
| Jars, vaults and pools | one detail: the limit ("0.01 WETH a claim"; the pool shows what is waiting) | The cooldown and harvests (the jar's page); the amount stays on the right |

The census applies the rules from version 14 and measures them: at the app's density in a 390px
tile, the row cards drop or shorten 2 of 18 details in English and 5 of 18 in Portuguese, against
6 of 24 and 11 of 24 before. Most of what remained was the jar rows, where the amount on the right
leaves too little room for two details, so on 18 October the maintainer gave a jar row one detail.
With the locked picks (census version 16), no detail drops or shortens in English, Spanish or
Portuguese, in a 390px tile or on a 390px phone.

Two more rulings the same day, from the census review:

- **Every card keeps one height.** No state, action or language makes one card in a list taller
  than its neighbours. Layouts that add a line by design (the pill under the title, the label above
  it) and two-line titles stay opt-in choices for a whole card type, never a single card.
- **A media card needs a picture of its own.** Work, gardens, actions and hypercerts have one;
  commitments, assessments and jars, vaults and pools do not, so they take the item row only.

### Card picks, locked on 18 October

The maintainer's census line, locked together with the answers to four closing questions:

| Decision | Locked pick |
|---|---|
| Where the status sits | B, the pill under the title (the recommendation was D, the pill leading the detail line) |
| Detail line | The agreed rules above |
| Row height | 88px for every item row, with an 88px photo |
| Title size | 15px in the app, 13px in the cockpit |
| Detail size | 11px details and labels |
| Title lines | One line for every card type; the full title on hover |
| Icons | Rows without a photo lead with an icon tile |
| Confirming | While an act settles, the status pill reads "Confirming…" (or "Not sent" for a promise still on the phone) |
| Commitments | Item row led by the offer or request icon |
| Actions | Picked from media cards with a banner |
| Gardens | Media card with the garden's banner |
| People | Item row with an avatar and one role chip |
| Jars, vaults and pools | Item row with one detail and no action on the row |
| Facts | Label beside its value, divided rows |
| Empty and error states | Full size, with an icon tile |

**One pill per card.** A card shows one pill, its status. Any other label becomes one of three
things: a state that replaces the status (an error, a retry, "Confirming…", "Not sent"), one of the
two details (feedback reads "1 comment"), or a mark on the photo (the photo count, the domain). A
person's row keeps one role chip, the highest role. Today the app's work row can add a photo-count
chip and feedback, error and retry badges on a third line; those fold into the rule above.

**What the locked layout costs.** With one title line at 15px, a 390px column at the app's density
cuts 2 of 5 Spanish and 2 of 5 Portuguese titles and no English one; a 390px phone cuts 1 English,
4 Spanish and 3 Portuguese. A cut title ends in an ellipsis and shows in full on hover. Long English titles end in an ellipsis everywhere. Rows with the pill under the title
take one fixed 88px height, so a card never grows to fit.

Questions raised against the picks, all settled by 18 October:

- **F9 and the earlier preference: settled.** Earlier the same day the maintainer preferred the
  app's filter button ([brief](brief.md#stated-direction), item 6). The pick keeps the cockpit's
  chips, and the maintainer confirmed the pick when asked.
- **F3 and the app's message lines: settled.** Each surface keeps its own reserve under a field:
  two lines in the app (DL-018, chosen because many real messages wrap on a 360px phone in English,
  Spanish and Portuguese) and one in the cockpit (its rule that a message never moves the form).
  The reserve becomes a per-surface setting like the button corner; the rest of the field anatomy is
  shared, and a longer message grows the slot rather than scrolling. On the pair, the longest
  Spanish and Portuguese cockpit messages are measured in two-column forms at 640px, where a message
  has about 205px; if several wrap, the cockpit reserves two lines too.
- **F7 on the cockpit's phone: settled.** The cockpit's phone queue takes the work row. Its work
  card is one button that opens the work's page, where approval happens, so the queue only chooses
  what to open; a photo-grid card is about 300px tall on a phone, so two fit a screen, against about
  six 88px rows. The row keeps the first photo with the photo count on it. A steward who sorts by
  photo checks it on the pair; if the photo is too small to judge, the fix belongs on the work's
  page, not in a second card design.
- **F8 on desktop: settled.** Each equal-width tab is at most 180px wide on desktop, the row aligned
  left and never wider than the content: 720px for the cockpit's four-tab rows (Hub, Garden,
  Community), 360px for a two-tab row. The longest label, "Coordenação", measures 94px in Plus
  Jakarta Sans at 14px, about 170px with its icon, count badge and padding. Phones keep full-width
  tabs.
- **Where a card's status sits, and how many lines a title takes: settled.** Raised on 17 October,
  when the pill in the title's corner cut titles off. The
  [card census](artifacts/card-census.html#layouts) measured five placements, and on 18 October the
  maintainer locked the pill under the title, one title line and the sizes in
  [Card picks, locked on 18 October](#card-picks-locked-on-18-october).

## Token slices approved, 21 October

The design gate for steps 1 to 3 ran on 20 October
([eval.md](eval.md#design-gate-for-the-token-slices)). On 21 October the maintainer approved the
three slices as drafted, with the four items the drafts carried, and settled the two calls the
review set raised:

- **Step 1, typeface.** The installed app sets Plus Jakarta Sans; the public website keeps Inter.
  The type role names (title, body, label and meta in place of the Material names) land as a
  second pull request under the same issue, after the typeface.
- **Step 2, ground and dark ladder.** With the linen canvas, the Earth ramp and the lifted dark
  card come four consequences: coloured text that would fall below AA on the lifted card takes one
  lighter step in dark on both surfaces (error red-400, feature purple-300, information blue-400);
  the cockpit's error-screen Retry moves to the error action fill (DL-053); the app's tab row and
  the garden page's title block take the ground they sit on; and the browser's status bar and the
  install manifest take each presentation's ground (linen and the warm floor for the app, white
  for the website).
- **Step 3, outline, focus and weight.** With the control-grade outline come one solid 2px focus
  ring on buttons, chips, fields and the switch, in place of the 3px halo that measured about
  1.3:1, drawn as the cockpit's controls and the app's icon buttons already draw it; and the app's
  button labels at weight 500.

The public website keeps its own dialect in all three. Every later slice still starts on its own
approved pair.

## Count badge approved, 23 October

The design gate for step 4 ran on 23 October
([eval.md](eval.md#design-gate-for-the-count-badge)). The same day the maintainer approved the
pairs with all six recommendations the review set carried:

- **The bar keeps 9+.** Every other count reads 99+ above 99. The bar's badge sits on a 24px
  icon, where 99+ (28px) would be wider than the icon; the Your Work launcher and its Pending tab
  give the number.
- **The tone fills the badge on every cockpit tab**, active or not: a fifth use of the workspace
  tone, named in Rule 18 with the decision-log row for F10. Gray badges on inactive tabs would
  bring back a second badge.
- **The cockpit fills it with the tone's on-surface accent**, not its action fill. Community's
  action fill (orange-700) carries white 11px numerals at 4.0:1; its accent (orange-800) measures
  4.9:1, and the other four tones' accents equal their action fills, in both themes. Raising
  Community's action fill itself, which every white label on it shares, is its own change with its
  own pair.
- **The ring is the surface the control sits on**: the page canvas, and white on the app's bottom
  bar.
- **No ring inside tabs**, in this step or step 5: the badge measures 5.2:1 against the app's
  tinted active tab in light and 10.9:1 in dark.
- **A garden's notification bell joins the step.** The sources missed it; it drew the launcher
  badge.

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
| Count badges | The app's [AppBar.tsx](../../../packages/client/src/components/Layout/AppBar.tsx), the [Your Work launcher](../../../packages/client/src/views/Home/WorkDashboard/Icon.tsx), the [Promises launcher](../../../packages/client/src/views/Home/CommitmentsSheet/Launcher.tsx), the Home filter count, `StandardTabs` and the [AppSheet](../../../packages/client/src/components/Sheets/AppSheet.tsx) tabs, and a garden's notification bell in [TopNav](../../../packages/client/src/components/Navigation/TopNav.tsx); the cockpit's `AdminTabRail`. Since step 4 they all render Shared's `CountBadge`. |
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
| R9 | Every object card on both surfaces is built from four shared shapes: item row, media card, fact row and state block. Each object's card code has one home. | Maintainer's choice, 2026-10-17. |
| R10 | The cockpit renders the shared controls, tuned by its own tokens, one control family at a time after the card work. Density, hit areas and pill corners stay the cockpit's. | Maintainer's choice, 2026-10-17; reverses part of Rules 15 and 18. |
| R6 | Control boundaries meet 3:1, text meets its existing contrast floor on the new ground, and one focus-ring role serves both surfaces. | The measurements above; existing accessibility rules. |
| R7 | No fitted width regresses in English, Spanish or Portuguese at phone widths. | Existing width and line rules in the app's design guide. |
| R8 | The work is tracked in Linear: a parent issue with one sub-issue per delivery step, in the active release project, which owns PWA and admin delivery for the Cosmo-Local plan. | Stated direction; project changed on 2026-10-17. |

## Decisions to resolve

Each fork lists its options with the recommendation first, then what it touches. The maintainer's
pick is repeated under each fork; every pick was locked on 18 October (see
[Direction accepted in principle](#direction-accepted-in-principle)). The lab switches every option
live.

| Fork | Recommendation | Pick, locked on 18 October |
|---|---|---|
| F1 Typeface | Plus Jakarta Sans on both | As recommended |
| F2 Ground | Linen canvas, white cards, one dark ladder | As recommended |
| F3 Controls | Corner per surface; unify weight, outline and field anatomy | As recommended |
| F4 Chips | Capsules on both | As recommended |
| F5 Phone sheets | One surface and header | As recommended |
| F6 Bottom bar | Pill behind the active icon on both | As recommended (revised 17 October) |
| F7 Cards and rows | One surface and row anatomy, corner per surface | The app's cards everywhere (revised 17 October) |
| F8 Tabs | The app's tabs on both, equal width | As recommended |
| F9 Filter control | The app's filter button on both | Keep both; confirmed, reversing the earlier preference |
| F10 Count badge | One 16px badge, 11px semibold | As recommended |
| F11 List spacing | 12px gap on both | As recommended (revised 17 October) |
| F12 Desktop work card | Wide, mosaic on the left | As recommended |
| F13 Dark cards | Card one step lighter | As recommended |

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

**Pick, locked on 18 October:** the recommended option.

### F2 One ground

- **Linen canvas, white cards, one dark ladder** (recommended): the canonical neutral is linen and
  the cockpit already does this. The app's white-on-white cards become white on linen.
- **White canvas on both**: the cockpit loses its warm ground, and white cards on white need a
  shadow or a stronger line everywhere.
- **Keep the split**: the gardener surface stays colder than the steward surface.

Touches the app-scope surface tokens and the dark block in `theme.css`, the static loading screen's
colours, and the app's token audit. Every green-on-surface ratio was measured on white.

**Pick, locked on 18 October:** the recommended option.

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

**Pick, locked on 18 October:** the recommended option. The cockpit keeps its pills as its own
corner, no longer on Material 3's authority. The message slot is set per surface: two lines in the
app (DL-018), one in the cockpit.

### F4 Chips

- **Capsule chips on both** (recommended): the capsule is the language's shape for "pick me", and
  selected stays a solid accent fill.
- **Keep both**: two filter vocabularies for the same job.
- **The app adopts the cockpit's 8px chip**: breaks the capsule rule where it reads best.

DL-065 (no check mark on a selected chip) carries over unchanged.

**Pick, locked on 18 October:** the recommended option.

### F5 Sheets on phones

- **One sheet surface and header** (recommended): a white surface, the grip and the shared
  `SheetHeader` on both. `AdminDialog` keeps its centered desktop form; only its phone presentation
  changes.
- **Keep the cockpit's warm grey sheet**: a steward on a phone sees two sheet materials in one day.
- **The app adopts the cockpit's sheet**: loses the grip and the native drag (DL-033).

The title size stays per density (18px in the app, 22px in the cockpit). Drag-to-dismiss is
behaviour and stays the app's.

**Pick, locked on 18 October:** the recommended option.

### F6 The bottom bar's active state

- **Pill behind the active icon on both** (recommended): the cockpit's recipe, in green in the app.
  Each bar keeps its chrome.
- **Filled icon on both**: the cockpit loses the tone use that orients a steward across workspaces.
- **Keep both**: the most repeated element stays the most different.

The app's bar stays solid. A backdrop blur costs frames on the low-end phones the app targets.

**Pick, locked on 18 October:** the recommended option, revised on 17 October from keeping each
bar's own active state.

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

**Pick, locked on 18 October:** the app's cards everywhere, revised on 17 October from the
recommended option. The cockpit gives up its 12px raised card. On a phone its queue takes the app's
work row; on desktop it keeps the wide photo-grid card (F12) in the app's card style. The row
stays on the cockpit's phone queue (settled on 18 October); a steward who sorts by photo checks it
on the pair.

### F8 Tabs

- **The app's tabs on both, equal width** (recommended): `StandardTabs` as shipped. Equal cells, a
  tinted active cell with a 2px underline, a solid count badge, an icon when a tab has one. On
  desktop each cell is capped at 180px and the row aligns left (720px for four tabs, as the lab
  draws), so the cells stay readable.
- **The cockpit rail on both**: an underline rail at content width with the grey count chip. The
  app's four garden tabs would scroll at 320px.
- **Keep both**: two tab vocabularies for the same job.

Touches `AdminTabRail`: it gains the equal-width layout and the tinted active cell, and its count
chip becomes the shared badge. The tab height stays per surface (DL-011).

**Pick, locked on 18 October:** the recommended option.

### F9 Filter control

- **The app's filter button on both** (recommended): a round outlined icon button with a count
  badge that opens a sheet of choices. The cockpit's toolbar keeps search and sort inline.
- **Inline chips on both**: the app's Your Work shows scope chips instead of its compact select.
- **Keep both**: the same job has a button in one surface and a chip row in the other.

DL-082 holds under every option: Pending and Approved stay scopes of one list. See the judgment
point below about where those two scopes live.

**Pick, locked on 18 October:** keep both. It reverses the preference stated earlier the same day
for the app's button, and the maintainer confirmed it when asked. The cockpit's chips still take the
capsule from F4.

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

**Pick, locked on 18 October:** the recommended option.

### F11 List spacing

- **12px gap on both** (recommended): the app's gap today. The gap is what makes a card read as a
  card.
- **8px gap on both**: denser; cards start to read as one block on a phone.
- **One divided card on both**: rows inside one card. Suits settings rows, not work items.
- **Keep both**: 12px in the app, 14px in the cockpit's grid, none in its divided record lists.

**Pick, locked on 18 October:** the recommended 12px gap on both, revised on 17 October from 8px.

### F12 Desktop work card

- **Wide, mosaic on the left** (recommended): `HubWorkCard` keeps its media mosaic and lies wide,
  with the title, action, gardener and age beside it. Two cards per row at 1280px instead of three
  tall ones, and about as many cards above the fold.
- **Tall, mosaic on top (today)**: three per row at 1280px, four from about 1300px.

Touches `HubWorkCard`'s layout from the desktop breakpoint and the grid's column rule. Phones keep
the tall card unless F7 says otherwise.

**Pick, locked on 18 October:** the recommended option.

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

**Pick, locked on 18 October:** the recommended option.

## Human judgment points

- **Locked decisions this reopens.** Strict Material 3 for the cockpit, including its pills and
  compact metric (DL-010, DL-011, DL-030, Rule 18); the app's corners (DL-029); the cockpit's chip
  (DL-065); and the guides and prompt vocabulary that assign each surface its face. Each accepted
  fork needs a new decision-log row that names what it supersedes. The maintainer has since retired
  the Material 3 rule itself (see [Direction accepted in principle](#direction-accepted-in-principle));
  those rows are still to be written.
- **F9 would have cost a tap.** Pending and Approved are one tap apart in the cockpit's toolbar
  today. Behind a filter button they would be two. The pick keeps them inline, so this point is
  closed unless the pick changes.
- **F8 on desktop.** Equal cells across a 1176px content column are very wide. Settled on 18
  October: each tab is at most 180px wide and the row aligns left.
- **F7 on the cockpit's phone.** A row removes the mosaic from the phone queue. Settled on 18
  October: the row stays, and a steward who sorts by photo checks it on the rendered pair.
- **The Cosmo-Local demonstration.** The research's view was that only the token slice is small
  enough to precede it, and only if the width and contrast measurements pass. The maintainer's aim
  is to land as much of the sequence as fits before it. The measurements still gate the token slice,
  and each later step still needs its approved pair.
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
