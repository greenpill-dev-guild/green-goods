# Steward Cockpit UX Fixes — PR3 Garden and Community

## Lane

- Execution sub-lane: `pr3_garden_community` (machine lane `ui`; also touches `state_api`)
- Branch: `fix/garden-community-clarity`, from a fresh `origin/develop` after PR2 merges
- Depends on: `pr2_hub_review_queue`
- Merge: the implementing agent merges with `--merge` once CI Gate is green and bot reviews are
  resolved
- Critical gate: `packages/shared/src/hooks/garden/` changes make the push plan critical.

## Scope

D4, D6 (DEC-H), D8 (Edit Garden), D9, D10, D11, D14 (amounts), D15, D19 (Impact), D27, D30
(Garden and Community descriptions), D31 (Karma, vault, payouts copy), D33 (Garden and Community
tiles), D34 (Karma and cookie jar casing). Codify DL-049.

## Steps

### 1. Garden Profile save shows each confirmation (D4, D8, D11)

- Today `packages/admin/src/components/Garden/GardenSettingsEditor.tsx` `handleSave` (~293) runs up
  to seven `mutateAsync` calls in sequence (name, description, location, open joining, max
  gardeners, domains, banner with an IPFS upload) while the footer in
  `packages/admin/src/views/Garden/components/GardenWorkspaceContent.tsx` (~173–230) only says
  "N unsaved changes" or "Saving changes…".
- Add a pure `buildGardenSettingsSaveRows(dirtyFields, progress)` that returns `TxProgressRow[]`
  (`packages/admin/src/components/TxProgressList.tsx`) with a steward-facing title per field, its
  state, and the transaction hash each `mutateAsync` resolves with. Table-test it.
- The editor records each field's state as the run advances and reports it through
  `onDirtyStateChange`. The dialog shows:
  - before saving: "3 changes · 3 wallet confirmations" (one confirmation per changed field; the
    banner also uploads first)
  - while saving: `TxProgressList` rows (confirmed · view transaction / waiting for your wallet /
    queued)
  - after a failure: "Stopped at <field>. 1 of 3 saved. Your other edits are still here." with a
    Try Again button that saves what is still dirty
  - when done: "All changes saved"
- Dialog title "Edit Garden", matching the action that opens it (`app.garden.profile.modal.title`);
  drop the description "Update settings, metadata, and on-chain identifiers".
- The Name field, disabled for non-owners (`canEditName = isOwner`, ~245), shows the helper "Only
  the garden owner can rename the garden." and hides its byte counter while disabled.
- Tests: the row builder table; extend `packages/admin/src/components/Garden/GardenSettingsEditor.test.tsx`
  (a failure stops the run, keeps the draft, and Try Again resumes).

### 2. People, not role seats (D6, DEC-H, D9, D15, DL-049)

- `packages/shared/src/hooks/garden/useGardenDerivedState.ts` (~359): expose the distinct member
  count from `directoryEntries`; `packages/admin/src/views/Community/components/CommunityMembersTab.tsx`
  (~52) uses it for the rail total instead of summing `roleSummary`.
- `packages/admin/src/components/Garden/ManageMembersDialog.tsx` (~86): one row per person,
  holding `AddressDisplay` and one `RoleChip` per role; with `canManage`, each role has its own
  remove button (label "Remove <role>") that opens the existing `AdminConfirmDialog` for that
  address and role. Count copy "{count} members".
- D9: remove the rail's Add Member and Manage Members buttons (~248–262) and the card-header
  Manage Members (~88–97); the header action and each row's Manage Roles stay.
- D15: drop the rail's role-count list (~216); the filter chips stay the one place for role
  counts, and below 480px they collapse into an `AdminSelect` (container query).
- Tests: `packages/admin/src/__tests__/components/Garden/ManageMembersDialog.test.tsx`,
  `packages/admin/src/views/Community/components/CommunityMembersTab.test.tsx`.

### 3. Every endowment amount carries its asset (D14, D9, D27, D31, D33)

