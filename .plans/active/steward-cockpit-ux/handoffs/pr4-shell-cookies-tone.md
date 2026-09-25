# Steward Cockpit UX Fixes — PR4 Shell, Cookies, Tone

## Lane

- Execution sub-lane: `pr4_shell_cookies_tone` (machine lane `ui`)
- Branch: `feature/shell-cookies-and-actions-tone`, from a fresh `origin/develop` after PR3 merges
- Depends on: `pr3_garden_community`
- Merge: **waits for Afo's yes.** Capture before (at the branch start) and after screenshots at
  1280 and 375, light and dark, share them with Afo in the session, and merge with `--merge` only
  after he approves, CI Gate is green, and bot reviews are resolved.

## Scope

DEC-A, D8 (campaign jar and Profile names), D16, D17, D18, D19 (campaign list), D20, D21 (DEC-C),
D22 (DEC-D), D31 (campaign copy), D34 (campaign casing), D36. Codify DL-043, DL-045, DL-046,
DL-050, DL-051.

## Steps

### 1. Outlined Hub trio (DEC-A, DL-043)

- `packages/shared/src/hooks/admin-ui/hub/hub.utils.ts` `buildHubViewActions` (~243): set
  `variant: "secondary"` on Submit Work and Create Assessment (today Create Assessment is primary
  for reviewers who cannot manage). Keep `primary: true` on Submit Work so it stays rightmost and
  drives the FAB. Update the comment.
- Codify: interaction-patterns § 1 (a review surface renders its action set outlined; the declared
  primary still orders the row and fills the FAB), the tone-budget line in
  `packages/admin/DESIGN.md`, and frontend-design Rule 18 ("at most one filled header action").

### 2. Phone app bar and nav (D16)

- `packages/shared/src/components/Canvas/GardenChip.tsx` (~50–54): size the chip to its flex slot
  (`max-width: 100%` inside a `min-w-0 flex-1` leading slot in
  `packages/admin/src/components/Shell/AppBar.tsx`) instead of `calc(100vw - 2rem)`, so it never
  runs under the refresh and bell buttons. Measured at 375 before the fix: chip x 30–322, refresh
  261–301, bell 305–345.
- `packages/admin/src/components/Shell/NavigationBar.tsx` (~66–86): on mobile drop the label
  letter-spacing and `truncate`, and trim item padding, so Hub, Garden, Community (Comunidad,
  Comunidade), Actions, and Profile fit at 360 and 375 in en, es, and pt. Measure each label's
  `scrollWidth` against its box. Update `NavigationBar.test.tsx` if it asserts the old classes.

### 3. FAB shows its primary action (D17, DL-050)

