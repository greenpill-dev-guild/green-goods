# Admin Interaction Patterns — the codified contract (2026-08-16)

The interaction-design layer of the admin console, written down. Every rule cites the shipped
code that proves it and the external principle behind it (sources: [admin-ux-brief.md](./admin-ux-brief.md)).
The shipped console is the binding ground truth: when a prototype, AI-generated design, or new
view disagrees with a rule here, the rule wins; when this file disagrees with shipped code, fix
one of them in the same change — never let them drift silently.

Born from the 2026-08-16 admin prototype review, where a validator-green prototype round still
violated half of these. Validators check structure; this contract is what "designed" means.

## 1. Action placement and alignment

- **Action clusters are end-aligned. Always.** Header action rows, dialog footers, card actions,
  row trailing acts, sheet footers — every group of action buttons sits at the end of its
  container. Proof: `PageHeader.tsx` `route-header-actions` (`justify-end`); `AdminDialog.tsx`
  footer (`sm:justify-end`, doc: "buttons right-aligned"); in-content clusters
  `flex items-center justify-end gap-2` ([GardenWorkspaceContent.tsx:195](../../../packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx)).
  A left-aligned action cluster anywhere is a defect. (Jakob's Law; Refactoring UI alignment.)
- **A view declares ONE stable action set, identical across its tabs.** The set never changes
  with the active tab; availability is expressed by disabling, not by removing. Proof:
  [garden.utils.ts:103](../../../packages/shared/src/hooks/admin-ui/garden/garden.utils.ts) —
  `buildGardenViewActions` accepts the active view and ignores it; `AdminViewActions.tsx:15`:
  "ONE fixed primary action … stable across tabs." (NN/g consistency; recognition over recall.)
- **The primary is rightmost; secondaries sit left of it in declaration order.** Destructive acts
  never share a cluster with routine acts — they get their own row, region, or the confirm
  dialog's danger slot. (Brief: destructive separation; Fitts's Law.)
- **Tab-specific actions live in the tab's content**, end-aligned in the section they act on —
  a section-header trailing act, a right-rail quick-actions card, or a row's one trailing act.
  Never in the view header.
- **Below 1024px the same view action set rides the FabButton speed dial**, primary nearest the
  trigger ([useViewActions.ts:71](../../../packages/shared/src/hooks/admin-ui/useViewActions.ts) —
  "mirroring the desktop row's primary-rightmost emphasis"). One action set, two presentations.

## 2. Dialog taxonomy and continuity

Four shells, one job each ([AdminDialog.tsx](../../../packages/admin/src/components/AdminDialog.tsx),
[AdminSideSheet.tsx](../../../packages/admin/src/components/AdminSideSheet.tsx)):

| Shell | Use | Never |
|---|---|---|
| `AdminDialog` standard (sm/md/lg) | one decision or a small form | multi-step content |
| `AdminConfirmDialog` | confirm one consequential act; names blast radius; takes exactly the reason the contract stores | invented reason fields; vague "Confirm" labels |
| `AdminDialog` variant="flow" + `ActionFlowShell` | every multi-step flow: pinned header, step rail, pinned footer | rail changes mid-flow |
| `AdminSideSheet` | global surfaces (profile, settings, notifications) | workspace actions |

