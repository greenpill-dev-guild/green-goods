# Green Goods Admin Design-System Audit

Date: 2026-07-05
Status: Audit artifact only. No implementation changes are included.
Primary focus: admin dashboard design system, especially `/hub`, `/actions`, `/garden`, `/community`, dialogs, side sheets, and agent-facing design guidance.
Secondary context: attached UI-design video transcripts. Client PWA and editorial/public website are treated as contrast points, not as surfaces needing changes.

## Executive Summary

The admin design system is in a better state than the recent back-and-forth makes it feel. The latest dialog work is aligned with the current admin contract: workspace action/detail flows now belong in centered `AdminDialog`; the global account/settings/notification surfaces belong in `AdminSideSheet`; `/hub` is the best reference route; the component layer has real guards and the design-token checks pass.

The main issue is not that the admin system lacks a direction. The issue is that the direction is spread across too many files, and some of those files still teach older behavior. That creates avoidable disagreement for humans and agents: glass is described differently in different places, the component wrapper count is stale in some docs, canvas recession is both retired and still documented, and a few stories/comments still imply old `2xl` or ad-hoc dialog sizing.

Based on the transcripts, the strongest next move is not a new visual style. It is making the admin design system simpler, more explicit, and harder to misuse:

1. Clean up the source-of-truth drift in the admin design docs and examples.
2. Keep `/hub` as the reference admin route.
3. Make the current dialog/side-sheet rules impossible to misread.
4. Add a concise admin dashboard recipe that tells future agents how to arrange functional admin screens.
5. Then do route-level cleanup, starting with `/actions`, without turning the admin into a marketing or gallery surface.

## Transcript-Informed Lens

The transcripts were useful because they reinforce a few practical points that match the pain we are seeing in the admin dashboard.

First, good AI-assisted design depends on reusable rules, not repeated taste arbitration. A design system needs strong prompts, tokens, examples, and component contracts. When those disagree, models and humans fill the gaps with visual habits from other surfaces.

Second, a functional dashboard is a different design problem from a client PWA or editorial website. Admin screens should help operators scan, compare, filter, decide, and act. They should not borrow hero moments, gallery layouts, theatrical gradients, or marketing composition just because those patterns look polished elsewhere.

Third, arrangement matters more than decoration. The transcripts emphasize that dashboards often fail because information hierarchy is weak, not because a component is unattractive. For Green Goods admin, that means the page recipe is as important as the token system: route frame, header actions, filters, tabs, dense result areas, detail flows, and empty/loading/error states all need a consistent grammar.

Fourth, the right reusable primitives should do most of the work. The admin now has the primitives it needs. The design system should push work into `Admin*` wrappers, Storybook-backed shared foundations, design tokens, and guarded examples instead of encouraging local one-off layout and sizing choices.

## Current Health

The foundation is sound.

- The latest `AdminDialog` implementation is aligned with the active admin model.
- `AdminSideSheet` is correctly scoped to global AppBar surfaces: Profile, Settings, and Notifications.
- `/hub` is the clean reference route for the current admin canvas.
- The design-token and design-doc checks are passing.
- Storybook coverage and story-quality checks are passing.
- The repo has guard tests for dialog and side-sheet standards.
- The current admin wrapper inventory has 16 `Admin*` component files:
  - `AdminBadge`
  - `AdminButton`
  - `AdminCard`
  - `AdminCheckbox`
  - `AdminDialog`
  - `AdminFab`
  - `AdminFilterChip`
  - `AdminLinearProgress`
  - `AdminListItem`
  - `AdminSearchToolbar`
  - `AdminSideSheet`
  - `AdminSortSelect`
  - `AdminTabRail`
  - `AdminTextField`
  - `AdminTooltip`
  - `AdminViewActions`

Validation run during this audit:

```text
bun run agentic:guidance
bun run check:design-generated
bun run check:design-tokens
bun run lint:vocab
bun run check:design-md
bun run --filter @green-goods/admin test -- src/__tests__/components/AdminDialogStandard.guard.test.ts src/__tests__/components/AdminSideSheetStandard.guard.test.ts
bun run --filter @green-goods/shared check:stories
bun run --filter @green-goods/shared check:story-quality
```

