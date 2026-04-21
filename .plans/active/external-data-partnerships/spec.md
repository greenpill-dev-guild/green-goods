---
title: External Data Partnerships — Design
epic: Epic — External Data Partnerships
outcome: 2+ external data partners indexed and surfacing in admin
quarter: Q2 2026
due: 2026-06-30
status: Draft
owner: afo
last_updated: 2026-04-17
---

# External Data Partnerships — Design

## Goal

Integrate **two external data partners** (Sylvie + locale.network) so partner-verified signals surface as EAS attestations tied to work submissions, acting as a verification gate that operators see before approving.

Outcome metric: 2 partner adapters live, each producing ≥1 attestation per week in one Season One pilot garden.

## Decisions (locked during brainstorm)

| # | Decision | Value |
|---|---|---|
| 1 | Role of partner data | Automated verification gate — operator sees evidence badge, still approves |
| 2 | Ingestion pattern | We pull from partner APIs — both on-submission and periodic |
| 3 | Q2 partners | Sylvie + locale.network |
| 4 | Attestation authority | Green Goods holds trusted attester address; creates attestation after validating partner response |
| 5 | Indexer boundary | EAS attestations NOT re-indexed (per CLAUDE.md); query EAS directly at render time |

## Architecture

```
┌─ packages/agent (or new packages/partners) ──────────────────────┐
│                                                                  │
│  partners/                                                       │
│    _adapter.ts         NEW · PartnerAdapter interface            │
│    sylvie.ts           NEW · Sylvie API client + normalizer      │
│    locale.ts           NEW · locale.network API client + norm.   │
│                                                                  │
│  services/                                                       │
│    partnerPoller.ts    NEW · periodic cron per-garden            │
│    attestationWriter.ts NEW · creates EAS attestations           │
│                                                                  │
│  api/                                                            │
│    verification.ts     NEW · on-submission trigger endpoint      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ Ethereum Attestation Service (existing) ───────────────────────┐
│  Schema: ExternalVerification                                    │
│    {                                                             │
│      submissionId: bytes32,                                      │
│      partner: string,          // "sylvie" | "locale"            │
│      claim: string,            // "vegetation_detected" etc.     │
│      confidence: uint16,       // 0-10000 bps                    │
│      rawDataUri: string,       // IPFS CID of full response      │
│      observedAt: uint40        // partner-reported timestamp     │
│    }                                                             │
│  Attester: Green Goods trusted attester address                  │
└──────────────────────────────────────────────────────────────────┘

┌─ packages/admin ─────────────────────────────────────────────────┐
│  components/WorkReview/VerificationBadges.tsx  NEW               │
│    · queries EAS for attestations on work submission             │
│    · renders partner badges (green/yellow/red)                   │
└──────────────────────────────────────────────────────────────────┘

┌─ packages/shared ────────────────────────────────────────────────┐
│  hooks/useWorkAttestations(submissionId)   NEW                   │
│  modules/partners.ts                       NEW · metadata        │
└──────────────────────────────────────────────────────────────────┘
```

## `PartnerAdapter` interface

```typescript
interface PartnerAdapter {
  name: 'sylvie' | 'locale';
  displayName: string;

  // On-submission pull — called when a work is submitted
  verifySubmission(submission: WorkSubmission): Promise<VerificationResult | null>;

  // Periodic pull — called per garden on schedule (e.g., daily)
  pollGarden(garden: Garden, sinceTimestamp: number): Promise<VerificationResult[]>;
}

interface VerificationResult {
  claim: string;                // partner-specific verb ("vegetation_cover", "biodiversity_signal")
  confidence: number;           // 0-10000 bps
  observedAt: number;           // UNIX seconds
  rawData: unknown;             // stored to IPFS, CID in attestation
}
```

Each partner implements this once. New partners = new file + registration. No core change.

## Ingestion cadence

**On-submission (event-driven):**
```
1. Gardener submits work → client/admin calls agent /api/verification/work/{id}
2. Agent iterates all registered adapters
3. Each adapter tries to verifySubmission(); returns VerificationResult or null
4. For each non-null result: agent writes IPFS blob + creates EAS attestation
5. Admin work-review fetches attestations from EAS when operator opens the submission
```