- Today `packages/shared/src/hooks/garden/useGardenDetailData.ts` (~100–115) adds net deposits
  across every vault (WETH and DAI) into one `vaultNetDeposited`, shown unit-less in Garden Health
  ("Endowments 0.0007"), the Community header, the Endowment tab, and `Vault.tsx`
  ("0.0007 2 assets").
- Add pure `summarizeNetDepositsByAsset(vaults, chainId)` and `formatAssetAmounts(list, locale)` to
  `packages/shared/src/utils/blockchain/vaults.ts`, grouping by asset and formatting with
  `getVaultAssetSymbol` and `getVaultAssetDecimals` ("0.0005 WETH · 12 DAI"). Table-test both.
- `useGardenDetailData.ts` exposes `endowmentByAsset` and `hasEndowment`; delete the summed bigint.
  Update its consumers: `packages/shared/src/hooks/admin-ui/garden/useGardenWorkspaceController.ts`
  (~305), `packages/shared/src/hooks/admin-ui/community/community.utils.ts`
  (`buildCommunityHeaderStats`), `packages/admin/src/views/Community/components/CommunityEndowmentTab.tsx`
  (~43), `packages/admin/src/views/Garden/Vault.tsx` (~185), `OverviewTab.tsx` (~243, ~455), and
  the treasury severity in `useGardenDerivedState.ts` (use `hasEndowment`).
- D27: `packages/admin/src/components/Vault/PositionCard.tsx` (~328) prints
  `app.treasury.impactYieldHelper` once above the vault grid instead of on every card.
- D9: Harvest & Distribute (~333, ~416) becomes tonal, so Endowment shows one filled action.
- D31: `VaultContractDetails` copy in steward words.
- D33: stat tiles nested inside cards on Garden Health and Endowment become plain label and value
  rows.
- Tests: the two table tests; update fixtures in
  `packages/admin/src/components/Layout/AdminNotificationPanel.test.tsx`,
  `packages/admin/src/__tests__/components/CanvasLayout.test.tsx`,
  `packages/admin/src/views/Community/components/CommunityWorkspaceContent.test.tsx`,
  `packages/shared/src/__tests__/hooks/admin-ui/header-stats.test.ts`, and
  `packages/shared/src/__tests__/hooks/garden/useGardenDerivedState.test.ts`.

### 4. Payouts, Impact, Karma (D10, D19, D30, D31, D33, D34)

- D10: `community.utils.ts` (~161) keeps Fund Cookie Jar visible but disabled with the reason
  "This garden has no payout jar yet." when the garden has no jar;
  `packages/admin/src/views/Hub/components/CookieJarPayoutPanel.tsx` (~124) empty state says how a
  jar appears.
- D19: `packages/admin/src/views/Garden/components/ImpactTab.tsx` hides View All at zero (~89,
  ~189); drop the forced heights in `gardenDetail.constants.ts` (~17); empty states point to the
  Hub's Create Assessment and Create Hypercert.
- D31: `CommunityPayoutsTab.tsx` "Allocation events" → "Payouts so far";
  `packages/admin/src/views/Garden/components/KarmaIntegrationPanel.tsx` names who can clear the
  migration warning ("Ask the Green Goods team to migrate this garden").
- D34: "Karma Integration" in Title Case; `app.cookieJar.noJars` → "No cookie jars found for this
  garden".
- D30: halve `cockpit.community.members.directoryDescription` ("Search and filter members."),
  and drop `cockpit.community.description` and `cockpit.garden.description` where they repeat
  the tab rail.
- D33: the Members rail tiles become rows.

## Stories

GardenSettingsEditor (saving, stopped, done), ManageMembersDialog (one row per person, remove a
role), CommunityMembersTab, PositionCard, CookieJarPayoutPanel without a jar, ImpactTab empty,
multi-asset endowment.

## QA Catalog

Update ADM-048 to ADM-051 and ADM-168 (Edit Garden), ADM-053 (Manage Members), ADM-007, ADM-023,
ADM-066 to ADM-069 (endowment), ADM-010 and ADM-070 (payout jar). Add new IDs for save progress
and per-asset amounts. Then `node packages/qa/build.mjs`,
`node scripts/quality/check-qa-id-ledger.mjs --base origin/develop`, and
`node scripts/docs/generate.mjs`.

