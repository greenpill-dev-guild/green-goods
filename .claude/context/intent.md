# Organizational Intent

<!-- last_synced: 2026-02-28 | source: CharmVerse > Regen Stack > Green Goods -->
<!-- Maintenance: review quarterly. Sync grant context and decision heuristics with CharmVerse. -->

Loaded for decisions requiring organizational context: feature prioritization, impact trade-offs, community-aware UX, strategic alignment.

For full context, read the docs:
- Mission & Values: `docs/docs/concepts/mission-and-values.mdx`
- Impact Model: `docs/docs/concepts/impact-model.mdx`
- Strategy & Goals: `docs/docs/concepts/strategy-and-goals.mdx`
- Communities: `docs/docs/concepts/communities.mdx`

## Agent Decision Heuristics

### When features conflict with organizational goals
1. Features advancing Capital Formation + Impact Accessibility > Governance only
2. Features serving LATAM communities > features for enterprise polish
3. Gardener-facing simplicity > technical correctness visible to Gardener
4. Field-tested action schemas > theoretically complete schemas

### When making UX judgment calls
- Gardener perceives Green Goods as "a helpful WhatsApp contact that pays them for work"
- Funder perceives it as "a high-yield savings account that heals the planet"
- Evaluator perceives it as "a data-rich platform for certifying truth"
- Never use blockchain vocabulary in Gardener-facing copy
- 5-sided marketplace: labor, management, capital, verification, community benefit

### When evaluating impact on real communities
- 20 active garden communities, primarily LATAM
- University of Nigeria Nsukka: solar infrastructure (power outages common)
- AgroforestryDAO Brasil: scientific data partnerships (Portuguese required)
- Uganda: school-tree assignments (mobile-first, low bandwidth)
- Offline-first is not abstract — it means field workers during power outages

### When touching action schemas or work submissions
- Every action must maintain the CIDS chain: Activity → Output → Outcome → Impact
- Removing evidence capture (photos) breaks the entire verification model
- 8 Forms of Capital frame assessment scope (not just financial)
- Core actions (7) available in ALL gardens; domain-specific actions are opt-in

### Economic context for priority decisions
- Target: 150 Gardeners, 1,500 actions/month, 30 Hypercerts/month
- Monthly ops cost: ~$195 (gas + IPFS + infra + monitoring)
- Break-even TVL: ~$60k minimum, ~$100-200k target
- B2B2C: Operators onboard Gardeners (zero acquisition cost via passkeys)

### Grant context for scope decisions

Each major feature set maps to a specific grant. When a feature request or bug touches one of these areas, scope the work to that grant's deliverables.

| Grant | Features Funded |
|---|---|
| **Arb in ReFi Grant** | App Home, Garden, Work, Insights, Assessments, Gardeners, Garden details |
| **Arb New Ideas Grant** | Governance, Garden Pools (Voting), Funding, Vaults, Hypercerts, Impact |
| **RealFi Hackathon** | Details, Gardens Filter, Work Dashboard (Recent/Pending/Completed) |
| **VeBetter Rewards** | Wallet, Cookies (Payouts), Send |
| **Unlock Celo Grant** | Hats (Roles), Trust Graph (Reputation) |
| **Octant Epoch 10** | Revnet & Streams (Revenue) |
| **Celo/Grassroots Grant** | Commitment Pools (Vouchers) |

**Decision heuristic**: When a feature request maps to a specific grant, scope it to that grant's deliverables. Features spanning multiple grants need explicit prioritization from the team — do not assume cross-grant scope without confirmation.