- **A flow opens in its final shell at step one and never changes shell or size mid-flow.**
  If step one is small, it is still the flow dialog with its rail. Entering "Start a season"
  through a small dialog that jumps to a large wizard is the canonical violation. (NN/g
  consistency; Tesler's Law — the system absorbs the complexity, not the user.)
- **The step rail is declared once per flow and never changes** (validator-enforced in the
  prototype build; detours render inside their step). Below 620px dialogs present as bottom
  sheets — same content, same footer order.
- **Action labels are specific**: "Pause pool", "Cancel season", "Approve work" — never "OK",
  "Confirm", "Submit". Confirmations name consequences before the act (ecosystem cascade rule).
- **Dirty flows confirm before discarding** (`useDirtyClose` + `DiscardChangesDialog`);
  in-flight async hard-blocks close. Recoverable errors preserve input. (NN/g user control,
  error prevention.)

## 3. Flow anatomy

- **Every flow shows its entry.** A journey, demo, or spec walk starts on a true console home
  (a workspace route), shows the control that opens the flow, then enters it. A flow that begins
  inside its own dialog is undocumented UI. (NN/g visibility of status; GOV.UK transaction
  pattern: start page → steps → confirmation.)
- **Steps follow the client composer's grammar** where the same job exists on both surfaces:
  what → how much → proof/protection → sectioned review, with an Advanced detour for infrequent
  options — admin gets denser fields, not different steps (Decision Log #64: reuse shipping
  rhythms, never parallel patterns).
- **Completion lands somewhere real**: the workspace that owns the result, showing the result.
  Success is visible state change plus a quiet confirmation, never a dead end. (Brief: success
  feedback; admin never celebrates — quiet checkmark rule.)

## 4. Layout

- **The canvas is a single `MainSheet` column (max-width 1400px). The console has no persistent
  side navigation rails.** Within a workspace tab, use a **two-column split** when the tab earns
  it: left column (majority width) carries focused actions and high-level objects; a right rail
  (~300–340px) carries container status, quick actions, and activity/updates. Decided for the
  pool tab 2026-08-16. Collapse to one column below ~900px — rail content stacks after the left
  column, nothing disappears. (web.dev responsive; brief: no hidden critical data.)
- **Group by proximity, not by boxes.** Cards contain one coherent subject each; don't wrap
  every list in nested containers. Information density is a feature on operational screens —
  organize it, don't dilute it. (Laws of UX proximity/common region; brief: no card-itis.)
- No accidental horizontal page overflow at any supported viewport; wide tables scroll inside
  their own container deliberately.

## 5. Rows, cards, and status

- **Two row variants, and only two.**
  - **Record row** — a row you *look at*: title + kind/state chips on line one, calm meta on
    line two, ONE trailing act or a chevron when the row simply opens.
  - **Decision row** — a row you *answer*: same anatomy, TWO acts, affirmative rightmost. Used
    only where the acts are paired opposites (accept/decline, approve/reject); once decided,
    the pair is replaced by the outcome it produced, so a row never offers a decision twice.

  Two lines are the default because a single-line row wraps its buttons as soon as the column
  narrows. State lives in the chip vocabulary (with text, never color alone). **The row's
  information contract is fixed**: chips = kind · lifecycle · at most one attention chip; meta =
  who · how much · when, always in that order. A row that says a different *kind* of thing each
  time cannot be scanned — "recipient can't confirm" and "payment not planned" are states, so
  they are chips, not prose in the meta. (Hick's Law; brief: color never sole indicator.)
- **Scopes, not sibling cards.** Past-due, lapsed, ongoing, and confirmed are *filters* of one
  list. Giving each its own card is how one promise list became six differently-designed queues
  (2026-08-16). A queue earns a separate card only when it holds a different **object** —
  claims are requests to take up a promise, so they get their own conditional card; "past due"
  is the same promise under a filter.
- **A card is titled by its subject.** When a card is about one object, that object heads the
  card — title, chips, counts, and its one act in the header — rather than a generic title with
  the object stacked beneath as a second header. Peers list below a quiet section divider whose
  own act creates more of them.
- **Counts that don't navigate are not buttons.** Render a read-only stat as text; only a stat
  that goes somewhere gets button semantics.
- **No overflow menus on the admin surface.** If two acts are legal at the same moment and one
  is rare or destructive, offer the rare one *inside the flow of the common one*, where its
  context is already on screen — the way cancelling a season is offered inside the close flow.
  An overflow hides the act from anyone who doesn't know to look.
- **New capability arrives as a row on an existing card, not a new tab** (uiux §5: "every
  screen is designed so a settlement row can be added without moving anything").
- **Counts are stats, not buttons.** Queue counts render as one card of hairline-separated
  columns — number leading in tabular figures, label beneath — even when each one navigates. A
  zero renders calm; a count of nothing must never look like an alert. Button chrome around a
  number makes a dashboard read as a toolbar. (Refactoring UI: emphasis is a budget.)
- **Action rows carry at most two button weights.** Outlined secondaries plus one filled
  primary. A text + outlined + filled trio in one row reads as three unrelated controls.
- **Stacked action groups are equal width.** Buttons in a rail or sheet stack go full-bleed;
  three ragged widths read as three unrelated things.
- **Title Case for titles, sentence case for actions.** Card titles, section headings, dialog
  and flow titles, and step-rail titles take Title Case ("Season & Campaigns", "Pool Status",
  "Quick Actions", "How It Works"). Buttons, banners, meta, and body copy stay sentence case
  ("Close season…", "Start a campaign"). A card title also never repeats its container's name —
  the Pool tab's status card is "Pool Status", not "Pool — the container".
- **Banners teach once; chips carry state.** Repeating per-row conditions (past due, expired,
  lapsed) as info banners is a defect — encode them in chips + meta. Reserve banners for one-time
  context the user genuinely lacks. (Refactoring UI: emphasis is a budget.)
- **Every screen/component accounts for the full state matrix**: default · hover · focus ·
  active/selected · disabled · loading · empty · error · success · long content ·
  permission-restricted · small and large viewports. Empty states name the next act.

## 6. Component parity

- **Compose only from the shipped palette** — the `Admin*` wrappers, shell components
  (`PageHeader`, `AdminTabRail`, `FabButton`, `ActionFlowShell`, `AdminSideSheet`,
  `CanvasLayout`/`AppBar`/`NavigationBar`), and shared primitives (`MetaStrip`, `StatusBadge`,
  `AddressDisplay`, sheet primitives). One concept = one component, everywhere — including the
  protocol/Green Goods surfaces, which are the same console scoped to the protocol garden, never
  a parallel design.
- Prototypes mirror this 1:1: every prototype component maps to a shipped component by name in
  the components gallery, with its `packages/...` citation; a missing primitive is flagged, not
  invented. Prototype visual style derives from the shipped tokens (Plus Jakarta Sans, tone
  tints, 16dp shape ceiling), not an approximation.

## 7. Review gate

Before publishing any admin design round (prototype or code): run this contract top-to-bottom as
a checklist, plus [review-checklist.md](./review-checklist.md) Lens 4. Mechanical validators
(prototype build: rail stability, entry surfaces, reason-field pairing, one-row bars) catch a
subset; sections 1, 2, 4, and 5 are judgment checks a human-visible pass must cover explicitly.
"The build is green" is necessary, never sufficient.
