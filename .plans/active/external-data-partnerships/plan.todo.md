# External Data Partnerships Plan

**Feature Slug**: `external-data-partnerships`
**Epic**: [#465](https://github.com/greenpill-dev-guild/green-goods/issues/465)
**Outcome Milestone**: [Outcome: 2 external data partners indexed](https://github.com/greenpill-dev-guild/green-goods/milestone/15) (#15)
**Spec**: [docs/superpowers/specs/2026-04-17-external-data-partnerships-design.md](../../../docs/superpowers/specs/2026-04-17-external-data-partnerships-design.md)
**Status**: `ACTIVE`
**Created**: `2026-04-17`
**Last Updated**: `2026-04-17` (initial plan)
**Hard Deadline**: 2 partners × ≥1 attestation/week in pilot garden by **2026-06-30**
**Branch Strategy**: `feature/external-data-partnerships` with phase commits for independent rollback

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

## Blockers (Pending Discovery)

These must resolve before Phase 2+ can complete. Track status here and update as each unblocks.

| # | Blocker | Owner | Target | Status |
|---|---|---|---|---|
| B1 | **locale.network API shape** — need API docs / contact to scope adapter | afo | 2026-04-30 | ⬜ Open |
| B2 | **Sylvie API credentials** — creds + rate limits for `verifySubmission` and `pollGarden` | afo | 2026-04-30 | ⬜ Open |
| B3 | **EAS schema registration** — register `ExternalVerification` + `GardenVerification` on Arbitrum; record UIDs in deployment artifact | afo | 2026-05-05 | ⬜ Open |

B1 blocks Phase 3. B2 blocks Phase 2. B3 blocks Phase 5 (writer cannot attest without schema UIDs).

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Role C — automated verification gate | Operator sees evidence badge but remains final approver. Partners = signal, not automation. |
| 2 | Ingestion B — we pull from partner APIs (both event-driven + periodic) | Event flow catches on-submission signals; periodic cron catches data arriving after submission (satellite passes, batch jobs). |
| 3 | Q2 partners: Sylvie + locale.network (option Y — two partners) | Meets outcome milestone of "2 external data partners indexed." |
| 4 | Green Goods holds trusted attester address | Single attester key simpler than partner-as-attester; we validate partner response before writing EAS attestation. |
| 5 | EAS attestations NOT re-indexed (per CLAUDE.md indexer boundary) | Query EAS directly at render time via `useWorkAttestations` hook; indexer stays within its boundary. |
| 6 | Pluggable `PartnerAdapter` interface — one file per partner | New partners = new file + registration; no core changes. Scales beyond Q2. |
| 7 | Raw partner data to IPFS, CID embedded in attestation | Attestation stays compact (~200 bytes); full response verifiable off-chain via CID. |
| 8 | Periodic cron per-garden (not per-submission) | Reduces partner API load; satellites + batch partners naturally align to garden geography. |
| 9 | Confidence bands: green ≥70%, yellow 40–69%, red <40%, gray no-attestation | Simple scannable UX; thresholds tunable via `modules/partners.ts`. |
| 10 | Retry strategy: IPFS 3× exp backoff; EAS write → manual retry queue in admin health panel | Balances resilience vs. noisy retry loops burning gas. |

## Requirements Coverage

| Spec Requirement | Planned Phase · Task | Status |
|---|---|---|
| Partner outreach (Sylvie + locale creds) | 0.1 | ⬜ |
| `ExternalVerification` EAS schema on Arbitrum | 1.1 | ⬜ |
| `GardenVerification` EAS schema on Arbitrum | 1.2 | ⬜ |
| Schema UIDs recorded in deployment artifact | 1.3 | ⬜ |
| `PartnerAdapter` interface (`_adapter.ts`) | 2.1 | ⬜ |
| Sylvie adapter (`sylvie.ts`) | 2.2 | ⬜ |
| locale.network adapter (`locale.ts`) | 3.1 | ⬜ |
| On-submission webhook (`/api/verification/work/:id`) | 4.1 | ⬜ |
| Periodic cron orchestrator (`partnerPoller.ts`) | 4.2 | ⬜ |
| IPFS raw-data uploader | 5.1 | ⬜ |
| `attestationWriter.ts` (EAS writer service) | 5.2 | ⬜ |
| Retry queue + admin health alert | 5.3 | ⬜ |
| `VerificationBadges` component + detail modal | 6.1 | ⬜ |
| Badge color bands (green/yellow/red/gray) | 6.2 | ⬜ |
| Shared hook `useWorkAttestations(submissionId)` | 7.1 | ⬜ |
| `modules/partners.ts` display metadata | 7.2 | ⬜ |
| E2E: pilot garden × 2 partners × ≥1 attestation/week | 7.3 | ⬜ |

## CLAUDE.md Compliance

- ✅ All React hooks in `@green-goods/shared` — `useWorkAttestations` lives in `packages/shared/src/hooks/`, never in admin
- ✅ Barrel imports only (`import { useWorkAttestations } from "@green-goods/shared"`)
- ✅ Indexer boundary respected — no EAS re-indexing; attestations queried directly from EAS
- ✅ `bun run test` (never `bun test`) for agent + admin + shared packages
- ✅ Logger from `@green-goods/shared` (no `console.log` in adapters, poller, writer)
- ✅ Error handling: `createMutationErrorHandler()` for shared mutations; adapters return null on partner failure (no swallow — log via shared `logger`)
- ✅ `Address` type (not `string`) for attester + garden addresses
- ✅ Query keys via `queryKeys.*` helpers; serialize objects
- ✅ Deployment artifact (`deployments/{chainId}-latest.json`) source of truth for EAS schema UIDs + attester address
- ✅ Intent Priorities: Offline correctness #1 — admin UI degrades gracefully when EAS query fails (gray badges, not error state)
- ✅ Single `.env` at root — partner creds read from root `.env` via `VITE_` or agent-side vars per `.env.schema`

## Phase 0 — Partner Outreach + Credentials (2026-04-20 → 2026-04-30)

### 0.1 Outreach

- [ ] Email Sylvie team — request API creds, rate limits, sample response shapes for relevant claims
- [ ] Contact locale.network — request API docs, auth model, pricing/rate info
- [ ] Create shared doc tracking status of both conversations (link from B1/B2)
- [ ] Update Blockers table once creds/docs arrive
- [ ] Commit: `docs(claude): track external partner outreach state`

### 0.2 Branch + scaffolding

- [ ] Create branch `feature/external-data-partnerships` from `develop`
- [ ] Create empty `packages/agent/src/partners/` and `packages/agent/src/services/` dirs
- [ ] Add `.env.schema` entries for partner creds (Sylvie + locale) without values
- [ ] Commit: `chore(agent): scaffold partners module + env schema`

## Phase 1 — EAS Schema Registration (2026-05-01 → 2026-05-05)

### 1.1 `ExternalVerification` schema

**Files:**
- Create: `packages/contracts/script/register-eas-schemas.ts`

- [ ] Define schema string per spec: `bytes32 submissionId, string partner, string claim, uint16 confidence, string rawDataUri, uint40 observedAt`
- [ ] Resolver: zero address (no custom resolver for Q2)
- [ ] Revocable: true
- [ ] Dry-run on Sepolia first; verify UID
- [ ] Commit: `feat(contracts): register ExternalVerification EAS schema`

### 1.2 `GardenVerification` schema

- [ ] Define schema string: `address garden, string partner, string claim, uint16 confidence, string rawDataUri, uint40 observedAt`
- [ ] Register on Sepolia → Arbitrum
- [ ] Commit: `feat(contracts): register GardenVerification EAS schema`

### 1.3 Record schema UIDs

**Files:**
- Modify: `packages/contracts/deployments/42161-latest.json`
- Modify: `packages/contracts/deployments/11155111-latest.json`

- [ ] Add `eas.schemas.externalVerification` UID
- [ ] Add `eas.schemas.gardenVerification` UID
- [ ] Add `eas.trustedAttester` address (Green Goods attester key)
- [ ] Commit: `chore(contracts): record EAS schema UIDs + attester in deployment artifact`

## Phase 2 — PartnerAdapter Interface + Sylvie Adapter (2026-05-05 → 2026-05-15)

### 2.1 `_adapter.ts` interface

**Files:**
- Create: `packages/agent/src/partners/_adapter.ts`
- Create: `packages/agent/src/partners/__tests__/_adapter.test.ts`

- [ ] Define `PartnerAdapter` interface per spec (`name`, `displayName`, `verifySubmission`, `pollGarden`)
- [ ] Define `VerificationResult` + `GardenVerificationResult` types
- [ ] Export a `registerAdapter()` helper + in-memory registry
- [ ] Type test: adapter must implement all fields (tsc strict)
- [ ] Commit: `feat(agent): add PartnerAdapter interface + registry`

### 2.2 Sylvie adapter

**Files:**
- Create: `packages/agent/src/partners/sylvie.ts`
- Create: `packages/agent/src/partners/__tests__/sylvie.test.ts`

- [ ] `verifySubmission` → fetch Sylvie endpoint for work GPS + metadata, normalize to `VerificationResult`
- [ ] `pollGarden` → fetch per-garden feed since timestamp, normalize array
- [ ] Auth via bearer token from env; fail gracefully (return null) on network/auth error
- [ ] Logger used for errors (not `console.log`)
- [ ] Unit tests with mocked Sylvie API (fetch stub) — success, 4xx, 5xx, malformed
- [ ] Register adapter in an `index.ts` barrel
- [ ] Run: `cd packages/agent && bun run test`
- [ ] Commit: `feat(agent): add Sylvie partner adapter`

## Phase 3 — locale.network Adapter (2026-05-15 → 2026-06-01)

**Depends on:** B1 (locale API docs). If still open at 2026-05-15, escalate.

### 3.1 locale adapter

**Files:**
- Create: `packages/agent/src/partners/locale.ts`
- Create: `packages/agent/src/partners/__tests__/locale.test.ts`

- [ ] Implement `PartnerAdapter` with locale-specific auth + response shape
- [ ] Map locale claim vocabulary → normalized `claim` strings (document mapping)
- [ ] `pollGarden` implementation (if locale supports garden-level queries — else return [] with warning log)
- [ ] Unit tests with mocked locale API
- [ ] Register in partners barrel
- [ ] Run: `cd packages/agent && bun run test`
- [ ] Commit: `feat(agent): add locale.network partner adapter`

## Phase 4 — Pull Orchestration (2026-05-15 → 2026-06-05)

### 4.1 On-submission webhook

**Files:**
- Create: `packages/agent/src/api/verification.ts`
- Create: `packages/agent/src/api/__tests__/verification.test.ts`

- [ ] Route: `POST /api/verification/work/:id` — accepts submission payload
- [ ] Iterates all registered adapters via `verifySubmission`
- [ ] For each non-null result → enqueue IPFS + EAS write (Phase 5 services)
- [ ] Returns 202 accepted; attestations land async
- [ ] Auth: HMAC-signed by client/admin (shared secret in `.env`)
- [ ] Integration test: mock adapters, assert writer called N times
- [ ] Commit: `feat(agent): add /api/verification/work/:id webhook`

### 4.2 Periodic cron orchestrator

**Files:**
- Create: `packages/agent/src/services/partnerPoller.ts`
- Create: `packages/agent/src/services/__tests__/partnerPoller.test.ts`

- [ ] Iterate gardens × adapters; call `pollGarden(garden, lastPolledAt)`
- [ ] Persist `lastPolledAt` per (garden, partner) tuple
- [ ] For submission-linked results → delegate to webhook path; for garden-level → use `GardenVerification` schema
- [ ] Cron registration (hourly default; partner-specific override via env)
- [ ] Unit tests with mocked adapters + clock
- [ ] Commit: `feat(agent): add periodic partnerPoller service`

## Phase 5 — IPFS + EAS Writer Services (2026-05-20 → 2026-06-10)

### 5.1 IPFS uploader

**Files:**
- Create: `packages/agent/src/services/ipfsUploader.ts`
- Create: `packages/agent/src/services/__tests__/ipfsUploader.test.ts`

- [ ] Upload raw partner response JSON; return CID
- [ ] Retry 3× with exponential backoff on failure
- [ ] On final failure: log + bubble error (caller decides to skip attestation)
- [ ] Unit tests with mocked IPFS client
- [ ] Commit: `feat(agent): add IPFS uploader with retry`

### 5.2 `attestationWriter.ts`

**Files:**
- Create: `packages/agent/src/services/attestationWriter.ts`
- Create: `packages/agent/src/services/__tests__/attestationWriter.test.ts`

- [ ] Read schema UIDs + attester key from deployment artifact + env
- [ ] Build EAS attestation payload from `VerificationResult` + IPFS CID
- [ ] Submit via ethers/viem to Arbitrum EAS contract
- [ ] Support both `ExternalVerification` (submission-linked) and `GardenVerification` (garden-level)
- [ ] Emit structured log on success (attestation UID, partner, claim, confidence)
- [ ] Unit tests with mocked EAS client
- [ ] Commit: `feat(agent): add EAS attestation writer`

### 5.3 Retry queue + health alert

**Files:**
- Create: `packages/agent/src/services/attestationRetryQueue.ts`
- Modify: `packages/admin/src/views/Health/*` (add failed-attestation panel)

- [ ] Persist failed writes (IPFS success but EAS write fail) to a queue table
- [ ] Expose `GET /api/verification/retry-queue` for admin health panel
- [ ] Expose `POST /api/verification/retry/:id` for manual retry
- [ ] Admin health view surfaces count + list
- [ ] Commit: `feat(agent,admin): add attestation retry queue + health surface`

## Phase 6 — Admin UI — Verification Badges (2026-06-01 → 2026-06-15)

### 6.1 `VerificationBadges` component

**Files:**
- Create: `packages/admin/src/components/WorkReview/VerificationBadges.tsx`
- Create: `packages/admin/src/components/WorkReview/AttestationDetailModal.tsx`
- Create: `packages/admin/src/components/WorkReview/__tests__/VerificationBadges.test.tsx`

- [ ] Consume `useWorkAttestations(submissionId)` from shared
- [ ] Render one badge per attestation (partner logo, claim, confidence, timestamp)
- [ ] Gray placeholder badge for partners with no attestation yet
- [ ] Click badge → open `AttestationDetailModal` (partner, claim, confidence, timestamp, IPFS raw link)
- [ ] i18n'd per `.claude/skills/ui/i18n.md`
- [ ] Component tests with mocked hook
- [ ] Commit: `feat(admin): add VerificationBadges + AttestationDetailModal`

### 6.2 Badge color bands + integration

**Files:**
- Modify: `packages/admin/src/views/Garden/WorkTab.tsx` (or work review surface)

- [ ] Apply color band logic: green ≥70%, yellow 40–69%, red <40%, gray no-attestation
- [ ] Band thresholds sourced from `modules/partners.ts` (shared), not hardcoded
- [ ] Mount `VerificationBadges` in work review row/detail
- [ ] Visual test via Storybook stories for each band
- [ ] Commit: `feat(admin): wire VerificationBadges into work review`

## Phase 7 — Shared Hook + E2E (2026-06-10 → 2026-06-30)

### 7.1 `useWorkAttestations` hook

**Files:**
- Create: `packages/shared/src/hooks/useWorkAttestations.ts`
- Create: `packages/shared/src/hooks/__tests__/useWorkAttestations.test.ts`
- Modify: `packages/shared/src/index.ts` (barrel)

- [ ] TanStack Query hook: `useWorkAttestations(submissionId)`
- [ ] Query EAS GraphQL endpoint directly (no indexer) filtered by `submissionId` + schema UID
- [ ] Use `queryKeys.attestations(submissionId)` helper
- [ ] Return `{ attestations, isLoading, error }` — graceful fallback on network error (empty array + logged)
- [ ] Unit tests with mocked GraphQL client
- [ ] Export from barrel
- [ ] Commit: `feat(shared): add useWorkAttestations hook`

### 7.2 `modules/partners.ts` metadata

**Files:**
- Create: `packages/shared/src/modules/partners.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] Export partner display metadata (name, displayName, logo path, color, description)
- [ ] Export band thresholds (green/yellow/red) as a single source of truth
- [ ] Export claim-vocabulary reference per partner
- [ ] Commit: `feat(shared): add partners module with metadata`

### 7.3 E2E in pilot garden

- [ ] Pick 1 Season One pilot garden (coordinate with operator)
- [ ] Configure env with real Sylvie + locale creds
- [ ] Manually submit 5 work entries; verify attestations land within 1 hour for event flow
- [ ] Let cron run 24h; verify garden-level attestations land
- [ ] Measure: 2 partners × ≥1 attestation/week sustained across 2 weeks
- [ ] Commit: `docs(claude): record external-partnerships E2E pilot results`
- [ ] Close Outcome milestone #15 when measurement holds

## Dependencies / Blockers

- **B1 locale.network API docs** — blocks Phase 3 (adapter)
- **B2 Sylvie API credentials** — blocks Phase 2.2 full integration test (can scaffold with mocks)
- **B3 EAS schema UIDs on Arbitrum** — blocks Phase 5.2 (writer needs UIDs)
- **IPFS pinning service** — confirm Pinata/Web3.Storage creds already in root `.env` (used elsewhere)
- **Arbitrum attester key** — generate + fund with ETH for gas (~$4/month at 100 attestations/week)

## Risks (carry from spec)

1. **Partner API access delays** — start outreach 2026-04-20; escalate if no creds by 2026-05-10
2. **Data quality variance** — confidence bands make noise visible without blocking; tune thresholds if needed
3. **EAS write cost** — ~$0.01/attestation × 100/week = $4/month; acceptable, monitored via attester balance alert
4. **locale.network scope unknown** — adapter estimate is placeholder until B1 resolved; may slip Phase 3 timeline
