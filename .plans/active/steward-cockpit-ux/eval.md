# Steward Cockpit UX Fixes Evaluation Plan

## Release Gates

1. Correctness: every workspace renders against the hosted indexer; counts and amounts agree
   wherever they appear; no amount sums different assets.
2. Usability: the three audit tasks (review work with a reason, create an assessment, change one
   Garden Profile field) complete at 1280 and 375 without a dead end or an unannounced prompt.
3. Regression safety: focused tests per PR; critical overrides for PR2 and PR3; CI Gate green.
4. Evidence quality: each handoff records RED and GREEN proof, a Validation Receipt, and labelled
   rendered proof (engine and session).
5. Human judgment: PR4's visual rules are approved by Afo on rendered pairs before merge.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | `/actions` with indexer capital names | The registry and detail render capital names; no route error | `state_api` (PR1) | Table test + mock-auth localhost capture |
| AC-2 | Reject in the review dialog | Reject opens the reason dialog; confirm stays disabled until a reason; the rejection carries it as feedback | `ui` (PR2) | ReviewForm test + capture |
| AC-3 | Review queue signals | Cards show neutral Pending with age; header shows "N waiting over a week"; Critical only on a stalled queue; review time in days | `state_api` + `ui` (PR2) | `summarizeReviewQueue` table test + captures |
| AC-4 | Work titles | No generated timestamps in cards, dialog titles, notifications, or attestation lists | `state_api` (PR2) | `workTitles` table test + capture |
| AC-5 | Confidence and early warnings | Nothing preselected; no warning before an attempt; client sheet matches | `ui` (PR2) | Component test + captures |
| AC-6 | Assessment language | Plain titles, method names as helpers, no default domain | `ui` (PR2) | Step tests + capture |
| AC-7 | Garden Profile save | Footer counts confirmations; rows show each landing; a stop names the field and keeps edits | `ui` (PR3) | Row-builder table test + editor test + capture |
| AC-8 | Member counts | Tab, rail, and dialog agree on distinct people; one row per person | `ui` (PR3) | Dialog and tab tests + capture |
| AC-9 | Endowment amounts | Every amount shows its asset; multi-asset gardens list each | `state_api` (PR3) | Vault summary table test + capture |
| AC-10 | Phone shell | Chip never under the icons; five nav labels fit at 360 in en/es/pt; FAB icon; tab rail cue; alert card first | `ui` (PR4) | Measurements + pairs |
| AC-11 | Actions tone | Purple action, pill, and accent in light and dark; red only for errors | `ui` (PR4) | Token check + pairs |
| AC-12 | Campaign cookie jars | Card on the protocol garden's Payouts for deployers only; flow dialog creates a jar; `/cookies*` redirects | `ui` (PR4) | Route tests + pairs |
| AC-13 | Storybook fidelity | Garden Overview and Hub queue stories match the product layout | `ui` (PR5) | Storybook captures |
| AC-14 | Tokens ratchet | No raw type sizes or view-level `--m3-*` colours; a new one fails `check --only design-tokens` | `ui` (PR5) | Check output |
| AC-15 | QA review | Acceptance checks walked at 1280 and 375, light and dark | `qa_pass_1` | QA handoff |
| AC-16 | Regression review | Targeted validation re-run; open defects closed or filed | `qa_pass_2` | QA handoff |

## Test Strategy

- Unit: table tests for the pure functions each handoff names (`parseIndexerCapital`,
  `toWorkDisplayTitle`, `summarizeReviewQueue`, `buildGardenSettingsSaveRows`,
  `summarizeNetDepositsByAsset`, `formatAssetAmounts`).
- Integration: the existing component tests the handoffs list (ReviewForm, ManageMembersDialog,
  CommunityMembersTab, GardenSettingsEditor, OverviewTab, route and command-palette tests).
- E2E / Playwright: labelled rendered proof on mock-auth localhost; no new E2E suites.
- Manual checks: the three audit tasks at 1280 and 375; PR4 pairs reviewed by Afo.
- TDD proof: RED/GREEN commands and evidence are recorded in the PR handoffs and summarized in
  `status.json` through `record-tdd`.

## Validation Ladder (every PR)

```bash
bun run --filter @green-goods/<shared|admin|client> test -- <changed test files>
bun run --filter @green-goods/<shared|admin> typecheck
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path <surface>:<path>
bun run --filter @green-goods/shared test -- i18n/locale-coverage
bun run check --only design-tokens
bun run check --only guidance-links
node packages/qa/build.mjs
node scripts/quality/check-qa-id-ledger.mjs --base origin/develop
node scripts/docs/generate.mjs
node scripts/harness/plan-hub.mjs validate
```

Run the package typecheck when interfaces move (builds do not typecheck). PR2 and PR3 run the
selector's critical override; wait for low machine load first. Format changed files with
`bunx biome format --write <files>`.

## QA Sequence

### QA Pass 1

- After PR5 merges, walk AC-1 to AC-14 at 1280 and 375, light and dark, on mock-auth localhost.
- If blocked, record the blocker in `handoffs/claude-qa-pass-1.md`.

### QA Pass 2

- Start only after `qa_pass_1` is passed.
- Re-run targeted validation and close the loop on remaining defects.