## Design Docs

Codify DL-049 in interaction-patterns § 5 (counts mean people) and flip it to `codified`.

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/hooks/garden/useGardenDerivedState.test.ts src/__tests__/hooks/admin-ui/header-stats.test.ts
bun run --filter @green-goods/admin test -- src/components/Garden/GardenSettingsEditor.test.tsx src/__tests__/components/Garden/ManageMembersDialog.test.tsx src/views/Community/components/CommunityMembersTab.test.tsx
bun run --filter @green-goods/shared test -- i18n/locale-coverage
bun run --filter @green-goods/shared typecheck
bun run --filter @green-goods/admin typecheck
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path admin:src/components/Garden/GardenSettingsEditor.test.tsx
```

Add the new table-test files to the first two commands once they exist.

## Rendered Proof

Mock-auth localhost at 1280 and 375: Edit Garden with three changes (before, during with a
mocked wallet, stopped), Community → Members (counts agree, one row per person), Endowment and
Garden Health (per-asset amounts), Payouts without a jar, Impact empty.

Recorded 2026-09-25 (engine: Claude Browser pane, Chromium; session: mock-auth localhost,
`?mockAuth=deployer`, admin dev server reading the hosted indexer `e6edffd`, Green Goods Community
Garden; nothing was saved or sent):

- Garden Health at 1280: the three metrics sit unboxed above a divider, the key metrics are plain
  rows, and Endowments reads "0.0007 WETH". The header carries no description; Karma Integration
  is in Title Case and its migration warning ends "Ask the Green Goods team to migrate this
  garden."
- Edit Garden at 1280, with the location, description, and open joining changed: titled Edit
  Garden with no description; the footer reads "3 changes · 3 wallet confirmations"; the deployer
  is not the owner, so Name is locked with "Only the garden owner can rename the garden." and no
  byte counter. The edits were discarded through Discard Changes?.
- Community → Members at 1280 and 375: Total members 46, the directory's 46 rows, the Members tab
  badge, and Manage Members ("46 members") agree; the rail shows no role list and no buttons. At
  375 the role filter is a select ("Filter members by role", counts in its options) and the first
  member sits above the fold. Manage Members opened for the owner shows one row with Owner,
  Steward, and Gardener chips, each with its own remove; at 375 that row first squeezed the
  address under the Owner chip, fixed by stacking the chips under the address (0359ceb08).
- Endowment at 1280: Total value locked "0.0007 WETH", the yield explanation once above the DAI
  and WETH cards, plain rows in each card, Harvest & Distribute tonal, and "Where the Funds Are
  Held" with DAI Vault, WETH Vault, Green Goods Vault Manager, and Aave Lending Pool.
- Payouts at 1280 and 375: this garden has no payout jar (the panel's own read agrees). Fund
  Cookie Jar is disabled with the title and description "This garden has no payout jar yet.";
  the panel reads "No cookie jars found for this garden" with the new explanation, and payout
  readiness counts "Payouts so far 0". At 375 the speed dial lists the reason under the disabled
  action; its labels wrapped one word per line until the dial was sized to its content
  (0359ceb08).
- Impact at 1280: no View All on either empty list; "No hypercerts yet" says hypercerts are made
  in the Hub and links Create Hypercert, and Recent Assessments links Create Assessment; the
  hypercert card no longer stretches to the screen.
- Save progress (Storybook static build, Chromium): Saving shows Name Confirmed with View,
  Description "Waiting for your wallet" as the current step, and Location queued under "Saving
  changes…"; Stopped reads "Stopped at Description. 1 of 3 saved. Your other edits are still
  here."; StewardNotOwner renders the real dialog with the locked name and its helper. A live
  save with a wallet was not run, since it writes to the chain.
- The third review round's FAB changes (a disabled sole action stays inert and says why; a dial
  with every action disabled still focuses its first action) were not rechecked in the browser;
  the FAB tests in both packages and the storybook-ci FAB stories cover them, including a check
  that the shared dial keeps a label on one line.

## TDD Proof

- RED, each before its change (`bun run --filter @green-goods/admin test -- <file>` unless
  noted):
  - Endowment (07:53Z): `GardenVaultView.test.tsx` failed (no per-asset total; the old page summed
    base units) and `PositionCard.test.tsx` failed (the card still repeated the yield
    explanation).
  - Edit Garden (08:11Z): `GardenSettingsEditor.test.tsx` 2 failed (a declined write left no
    stop and Try Again re-sent the saved name; the locked Name had no helper).
  - Members (08:41Z): `CommunityMembersTab.test.tsx` failed (the rail summed role seats) and
    `ManageMembersDialog.test.tsx` failed (one row per role seat).
  - Fund Cookie Jar (08:44Z): `view-actions.test.ts` (shared) failed (no disabled state or
    reason) and `AdminViewActions.test.tsx` failed (no title or description).
- GREEN: the same files pass after each change; see the receipt for the final run.
- After review (RED on the code before each fix): first round, `gardenSettingsSave` 2 and `GardenSettingsEditor` 1 failed (a Safe proposal read as Confirmed with an explorer link), `useGardenCookieJars` 4 failed (no signal that the jar list was read), and `vaults` 2 failed (an empty endowment read a bare "0"). Second round: `AdminViewActions` 1, `FabButton` 1, and shared `NavigationBar` 2 failed (a disabled action's reason was unreachable by keyboard and hover, and the shared dial did not show it), `speedDialNavigation` failed (no shared rule yet), and `vaults` 1 failed (USDC read as 18 decimals). Third round: `FabButton` 2 and shared `NavigationBar` 2 failed (a disabled sole action still fired and gave no reason, and a dial with every action disabled left focus on the FAB). Codex, after the third round: the `NavigationBarFab` SpeedDial story failed in storybook-ci once it mounted the FAB as `NavigationBar` does ("Add Member" wrapped onto two lines because the dial took the FAB's width).
- Proof limit: the table tests for `summarizeNetDepositsByAsset`, `formatAssetAmounts`, and
  `buildGardenSettingsSaveRows`, and the Impact and Karma tests, were written with their code;
  the Karma test moved with its copy.

## Validation Receipt

- Tested implementation commit SHA: `d5692a23ba1c967aca3083aee2300a7962f86bf1` (after Codex's review of the third round, on `develop` with PR2 merged; the receipts on `59ca04ac0`, `2d1db069b`, `d9fb2906a`, and `2b344c8eb` are superseded)
- Run at (UTC): push gate `2026-09-25T16:20:29Z` to `2026-09-25T16:23:35Z`
- Exact command(s): `PATH="$PWD/node_modules/.bin:$PATH" node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path shared:src/__tests__/components/NavigationBar.test.tsx`
- Result: push gate exit 0 on the critical plan, 26 automated checks passed (shared 5814, client 1399, admin 1021, and agent 316 tests passing, with docs-authority, source-structure, design-guardrails, agent-guidance, qa-id-ledger, supply-chain, story-quality, and agent-tools-test; the storybook-ci story suite passed locally on the same commit, 94 files and 330 tests);
  browser-proof stays the manual proof recorded under Rendered Proof
- Validated paths: `packages/shared/src`, `packages/admin/src`, `packages/qa/locales`, `scripts/data`, `scripts/quality`, `docs/docs`, `.claude/skills`, `DESIGN.md`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages/shared/src packages/admin/src packages/qa/locales scripts/data scripts/quality docs/docs .claude/skills DESIGN.md` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code d5692a23ba1c967aca3083aee2300a7962f86bf1..HEAD -- packages/shared/src packages/admin/src packages/qa/locales scripts/data scripts/quality docs/docs .claude/skills DESIGN.md` → empty (exit 0); the receipt commit changes only `.plans/`
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- packages/shared/src packages/admin/src packages/qa/locales scripts/data scripts/quality docs/docs .claude/skills DESIGN.md` → empty

## Risks / Blockers

- `useGardenDetailData` has many consumers; delete the summed bigint only after every consumer
  moves to the per-asset list or `hasEndowment`.
- Try Again must re-read what is still dirty after the garden refetches, so saved fields are not
  sent twice.