- `packages/admin/src/components/Shell/FabButton.tsx` (~36–40, ~248–252): a multi-action dial
  shows `config.icon` (the primary action's icon, already set by `useViewActions`) and swaps to
  `RiCloseLine` while open, replacing the 45° rotation of "+". Hub keeps "+" because Submit Work's
  icon is `RiAddLine`. Rewrite the comment that explains the old neutral opener.
- Dial labels (~211) stay on one line.
- Update the FabButton stories' play functions if names change; keep the accessible names.

### 4. Tab rail cue (D18)

- `packages/admin/src/components/AdminTabRail.tsx` (~121): when the rail overflows, fade the
  clipped edge (CSS mask) and snap tabs on scroll; keep scrolling the active tab into view.
  Measured at 375: Hub 476 of 283 px, Community 490 of 283, Garden 339 of 283.

### 5. Alerts lead on phones (D36, DL-051)

- Garden Health puts Attention Needed in the rail, which stacks after the main column below
  768px (`packages/admin/src/index.css` ~629 `.garden-tab-rail { order: 2 }`). On phones, show the
  alert card first and leave the rest of the rail after the main column. Prefer placing the one
  card with the existing `useMediaQuery` hook over `display: contents`, which can drop the rail's
  landmark from the accessibility tree.
- Codify in interaction-patterns § 4 as an amendment to DL-008.

### 6. Purple Actions tone (D21, DEC-C, DL-045)

- `packages/admin/src/styles/admin-m3-tokens.css` `[data-tone="actions"]` (~441–452): primary and
  action `var(--purple-700)` (91 44 201; 7.9:1 with white), hover `var(--purple-800)`, container
  `var(--purple-100)` with `var(--purple-900)` ink, accent text `var(--purple-700)`, surface tint
  from `--purple-500`.
- Dark block (~548–559), DL-009 tonal rule: fill `var(--purple-200)` with `var(--purple-900)` ink,
  hover `var(--purple-100)`, container `var(--purple-900)` with `var(--purple-100)` ink, accent
  `var(--purple-200)`.
- Update the dual-safe tones line in `.claude/skills/design/language.md` (~381), bump
  `token_version` in `.claude/skills/design/SKILL.md` from 2.17.0 to 2.18.0, and fix any doc that
  names the Actions workspace red.

### 7. Campaign cookie jars on the protocol garden's Payouts (D22, DEC-D, D20, D8, D19, D31, D34, DL-046)

- Lift the protocol-garden test in `packages/admin/src/views/Community/components/CommunityPools.tsx`
  (~44: root garden from `useProtocolPool`, or the garden's own pool type `PROTOCOL`) into one
  shared hook in `packages/shared/src/hooks/commitment-pooling/`, used by `CommunityPools` and
  `CommunityPayoutsTab`.
- `packages/admin/src/views/Community/components/CommunityPayoutsTab.tsx`: when the viewer is a
  deployer (`useRole().isDeployer`) and the selected garden is the protocol garden, show a
  "Campaign Cookie Jars" card holding the existing campaign list (`CampaignCookieJarPanel` and
  `CampaignCookieJarPanelList` under `packages/admin/src/views/Cookies/components/CampaignCookieJar/`),
  with Create Cookie Jar in its header.
- Create Cookie Jar opens a flow dialog (`AdminDialog variant="flow"` with `ActionFlowShell`)
  whose steps host the existing sections: Campaign (`CampaignDetailsSection`), Payout
  (`CampaignPayoutSection`), Gardens (`CampaignGardenSection`), Review (`CampaignCreateReview`,
  with `CampaignAdvancedSection` as a detour). Move the state and handlers from
  `CampaignCookieJarCreateWorkspace.tsx` into the dialog body; the created and submitted states
  (`CampaignCookieJarCreateStates.tsx`) render as the flow's final state.
- `packages/admin/src/routes/views.tsx` (~355–360): `/cookies` redirects to the protocol garden's
  Community → Payouts (`item=campaigns`) and `/cookies/deploy` to the same with the create flow
  open (`item=create-campaign-jar`). Point the command-palette entry
  (`packages/shared/src/hooks/admin-ui/navigation/workspaceViews.ts` ~60) at the new route.
- Delete what this orphans: `packages/admin/src/views/Cookies/index.tsx`, the numbered-section page
  layout in `CampaignCookieJarCreateForm.tsx`, the fixed phone review bar in
  `CampaignCreateReview.tsx` (~88), the forced `min-h-[32rem]` in `CampaignCookieJarPanelList.tsx`
  (~34), and any route helpers left unused.
- One name, "Campaign Cookie Jars" (`cockpit.community.cookies.title`, `...listTitle`); steward
  words for "Generated stewards", "Missing stewards", and "1 trusted campaign jar indexed for this
  network."
- Tests: `packages/admin/src/components/Layout/commandPalette.results.test.ts`,
  `packages/admin/src/__tests__/routing/command-palette-routes.test.tsx`,
  `packages/admin/src/__tests__/routing/runtime-navigation.test.tsx`,
  `packages/shared/src/__tests__/utils/admin-routes.test.ts`,
  `packages/admin/src/views/Cookies/campaignCookieJarPanel.model.test.ts`, plus one redirect test.
- Codify DL-046 in `packages/admin/DESIGN.md` where it lists protocol-level surfaces.

### 8. Profile name (D8)

- `packages/admin/src/components/Layout/AccountSurface.tsx` (~40–48): the mobile tab reads
  "Profile", matching the nav item and the desktop sheet; update the comment.

## Stories

FabButton (dial closed and open with the primary icon), AdminTabRail overflowing, Campaign Cookie
Jars card, the create flow at each step and its created state, Actions workspace in purple (light
and dark).

## QA Catalog

Update ADM-070, ADM-103, and ADM-169 (campaign jars: new home and flow) and ADM-100 to ADM-102 if
they name the Actions colour. Then `node packages/qa/build.mjs`,
`node scripts/quality/check-qa-id-ledger.mjs --base origin/develop`, and
`node scripts/docs/generate.mjs`.

## Validation

```bash
bun run --filter @green-goods/admin test -- src/components/Layout/commandPalette.results.test.ts src/__tests__/routing/command-palette-routes.test.tsx src/__tests__/routing/runtime-navigation.test.tsx src/views/Cookies/campaignCookieJarPanel.model.test.ts src/components/Shell/NavigationBar.test.tsx
bun run --filter @green-goods/shared test -- src/__tests__/utils/admin-routes.test.ts
bun run --filter @green-goods/shared test -- i18n/locale-coverage
bun run --filter @green-goods/admin typecheck
bun run check --only design-tokens
bun run check --only guidance-links
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path admin:src/components/Layout/commandPalette.results.test.ts
```

## Rendered Proof (before and after, shared with Afo)

Mock-auth localhost, 1280 and 375, light and dark: Hub header trio; Garden at 375 (chip, nav, FAB
closed and open, tab rail, alert order); the Actions workspace; Community → Payouts in the
Green Goods Community Garden with the campaign card; the create flow's first step and Review.
Label engine and session.

Recorded 2026-09-25 (engine: headless Chromium through Playwright; session: mock-auth localhost,
`?mockAuth=deployer`, the admin dev server on the branch reading the hosted indexer, Green Goods
Community Garden; nothing was saved or sent). Before is PR3's head (`06cacf819`, develop once PR3
merged), after is this branch; 1280 and 375 in light and dark, plus 360 in es and pt; the contact
sheets went to Afo in the session on 2026-09-25.

- Hub at 1280: the trio is outlined with Submit Work rightmost. At 375 the chip reads "Green Goods
  Comm…" and ends before the refresh and bell, and the nav reads Community whole.
- Garden Health at 375: Attention Needed leads above Garden Health; the FAB shows a gear and, open,
  a close icon; the tab rail fades its clipped edge.
- Nav at 360 in es and pt: Comunidad and Comunidade show whole; the chip ends before the bell.
- Actions at 1280 and 375, light and dark: the fill, tab, and nav pill are purple.
- Profile at 375: the page and its first tab read Profile.
- `/cookies` lands on the Green Goods Community Garden's Payouts with Campaign Cookie Jars in view at
  1280 and 375, after PageTransition learned to land on a `data-route-item` target (the first capture
  showed the reset to the top). `/cookies/deploy` opens Create Cookie Jar on Campaign; three Nexts
  reach Review, where Create stays disabled until the jar is complete.

## TDD Proof

RED on the code before each change, then GREEN on the same command (2026-09-25; admin and shared
suites through `bun run --filter @green-goods/<pkg> test -- <file>`, stories through the storybook-ci
Vitest project):

- Outlined Hub trio (16:31Z): shared `view-actions.test.ts` 2 failed (Submit Work and an
  evaluator's Create Assessment rendered filled); GREEN 20 passed.
- Profile name (16:34Z): the `Profile` route stories, now in storybook-ci, 2 failed (heading and
  tab read Account); GREEN 2 passed.
- Phone app bar and nav (16:47Z): the `AppBar` phone story failed (chip right edge 328 past the
  actions at 255) and the `NavigationBar` phone stories failed at 360 in en, es, and pt (Community
  71, Comunidad 72, Comunidade 80 px against 68 px tabs); GREEN 14 passed.
- FAB icon (16:51Z): `FabButton.test.tsx` 1 failed (the closed dial drew a plus, not the primary's
  icon); GREEN 4 passed.
- Tab rail cue (16:53Z): the `OverflowOnAPhone` rail story failed (no overflow state); GREEN 3
  passed.
- Alerts on phones (17:13Z): `OverviewTab.test.tsx` 1 failed (the Attention Needed card followed the
  health card at phone width); GREEN 60 passed across the Garden tests.
- Purple Actions (17:15Z): the `ActionsTone` rail story failed (active tab rgb(208, 37, 51), the
  error red); GREEN rgb(91, 44, 201).
- Campaign cookie jars (17:19Z–17:31Z): shared `useProtocolPool.test.ts` 3 failed (no
  `isProtocolGarden`); `admin-routes.test.ts` 1 and `runtime-navigation.test.tsx` 2 failed (no
  redirect to Payouts); `CommunityPayoutsTab.test.tsx` 2 failed (no card, no flow); GREEN 3, 8, 16,
  and 6 passed.
- Arrival scroll (17:43Z): `PageTransition.test.tsx` 1 failed (a workspace switch reset to the top
  instead of the `data-route-item` target); GREEN 19 passed.
- Codex's first review (20:03Z–20:08Z): `campaignCookieJarDraft.test.ts` 3 failed (a changed payout
  asset, withdrawal interval, or jar owner did not count as an edit to discard); GREEN 13 passed.
  `AdminTabRail.test.tsx` 1 failed (a tab that widened inside an unchanged rail left no fade); GREEN 4
  passed. Shared `NavigationBarFab.test.tsx` 1 failed (the dial still drew the rotating plus); GREEN
  passed. `useProtocolPool.test.ts` 1 failed (the deployment's root garden was not the protocol garden
  where pooling is not deployed); GREEN 4 passed. `useEligibleAdminGardens.test.ts` 1 failed (a
  deployer without a role there could not select the protocol garden); GREEN 14 passed.
- Codex's second review (20:31Z): `FabButton.test.tsx` and shared `NavigationBarFab.test.tsx` both
  failed (an open dial was still named Open Actions); GREEN both passed.
- CodeRabbit's review (20:44Z): `AdminTabRail.test.tsx` 1 failed (a selected tab landed flush with
  the rail's edge, under its fade: scrollLeft 14 where the first tab start that clears it is 56);
  GREEN 5 passed, with the two older cases moved from the flush-edge offset (100) to the tab's own
  snap position (120). In Chromium the rail snaps even a programmatic scroll, so the flush offset
  never held: on the 283px phone story Work landed at 0–122 under the start fade and Assess at
  126–258 under the end fade; after the fix they land at 40–162 and 45–178, clear of both.
- Proof limit: the flow dialog's step-navigation story was written with the flow; its storybook-ci
  play passes. The QA catalog cases are the manual proof. The phone tabs' large-text wrap
  (Codex's second review) needs layout jsdom lacks; Chromium at 360px with 20px labels measured
  Profile ending at 374 before (the nav overflowed) and the five tabs ending at 355 after.

## Validation Receipt

- Tested implementation commit SHA: `b07aed27e56d8bb8367c004314705dfac8a3ebd4` (after Codex's second review and CodeRabbit's review of #908; the receipts on `1d2f9584e`, `e2a85abd5`, and `a6f43eb1b` are superseded)
- Run at (UTC): full suites `2026-09-25T20:48:06Z` to `2026-09-25T20:50:57Z`; push gate `2026-09-25T20:50:57Z` to `2026-09-25T20:54:48Z`
- Exact command(s): `bun run --filter @green-goods/{admin,shared,client} test`; `bun run --filter @green-goods/shared test:stories:ci`; `PATH="$PWD/node_modules/.bin:$PATH" node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --check ontology --check docs-generated --check design-guardrails --test-path admin:src/__tests__/components/AdminTabRail.test.tsx`
- Result: admin 1053, shared 5824 (17 skipped), and client 1399 tests passed, and the storybook-ci story suite passed (96 files, 340 tests); the push gate exited 0 on the critical plan with 29 automated checks passed: format, lint, the shared, client, admin, and agent typechecks, test typechecks, suites, and builds, docs-authority, docs-test, docs-build, source-structure, design-guardrails, ontology, agent-guidance, qa-id-ledger, supply-chain, story-quality, storybook-build, agent-tools-test, and docs-generated. Earlier failures on this branch, all fixed: docs-authority on `31703f66f` (the Funding and Governance source of truth), Build Docs on `f891e3d70` (ADM-187 and ADM-188 named a non-persona role), and the admin Playwright smoke test on `f70febbca` (the old Account heading). Browser-proof stays the manual proof under Rendered Proof
- Validated paths: `packages/admin/src` `packages/shared/src` `packages/shared/.storybook` `packages/admin/DESIGN.md` `packages/admin/AGENTS.md` `scripts/data` `docs/docs` `tests/specs` `.claude/skills` `.claude/rules`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/admin/src packages/shared/src packages/shared/.storybook packages/admin/DESIGN.md packages/admin/AGENTS.md scripts/data docs/docs tests/specs .claude/skills .claude/rules` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code b07aed27e56d8bb8367c004314705dfac8a3ebd4..HEAD -- packages/admin/src packages/shared/src packages/shared/.storybook packages/admin/DESIGN.md packages/admin/AGENTS.md scripts/data docs/docs tests/specs .claude/skills .claude/rules` → empty (exit 0); the receipt commit changes only `.plans/`
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- packages/admin/src packages/shared/src packages/shared/.storybook packages/admin/DESIGN.md packages/admin/AGENTS.md scripts/data docs/docs tests/specs .claude/skills .claude/rules` → empty

## Risks / Blockers

- The flow-dialog conversion is the largest UI change in this plan; keep the campaign state
  logic as it is and only re-host it.
- The redirect needs the protocol garden's address before the first render; fall back to the
  Community workspace when the chain config has none.
- `.claude/rules/frontend-design.md` and the design skill are security-sensitive guidance
  surfaces; call their edits out in the PR.
