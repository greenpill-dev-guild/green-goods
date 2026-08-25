# Commitment pooling — experience-audit fix pass 1 — 2026-08-25

Build pass per `../prompt-qa-experience-fixes.md`, addressing the decided findings of
`qa-experience-audit-2026-08-25.md` (both halves + § 10 Wave 2 intake).

## 1. Dispatch record

- **Date:** 2026-08-25
- **Base:** `origin/develop@fc27a5b000fd8ab8674ac5a6dea159a0a602234b` — identical to the audit's
  target SHA, so every audit finding verified 2026-08-25 carries to base by construction; Phase 0
  additionally re-checked each anchor independently (below).
- **Local-checkout note:** `develop` is 1 ahead of origin with unpushed `29c935fb6`
  (another session's `docs(client,admin)` commit — `.plans/` report + evidence only, zero product
  code). Branches will be cut from `origin/develop` once develop is synced (flagged at scope lock).
- **Autonomy:** scope-locked (default). Phase 0 presented 2026-08-25; **awaiting Afo's go.**
  No product-code commits made.
- **Branches (planned):** `fix/pooling-experience-pass-1` (Groups A+B) and
  `feat/editorial-record-and-cycle` (Group C), both off `origin/develop`, PRs → `develop`,
  never stacked. Audit artifacts (report, `evidence/qa-experience-audit/**`, handoff block)
  get their own `docs(commitment-pooling)` commit first on the fixes branch, named paths.

## 2. Phase 0 verification (scope-lock table)

Verdicts: every Group A–C item **reproduces at base**; none found already-fixed. Line anchors
re-confirmed in the working tree (product code at base == `fc27a5b00`).

### Group A

| # | Item | Phase 0 verdict | Anchor evidence at base |
|---|---|---|---|
| 3 | Expire-now confirm dialog | reproduces — `acts.expire(...)` fired directly from the row | `PoolCommitmentsCard.tsx:290`. **Scope note: `AdminConfirmDialog` does not exist** — only reason-required `AdminReasonDialog`; the fix mints a lean confirm primitive (AdminDialog anatomy, no reason field) |
| 11 | SeedStepProof native checkbox | reproduces | `SeedStepProof.tsx:79` `type="checkbox"`, `:88` `accent-[rgb(var(--tone-action))]`; `AdminCheckbox.tsx` exists unused |
| 18 | AllocationEditor group error | reproduces (audit A7, same SHA) | group-level sum error unassociated; field-level links clean |
| 17 | Hub "Confirm" → "Confirm kept" | reproduces | `HubConfirmQueue.tsx:223` "Confirm" + `:235` "Confirm…" (menu variant renamed alongside) |
| 9 | Garden tab rail AT semantics | reproduces — plain buttons, no `aria-current`/selected | `StandardTabs.tsx:76-100`; light compliant path planned (aria-current + accessible group name) |
| 7 | es/pt at 320 clipping | reproduces (measurements JSON `localeOverflow`, same SHA) | composer Next glyph clip, cycle-select truncation, tab-label clips |
| 20 | Proof-composer back 32→40 | reproduces (audit C3) | `ProofComposer.tsx` shell header `onBack` (:57) |
| 2 | Name the asker pre-acceptance | reproduces + **unblocked**: read model has `creator` | `CommitmentPeople.tsx:31-47` renders only leadProvider/counterparty (both unset pre-acceptance); `types-core.ts:39` `creator?: Address`; demo fixtures set it (`demo-commitments.ts:30ff`); indexer `createdBy` selected + mapped (`data-core.ts:48,268`). Build confirms live population via the series join |
| 5 | Pool-list liveness scope | reproduces — direction-only chips | `GardenPool.tsx:20-23` `DIRECTION_FILTERS` (all/offers/requests); no liveness dimension |
| 8 | Evidence strip on detail | reproduces — sheet-only evidence | `GardenCommitment.tsx` (no EvidencePreview; passes `evidenceAttributions` at :229); `ConfirmSheet.tsx:23,83,236`; standalone `EvidencePreview.tsx` reusable |
| 13 | Done screen names the thing | reproduces | `en.json:1150,1153` "It is on its way" / body names nothing |
| 10 | Drawer pending banner register | reproduces | `en.json:1017` `app.commitments.pendingCreate` warning register; drawer `LiveTab.tsx` |
| 14 | Row stutter | reproduces | `CommitmentRow.tsx:68-74` direction meta; `en.json:955` `progress.proofOnly` "moves this forward" phase-blind; consumer `CommitmentProgress.tsx` |
| 19 | CycleRail same-day range | reproduces — unconditional start–end format | `CycleRail.tsx:47-52` |
| 21 | Browser-verification phrases | reproduces, **scope correction: 4 files fail, not 3** | checker `check-browser-verification-policy.mjs:7,76-87` requires 6 exact phrases in root `AGENTS.md` (passes), root `CLAUDE.md` (**fails**), `packages/{admin,client,shared}/AGENTS.md` (fail); insertion must dodge stale-pattern regexes `:90-113` |
| F1 | CommitmentDialogPanel story crash | reproduces | `CommitmentDialog/CommitmentDialogStates.tsx:41,97` `useNavigate` without Router in stories; fix = router decorator, check NotFound |
| F5 | Proof-count contradiction | reproduces (audit re-confirmed live) | detail count via `CommitmentProgress.tsx` vs sheet `useCommitmentEvidence(evidenceAttributions)` (`ConfirmSheet.tsx:83`); build decides which number is true |
| F10 | Composer review "1 hours" | reproduces | `ComposeReview.tsx` uses `n(intl, targetUnits, unitLabel)` raw; `formatCommitmentUnits` exists (`shared/src/i18n/commitmentUnits.ts`, rows adopted in `1e34e39e2`) |

