# PRD-1375 remaining cockpit slices

Base: fetched `origin/develop` = `652825db9ebe88458dfbf7e6246147190e93fdac` on
2026-11-05 UTC. Initial fetch was sandbox-blocked; the approved fetch succeeded.
Clean detached worktree at dispatch. No branch changes, publication or Linear writes authorized.

Live issue reconciled: ten entries despite the nine-slice title, three checked and seven unchecked;
no comments. #1391 and #1392 contain the review fixes and locked rulings; #1403, #1404,
#1414, #1416 and #1419 are merged and cover the checked entries. Those slices stay untouched.
The hub's linear-sync manifest is `parent_only`, `preserve_existing`; PRD-1266 was verified
live as Done without mutation. PRD-1375 is the accepted follow-up scope.

Integration update received during verification: develop advanced to
`106c7e9ae40691e3be9718c23070e6b0414ec4cb` with PR #1484. This stream keeps the base above
frozen. A read-only comparison against the unpublished Home repair catalogs on the same base
found 17 changed cockpit keys and 2 changed Home keys per locale, with no overlapping keys in
EN/ES/PT. Integration still needs the usual file merge and validation; nothing was applied here.

Reuse: `Cards/FactRow.tsx` owns list facts and remains unchanged. The new sibling
`Cards/StatTile.tsx` owns headline metrics missing from that grammar, as DL-136 requests.
Its Storybook pair must render before consumer rollout. Existing admin cards, ItemRow,
garden settings editor and steward-access controller remain their respective capability owners.

## Result and review order

Six remaining implementation slices are complete for review. The seventh, DL-145, has its
data audit and an honest unavailable state; actual jar history needs a separate data-contract
decision. This handoff does not move PRD-1375 to Done or establish production approval.

| Checkpoint | Implementation and evidence |
|---|---|
| Shared primitive first, DL-136 | Added `StatTile` beside `FactRow`; rendered the before/after Storybook pair before consumer rollout. Measured label 12px/500, value 22px/600, delta 12px. Facts retain `FactRow`. |
| Hub, DL-135/138 | At most two wide queue cards from 1024px, 192px mosaic, 14px title, 12px meta; matching skeleton. Empty Create remains below 1024px and hides from 1024px. Checked 390, 1023, 1024, 1440 and 1920px as applicable. |
| Metrics and subtitles, DL-136 | Garden Health, Endowment balances and Promises stats adopt `StatTile`; assets remain separate. Relevant non-voucher cockpit card subtitles use 14px body type. Shared MediaCard keeps the app's defaults and takes cockpit overrides through tokens. |
| Edit Garden, DL-137 | Name/Location share a row; three-line description; one joining/cap FactList; domain chips; uploader inside identity card with draft ownership retained in the editor. At 1440×900, enabled-cap body measures 686px client/686px scroll and all six field message areas reserve 32px. EN/ES/PT desktop and phone captures; existing save, held-send, partial failure, retry and discard tests retained. |
| Profile, DL-139 | Titled access section and explicit request label; excludes owned/stewarded gardens, case insensitive. Pasted links explain existing access. Role changes cannot leave a blank review step. Retry fixture recovers and Escape returns focus. |
| Members, DL-141 | Count-free nonempty role filters; per-role counts and missing coverage in Members rail. Distinct-person directory total stays in the header, preserving DL-134. Desktop keyboard filter and phone select/reset checked. |
| Garden, DL-142/143/144 | ItemRows carry photo/icon, actor/action and independent known status; full-row record navigation, day groups and 20-event pages. Health + three-row mini feed in main column; alerts/Karma in rail. Workspace tabs measured Health, Promises, Activity, Impact. |
| Jar, DL-145 | Added claims/cap, funding source and last jar payout facts as unavailable, with specific explanations. Existing allocation count now explicitly says garden yield payouts. No inferred claimant, deposit source, zero history or jar attribution. DL-145 remains locked. |

## DL-145 data-contract boundary

Audited [indexer config](../../../../packages/indexer/config.yaml),
[schema](../../../../packages/indexer/schema.graphql),
[factory handler](../../../../packages/indexer/src/handlers/cookieJarFactory.ts) and
[yield handler](../../../../packages/indexer/src/handlers/yieldSplitter.ts).
The factory indexes JarCreated and MetadataUpdated. There is no garden-jar claim/deposit
history read. YieldAllocation has garden, asset, amounts, transaction and timestamp, but no
recipient jar address. Campaign jar records do not establish history for these garden jars.

