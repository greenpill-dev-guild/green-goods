---
title: Reputation & Badging — Design
epic: Epic — Reputation & Badging
outcome: Badges live across 3+ pilot gardens, portable across sibling projects
quarter: Q2 2026
due: 2026-06-30
status: Draft
owner: afo
last_updated: 2026-04-17
---

# Reputation & Badging — Design

## Goal

Launch a **6-badge reputation system** anchored by Unlock Protocol locks + EAS attestations, issued automatically by the Greenwill service watching Green Goods data. Badges are **portable** — recognized by sibling projects (Coop, WEFA) via shared identity + attestation infra.

Outcome metric: 6 badge types deployed, active in 3+ pilot gardens, with cross-project recognition demonstrated in at least one sibling project.

## Decisions (locked during brainstorm)

| # | Decision | Value |
|---|---|---|
| 1 | Badge purpose | Reputation + access gating + portable cross-project identity |
| 2 | Q2 taxonomy | All 6 badges (Verified Gardener, Active Contributor, Stewardship, Garden Operator, Community Builder, Impact Verified) |
| 3 | Issuance mechanism | Greenwill background service (#457) watches Green Goods data, grants Unlock keys + writes EAS attestations |
| 4 | Portability mechanism | Shared EAS schemas + Unlock locks recognizable by any EIP-compliant consumer |

## Architecture

```
┌─ packages/agent (or new packages/greenwill) ─────────────────────┐
│                                                                  │
│  badges/                                                         │
│    _registry.ts         NEW · BadgeDefinition registry           │
│    verified-gardener.ts NEW · criterion evaluator                │
│    active-contributor.ts NEW                                     │
│    stewardship.ts       NEW                                      │
│    garden-operator.ts   NEW                                      │
│    community-builder.ts NEW                                      │
│    impact-verified.ts   NEW                                      │
│                                                                  │
│  services/                                                       │
│    greenwillIssuer.ts   NEW · main loop                          │
│    unlockClient.ts      NEW · grant Unlock keys                  │
│    easBadgeWriter.ts    NEW · create attestations                │
│                                                                  │
│  handlers/                                                       │
│    cron: evaluate-badges  NEW · periodic eval per user           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌─ packages/contracts ─────────────────────────────────────────────┐
│  deployments/{chainId}-latest.json — add 6 Unlock lock addrs     │
│  deployments/{chainId}-latest.json — add 1 shared EAS schema UID │
│  (actual locks deployed via Unlock factory — no custom contract) │
└──────────────────────────────────────────────────────────────────┘

┌─ Unlock Protocol (existing, on Arbitrum) ────────────────────────┐
│  6 locks (one per badge) — ERC-721 keys                          │
│    · non-transferable (soulbound option)                         │
│    · key manager = greenwill issuer address                      │
│    · expiration = varies per badge (Active Contributor = 1yr)    │
└──────────────────────────────────────────────────────────────────┘

┌─ EAS (existing, on Arbitrum) ────────────────────────────────────┐
│  Schema: GreenGoodsBadge                                         │
│    {                                                             │
│      badgeType: string,        // enum of 6 badges               │
│      recipient: address,                                         │
│      earnedAt: uint40,         // UNIX                           │
│      evidenceUri: string,      // IPFS CID: submission IDs, etc. │
│      tier: uint8               // for tiered badges (0=bronze..) │
│    }                                                             │
└──────────────────────────────────────────────────────────────────┘

┌─ packages/shared ────────────────────────────────────────────────┐
│  hooks/useBadges(address)    NEW  · queries EAS + Unlock         │
│  modules/badges.ts           NEW  · display metadata (name,      │
│                                     icon, description, tier fmt) │
└──────────────────────────────────────────────────────────────────┘

┌─ packages/client + packages/admin ───────────────────────────────┐
│  components/Profile/BadgeShelf    NEW · grid of earned badges    │
│  components/Profile/BadgeDetail   NEW · modal: criteria, date,   │
│                                        evidence link             │
└──────────────────────────────────────────────────────────────────┘
```

## Badge Taxonomy (Q2)

| Badge | Criterion | Issuance cadence | Key expiry |
|---|---|---|---|
| **Verified Gardener** | First work submission approved | On approval event | Lifetime |
| **Active Contributor** | 10 approved submissions in rolling quarter | Daily eval | 1 year (renews) |
| **Stewardship** | 30+ approved, 3+ months active | Daily eval | Lifetime |
| **Garden Operator** | Holds operator Hat on ≥1 garden | Daily eval | While role held |
| **Community Builder** | Onboarded 5+ gardeners to a garden | Daily eval | Lifetime |
| **Impact Verified** | ≥1 Hypercert minted from their work | On mint event | Lifetime |

Each badge = one Unlock lock + one EAS attestation. Attestation is the permanent record; Unlock key is the access credential.

## `BadgeDefinition` interface

```typescript
interface BadgeDefinition {
  id: string;                   // "verified-gardener" | ...
  displayName: string;
  lockAddress: Address;         // Unlock lock
  easSchemaUid: string;         // EAS schema UID
  evaluate(user: Address, context: EvalContext): Promise<BadgeEvalResult | null>;
  cadence: 'on-event' | 'daily';
}

interface BadgeEvalResult {
  earned: boolean;
  tier?: number;
  evidence: string[];           // IDs of submissions / hats / hypercerts
  earnedAt: number;
}
```

## Issuance flow

**Event-driven (`on-event`):**
```
1. Green Goods event fires (WorkApproved, HypercertMinted, HatMinted)
2. Greenwill subscribes via Envio GraphQL subscription
3. For each event, runs applicable badge evaluators
4. If earned(user, badge) AND not already issued:
   - Upload evidence JSON to IPFS
   - Call unlockClient.grantKey(lockAddress, user)
   - Call easBadgeWriter.attest(schemaUid, { recipient, earnedAt, evidenceUri })
5. Log BadgeIssued(badgeId, user, evidenceUri, txHash)
```

**Daily cron (`daily`):**
```
1. Cron runs at 00:00 UTC
2. Iterate all known users (from Envio)
3. For each user × each daily-cadence badge:
   evaluate() → if earned and not issued → issue
4. Also refresh expiring keys (Active Contributor expires after 1y → re-eval)
```

## Portability

EAS attestations are universal — any wallet, any dApp, any chain with EAS can read them. Unlock keys are ERC-721 — any dApp can check `balanceOf(user, lock)`.

**Sibling-project recognition pattern:**
- Coop (browser extension) reads EAS attestations by wallet → shows badge shelf in its profile panel
- WEFA (game PWA) uses Unlock key ownership to gate access to premium game features

Green Goods ships the **issuance side**. Recognition is sibling-project work (coordinated via shared infra, not duplicated in this epic).

Schema UIDs + lock addresses recorded in `deployments/{chainId}-latest.json` so sibling projects have a canonical source.

## Admin UI

`views/Community` + `views/Profile` get a **Badge Shelf** component:
- Earned badges in color with tier indicator
- Unearned badges in grayscale with criteria tooltip
- Click a badge → detail modal with evidence timeline

No new admin-only operations — badge issuance is fully automatic.

## Client PWA

Same `BadgeShelf` component — client is read-only display. Gardener sees their own shelf on profile.

## Edge Cases

- **Criterion retroactively met** — daily cron catches up existing qualifying users (backfill on first run).
- **Criterion un-met (e.g., operator revoked)** — Garden Operator badge has `cadence=daily` + `expiry=while-role-held`; cron revokes the Unlock key but leaves attestation (attestation is history, key is access).
- **User changes wallet** — new wallet = new badges; no migration. Social recovery via Pimlico should preserve wallet.
- **Issuance failure partway through** — retry queue in Greenwill service; idempotent via `BadgeIssued` log lookup.

## Testing

| Layer | Scope |
|---|---|
| Unit | Each `evaluate()` function with mocked Envio data |
| Integration | `greenwillIssuer.ts` event loop against forked testnet |
| E2E | Seed test data on fork → run cron → assert 6 Unlock keys + 6 `GreenGoodsBadge` attestations under the shared schema exist |

## Observability

- Per-badge issuance count (daily)
- Per-user badge count
- Failed issuance queue depth (alert if >10)
- Greenwill cron heartbeat

## Out of Q2 Scope

- Badge revocation UX beyond role-based expiry
- Tier upgrades (bronze → silver → gold within same badge)
- Community-proposed badges (governance)
- Cross-chain badge bridging
- Badge-gated features within Green Goods itself (Q3 — currently decorative + portable, not yet used as access gate in GG admin/client)

## Timeline

| Date | Gate |
|---|---|
| 2026-04-17 | Design locked |
| 2026-04-25 | 6 Unlock locks deployed on Arbitrum; 1 shared `GreenGoodsBadge` EAS schema registered |
| 2026-05-15 | Greenwill service skeleton (#457) complete with 2 badge evaluators |
| 2026-06-01 | All 6 evaluators live in staging |
| 2026-06-15 | Admin + client Badge Shelf components shipped |
| 2026-06-30 | Outcome: badges active in 3+ pilot gardens |

## Risks

1. **Envio subscription reliability for event-driven issuance** — fallback to daily cron catches misses.
2. **Unlock Protocol Arbitrum availability** — Unlock has stable Arbitrum deployment; low risk.
3. **Sibling-project recognition not ready in Q2** — design-for-portability still works; cross-project demo may slip to Q3. Outcome metric ("portable") includes "demonstrated in at least one sibling project" — may need to narrow if sibling-project teams can't prioritize.
4. **Soulbound transferability** — Unlock supports non-transferable locks; must be configured at lock creation.
