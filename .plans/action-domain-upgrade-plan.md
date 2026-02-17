# Action Domain Upgrade v1 — Remaining Work

**Branch**: `feature/action-domains`
**Status**: Contracts + types + config DONE. Client/Admin UI remaining.
**Created**: 2026-02-13 | **Trimmed**: 2026-02-16

> Full decision log (58 decisions), contract specs, and type definitions were implemented and committed.
> See commits: `1eadb764`, `7707ea80`, `d2fa7d57`, `2111f6d5`.

---

## Remaining: Phase 3 — Client UI (Domain Tabs + Audio + Dynamic Form)

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Rebuild `Intro.tsx` — domain tabs (Radix Tabs) above Embla carousels; domain → action → garden flow | `client/views/Garden/Intro.tsx` | TODO |
| 3.2 | Domain tab logic: single `useMemo` (Rule 9) computes union of gardens' domains + filtered actions/gardens; auto-hide tabs if 1 domain | `Intro.tsx` | TODO |
| 3.3 | Wire `selectedDomain` through `WorkSelectionContext` | `providers/Work.tsx`, `Intro.tsx` | TODO |
| 3.4 | Integrate `AudioRecorder` + `AudioPlayer` into `Media.tsx` | `client/views/Garden/Media.tsx` | TODO |
| 3.5 | Audio preview/playback + delete with blob cleanup | `Media.tsx` | TODO |
| 3.6 | Remove hardcoded `plantSelection`/`plantCount` from `Details.tsx`; rely on `action.inputs` (WorkInput[]) | `client/views/Garden/Details.tsx` | TODO |
| 3.7 | Update `Review.tsx` — remove plant-specific FormCard entries; show generic details + audio | `client/views/Garden/Review.tsx` | TODO |
| 3.8 | Basic video capture in `Media.tsx` — max 30s, mutually exclusive with multi-photo | `client/views/Garden/Media.tsx` | TODO |
| 3.9 | "Share location" toggle in `Details.tsx` — Geolocation API, coarse accuracy | `client/views/Garden/Details.tsx` | TODO |
| 3.10 | Client approval flow — `ConfidenceSelector` in approve/reject drawer; hardcode `HUMAN` method; confidence required for approval (min LOW) | `client/views/Home/Garden/Work.tsx` | TODO |
| 3.11 | Extend `WorkApprovalDraft` in offline job queue payload for confidence | `modules/job-queue/` | TODO |

**Validation**: `bun format && bun lint && bun --filter client run test && bun --filter client build`

---

## Remaining: Phase 4 — Admin Work Review Page + Confidence UI

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4.1 | Update `config/schemas.json` with extended WorkApproval schema | `config/schemas.json` | TODO |
| 4.2 | Update `WorkApprovalResolver.sol` for new fields (confidence ≤3, method ≤15, confidence≥LOW when approved) | `contracts/src/resolvers/WorkApproval.sol` | TODO |
| 4.3 | Register `/gardens/:id/work/:workId` route; create `WorkDetail.tsx` — 2-column responsive grid | `admin/src/router.tsx`, `admin/src/views/Gardens/Garden/WorkDetail.tsx` | TODO |
| 4.4 | Media evidence section — photo grid + `AudioPlayer` for gardener audio | `admin/src/components/Work/MediaEvidence.tsx` | TODO |
| 4.5 | `ConfidenceSelector` integration — `aria-required` when approved, default NONE when rejecting | `WorkDetail.tsx` | TODO |
| 4.6 | `MethodSelector` integration — 4 chips, domain context pre-selects likely methods | `WorkDetail.tsx` | TODO |
| 4.7 | `AudioRecorder` for operator review notes | `WorkDetail.tsx` | TODO |
| 4.8 | Review notes IPFS upload chain (audio → JSON → CID) with loading + error recovery | `utils/eas/encoders.ts` | TODO |
| 4.9 | Wire approval form: RHF + Zod → `useWorkApproval()` → single EAS tx | `WorkDetail.tsx` | TODO |
| 4.10 | Indexer: WorkApproval entity gains confidence + method + reviewNotesCID | `indexer/` | TODO |

---

## Remaining: Phase 5 — Assessment Expansion + Harvest Pipeline

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5.6 | Assessment creation wizard (admin) — 3-step: strategy kernel → domain + actions → SDG + harvest | `admin/views/Assessments/` | TODO |
| 5.7 | Strategy kernel step — diagnosis + SMART outcomes repeater + Cynefin phase radio | `admin/views/Assessments/` | TODO |
| 5.8 | Domain + action set step — domain selector + action multi-select filtered by domain | `admin/views/Assessments/` | TODO |
| 5.9 | SDG + harvest step — 17 SDG goal chips + reporting period date range | `admin/views/Assessments/` | TODO |
| 5.10 | Assessment IPFS JSON upload, CID in attestation metadata | `utils/eas/encoders.ts` | TODO |
| 5.11 | Hypercert mint wizard — assessment dropdown auto-filters works by period + domain + actions | `admin/views/Hypercerts/` | TODO |
| 5.12 | Metadata prefill from assessment (scope/outcome/stakeholder tags) | `admin/views/Hypercerts/` | TODO |
| 5.13 | "Ready to mint?" confirmation with verification summary | `admin/views/Hypercerts/` | TODO |
| 5.14 | Indexer: assessment entity gains strategy kernel + harvest intent fields | `indexer/` | TODO |

> Types (`GardenAssessment`, `CynefinPhase`, `SmartOutcome`, `AssessmentAttachment`) already exist in shared.

---

## Remaining: Phase 6 — Indexer + Deploy

| # | Task | Status |
|---|------|--------|
| 6.1 | Indexer schema: Domain enum, GardenDomains entity | TODO |
| 6.2 | Indexer config: new events | TODO |
| 6.3 | Event handlers: ActionRegistered (domain), GardenDomainsUpdated, WorkApproval extended fields | TODO |
| 6.4 | Deploy.ts updates | TODO |

---

## Key Design References (for remaining UI work)

**Domain tab UX**: Union of gardener's gardens' domains → tabs. Hidden if single domain. `selectedDomain` in `WorkSelectionContext`.

**Confidence selector**: 4-segment Radix ToggleGroup (None/Low/Medium/High). `aria-required` when approving. Disabled=NONE when rejecting.

**Method selector**: Radix ToggleGroup `type="multiple"`, chips: Human | IoT | Onchain | Agent. Bitmask value. At least 1 required for approvals.

**Work review page layout**: Desktop 2-column (evidence left, review form right sticky). Mobile single column stacked.

**Assessment property groups**: (1) Strategy Kernel, (2) Domain + Action Set, (3) Impact Alignment (SDG), (4) Harvest Intent.
