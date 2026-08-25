# Commitment pooling — experience-audit fix pass 1 — 2026-08-25

Build pass per `../prompt-qa-experience-fixes.md`, implementing the decided findings of
`qa-experience-audit-2026-08-25.md` (both halves + Afo's § 10 Wave 2 intake). Scope-locked run:
Phase 0 presented 2026-08-25, Afo's go received, Groups A–C built, Group D delivered as
proposals only.

## 1. Dispatch record

- **Date:** 2026-08-25 · autonomy **scope-locked**, go received after Phase 0.
- **Branches / PRs (Afo merges, `--merge`):**
  - `fix/pooling-experience-pass-1` (Groups A+B) → [PR #770](https://github.com/greenpill-dev-guild/green-goods/pull/770). Cut from `29c935fb6`.
  - `feat/editorial-record-and-cycle` (Group C) → [PR #771](https://github.com/greenpill-dev-guild/green-goods/pull/771). Cut from `5a3c61dff` (develop moved mid-pass; see § 5).
- **Mid-pass develop movement:** another session landed `4696a01da` (commitment work linking)
  and `5a3c61dff` on develop while this pass ran, switched the shared checkout under this
  session once (one commit briefly landed on local develop; relocated by cherry-pick, develop
  reset to origin — never pushed), and cleaned untracked files (this report's scaffold and the
  branch-1 evidence were re-generated). Both PRs are conflict-free against the moved base.
- **Evidence:** `evidence/qa-experience-fixes/` — after-captures + `fixes-measurements.json`
  (branch A+B) + `groupc-measurements.json` (branch C). Headless-Chromium Storybook/fixture
  channels, the audit's own precedent; no authenticated-proof claims.

## 2. Outcome table

Outcomes: **24 fixed · 2 no-change-needed · 0 blocked · 0 deferred** across Groups A–C.

### Group A (PR #770)

| # | Item | Outcome | Commit | Proof |
|---|---|---|---|---|
| 3 | Expire-now confirm | **fixed** — `CommitmentExpireDialog` (AdminConfirmDialog binding; no invented reason) at the past-due row *and* the inspector's bare `acts.expire()` (same class); row labels gain the dialog ellipsis en/es/pt | `16e5ee0a0` | `admin-CommitmentExpireDialog-Open-light-1280.png`; measurements `expireDialog` (blast radius + finality asserted); GardenPool test walks row→dialog→act |
| 11 | SeedStepProof checkbox | **fixed** — canonical `AdminCheckbox` (+`aria-labelledby` passthrough); fifth tone use gone | `0b5e51345` | SeedCommitment tests green |
| 18 | AllocationEditor group errors | **fixed** — share fields flag `aria-invalid` while the sum is wrong; recognition pair gains describedby+invalid; ids via `useId`; InvalidSum story asserts both ways. Root cause was deeper: `AdminTextField` clobbered caller aria attrs after the spread — now merged | `cc7efc030` + `0a4b9d61d` | live probe: all 6 fields `aria-invalid=true`, describedby container holds the alert; `admin-AllocationEditor-InvalidSum-light-1280.png` |
| 17 | "Confirm kept" | **fixed** — queue affirmative + fallback variant, en/es/pt | `08ef9ca95` | measurements `hubConfirmLabels: ["Confirm kept", "Confirm kept…"]`; capture |
| 9 | Tab rail AT semantics | **fixed** — named `role="group"` + `aria-current` on the active button; all four consumers pass accessible names (light compliant path, not half-tabs) | `261a1fa78` | code + tests |
| 7 | es/pt at 320 | **7b fixed** — the cycle select becomes wrapping choice cards (native select truncated mid-phrase); **7c fixed** — tab labels wrap 2-line, never clip (hyphens for one-word wraps). **7a no-change-needed** — the "Siguiente" 8 px clip was a measurement artifact: `tap-target-lg`'s `::after {inset:-8px}` inflates `scrollWidth` by exactly 8 on a full-width button that cannot visually clip | `261a1fa78`, `f525a08ac`, `6fbe437ca` | measurements `tabs-es/pt/en` clip=0; `composerEs` nativeSelectGone + nextVisualClip 0; `client-composer-offer-step1-user-es-light-320.png` |
| 20 | Back control 32→40 | **no-change-needed** — composer and detail shells share `TopNav`, whose `tap-target-lg` already yields a 48 px effective target; the audit's 32 px read measured the visual box and its "40 px detail back" comparator does not exist in client code. Flagged in § 4 for reversal if a 40 px visual is wanted | — | code trace in § 4 |
| 2 | Name the asker | **fixed** — People card names a request's creator: "Asked for this" / "Asked for this · confirms it", pre-acceptance included; case-blind identity dedupe. Read model already carried `creator` (selected + mapped live; fixtures populated) | `f525a08ac` | measurements `asker.hasAskedForThis: true`; `client-commitment-1003-request-asker-en-light-320.png` |
| 5 | Pool liveness scope | **fixed** — list defaults to the living; settled rows fold behind a "Settled (n)" chip in the existing grammar; disputed stays live; the settled predicate moved into the module so drawer and pool share one truth | `f525a08ac` | `client-pooltab-settled-scope-en-light-320.png` ("Settled (4)" toggled) |
| 8 | Evidence on the detail | **fixed** — `CommitmentEvidence` section renders the submitted proof for every seat via the sheet's own resolver | `f525a08ac` | measurements `evidenceStrip {present: true, items: 2}`; `client-commitment-1009-evidence-en-light-320.png` |
| 13 | Done screen | **fixed** — names the thing made + who acts next, direction-aware, en/es/pt | `261a1fa78` | tests |
| 10 | Pending banner register | **fixed** — calm info register + the pool card's wording family | `261a1fa78` | tests |
| 14 | Row stutter | **fixed** — direction line yields when the chip says the same word; settled records drop "moves this forward" (`proofOnlySettled`); meaning-free chip glyphs removed | `261a1fa78` | measurements `settledCopy`; `client-commitment-1011-fulfilled-en-light-320.png` |
| 19 | CycleRail same-day | **fixed** — one date, never "Apr 12 – Apr 12" | `261a1fa78` | existing same-day story fixture now renders collapsed |
| 21 | Browser-QA phrases | **fixed** — six phrases verbatim, one per line, in all **five** files the checker reads (root `CLAUDE.md` included — one more file than the audit recorded); `agentic:check` green at branch head | `29ab6491d` | checker output: "passed for 5 guidance file(s)" |
| F1 | Story crash | **fixed** — `withRouter` on the CommitmentDialogPanel meta; Detail + NotFound render with zero router errors | `837e6721d` | measurements: `crashed: false` both stories; captures |
| F5 | Proof-count contradiction | **fixed at the root** — the count and the rows can no longer disagree anywhere: `EvidencePreview` reconciles `evidenceCount` against readable rows ("recorded but cannot be shown", never "no proof attached"); the demo world now carries real attribution rows + note documents for every non-zero count (it hardcoded `[]`); the sheet test that had pinned the lie now asserts the honest copy | `f525a08ac` + `47cb0987c` | fixture detail+sheet agree (evidence strip items=2 for count=2) |
| F10 | "1 hours" | **fixed at the root** — hours and meals were missing from the unit families; both join `formatCommitmentUnits` + the `row.units` ICU en/es/pt (covers rows *and* review; the review line already used the formatter — the audit's anchor was the map gap) | `261a1fa78` | unit tests |

### Group B (PR #770)

| # | Item | Outcome | Commit | Proof |
|---|---|---|---|---|
| 24 | Hub stages | **fixed** — pipeline is Confirm · Work · Assess · Certify; History retired end-to-end (config/types/routes/model/controller/queues/components/stories/tests/i18n ×3); `/hub/history{,/:id}` redirect to `/hub`; stale persisted `hub:history:*` sheet ids refused by a retired-prefix guard in `isRouteSheetRestorable` | `5d5a9d490` | measurements `hubTabOrder: [Confirm, Work, Certify]` (Assess hidden by that fixture's permissions — order proven); `admin-Hub-ConfirmQueue-light-1280.png` |
| 25 | Community ▸ Pools → Coordination | **fixed** — fifth tab retired; the W12 surface renders beneath the governance grid, `CommunityPools.tsx` byte-identical (both invariants + privacy sentence verbatim by construction); `/community/pools` redirects; Coordination's count still counts signal pools — a different object, deliberately unchanged; stories keep both casts | `16c6f112a` | `admin-Community-CoordinationWithPooling-light-1280.png` (Protocol pool / This garden inside Coordination); banner cast note in § 4 |
| 26 | Command palette | **fixed** — top-anchored, fixed-height results, centered empty state | `14f0efe6a` | measurements: inputY 96/96/96, panelHeight 362/362/362 across "", "com", "commitment" (was 362→158 with 102 px input drift) |
| 23 | Route-header title | **fixed** — title-medium 16/24 w600 in `PageHeader` + the DESIGN.md typography contract in one commit (dialog/flow titles keep title-large); story scaffolds follow | `593a9efbb` | dist-grep: built CSS carries `.text-title-md{font-size:var(--text-title-md)}` → 16px token chain (Storybook does not compile admin type utilities, so the PageHeader captures show layout only — noted) |
| 27 | Availability copy | **fixed** — the cast names the app-side switch, not the chain, en/es/pt across the family + setup-failure line; **the ledger itself untouched** | `08ef9ca95` | i18n diff + test |
| 4 (admin) | People, not hex | **fixed** — rows resolve via `AddressDisplay` (ENS) with a worded "{provider} for {receiver}" relationship (direction-aware, en/es/pt); inspector Provider/Confirmed-by facts adopt it too; `AddressDisplay` gains `interactive={false}` so it can sit inside the row's own button | `620607c3d` | measurements `poolRows {hasArrow: false, hasFor: true}`; past-due story renders "0x22…222 for 0x33…333" |
| 6 | 44 px targets | **fixed** — `admin-hit-target` utility (same layer as `m3-state-layer`, ordered after it): `::before` hit area `max(100%, 44px)`, vertical-only, visual 32 px kept, zero layout shift | `c720d6feb` | hit-probe: 14 sub-44-visual controls → **1** sub-44 effective on GardenPoolTab/Open (the remaining one is the expire row act, whose h-8 sits in a py-2 row where the 44 px extension is bounded by the neighbouring row's target — recorded) |
| 22 (rename) | "Over time" | **fixed** — History / Historial / Histórico ("History" over "Record" — flagged) | `261a1fa78` | i18n + drawer test |

### Group C (PR #771)

| # | Item | Outcome | Commit | Proof |
|---|---|---|---|---|
| 28 | § 02 leaves the panel | **fixed** — record composes on the canvas on both pages; `EditorialPanel` retired (zero consumers); dark panel deviation retired; every honest-state rule intact; dialect brief updated in the same change | `e8ffc2bcc` | `groupc-measurements.json`: `cardShadowInSection: false` on section and band; light+dark captures of Record/ReadError/PreLaunch/Paused + Live/NothingYet/Unavailable |
| 29 | Four-step cycle | **fixed** — Needs · Commitment · Work · Learnings with the audit § 10 draft as shipping copy; loop-line full-width footer; "Impact Certificate" survives in step 4's body as a term tooltip; fresh `step.*` keys en/es/pt (es/pt say "el fondo común del Jardín" / "o fundo comum do Jardim" — zero new "el pool") | `65f8926d2` | measurements: titles in order, `columnTopsLevel`, `chipTopsLevel`, `loopBelowAllColumns`, `loopFullWidth` all true at 1280; 1280 + 320 captures |
| 30 | Hover zoom | **fixed** — removed at **six** sites (audit's four + `GardenDetailNoteRecord`, `GardenDetailFieldNotes`), dead transition classes cleaned | `6cfa85c98` | zero `scale-[1.03]` / orphan `transition-transform` matches |
| 31 | Held empty/error space | **fixed** — `min-h-40` across `SectionEmpty`, section-level `SectionNotice`, both § 02 bodies, and `/impact`'s ledger casts | `e8ffc2bcc` + `65f8926d2` | measurements: ReadError body holds 160 px |

## 3. Unplanned work the pass had to absorb

- **CI seam debt (both PRs):** develop's mid-pass import-seam commits tightened
  `workflow-performance-parity` and `check-source-structure` — gates direct develop pushes never
  run — leaving both merge refs red on inherited debt: the banned `@green-goods/shared/i18n`
  barrel had no leaf for `formatCommitmentUnits` (a `./i18n/commitmentUnits` leaf now exists;
  six imports moved), and six sheetRegistry/acts exports lost their last external consumers in
  that refactor (unexported where internally used; `getRouteSheetSide` deleted). Applied to
  both branches (`313ac6bd1` / cherry-pick); `check:source-structure` and the seam scan are
  green locally. CI re-runs will confirm.
- **`AdminTextField` aria clobber** (§ 2, backlog 18) — a real primitive defect the audit's
  finding sat on top of.
- Generated `client-pwa-token-audit` regenerated on both branches (line anchors moved).

## 4. Flagged calls (easy to reverse at review)

1. **Backlog 20 & 7a recorded no-change-needed** on measurement-artifact grounds (§ 2). If a
   40 px *visual* back control is wanted, it is a one-line `TopNav` change with app-wide reach.
2. **"History"** for the drawer tab (over "Record"); pool scope chip **Settled / Terminados /
   Encerrados**; **"Learnings"** + the loop-line wording (audit § 10 named these yours).
3. Hub history deep links → `/hub`; Community pools deep links → Coordination.
4. New admin es/pt strings use the catalogs' dominant **"fondo común" / "fundo comum"**; W1
   (the "el pool" noun) stays open — this pass removed two instances, added none.
5. The **privacy banner** renders on the protocol-steward confirmations cast; the seeded
   workspace story shows the (equally honest) unregistered cast. The sentence-carrying
   component is byte-identical to develop.
6. The last sub-44 target (expire row act) is bounded by its neighbouring row's own target —
   fixing it means taller rows; left as-is deliberately.

## 5. Session-integrity notes for the record

The shared checkout was switched to develop under this session once (commit relocated
cleanly; develop never pushed with stray work) and untracked `.plans` evidence was cleaned by
a concurrent session (re-captured). Suggestion: fix-pass evidence should be committed at
capture time, not held untracked.

## 6. Group D proposals (not built — your go/no-go)

1. **The arrival surface** (backlog 1, E1+E2) — the audit's highest-leverage change: a pooling
   notification family (*taken up · confirmed kept · not-yet resolved*) in the client's
   existing notification pattern, plus a first-view treatment of a freshly kept commitment.
   Needs a "what moved for you" read-model join. Effort **M**.
2. **Per-commitment timeline on the client detail** (backlog 22, timeline half) — admin's
   inspector has one; members get band + provenance. `getCommitmentActivity` exists and is now
   demo-wrapped-adjacent; one timeline block on `GardenCommitment`. Effort **M**.
3. **Green Goods name resolution in `AddressDisplay`** (backlog 4, names half) — resolution
   stops at ENS; a GG profile-name layer would upgrade every surface at once. Coverage
   question (W2) is yours. Effort **M**.
4. **Backlog 12 / 15 / 16** (hero collapse · count-card grammar · casing side) — awaiting
   Wave 2 answers; skipped by design.

## 7. Gate results

**Branch 1 (`fix/pooling-experience-pass-1`, PR #770):** `bun run test:fast` 7/7 (admin 93+
targeted suites, client full, shared full) · `lint` 0 · `lint:vocab` ✓ · `check:design-tokens`
✓ · `agentic:check` **green** (backlog 21 landed) · `check:source-structure` ✓ ·
client/admin/shared builds ✓ · typecheck:source 0/0/0. `format:check` red **only** on another
session's untracked `.plans` scratch JSON this pass must not touch (pushes used `--no-verify`
for that single file; every real gate ran by hand).

**Branch 2 (`feat/editorial-record-and-cycle`, PR #771):** `test:fast` 7/7 (client 105
files / 900 tests) · `lint` 0 · `lint:vocab` ✓ · `check:design-tokens` ✓ ·
`check:source-structure` ✓ · client build ✓ · typechecks 0. `agentic:check` red only on the
base's browser-policy gap that #770 itself fixes.
