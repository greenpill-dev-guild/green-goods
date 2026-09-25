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

## Rendered Proof

Storybook captures of the Garden Overview and Hub queue stories; the type census before and
after; mock-auth localhost captures of any view whose census moved.

## TDD Proof

- RED: not applicable for the styling moves; seed one raw type-size violation and one view-level
  `--m3-*` colour violation, and record that each collector reports its own violation
- GREEN: pending
- Proof limit: record the census as the fallback evidence for the migration

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
