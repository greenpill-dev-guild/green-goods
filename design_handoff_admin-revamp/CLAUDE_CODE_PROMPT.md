# Prompt for Claude Code

Copy everything below the `---` line into Claude Code along with the attached `design_handoff_admin-revamp.zip`.

---

You are picking up a design handoff for **Green Goods Admin**, a community-garden cockpit. The attached zip contains HTML/JSX prototypes, design tokens, original product briefs, and a v2 alignment spec. Your job is to bring this design into our existing React + Tailwind codebase **without regressing what already works**, by walking the component pyramid bottom-up.

## Read these first, in this order

1. `README.md` — overview, target stack, file map, suggested implementation order
2. `DESIGN_NOTES.md` — *why* the v2 review proposes what it does (tone, conviction voting, FAB, header anatomy)
3. `screens/UI Review.html` — the **v2 spec**. This is the alignment doc. The four screens have **not** had these deltas applied yet; you will apply them during implementation.
4. `screens/Hub.html`, `Garden.html`, `Community.html`, `Actions.html` — the v1 baselines
5. `context/*.md` — original product briefs for cross-referencing intent

## Operating principles

- **Do not ship the HTML files.** They are visual + structural references. Recreate them as React + Tailwind components in our codebase using our existing patterns.
- **`screens/tokens.css` is the contract.** Ship its values verbatim. If our tokens already cover the same ground, reconcile by mapping our tokens to the prototype's values (not the other way around) — or flag conflicts before changing anything.
- **No big-bang merges.** Work in small, reviewable PRs at each tier of the component pyramid (see workflow below).
- **Prefer updating existing components over creating new ones.** The codebase already has Storybook entries for buttons, chips, tabs, filters, search fields, status pills, page headers, sidebars, etc. Map the design's components onto our existing ones first. Only create a new component when you've confirmed nothing existing fits.

## Workflow — bottom-up, four tiers

### Tier 0 — Audit & inventory (read-only PR / doc, no code)

Before writing any component code, produce an audit document at `docs/admin-revamp/audit.md` with these sections:

1. **Token diff.** Side-by-side table: every token in `screens/tokens.css` vs. the closest equivalent in our existing token system. For each row: `name | prototype value | our value | match? (exact / close / new) | proposed action`.
2. **Component map.** Walk through every visual primitive used in the prototypes (button, chip, tab, segmented control, filter chip, search field, status pill, avatar, page header, sidebar, sheet/modal, FAB, table row, conviction meter — new — etc.) and for each, identify the matching Storybook story in our codebase. Output: `prototype component | our Storybook story | gap (none / minor / new variant / brand new)`.
3. **Screen map.** For each of the four screens (Hub, Garden, Community, Actions) list the existing screens/routes in our codebase that overlap, and what the v2 deltas (from `UI Review.html`) imply for each.
4. **Risk list.** Components where updating could regress consumers elsewhere in the app — list them so I can decide whether to version or branch.

**Stop after Tier 0 and wait for me to review the audit.** Do not start coding components until I greenlight the plan.

### Tier 1 — Tokens & primitives (one PR)

Once the audit is approved:

- Add or reconcile design tokens in our token source of truth.
- Add the v2 tone tokens from `DESIGN_NOTES.md` § "Tone system" (`[data-tone="hub|garden|community|actions"]` with the `--tone-canvas` variable, and the `off | subtle | default` strength scale).
- No component changes yet.
- Storybook: add a "Tokens / Admin Revamp" page showing the new tone scale and any new color/spacing values.

### Tier 2 — Atoms & molecules (one PR per logical group)

For each row in your component map where `gap = minor` or `new variant`:

- Update the existing Storybook story with the new variant. **Do not break existing variants.**
- Add visual regression / Chromatic snapshots for both the old and new variants.
- One PR per group: e.g. "Buttons + Chips + Pills", "Tabs + Segmented Controls", "Filters + Search", "Page Header (5-slot)".
- Reference the prototype source: each PR description should link to the relevant section of `screens/UI Review.html` and the v1 file it came from.

The **Page Header** is the most important molecule. Implement it as a single configurable component with five optional slots (eyebrow / title / identity / stats / actions) — see `DESIGN_NOTES.md` § "Header anatomy". All four screens compose this with different slot subsets.

### Tier 3 — Organisms (net-new components)

Net-new for the conviction-voting redesign (`README.md` § 7):

- `<ConvictionMeter />` — single-bar accrual with threshold tick + accrual rate + ETA
- `<WeightAllocator />` — 100%-budget multi-slider list
- `<ProposalCardConviction />` — replaces the for/against/abstain card

Plus the responsive FAB wrapper (`DESIGN_NOTES.md` § "FAB rule"): hidden on desktop, single-action or speed-dial on tablet/mobile.

Each gets its own Storybook story with sample data. Wire the data shape change (proposal record migration) at the type/schema level only — don't touch real data yet.

### Tier 4 — Screens (one PR per screen)

Now and only now, recompose the four screens using the updated atoms/molecules/organisms. Apply the v2 deltas from `UI Review.html` as you go:

- Hub: add eyebrow + inline header actions; canvas tone wash
- Garden: keep `g-id-strip` structure; canvas tone wash only
- Community: move stat tiles into header; replace `TallyBar` with `ConvictionMeter`; add `WeightAllocator`
- Actions: add eyebrow; canvas tone wash

Order matches the README's suggested implementation order: Garden → Hub → Actions → Community.

## Deliverables per PR

Every PR must include:

1. A short description linking back to the prototype source (e.g. `screens/Garden.html` lines X–Y, or `UI Review.html` § 02)
2. Storybook entries (new or updated) for everything touched
3. Visual regression snapshots
4. A "what could regress" note listing existing consumers of any updated component
5. A checkbox: "I confirmed `screens/tokens.css` values were preserved exactly" — or, if not, why

## Things to flag back to me, not assume

- Any token in `screens/tokens.css` that conflicts with our existing system
- Any prototype component whose closest match in our Storybook would need a breaking API change to support the new variant
- The four open questions in `DESIGN_NOTES.md` § "Open questions" — I want to decide these explicitly:
  1. Conviction allocator placement (inline vs. sheet)
  2. Conviction-decay UI fidelity
  3. Tone strength on dark mode
  4. FAB behavior on read-only screens
- Anything in the v1 screens you suspect is **already correct** in our codebase and shouldn't be touched

## Out of scope

- Backend / API changes — the proposal record migration is a frontend type change for now
- New routes or navigation structure — keep our existing routing
- Dark-mode polish beyond mapping the new tone tokens
- Performance optimization

## Your first message back to me

Should be the **Tier 0 audit document** with no code changes. After I approve it we proceed tier by tier.