### Group B

| # | Item | Phase 0 verdict | Anchor evidence at base |
|---|---|---|---|
| 24 | Hub stages: drop History, reorder Confirm·Work·Assess·Certify | reproduces; full usage map in § 3 | `hub.utils.ts:123-155` config (history `:150-154`), order today Work→Assess→Certify→Confirm→History |
| 25 | Retire Community ▸ Pools into Coordination | reproduces; map in § 4 | `Community/index.tsx:95-140` five tabs; **Coordination's count already reads `community.pools.length` (`:111`)** while Pools (`:130-133`) is countless |
| 26 | Command palette fixed-height top-anchor | reproduces (measured 362→158 px, y 219→321, same SHA) | `components/Layout/CommandPalette.tsx` + shared `useCommandPaletteController` |
| 23 | Route-header title role shrink | reproduces — spec-conformant title-lg | `PageHeader.tsx:108-115` + in-source comment pinning the spec; `packages/admin/DESIGN.md` typography table moves in the same commit |
| 27 | Availability-cast copy | reproduces | `en.json:4000` "Commitment pooling is not on this chain yet" (+ body `:3999`); family + `CommitmentDialogStates` unavailable cast; **no ledger flip** |
| 4 (admin) | AddressDisplay + worded relationship | reproduces (audit A6) | raw hex pairs + "→" in `PoolCommitmentsCard` rows and inspector facts; `AddressDisplay` shared, client-adopted already |
| 6 | 44 px effective targets | reproduces — 32 px visual | `AdminButton.tsx:81` sm = `h-8 px-3`; `AdminFilterChip.tsx:26,51` h-8 "32dp"; M3 expanded-touch-target pseudo-element, visual kept |
| 22 (rename) | "Over time" → history-reading label | reproduces | `en.json:1052` `app.commitments.tab.overTime` = "Over time"; propose **"History"**, en/es/pt, flagged in PR body |

### Group C

