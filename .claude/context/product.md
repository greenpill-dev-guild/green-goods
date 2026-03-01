# Product Context

Loaded for product-facing decisions: UX trade-offs, feature scoping, copy/messaging, user-impact assessments.

## Core Thesis

Verified, low-friction impact capture + standardized reporting + funding primitives (yield-to-impact + tokenized certificates) reduce verification/reporting overhead enough to unlock consistent funding for grassroots regenerative projects.

## Positioning

Green Goods is the verified impact operations layer for community-led regeneration -- capture evidence in the field, validate it locally, export funder-ready impact reporting with cryptographic public verification.

## User Archetypes (Priority Order)

| # | Archetype | What They Want | Primary Constraint | Tech Comfort |
|---|-----------|----------------|-------------------|--------------|
| 1 | **Gardener** | Rewards, recognition, impact visibility | Low connectivity, low patience for forms | None assumed |
| 2 | **Garden Operator** | Find opportunities/resources for community | Admin overhead, reporting burden | Moderate |
| 3 | **Evaluator** | Uphold expertise, iterate methodologies, gather research insights | Time, domain complexity | Moderate-high |
| 4 | **Funder** | Verified impact for funding confidence | Budget/allocation strategy, trust | Varies |
| 5 | **Community Member** | Community improvements, better resources | Awareness, access | None assumed |

**Decision rule:** When two archetypes conflict, resolve in priority order. Gardener experience wins unless doing so blocks Operator onboarding (Operators are the distribution channel).

## UX Quality Bars

### Gardener (Client PWA)

| Acceptable | Unacceptable |
|------------|--------------|
| Stale data with staleness indicator | Loading spinner blocking form access |
| 3-tap work submission (select action, capture photo, submit) | More than 5 taps to submit work |
| Delayed sync confirmation ("will upload when online") | Silent failure with no feedback |
| Passkey auth with zero blockchain vocabulary | Seed phrase, gas fee prompts, chain switching |
| Graceful degradation on 2G/3G | Features that require persistent connectivity |

### Operator (Admin Dashboard)

| Acceptable | Unacceptable |
|------------|--------------|
| Page load under 3s on broadband | Blank screens during data fetches |
| Batch operations for common tasks | One-at-a-time actions for bulk work |
| Temporarily degraded UI during iteration | Data loss or silent mutation failures |
| Configuration requiring documentation reference | Configuration requiring Solidity knowledge |

### Evaluator

| Acceptable | Unacceptable |
|------------|--------------|
| Assessment form requiring 2-3 minutes | Assessment requiring blockchain transaction awareness |
| Structured rubric with clear criteria | Free-text-only assessment with no guidance |

### Funder

| Acceptable | Unacceptable |
|------------|--------------|
| Dashboard with 24h data lag | Unverifiable or self-reported impact claims |
| Export-ready reports requiring minor formatting | Raw attestation data requiring technical parsing |

## Product Trade-Off Hierarchy

Resolve conflicts in this order (highest priority first):

1. **Gardener submission friction** -- Nothing blocks the <2 min capture flow
2. **Data integrity** -- Attestations are correct and verifiable, never fabricated
3. **Offline resilience** -- Operations queue and sync, never silently fail
4. **Operator efficiency** -- Reduce reporting/admin overhead per garden
5. **Funder legibility** -- Impact data is export-ready and auditable
6. **Feature breadth** -- New capabilities only after core flow is solid

## Feature Priority Framework

### Ship Now (Q1 2026)

- Impact reporting connected to capital formation
- User testing infrastructure
- Client UX stability (minimal degradation)

### Ship Next

- Agent-based impact reporting (WhatsApp/Telegram bots)
- IoT + AI integrations for evidence capture
- Unlock token badging for gardener credentials

### Ship Later

- RevNet tokenization
- Community stable coins
- Bio-regional quadratic funding streams

### Do Not Build

- Features requiring always-online connectivity
- Self-custodial wallet flows for Gardeners
- Real-time dashboards (event-driven with acceptable lag is fine)
- Carbon credit issuance or offset marketplace

## Development Status

| Package | Stability | Expectation |
|---------|-----------|-------------|
| Client | UX flow settled | Minimal degradation -- treat as production |
| Admin | Structure in flux | Changes and degradation expected -- iterate fast |
| Contracts | Deployed, upgrading | Changes require upgrade scripts and re-verification |
| Indexer | Stable schema | Schema changes need migration plan |

## GTM Model

- **B2B2C**: Operators onboard Gardeners. Gardener acquisition cost is effectively zero (passkeys + gas sponsorship).
- **Revenue**: Operators ($49-$1000/mo per Garden), Funders ($2k-$50k/yr for dashboards).
- **Sustainability**: Yield-backed via Octant vault (~$100k-$200k TVL target for self-sustaining ops).

**Implication for agents:** Operator setup friction directly impacts revenue. Gardener friction directly impacts retention. Optimize both paths aggressively.

## Messaging Constraints

### Use

- "Evidence capture and verification workflow"
- "Verified impact reporting"
- "Community-validated regenerative work"
- "Cryptographic proof of impact"
- "On-chain impact records"

### Avoid

- "Carbon credits" or "carbon offsets"
- "Climate neutral" or "net zero"
- "Tokenized carbon"
- "Impact certificates" as a standalone value prop (always pair with verification workflow)
- "Web3" or "blockchain" in Gardener-facing copy
- "Decentralized" as a feature (it is an implementation detail)

**Rule:** Gardener-facing copy must be comprehensible to someone who has never heard of Ethereum. Operator/Funder copy may reference on-chain verification as a trust mechanism.

## Competitive Differentiation

| Differentiator | Why It Matters |
|----------------|----------------|
| Last-mile proof capture (offline-first PWA, <2 min) | Reaches gardeners where connectivity fails |
| Human community verification (Operator-led) | Not self-report, not remote sensing -- local trust |
| Composable on-chain records (EAS attestations) | Interoperable impact data, not siloed |
| Capital formation primitives (yield + Hypercerts) | Funding follows verified impact automatically |

## Privacy Boundary

- **Minimize on-chain PII**: No names, emails, or phone numbers in attestation data.
- **Addresses are pseudonymous**: Do not build features that link wallet addresses to real-world identity on-chain.
- **Media storage**: IPFS hashes on-chain, media files off-chain. Never store raw images in attestation data.
- **Operator discretion**: Operators manage gardener identity mapping off-chain. The protocol does not enforce or store this mapping.

## Escalate Product Decisions When

- A feature trade-off pits Gardener friction against data integrity
- Copy or UI implies carbon credit / offset functionality
- A change would expose PII on-chain (even indirectly via attestation fields)
- Funder-facing reporting accuracy conflicts with Operator workflow simplicity
- The feature is not on the priority framework and would take more than 2 days to implement
- Gardener-facing UX requires blockchain vocabulary or wallet interaction

## Related Context
- Organizational mission and values → `docs/docs/concepts/mission-and-values.mdx`
- Impact model (CIDS) and action domains → `docs/docs/concepts/impact-model.mdx`
- Strategic goals, metrics, economic model → `docs/docs/concepts/strategy-and-goals.mdx`
- Real communities and localization → `docs/docs/concepts/communities.mdx`
- Agent decision heuristics → `.claude/context/intent.md`