Completing DL-145 requires an accepted read contract for jar-address-scoped claimant, time,
amount/asset, deposit source, and recipient-attributed yield payout data, including completeness
and failure states. A garden-wide allocation count cannot answer these questions. No indexer
schema, event subscription, backend or contract change was made in this stream.

The root stream's separate follow-up identifies an existing source for jar-attributed yield:
[YieldSplitter](../../../../packages/contracts/src/resolvers/Yield.sol) emits
`YieldToCookieJar(garden, asset, amount, jar)`. The current indexer subscribes to `YieldSplit`
only, so adding the projection/read can reuse that event. Shared's jar ABI also declares
Deposit. Claims still require deployed-version and receipt-source conformance; the sibling
source inspected by the root does not emit its declared Withdrawal event. That is a follow-up
source finding, not verification of any deployed jar. The root owns the proposed separate
jar-data scope; this stream adds no implementation or rollout authority.

## Separate reviewable groups

No commits were created. Review the governed code before the guidance group:

1. Shared StatTile, MediaCard token seams, explicit exports and pair stories.
2. Hub cards, skeleton and responsive empty states.
3. Metric consumers and subtitle type updates.
4. Garden settings layout, keeping draft/save ownership intact.
5. Profile access controller, view and recovery/ownership proof.
6. Members filters/rail and Garden activity/navigation.
7. Jar unavailable-state copy and EN/ES/PT catalogs.
8. Guidance only: `packages/admin/DESIGN.md`, `.claude/rules/frontend-design.md`,
   `.claude/skills/design/interaction-patterns.md`, and design `decision-log.md`.
   Codified DL-135–139 and DL-141–144; DL-137 remains a one-view layout rule.
   DL-134 and DL-140 were not changed. DL-145 is still locked.
9. Derived-evidence addendum requested by the root review: four fingerprint values in
   `scripts/data/module-seam-registry.json` and canonical regeneration of
   `docs/docs/builders/packages/{commands,api-index}.mdx` and
   `docs/docs/reference/glossary.generated.mdx`. Runtime and guidance remain frozen.

Sensitive/configuration impact: `packages/shared/package.json` adds only the StatTile and
existing useAddressDisplayName leaf exports. No dependency or lockfile change. The design-token
debt baseline loses two obsolete OverviewTab entries; no exemptions were added. No CI,
permission, agent entrypoint, harness configuration or source-length ceiling was weakened.
The seam registry is a sensitive evidence surface: only four derived fingerprints changed;
IDs, certified lifecycle, interfaces, proof lists and reviewedAt values did not. The API index
adds the two public exports and corresponding counts; Commands and Glossary change only their
source digests. No generated page was edited by hand.

## Browser proof and review walk

Proof class: **Storybook, isolated Chromium with seeded fixtures**. The initial StatTile pair
was also observed in a new Brave Storybook tab. This is not authenticated application proof.
No wallet signature, real upload, transaction or role grant was performed.