All of the above passed.

## Button And Color Update

This audit now factors in the recent admin button/color work.

What is already materially improved:

- The admin color system now has an AA-verified light/dark discipline: filled actions use deeper `--tone-action` steps with white text, while on-surface accent text/icons use `--tone-on-surface-accent`.
- `--tone-focus-ring` now exists as the intended focus-ring role: action tone in light mode, on-surface accent in dark mode.
- `--m3-outline` was promoted to a control-grade outline for fields, chips, and outlined buttons; `--m3-outline-variant` remains the decorative hairline.
- `AdminButton` now has stable border-box geometry across filled/outlined variants, tone-aware filled actions, outline color through `--m3-outline`, and elevated/text variants that use on-surface accent color.
- The shared `NavigationBar` FAB now avoids the admin Tailwind scan gap by applying the FAB background/text colors through inline token styles instead of shared-package arbitrary Tailwind color utilities.
- Multi-action FABs now collapse to a neutral "+" opener with an "Open actions" accessible label instead of duplicating the first action visually and semantically.
- The shared `NavigationBar` story now has a `MobileSpeedDial` scenario that checks the neutral opener and confirms the dial actions appear only inside the menu.

What this changes in the audit:

- Button and color should no longer be treated as an unresolved design direction problem.
- The remaining work is follow-through: make the docs and guards teach the new color model, finish the focus-ring migration, and verify the visible states in light/dark mode.
- Route-level cleanup should come after that follow-through, because route work will otherwise keep rediscovering token and state-color questions that are already mostly answered.

Remaining button/color actions:

1. **Finish the focus-ring token migration.** The current design/UI guidance says `--tone-focus-ring` is the only focus indicator token, but some consumers still use `--m3-primary` or `--tone-action` for focus rings. Evidence includes `AdminButton`, `AdminSearchToolbar`, `AdminFilterChip`, `AdminFab`, a few route-local cookie controls, and shared Canvas consumers such as `GardenChip`, `NotificationPanel`, and the FAB override in `admin-m3-overrides.css`. This needs a focused token migration or an explicit documented exception for any component that should not migrate.
2. **Add a narrow guard for focus-ring regressions.** Existing token checks validate the new color system, but they do not appear to block new `focus-visible:ring-[rgb(var(--m3-primary))]` or `--tone-action` focus rings in admin-facing controls. A small grep/AST-style guard would prevent this drift from returning.
3. **Update admin docs with the new color roles.** The docs should name the practical rule: `--tone-action` is for filled action backgrounds, `--tone-on-action` is the text on that fill, `--tone-on-surface-accent` is for colored text/icons on solid surfaces, `--tone-focus-ring` is for focus, `--m3-outline` is control-grade, and `--m3-outline-variant` is decorative.
4. **Document the shared-component Tailwind scan workaround.** The FAB fix is correct because admin does not scan utility classes authored inside `packages/shared/src`. That workaround should be called out in the admin route/component recipe so future shared Canvas changes do not reintroduce missing colors, missing transitions, or missing layout utilities.
5. **Capture rendered proof before declaring the button/color lane done.** The remaining proof should include light and dark admin screenshots or browser inspection for: `AdminButton` variants, mobile speed dial collapsed/open states, keyboard focus rings, and at least one non-green workspace tone such as Hub or Actions.

Current validation after factoring in the button/color work:

```text
bun run agentic:guidance
bun run check:design-tokens
bun run lint:vocab
bun run --filter @green-goods/shared check:stories
bun run --filter @green-goods/shared check:story-quality
```

All passed on the current tree. Important caveat: these checks confirm the broad token/story/vocab state, but they do not currently fail the remaining focus-ring token mismatches. That is why the focused guard remains an action item.

## Findings

### P1 - Agent-Facing Admin Contract Drift

Some top-level guidance still describes the older admin model.

Evidence:

- `AGENTS.md` says admin glass is reserved for "Navigation/FAB and sheet shells" and lists 13 `Admin*` wrappers.
- The current implementation and prompt contract say glass is for Navigation/FAB only, while dialogs and side sheets are solid.
- The actual admin wrapper count is 16.
- `packages/admin/DESIGN.md` has the correct current dialog/side-sheet rules in some sections, but its component list and material wording are not fully current.

Why it matters:

This is the highest-leverage problem because these files are what future agents and humans read before making UI decisions. When they are stale, the system invites disagreement even if the code is correct.

Recommendation:

Do a docs-only standards cleanup first:

- Update root `AGENTS.md` admin summary to match the current 16-wrapper inventory or avoid hardcoding the count.
- Remove "sheet shells" from glass allowances where the current rule is Navigation/FAB only.
- Update `packages/admin/DESIGN.md` so the material, overlay, and component inventory sections all agree.
- Treat `.claude/skills/design/prompt-contract.md` plus `docs/docs/builders/packages/admin.mdx` as the current behavioral baseline.

### P1 - Retired Canvas Recession Still Appears In Design Guidance

The current admin standard says the canvas no longer recedes when a bounded sheet or action flow opens. Some design-language guidance still says the opposite.

Evidence:

- `packages/admin/DESIGN.md` correctly says MainSheet recession is retired.
- `packages/admin/src/index.css` and the admin quick reference also align with no recession.
- `DESIGN.md` and `.claude/skills/design/language.md` still contain language about the admin canvas receding when a bounded sheet opens.
- `.claude/skills/design/prompt-contract.md` also has a stale `isReceded` explanation, even though nearby sections describe the current dialog-centered model correctly.

Why it matters:

This is exactly the kind of small contradiction that causes repeated UI churn. One pass reads the current admin docs and removes recession. Another pass reads the older design-language guidance and reintroduces it.

Recommendation:

Update all admin guidance to one rule:

> Workspace action/detail flows open in centered `AdminDialog`. The admin canvas does not dim, scale, blur, or recede for those flows. Global AppBar surfaces use `AdminSideSheet`.

Then add a grep-based check or existing design lint coverage for the stale phrases if the wording keeps coming back.

### P1 - Dialog Examples Still Teach Old Width Behavior

The dialog implementation is good, but a few examples/comments still teach older language.

Evidence:

- `AdminDialog` supports the current size scale and `ADMIN_FLOW_DIALOG_CLASS`.
- The guard test is anchored to the size scale.
- `AdminDialog.stories.tsx` still has a flow example that uses an inline ad-hoc width/min-height class override.
- `SubmitWork` comments and stories still refer to a "2xl AdminDialog".

Why it matters:

Examples matter more than prose for future implementation. If a story shows ad-hoc width overrides, agents will copy the story even when the docs say not to.

Recommendation:

Update the stories and comments so they model the current standard:

- Use `size="lg" variant="flow" className={ADMIN_FLOW_DIALOG_CLASS}` for action flows.
- Remove "2xl AdminDialog" wording.
- Avoid "or equivalent override" language unless the equivalent is a named approved wrapper or constant.
- Consider extending the guard to flag stale story/comment phrases such as `2xl AdminDialog`, `!max-w-3xl`, or local `sm:!max-w-*` dialog overrides.

### P1 - Component Inventory Is Split Across Too Many Places

The wrapper list appears in multiple files, and not all copies are current.

Evidence:

- Actual admin wrapper count: 16.
- `.claude/skills/design/prompt-contract.md` has the correct 16-wrapper list.
- `AGENTS.md` still says 13.
- `packages/admin/DESIGN.md` is missing newer wrappers such as `AdminSortSelect` and `AdminViewActions`.

Why it matters:

Counts are brittle. If they are repeated manually, they drift. A stale wrapper list makes new agents think they should invent local controls instead of using existing wrappers.

Recommendation:

Pick one durable source for the full list. The best candidate is the prompt contract or a generated inventory section. In other files, say "use the `Admin*` wrappers listed in the admin prompt contract" instead of repeating the full list. If a count is useful, generate or check it.

