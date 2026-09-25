# Steward Cockpit UX Fixes — PR5 Copy, Storybook, Polish

## Lane

- Execution sub-lane: `pr5_copy_storybook_polish` (machine lane `ui`)
- Branch: `refactor/admin-type-scale-and-stories`, from a fresh `origin/develop` after PR4 merges,
  so the migration covers the final campaign jar code
- Depends on: `pr4_shell_cookies_tone`
- Merge: the implementing agent merges with `--merge` once CI Gate is green and bot reviews are
  resolved

## Scope

D24 (DEC-F), D25 (remaining stories), D30 (remaining copy), D32 (all files, plus a ratchet), D33
(remaining nesting).

## Steps

### 1. Storybook renders the product's layout (D24, DEC-F)

- `packages/shared/.storybook/storybook.css` imports the admin tokens, components, and type, but
  not `packages/admin/src/index.css`, whose layout classes (`.garden-tab-layout`,
  `.garden-tab-main`, `.garden-tab-rail`, `.garden-tab-rail-sticky`, `.garden-stat-row*`, and the
  Hub `.hub-workbench-grid`, `.workbench-row`, `.workbench-card` rules) therefore never reach
  stories: the Garden Overview story stacks its rail and prints "Pending Work0".
- Move those rules, with their breakpoints (index.css ~486–735 and the workbench block inside
  `@layer utilities` ~950–1030), into `packages/admin/src/styles/admin-layout.css`. Import it from
  `index.css` and from `storybook.css`. Keep document-level rules (`:root`, `@layer base`, view
  transitions, reduced motion, the status palette remap) in `index.css`, as the note in
  `packages/shared/.storybook/surfaces.css` (~20) requires; update that note.
- Before moving, search `index.css` for later rules that override these selectors and move them
  too, so the cascade order holds.
- Proof: Storybook "Admin/Workspaces/Garden → Overview" and the Hub work queue stories match the
  product layout at 1280 and 375.

### 2. Type scale (D32)

- 339 raw `text-xs` … `text-2xl` uses in 78 admin files remain (heaviest: `HypercertPreview`,
  `ReviewForm`, `TradeHistoryTable`, `ActiveListingsTable`, `MetadataEditor`). Map each to the
  admin type utilities (`label-*`, `body-*`, `text-title-*`; scale in `packages/admin/DESIGN.md`
  § Typography) file by file.
- Take a rendered type census (computed font size and weight by role on the main routes and
  stories) before and after, and fix any drift the census shows.

### 3. View colours (D32)

- Replace raw `rgb(var(--m3-…))` in view-level files (about 15, including the campaign jar
  components, `ReviewForm`, `HubWorkCard`, `StrategyKernelStep`, `MetadataEditor`,
  `CreateGardenSteps/DetailsStep`) with the Warm Earth aliases (`text-text-strong`, `text-text-sub`,
  `bg-bg-weak`, `border-stroke-soft`, …). Raw `--m3-*` stays inside the `Admin*` primitives, the
  shell, `ActionFlowShell`, and the field-family primitives.

### 4. Ratchet (D32)

- Add two collectors to `scripts/design/check-tokens.sh` (beside the admin wrapper-adoption sweep,
  ~304) for raw type-size utilities and view-level `--m3-*` colours in `packages/admin/src`, fed
  into the existing usage baseline (`scripts/data/design-token-usage-baseline.tsv`, with its
  expiry and stale detection). After the migration the baseline should hold no entries for them;
  any intentional exception needs a category, owner, expiry, and note.
- Clarify `.claude/rules/frontend-design.md` Rule 9 (no raw type sizes in admin views) and Rule 13
  (`--m3-*` role tokens only inside Admin primitives; views use Warm Earth aliases).

### 5. Remaining copy and nesting (D30, D33)

- `cockpit.profile.theme.description` and `cockpit.workspace.chooseGardenHint`: halve or drop.
- `packages/admin/src/views/Actions/ActionDetail.tsx` (~149–176): flatten the card nested inside a
  card inside a card.

### 6. Remaining write-surface stories (D25)

- Add empty and loading stories for the notifications panel and any write surface the earlier PRs
  left with a single story; each new story covers a state the product can reach.

## QA Catalog

No behaviour changes are expected; if a case names a changed label, update it and run
`node packages/qa/build.mjs` and
`node scripts/quality/check-qa-id-ledger.mjs --base origin/develop`.

## Validation

```bash
bun run check --only design-tokens
bun run check --only guidance-links
bun run --filter @green-goods/admin typecheck
bun run --filter @green-goods/shared test -- i18n/locale-coverage
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path admin:<a changed test file>
```

Build Storybook (`bun run --cwd packages/shared build-storybook`) when the selector does not.

## Implementation Notes

