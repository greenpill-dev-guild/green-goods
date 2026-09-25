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

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none recorded

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

- `useGardenDetailData` has many consumers; delete the summed bigint only after every consumer
  moves to the per-asset list or `hasEndowment`.
- Try Again must re-read what is still dirty after the garden refetches, so saved fields are not
  sent twice.