Own Storybook preview: [local Storybook](http://localhost:3034/). The other checkout's services
were left alone. This worktree's Admin coordinator could not bind, so no mock-auth localhost
proof is claimed. Captures and one-shot automation are ignored local files under
`tmp/prd-1375-proof/`, not committed private QA evidence.

- [StatTile pair](http://localhost:3034/?path=/story/shared-cards-stattile--cockpit-pair)
- [Hub queue](http://localhost:3034/?path=/story/admin-workflows-hub-hubworkcard--queue)
- [Edit Garden](http://localhost:3034/?path=/story/admin-workflows-garden-editgardendialog--owner-editing)
- [Profile](http://localhost:3034/?path=/story/admin-shell-accountprofilepanel--localized)
- [Members](http://localhost:3034/?path=/story/admin-workflows-community-members--roster)
- [Garden workspace](http://localhost:3034/?path=/story/admin-workspaces-garden--health-layout)
- [Activity pages](http://localhost:3034/?path=/story/admin-workflows-garden-overviewtab--activity-pagination)
- [Jar facts](http://localhost:3034/?path=/story/admin-workflows-hub-cookiejarpayoutcard--default)
- [Already stewarded link](http://localhost:3034/?path=/story/admin-workflows-steward-access-request--already-steward)

The 21-case matrix (`matrix.json`) passed with no horizontal page overflow or page errors.
It covers 1440px and 390px layouts, 1920px queue, and EN/ES/PT Edit Garden/Profile/Members.
`interactions.json` records keyboard member filters, phone select/reset, exact empty-action
breakpoints, queue geometry, picker Retry/Escape/focus return and workspace tab order.
`refresh.json` records the final dated/photo activity, valid cap and latest localized copy.
Use `edit-cap-enabled-1440.png`, `activity-days-1440.png`, `activity-filtered-390.png`,
`jar-audited-1440.png` and `profile-terminology-390-{es,pt}.png` for the latest frames.

Human review: compare the pair first; inspect sparse Hub rows and hidden desktop Create;
open Edit Garden and keep the footer in view; try an already-owned garden link; filter Members
by keyboard and phone select; inspect day labels/Show More and the four-tab order; read the jar
limitations before deciding the follow-up data scope. Product acceptance remains with the user.

## Verification and bounded review

Runtime and guidance froze at the observed 2026-11-05T04:30:12Z boundary; the later accepted
addendum changes derived evidence only. Validation is complete. Earlier successful receipts
are not a claim about later edits. Evidence applies to the uncommitted working tree
over the base above, not to a new commit SHA or current-head GitHub CI.

Review scope is the union of this stream's changed files, including new files. Four batches:
Shared primitives/tokens and Hub; Garden settings/feed and metric consumers; Profile/Members;
jar/locales/guidance. All touched lines were inspected and the selected validation closed.
Safety facts: existing-access filtering gates both list and direct selection without changing
the request protocol; layout changes preserve the editor's draft, pending-send and retry owners.

Closed during review: matching Hub skeleton dimensions; app subtitle defaults isolated from
cockpit density; seconds-to-milliseconds fixture timestamps; garden-scoped payout wording;
reserved message lines and frozen source-length ceilings; existing role changes returning the
access view to Choose. Remaining requirement gap: the DL-145 data contract above.

The independent root review covered all 56 non-handoff paths in two batches (31 foundations
and 25 routes), found no actionable demonstrated defect, and returned COMMENT_ONLY. The
four-file derived addendum below is a separate review group. Root's broader proof still owns
its own final verdict; no readiness or PR approval is inferred here.

Exact final selected gate (from the repository root, explicit base because the shared remote
tracking ref advanced in another checkout):

```sh
VITEST_MAX_WORKERS=2 node scripts/dev/ci-local.js --intent qa --base 652825db9ebe88458dfbf7e6246147190e93fdac \
  --test-path shared:src/hooks/admin-ui/layout/useStewardAccessRequestController.test.tsx \
  --test-path shared:src/__tests__/hooks/garden/useGardenDerivedState.test.ts \
  --test-path admin:src/views/Garden/components/OverviewTab.test.tsx \
  --test-path admin:src/views/Community/components/CommunityMembersTab.test.tsx \
  --test-path admin:src/components/Garden/GardenSettingsEditor.test.tsx \
  --test-path admin:src/views/Garden/components/EditGardenDialog.test.tsx \
  --test-path admin:src/__tests__/components/HubWorkbenchGridCss.test.ts \
  --test-path admin:src/__tests__/components/CookieJarPayoutPanel.test.tsx \
  --test-path admin:src/__tests__/components/CookieJarPayoutModals.test.tsx
```

Plan: `tmp/prd-1375-pinned-plan.json`. Result: `tmp/prd-1375-pinned-validation.log`.
The selector retains every critical owner/consumer source and test typecheck. No receipt reuse
is claimed: critical QA runs each selected check fresh. No browser attestation is required for
this intent. Publication, approval and current-head GitHub CI were not requested.
Observed result: **16 fresh passes, 0 reused, 0 unrun**. Shared: 2 files/18 tests; Admin:
7 files/104 tests. All mandatory Shared/Client/Admin/Agent source and test typechecks passed.
Admin build passed (194.684s), Storybook build passed (120.922s): 478 components, 2771 stories,
46 groups. Earlier cancelled builds remain cancelled; this successful log is separate.

Current targeted Storybook command:

```sh
VITEST_MAX_WORKERS=2 bun run --cwd packages/shared ../../scripts/dev/node-cli.js vitest run \
  --config vitest.storybook.config.ts --project storybook \
  ../admin/src/components/Layout/AccountProfilePanel.stories.tsx \
  ../admin/src/components/Layout/StewardAccessRequest.stories.tsx \
  ../admin/src/views/Garden/components/OverviewTab.stories.tsx
```

Result: `tmp/prd-1375-frozen-stories.log`. A broad `bun run --cwd packages/shared test:stories:ci`
run passed 754 tests before the extra existing-access story. The subsequent broad run had
754 passing and one new story visibility assertion failure; that assertion now waits for the
dialog animation. Its access-request file passed all three tests on a focused rerun. The final
three-file run above also covers the latest Profile and activity fixture changes.
Observed final three-file result: **3 files, 5 tests passed**.

### Derived-evidence closure

The root's first broader review run failed test-quality on four stale registry fingerprints,
and docs-authority/docs-generated on three stale projections. These failures were retained,
not treated as passing evidence. The root then explicitly assigned this bounded refresh.

Before refreshing, all four existing public export targets were compared with the frozen
base. For each registered seam, every implementation, composition root, consumer and proof
input was byte-identical to the base. Across the seams' 6, 9, 6 and 7 inputs, the only changed
input was `packages/shared/package.json`, which adds the two leaf exports. Evidence:
`tmp/prd-1375-seam-refresh-evidence.json`.

The existing printer, `node scripts/quality/check-direct-tested-seams.mjs --print-fingerprints`,
produced the four new values. A structural comparison confirmed that every other registry
field was preserved. `node scripts/docs/generate.mjs` regenerated all 17 projections; exactly
the three expected MDX files changed. Their complete diff was inspected.

The failed guards were rerun with:

```sh
node scripts/dev/ci-local.js --intent review --base 652825db9ebe88458dfbf7e6246147190e93fdac \
  --only test-quality --only docs-authority --only docs-generated
```

Result: **3 fresh passes, 0 reused, 0 unrun**, in `tmp/prd-1375-derived-guards.log`.
The final 61-path selection is `tmp/prd-1375-final-union-plan.json`. Its verification command
uses the exact nine test paths above with `--intent push --base 652825db9ebe88458dfbf7e6246147190e93fdac
--reuse-passing-receipts`; this is a check invocation, not a Git push. It retains the critical
override and runs the full selected 23-check union, including validation-system, test-quality,
docs, ontology and React guards. Result: `tmp/prd-1375-final-union-validation.log`.
Observed final result: **23 fresh passes, 0 reused, 0 unrun** at the explicit frozen base.
This includes 432 validation-system tests and another passing run of Shared's 18 and Admin's
104 focused tests. Receipt reuse was allowed but none was used. The four-file derived addendum
remains available for the root's independent review; no runtime or guidance changed with it.

Additional observed proof:

| Command | Result |
|---|---|
| `VITEST_MAX_WORKERS=2 bun run --cwd packages/admin test src/__tests__/components/CookieJarPayoutPanel.test.tsx src/__tests__/components/CookieJarPayoutModals.test.tsx` | 2 files, 43 tests passed. |
| `node scripts/quality/check-source-structure.js` | Passed: 29 changed non-test files; 6 existing violations within the shrinking baseline; frozen size ceilings retained. |
| `bash scripts/design/check-tokens.sh` | Passed all token, type, wrapper, focus, modality and safe-area sweeps. |
| `./node_modules/.bin/design.md lint --format json packages/admin/DESIGN.md` | 0 errors, 0 warnings. |
| `node scripts/design/md-generate.mjs --check` | Passed; generated projections unchanged. |
| `bash scripts/design/check-vocab.sh` | Passed all three catalogs. |
| `node scripts/design/check-em-dashes.mjs` | Passed. |
| `node scripts/design/check-brand-voice-parity.mjs` | Passed. |
| `node scripts/quality/check-codex-docs.js` | Passed. |
| `node scripts/quality/check-skill-behavior-contracts.mjs` | Passed, 15 scenarios and 15 task routes. |
| `node scripts/quality/check-guidance-links.mjs` | Passed, 97 guidance files; unrelated older locked-decision warnings remain. |
| `git diff --check` | Passed. |

Catalog key comparison confirms EN/ES/PT parity for all 17 changed keys. DL-134, DL-140 and
DL-145 rows compare byte-for-byte with the base. The frozen file list and binary patch are
exported after this record closes; their SHA-256 is kept alongside the patch, outside its own
contents, to avoid a self-referential fingerprint.

Task record: PRD-1375 | Type: feature | Outcome: partial (six slices complete; DL-145 data separately scoped)
Agent/model: Codex / unknown | Coverage: this isolated implementation stream

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| investigate | unknown → 2026-11-05T03:00:28Z | Live issue, linked PRs, DL-134–145, guides and sync gate read |
| implement | 2026-11-05T03:00:28Z → 2026-11-05T04:30:12Z | Six slices and bounded jar audit; StatTile and pair first; implementation frozen |
| verify | unknown → 2026-11-05T04:44:58Z | 16-check fresh QA, 23-check final-union proof, focused Storybook and labeled rendered evidence |
| review | unknown → 2026-11-05T04:30:12Z | Author's four batches and safety facts; independent review remains with the root stream |
| implement | unknown → 2026-11-05T04:43:19Z | Root-authorized derived-only registry/docs addendum; runtime/guidance remained frozen |

Human corrections: 0; attention: unknown.