- The branch was cut from PR4's head before PR4 merged, so the migration covers the final
  campaign jar code; it is rebased onto `develop` once PR4 (#908) merges, and gated again there.
- Step 1 moved more than the garden and workbench blocks: the route frame (`.canvas-route-card`),
  the Hub card's media tiles, the account avatar tile, the surface primitives, the spacing rhythm,
  and the Hub shells, since the Garden Overview story renders the real canvas route. Rules nothing
  rendered were deleted instead of moved (the garden tab bar, tab list, trigger, and tab content,
  and the hub-history feed, card, and copy); the compiled admin CSS differs from before only by
  those selectors, with no order change among overlapping rules. The gate's stylesheet
  allowlists name `admin-layout.css`.
- Step 2 needed the named classes to compose: they were plain rules at specificity (0,3,0)
  after Tailwind's generated utilities, so `body-sm font-medium` rendered 400. They are
  `@utility` definitions now, and `cn()` registers them in tailwind-merge's font-size group.
  Raw 12, 14, and 16px sizes map to `body-xs`, `label-xs`, `body-sm`, and `body-md` with their
  modifiers; headings and metrics map by role to title-large (22/28/600: dialog, sheet, and flow
  titles, full-page state headings, hero amounts) or title-medium (16/24/600: card, section, and
  step titles, metric values). `GardenHeroBanner` had no consumer and was deleted with its CSS.
- Step 3's surfaces take the nearest Warm Earth step; text, stroke, and ink layers are exact.
  Reject's outlined-error recipe became `AdminButton variant="outlinedDanger"`.
  `AdminToneGallery`'s themed sample frames keep the M3 surface, recorded as the one baseline
  exception (`storybook-theme`, admin, expires 2027-03-31).
- Step 5's nesting target, `views/Actions/ActionDetail.tsx`, was not routed (`/actions/:id`
  mounts the Actions view, whose dialog is the already flat `ActionDetailPanel`), so it was
  deleted with the four keys only it used.
- Step 6 added Loading to the notification panel (its empty state is the shared
  `NotificationPanel` EmptyState story; a container-level no-garden story would need `useRole`
  mocked too), three join-queue states, and two campaign Review states and the garden picker's
  no-match state. The image input's upload error is internal state, so it has no story yet.

## Rendered Proof

- Engine: headless Chromium through Playwright, and the Storybook dev server on this branch.
  Session: mock-auth localhost (`?mockAuth=deployer`) on the admin dev server reading the hosted
  indexer, Green Goods Community Garden. Nothing was saved or sent.
- Storybook "Admin/Workspaces/Garden → Overview" and the Hub queue story, 1280 and 375, light and
  dark, before and after step 1: the Overview now shows the route padding, the two-column rail,
  and label/value stat rows; the Hub queue shows the card grid with its media tiles instead of
  one full-width column.
- Type census (computed size, line height, weight, tracking, and case of every visible text
  element): 16 routes at 1280 and 375 plus the work detail (34 targets) and 376 stories of the
  112 story files beside the migrated files. Two runs on unchanged code matched all 2494 route
  elements. After the migration: 114 story and 36 route elements changed size or line
  height, all in the title roles above (47 dialog titles 18→22, 38 section and step titles 18→16, 17 state headings
  20→22, metric values 18 and 20→16, the deposit amount 24→22, a metric's line 22.9→24); the
  only systematic difference is the named scale's tracking on 14px and 16px text (-0.006em and
  -0.011em). Three drifts it found were fixed before commit (see the TDD notes).
- Colour census (colour, background, and border colours of every element) of 72 stories and 3
  routes, light and dark: text, strokes, and ink layers unchanged; the surface steps above; the
  RightSheetRegistry story trigger now renders as an AdminButton.
- Mock-auth captures before (PR4's head) and after at 1280, and 375 where the layout differs:
  the Create Cookie Jar flow title, Garden Health's metrics, and the Endowment totals. The contact
  sheets went to Afo in the session.

## TDD Proof

- RED: with a probe file seeding `className="text-sm"` and
  `text-[rgb(var(--m3-on-surface-variant))]` in `packages/admin/src/views`, `bash
  scripts/design/check-tokens.sh` exited 1 naming both lines; before the migration the two
  collectors reported 465 raw type-size and 38 view-level M3 colour lines. `cn` failed its new
  case: `cn("font-mono text-sm", "body-xs")` kept both classes.
- GREEN: with the probe removed the gate passed with both collectors at zero; `cn` 7 of 7 passed.
  The census drifts fixed on the way: a shared `text-sm` default beat a `body-xs` override
  (fixed in `cn`), a metric under a `body-sm` parent inherited its 20px line (now the 24px
  title-medium line), and a listing id lost the 500 it inherited (now `label-xs`).
- Proof limit: the migration itself is styling; the type and colour census is its evidence.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- A mechanical size mapping can shift weight or line height; trust the census over the mapping.
- Moving CSS into an import changes its cascade position; check for later overrides first.