### P1 - Button And Color Work Is Stronger, But Focus Rings Still Need Closure

The recent color work solved the larger palette problem, but the focus-ring contract is not fully closed.

Evidence:

- `.claude/skills/ui/SKILL.md` says focus rings use `--tone-focus-ring`, never `--tone-action`.
- `.claude/skills/design/language.md` says `--tone-focus-ring` is the only token for focus indicators.
- `packages/admin/src/index.css` defines `--tone-focus-ring` and flips it for dark mode.
- `packages/admin/src/components/AdminButton.tsx` still uses `focus-visible:ring-[rgb(var(--m3-primary))]`.
- `packages/admin/src/styles/admin-m3-overrides.css` sets the shared FAB ring to `--tone-action`.
- Additional admin-facing controls still use `--m3-primary` or `--tone-action` for focus rings.

Why it matters:

The color system now distinguishes filled-action color from focus color for a reason: deep action fills can fail non-text focus contrast in dark mode. If a control still rings with `--tone-action` or `--m3-primary`, the surface may look fine in light mode while losing keyboard focus clarity in dark mode.

Recommendation:

Do a small focus-ring closure pass before route-level visual cleanup:

- Replace admin-facing focus rings with `rgb(var(--tone-focus-ring, ...))` where appropriate.
- Keep any exceptions explicit and documented.
- Add a guard that catches future admin-facing focus rings using `--tone-action` or `--m3-primary`.
- Verify at least one focusable control in each workspace tone in light and dark mode.

### P2 - `/hub` Is The Right Reference Surface

`/hub` is currently the strongest expression of the admin system.

Evidence:

- It uses `CanvasRouteFrame`.
- It has a clear route header.
- It uses `AdminViewActions`, `AdminSearchToolbar`, `AdminSortSelect`, `AdminFilterChip`, and `AdminTabRail`.
- It keeps the main working area focused instead of turning the page into decorative cards.

Why it matters:

The transcripts emphasize that strong systems need examples. `/hub` is the live example other routes should learn from.

Recommendation:

Explicitly promote `/hub` as the reference route in the admin dashboard recipe. Future admin route work should first ask:

- Does this route need the same route frame anatomy?
- Are the actions in the header or toolbar instead of scattered?
- Are filters, sorting, search, and tabs using admin wrappers?
- Is the main area a working surface rather than a gallery?

### P2 - `/actions` Has The Right Controls But Still Feels Catalog-Like

`/actions` has improved structure, but it still carries more card-grid/catalog energy than the admin system should prefer.

Evidence:

- It uses the right shell controls: search, sort, filters, chips, tabs, and action controls.
- The main body still falls back to a grid of `WorkbenchCard` items.
- The admin docs already warn that `/actions` should be a managed catalog, not a marketing gallery.

Why it matters:

This is the clearest route-level place where the admin could become simpler and more operator-focused. The goal should not be to redesign it into a list-only page by default. The goal should be to tighten the grid so it scans better and behaves more like an admin workbench.

Recommendation:

After the docs cleanup, do a focused `/actions` pass:

- Keep the existing control model.
- Tighten card density and information hierarchy.
- Reduce repeated decorative surface weight.
- Make status, owner, due/age, and next action easier to scan.
- Avoid turning the route into a marketing catalog or visual gallery.

### P2 - Detail And Settings Surfaces Still Have Card-Stack Pressure

Top-level `/garden` and `/community` shells are aligned, but some detail/settings surfaces still lean on stacked cards.

Evidence:

- `GardenWorkspaceContent` has a settings dialog with a useful two-column structure, but the right side contains stacked `AdminCard` metadata sections.
- `ActionDetail` has nested card pressure in the detail view.
- The current admin docs already push toward simpler dialog interiors: one main content block plus one supporting rail when needed.

Why it matters:

Card stacks make admin screens look organized at first, but they often reduce scan speed and create noisy visual rhythm. The transcripts' dashboard advice points toward better arrangement before more surface styling.

Recommendation:

Do not start here. First fix the docs/examples. Then review detail surfaces with a simple rule:

> A dialog or detail view should have one clear primary reading/action column and, at most, one supporting metadata rail. Avoid cards inside cards unless each card is a genuinely repeated item or independent tool.

### P2 - Legacy `leftSheet` Naming Is Acceptable But Still Mentally Expensive

The code keeps `leftSheet` naming for descriptor compatibility, while rendering the inspector through `AdminDialog`.

Evidence:

- `leftSheetChannel.tsx` comments explain that the names are retained for compatibility.
- `CanvasLayout` renders the left inspector config through centered `AdminDialog`.

Why it matters:

The implementation is defensible. The risk is cognitive: new agents may see `leftSheet` and assume workspace sheets are still part of the design language.

Recommendation:

Do not rename this immediately. It is lower priority than doc drift and examples. If the naming continues to confuse implementation work, plan a separate compatibility-preserving rename or facade:

- Keep the existing descriptor contract.
- Add a clearer `workspaceDialog` alias.
- Deprecate `leftSheet` terminology gradually.

### P2 - The Admin System Needs A Short Route Recipe

The current docs contain many rules, but they do not yet give a compact "build an admin dashboard route this way" recipe.

Why it matters:

The transcripts repeatedly point to reusable skills and clear examples as the way to get reliable AI-assisted design. The admin has enough pieces. It needs a shorter assembly guide.

Recommendation:

Add a human and agent friendly admin route recipe after the stale docs are cleaned up. It should fit on one page and cover:

- Route shell: `CanvasRouteFrame` and route header.
- Header actions: use `AdminViewActions` and restrained icon/text actions.
- Search/sort/filter: `AdminSearchToolbar`, `AdminSortSelect`, `AdminFilterChip`.
- Navigation within route: `AdminTabRail`.
- Main content: dense working surface, not decorative gallery.
- Repeated items: use cards only when the item is actually repeated.
- Detail/action flows: centered `AdminDialog` with approved size/class.
- Global AppBar surfaces: `AdminSideSheet`.
- Empty/loading/error states: calm, operational, and actionable.
- Prohibited patterns: hero moments, gallery framing, decorative gradients, ad-hoc dialog widths, nested cards, glass outside Navigation/FAB.

This recipe can start as a planning doc, then graduate into `.claude/skills/design/` or `docs/docs/builders/packages/admin.mdx` once the wording is settled.

## Recommended Update Sequence

### 0. Button/Color Follow-Through

Scope: focused token, guard, docs, and proof work. Not a new palette direction.

Recommended files/surfaces to inspect:

- `packages/admin/src/components/AdminButton.tsx`
- `packages/admin/src/components/AdminSearchToolbar.tsx`
- `packages/admin/src/components/AdminFilterChip.tsx`
- `packages/admin/src/components/AdminFab.tsx`
- `packages/admin/src/styles/admin-m3-overrides.css`
- `packages/shared/src/components/Canvas/GardenChip.tsx`
- `packages/shared/src/components/Canvas/NotificationPanel.tsx`
- `packages/shared/src/components/Canvas/NavigationBar.tsx`
- `packages/shared/src/components/Canvas/NavigationBar.stories.tsx`
- `packages/admin/DESIGN.md`
- `docs/docs/builders/packages/admin.mdx`
- `.claude/skills/design/prompt-contract.md`

Goal:

- Treat the palette and button direction as decided.
- Finish `--tone-focus-ring` adoption or document intentional exceptions.
- Keep the shared FAB inline-token workaround.
- Add guard coverage for future focus-ring drift.
- Capture rendered light/dark proof for button, FAB, and speed-dial states.

### 1. Standards Cleanup Pass

Scope: docs and examples only.

Recommended files:

- `AGENTS.md`
- `DESIGN.md`
- `packages/admin/DESIGN.md`
- `.claude/skills/design/language.md`
- `.claude/skills/design/prompt-contract.md`
- `packages/admin/src/components/AdminDialog.stories.tsx`
- `packages/admin/src/views/Garden/SubmitWork.tsx`
- `packages/admin/src/views/Garden/SubmitWork.stories.tsx`