| # | Item | Phase 0 verdict | Anchor evidence at base |
|---|---|---|---|
| 28 | § 02 leaves the panel | reproduces | garden § 02 = `views/Public/GardenDetailCommitments.tsx` (13 story states ✓); band = `PublicCommitmentsBand.tsx` `EditorialPanel` `:195-221` (6 story states ✓); dark panel deviation retires; uiux-spec addendum |
| 29 | Cycle → four steps | reproduces | `PublicEvidencePipeline.tsx` five hardcoded stages (doc `:12-14`), loop-line inside flow (`:96`); AD-9 draft copy verbatim as start; fresh en/es/pt, no new "el pool" |
| 30 | Remove hover-zoom | reproduces, **scope correction: 6 sites, not 4** | the four named + `views/Public/GardenDetailNoteRecord.tsx:64` + `views/Public/GardenDetailFieldNotes.tsx:168` (Afo's decision said "across the editorial site" — all six proposed) |
| 31 | Empty/error sections hold space | reproduces (audit AD-11) | empty casts render one italic line under the header |

## 3. B24 — History usage map (presented at scope lock)

Remove/reorder touches, by layer:

- **Config/types (shared):** `hub.utils.ts` — `PIPELINE_STAGE_CONFIG:123-155` (drop history,
  reorder confirm-first), `HubPipelineStage:19`, `resolvePipelineStageFromPath:111`, fixed-action
  comment `:255`. `hub.workbenchModel.ts` — `HubStageContentKind:76`, selection kind
  `"history"` `:90,:123`, fallback `?? "history"` `:225` (becomes confirm-first), `toHistoryContentId:291`.
  `useHubWorkbenchController.ts:187` (history→"decisions" section), `:420` (sort carry).
- **Navigation (shared):** `admin-routes.ts` — `AdminHubMode` drops `"history"` (:13),
  `hubHistory`/`hubHistoryDetail` helpers; `workspaceNavigation.ts:53-58` history branches;
  `sheetRegistry.ts:81-88` `toHistoryContentId`/`parseHistoryContentId` + prefix + restorable rule.
- **Admin views:** `routes/views.tsx:131-142` (`/hub/history` + `/:historyEventId` routes),
  `views/Hub/index.tsx:116` (work|history sort branch), `HubSheetDescriptor.tsx:166`,
  `HubHistoryInspector` component + its 3 stories, `Hub.stories.tsx:39,150,156`,
  `Garden/SubmitWork.tsx:20` + `Garden/WorkDetail/index.tsx:29` view guards.
- **Tests:** `route-folding.test.ts:109,187`, `hub-confirm-route.test.tsx:36`,
  `sheet-registry.test.ts:34`, `hub.workbenchModel.test.ts` (several).
- **i18n:** `cockpit.hub.tab.history` (en:4071) + es/pt mirrors — 4-part gate on removal.
- **Leave alone (non-hub "history" matches):** `AdminTabRail.stories`/`AdminToneGallery.stories`
  demo data, `actions.utils.ts:113` (`getWorkbenchTone` returns a *tone* named "history"),
  `GardenYieldCard.stories`.
- **History-content landing (recommendation):** `/hub/history` and `/hub/history/:id`
  **redirect to `/hub`** (index resolves to the new first stage, Confirm). `HubHistoryInspector`
  and the history content-id plumbing retire with the stage. No inbound links found outside
  the route table (AdminNotificationPanel carries none).

## 4. B25 — Community ▸ Pools retirement map

- `Community/index.tsx:95-140` — remove the `pools` tab entry; pooling elements render inside
  Coordination; count reconciliation: Coordination already shows `community.pools.length`.
- `CommunityPools.tsx` — W12 content (Protocol pool / This garden, `useProtocolPool`) moves into
  the Coordination view. **Invariants kept verbatim:** exactly protocol pool + current garden,
  never another garden's pool; privacy sentence = `cockpit.community.pools.confirmationsHint`
  (en:3484 "…Only these rows reach the team; no other garden's pool is browsed here.").
- `admin-routes.ts:16` — `AdminCommunityMode` drops `"pools"`.
- i18n family `cockpit.community.pools.*` (en:3482-3491+) — moved/renamed deliberately, 4-part gate.
- Stories/tests naming the Pools tab (CommunityPools stories, Community routing tests) move together.

## 5. Outcome table

*(build pass fills: backlog # · outcome · commit SHA · proof path)* — pending Afo's go.

## 6. Group D proposals (propose only — never built this pass)

1. **The arrival surface (backlog 1, E1+E2).** One pooling notification family — *taken up ·
   confirmed kept · not-yet resolved* — in the existing client notification pattern
   (`views/Home/Garden/Notifications.tsx` today carries no commitment source), plus a first-view
   treatment of a freshly kept commitment in the ConfirmSheet's warm register. Needs a read-model
   join for "what moved for you". Cost **M**. The audit's single highest-leverage change.
2. **Per-commitment timeline on the client detail (backlog 22, timeline half).** Admin's inspector
   has one; the member gets band + provenance only. `getCommitmentActivity` exists but is
   unwrapped under fixtures. One timeline block on `GardenCommitment`. Cost **M**.
3. **Green Goods name resolution in `AddressDisplay` (backlog 4, names half).** Resolution today
   stops at ENS; pooling moments render hex. Add GG name/profile lookup inside `AddressDisplay`
   so client + admin both benefit. Coverage question (W2) is Afo's. Cost **M**.
4. **Backlog 12 / 15 / 16** (hero collapse feel · count-card grammar · casing side) — awaiting
   Wave 2 answers; skipped by design this pass.

## 7. Flagged calls

- **Backlog 21 file set:** root `CLAUDE.md` also fails the checker — the fix touches 4 files,
  not the dispatch's 3.
- **A3 (backlog 3):** requires minting `AdminConfirmDialog` (no confirm-without-reason primitive
  exists in admin).
- **C30 (backlog 30):** 6 hover-zoom sites, not 4 — proposing all six per "across the editorial
  site".
- **B24 landing:** history deep links redirect to `/hub` (confirm-first); inspector retires.
- **B22 label proposal:** "History" (over "Record").
- **Unpushed `29c935fb6`** on local develop (another session's docs): develop should be pushed
  before branching, else the first PR's diff temporarily includes it.

## 8. Gate results

*(build pass fills, per branch)* — pending.