**Periodic (poll-driven):**
```
1. Cron runs hourly (or per-partner cadence)
2. For each garden × each partner: pollGarden(garden, lastPolledAt)
3. For each result linked to a specific submission: create attestation as above
4. For garden-level results (not per-submission): create GardenVerification attestation (separate schema)
```

Periodic is important when partner data arrives *after* submission (e.g., satellite pass happens next day; then we pull + attach).

## Trust Model

- **Green Goods holds the attester key** — we validate partner response signatures/auth before writing attestation.
- Attestation includes `partner` field → admin UI shows the logo/source.
- Partner's raw data lives on IPFS; attestation references via CID. Attestation is compact (~200 bytes); raw data is verifiable against CID.
- Operator remains the final approver. Attestations are **evidence**, not automation.

## Admin UI — Verification Badges

In work review page, each submission shows:

```
┌───────────────────────────────────────────┐
│  Submission #1234  ·  Tree planting       │
│  Gardener: 0xabc…    Garden: Urubamba     │
│                                           │
│  Partner verification:                    │
│   ✅ Sylvie        · vegetation_cover 87% │
│   ⚠  locale.net    · low confidence 42%   │
│                                           │
│  [Approve]  [Reject]  [View raw data ↗]  │
└───────────────────────────────────────────┘
```

Badge color bands:
- Green (≥70%)
- Yellow (40–69%)
- Red (<40%)
- Gray (no attestation yet)

Clicking a badge opens attestation detail (partner, claim, confidence, timestamp, IPFS link to raw data).

## Error Handling

- **Partner API down** — `verifySubmission()` returns null; no attestation created; no blocking of user flow.
- **Malformed partner response** — logged + surfaced as an admin health alert; no attestation.
- **IPFS upload failure** — retry 3× with exponential backoff; if still failing, attestation skipped.
- **EAS write failure** — retry; if still failing, queued for manual retry via admin health panel.

## Testing

| Layer | Scope |
|---|---|
| Unit (`bun run test` in agent) | Each adapter with mocked partner API |
| Integration | Full flow from inbound submission event → attestation on EAS (forked testnet) |
| Manual | Real API keys from Sylvie + locale, 1 submission cycle each |

## Out of Q2 Scope

- Partner-as-attester (partner holds their own EAS attester key) — Q3+
- AI synthesis across partners (combine signals) — Q3+
- Self-service partner onboarding (config-driven) — Q3+
- User-facing data ("your garden recorded 2.3 tCO2e this week") — Q3 when badging lands
- Garden-level pollers for partners that don't map to submissions — scoped in but may slip if Sylvie/locale don't offer that API

## Pending Discovery (blocks implementation plan)

1. **locale.network API shape** — need API docs / contact to scope the adapter
2. **Sylvie API credentials** — need creds + rate limits for `verifySubmission` and `pollGarden` endpoints
3. **EAS schema registration** — register `ExternalVerification` + `GardenVerification` schemas on Arbitrum; record UIDs in deployment artifact

## Timeline

| Date | Gate |
|---|---|
| 2026-04-17 | Design locked |
| 2026-04-30 | Partner creds secured (Sylvie + locale contacted) |
| 2026-05-15 | `_adapter.ts` interface + Sylvie adapter shipped to staging |
| 2026-06-01 | locale.network adapter shipped |
| 2026-06-15 | Admin UI verification badges live in Season One gardens |
| 2026-06-30 | Outcome: 2 partners × ≥1 attestation/week in pilot garden |

## Risks

1. **Partner API access delays** — mitigation: start outreach week of 2026-04-20.
2. **Data quality variance** — partners may return noisy/low-confidence data for many submissions. Mitigation: confidence thresholds + display bands make this visible, not blocking.
3. **EAS write cost on Arbitrum** — ~$0.01/attestation. At 100 attestations/week = $4/month. Acceptable.
4. **locale.network scope unknown** — adapter estimate is placeholder until we scope their API.