Goal:

- One material rule.
- One overlay rule.
- One wrapper inventory.
- One dialog sizing model.
- No stale canvas recession language.
- One admin color-role explanation that matches the recent AA color work.

### 2. Guard And Example Hardening

Scope: small tests/guards if needed.

Recommended additions:

- Extend existing admin dialog guard coverage to catch stale story/example patterns.
- Add checks for ad-hoc dialog max-width overrides where practical.
- Add a focused focus-ring token guard for admin-facing controls.
- Keep the guard narrow. It should prevent repeated drift, not police unrelated layout code.

### 3. Admin Route Recipe

Scope: design-system guidance, not route implementation.

Recommended location:

- Start in `.plans/` if we want to discuss it first.
- Promote to `.claude/skills/design/` or `docs/docs/builders/packages/admin.mdx` after approval.

Goal:

- Make the admin route assembly pattern easy to follow without re-reading the entire design system.

### 4. `/actions` Tightening Pass

Scope: route-level UI cleanup after the docs are consistent.

Recommended direction:

- Keep the current controls.
- Tighten the grid.
- Improve scan hierarchy.
- Reduce card weight.
- Preserve the admin cockpit feel.

Validation:

- Targeted admin tests.
- Design checks.
- Authenticated Brave QA if the visible route changes need browser proof.

### 5. Detail Surface Simplification

Scope: `/garden`, `/community`, and action-detail surfaces.

Recommended direction:

- Reduce nested card stacks.
- Prefer one primary area plus one supporting rail.
- Use repeated cards only for repeated entities.
- Keep metadata compact and calm.

### 6. Optional Naming Cleanup

Scope: only if `leftSheet` naming continues to cause mistakes.

Recommended direction:

- Preserve compatibility.
- Add clearer aliasing before any rename.
- Avoid broad layout rewrites.

## Acceptance Criteria For The First Cleanup Pass

The first implementation pass should be considered successful when:

- `AGENTS.md`, `DESIGN.md`, `packages/admin/DESIGN.md`, `admin.mdx`, and design skills agree on:
  - glass only for Navigation/FAB
  - solid dialogs and side sheets
  - centered `AdminDialog` for workspace action/detail flows
  - `AdminSideSheet` only for global AppBar surfaces
  - no admin canvas recession
- Stale phrases are removed or intentionally marked historical:
  - `sheet shells`
  - `2xl AdminDialog`
  - `canvas recedes`
  - `isReceded` as active admin behavior
  - ad-hoc flow dialog max-width overrides in examples
- The admin wrapper inventory is either accurate or not hardcoded in multiple places.
- Existing design checks still pass.
- Existing admin guard tests still pass.
- No route behavior changes are mixed into the docs-only pass.

## Open Decisions

1. Should the first approved implementation pass be strictly docs/examples/guards, with no route UI changes?
2. Should the admin route recipe live in `.claude/skills/design/`, `docs/docs/builders/packages/admin.mdx`, or start as a `.plans/` artifact first?
3. Do we want the `Admin*` wrapper list to be generated or simply referenced from one canonical file?
4. For `/actions`, should the first route pass preserve the card grid and tighten it, or should we explore a denser list/table-like workbench variant?
5. Is the `leftSheet` compatibility naming still causing enough confusion to justify a later rename/facade?

## Practical Recommendation

Do the button/color follow-through and standards cleanup before touching route UI.

The admin system is close enough that route work will be more productive after the written contract and control-state tokens are consistent. If we jump straight into `/actions` or detail surfaces, future agents may still read stale guidance or copy an older focus-ring pattern and reintroduce the same disagreement. The cleaner path is:

1. Finish button/color follow-through: focus rings, guards, docs, rendered proof.
2. Align the written contract.
3. Align examples and guards.
4. Add the route recipe.
5. Then tighten the routes.

That sequence matches the transcripts' strongest advice: make the reusable design rules clear enough that future AI-assisted design work has less room to guess.

## Implementation Status

Completed in the follow-through pass:

- Standardized admin and shared Canvas focus-ring usage around `--tone-focus-ring`, including admin buttons, chips, FAB/search primitives, Hub work cards, cookie jar controls, `AppBar`, `GardenChip`, `NotificationPanel`, and `NavigationBar`.
- Added a design-token guard so old admin/shared Canvas focus-ring patterns fail `bun run check:design-tokens`.
- Tightened the admin written contract: glass is limited to Navigation/FAB chrome; dialogs, side sheets, cards, forms, tables, lists, and dense route content stay solid.
- Clarified admin color roles: `--tone-action`, `--tone-on-action`, `--tone-on-surface-accent`, `--tone-focus-ring`, `--m3-outline`, and `--m3-outline-variant`.
- Added a reusable admin route recipe in `docs/docs/builders/packages/admin.mdx`.
- Updated dialog/story examples to use `ADMIN_FLOW_DIALOG_CLASS` and removed active `isReceded` story usage.
- Fixed the shared `NavigationBar` speed-dial focus treatment so its inline elevation style can compose with a visible focus ring, even when app-specific elevation tokens are absent.

Still deferred:

- Route-level cleanup for `/actions` and other dense admin pages is intentionally not mixed into this pass.
- Commit packaging should split governing docs/standards from implementation code before merge, per `packages/admin/AGENTS.md`.
- Final post-patch browser screenshot refresh was blocked by the environment after the escalation usage limit was reached. Static Storybook and admin builds pass, and the rebuilt Storybook asset contains the patched focus-ring fallback, but authenticated/admin browser QA still needs a later session with browser access.

## Evidence Appendix

Key files inspected:

- `AGENTS.md`
- `DESIGN.md`
- `.claude/skills/design/system-alignment-review.md`
- `.claude/skills/design/prompt-contract.md`
- `.claude/skills/design/language.md`
- `.claude/skills/design/quick-reference.md`
- `packages/admin/AGENTS.md`
- `packages/admin/DESIGN.md`
- `docs/docs/builders/packages/admin.mdx`
- `packages/admin/src/components/AdminDialog.tsx`
- `packages/admin/src/components/AdminSideSheet.tsx`
- `packages/admin/src/components/AdminDialog.stories.tsx`
- `packages/admin/src/__tests__/components/AdminDialogStandard.guard.test.ts`
- `packages/admin/src/__tests__/components/AdminSideSheetStandard.guard.test.ts`
- `packages/admin/src/views/Hub/index.tsx`
- `packages/admin/src/views/Actions/index.tsx`
- `packages/admin/src/views/Actions/ActionDetail.tsx`
- `packages/admin/src/views/Garden/index.tsx`
- `packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx`
- `packages/admin/src/views/Garden/SubmitWork.tsx`
- `packages/admin/src/views/Garden/SubmitWork.stories.tsx`
- `packages/admin/src/views/Community/index.tsx`
- `packages/admin/src/components/Layout/leftSheetChannel.tsx`
- `packages/admin/src/components/Layout/CanvasLayout.tsx`

Transcript attachments reviewed:

- `/Users/afo/.codex/attachments/a2f2a9b2-07a3-40ff-a07e-9d0f2fa347e2/pasted-text.txt`
- `/Users/afo/.codex/attachments/f65413ca-d1aa-4600-a824-0f144cc0b18d/pasted-text.txt`
- `/Users/afo/.codex/attachments/fe1fd6d8-4339-4252-9186-9bd740fa2828/pasted-text.txt`

Checks run:

- `bun run agentic:guidance`
- `bun run check:design-generated`
- `bun run check:design-tokens`
- `bun run lint:vocab`
- `bun run check:design-md`
- `bun run --filter @green-goods/admin test -- src/__tests__/components/AdminDialogStandard.guard.test.ts src/__tests__/components/AdminSideSheetStandard.guard.test.ts`
- `bun run --filter @green-goods/shared check:stories`
- `bun run --filter @green-goods/shared check:story-quality`
